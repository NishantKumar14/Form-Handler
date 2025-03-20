import express from "express";
import path,{ join } from "path";
import { fileURLToPath } from "url";
import ejsMate from "ejs-mate";
import MongoDBStore from "connect-mongo";
import Session from "express-session";
import nodemailer from "nodemailer";
import ShortUniqueId from "short-unique-id";
import { User } from "./models/users.model.js";
import { Form } from "./models/form.model.js";
import { requireLogin } from "./middlewares/auth.middleware.js";

const app = express();

app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
const __dirname = fileURLToPath(new URL(".", import.meta.url));
app.set("views", join(__dirname, "views"));

app.use(express.static(path.join(process.cwd(), "src/public")));
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));

const secret = process.env.SECRET || "thisshouldbebettersecret!";

const store = MongoDBStore.create({
    mongoUrl: process.env.MONGODB_URI,
    touchAfter: 24 * 60 * 60,
    crypto: {
        secret,
    },
});

store.on("error", function (err) {
    console.log("Session store error ", err);
});

const sessionConfig = {
    store,
    name: "sessionHell",
    secret,
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        // secure: true,
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
        maxAge: 1000 * 60 * 60 * 24 * 7,
    },
};

app.use(Session(sessionConfig));

app.use(async (req, res, next) => {
    res.locals.url = req.url;
    if (!req.session.user_id) {
        res.locals.currentUser = "";
        res.locals.currentUsername = "";
    } else {
        try {
            const user = await User.findById(req.session.user_id);
            if (user) {
                res.locals.currentUser = user._id;
                res.locals.currentUsername = user.username;
            }
        } catch (error) {
            console.error(error);
        }
    }
    next();
});

const sendMail = async (data, emailAdd, username) => {
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL,
            pass: process.env.EMAIL_PASS,
        },
    });

    const mailOptions = {
        from: process.env.EMAIL,
        to: emailAdd,
        subject: `Form Data for ${username}`,
        html: data,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log("Email sent successfully");
    } catch (error) {
        console.error("Error sending email:", error);
    }
};

app.get("/", (req, res) => res.render("home"));
app.get("/success", (req, res) => res.render("success"));
app.get("/contact", (req, res) => res.render("contact"));
app.get("/how-to-use", (req, res) => res.render("how-to-use"));
app.get("/register", (req, res) => res.render("register"));
app.get("/login", (req, res) => res.render("login"));
app.get("/failed", (req, res) => res.render("failed"));

app.get("/admin", requireLogin, async (req, res) => {
    try {
        const uid = req.session.user_id;
        const docs = await User.findById(uid);
        if (docs?.isAdmin) {
            const userdocs = await User.find({});
            res.render("admin", { userdocs });
        } else {
            res.render("message", { msgcode: "7" });
        }
    } catch (error) {
        console.error("Error fetching admin panel:", error);
        res.status(500).json({
            status: "failed",
            description: "Internal server error",
        });
    }
});

app.get("/url", requireLogin, async (req, res) => {
    try {
        const uid = req.session.user_id;
        const docs = await User.findById(uid);
        if (docs) {
            res.render("url", {
                username: docs.username,
                formids: docs.formsid,
            });
        } else {
            res.render("message", { msgcode: "1" });
        }
    } catch (error) {
        console.error("Error fetching user URLs:", error);
        res.status(500).json({
            status: "failed",
            description: "Internal server error",
        });
    }
});

app.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        const foundUser = await User.findAndValidate(username, password);

        if (foundUser) {
            req.session.user_id = foundUser._id;
            const redirectUrl = req.session.returnTo || "/";
            delete req.session.returnTo;
            return res.redirect(redirectUrl);
        }

        res.render("message", { msgcode: "2" });
    } catch (error) {
        console.error("Error logging in:", error);
        res.status(500).json({
            status: "failed",
            description: "Internal server error",
        });
    }
});

app.post("/contact", (req, res) => {
    try {
        const data = Object.entries(req.body);
        let mailData = `Contact Form Submission`;
        mailData += `<br>---------------------------<br>`;

        for (const [key, value] of data) {
            mailData += `${key.toUpperCase()} : ${value}<br>`;
        }

        mailData += `---------------------------<br>`;
        sendMail(mailData, "admin@formhandler.xyz", "Form Handler");
        res.render("success");
    } catch (error) {
        console.error("Error processing contact form:", error);
        res.status(500).json({
            status: "failed",
            description: "Internal server error",
        });
    }
});

app.post("/register", async (req, res) => {
    try {
        const { username, password, name, email, phoneNum } = req.body;
        const isAdmin = username === "anubhav";

        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.render("message", { msgcode: "3" });
        }

        const user = new User({
            username,
            password,
            name,
            email,
            phoneNum,
            isAdmin,
        });

        await user.save();
        req.session.user_id = user._id;
        res.redirect("/");
    } catch (error) {
        console.error("Error registering user:", error);
        res.status(500).json({
            status: "failed",
            description: "Internal server error",
        });
    }
});


app.get("/create-forms", requireLogin, (req, res) =>
    res.render("create-forms")
);

app.post("/create-forms", requireLogin, async (req, res) => {
    try {
        let { formTitle, redirectURL } = req.body;
        if (!redirectURL) {
            redirectURL = "https://confused-tan-elk.cyclic.app/success";
        }

        const uuid = nanoid(10);
        const uid = req.session.user_id;

        const userdocs = await User.findByIdAndUpdate(
            uid,
            {
                $push: { formsid: uuid },
            },
            { new: true }
        );

        if (!userdocs) {
            return res
                .status(500)
                .json({ status: "failed", description: "User update failed" });
        }

        const docs = await Form.create({
            formTitle,
            redirectUrl: redirectURL,
            formid: uuid,
            username: userdocs.username,
        });

        if (!docs) {
            return res
                .status(500)
                .json({
                    status: "failed",
                    description: "Form creation failed",
                });
        }

        res.render("url", { docs });
    } catch (error) {
        console.error("Error creating form:", error);
        res.status(500).json({
            status: "failed",
            description: "Internal server error",
        });
    }
});


app.get("/form/:user", requireLogin, async (req, res) => {
    try {
        const { user: username } = req.params;
        const docs = await User.findOne({ username });
        if (!docs) {
            return res.render("user", { docs: null });
        }
        const userdocs = await Form.find({ username });
        res.render("user", { userdocs });
    } catch (error) {
        console.error("Error fetching user forms:", error);
        res.status(500).render("user", { docs: null });
    }
});

app.post("/form/delete/:fid", async (req, res) => {
    try {
        const { fid } = req.params;
        const uidd = req.session.user_id;

        const docs = await Form.findOneAndDelete({ formid: fid });
        if (!docs) {
            return res
                .status(404)
                .json({ status: "failed", description: "Form not found" });
        }

        const userdocs = await User.findByIdAndUpdate(
            uidd,
            {
                $pull: { formsid: fid },
            },
            { new: true }
        );

        if (!userdocs) {
            return res
                .status(500)
                .json({
                    status: "failed",
                    description: "Error updating user data",
                });
        }

        res.json({
            status: "success",
            description: "Form deleted successfully",
        });
    } catch (error) {
        console.error("Error deleting form:", error);
        res.status(500).json({
            status: "failed",
            description: "Internal server error",
        });
    }
});

app.get("/form/:user/:formid", async (req, res) => {
    try {
        const { user: username, formid } = req.params;
        const userdocs = await User.findOne({ username });

        if (!userdocs) {
            return res.status(404).json({
                status: "failed",
                description: "Form is not yet created",
            });
        }

        if (!userdocs.formsid.includes(formid)) {
            return res.status(403).json({
                status: "failed",
                description: "Form is not accepting submissions",
            });
        }

        res.json({
            status: "success",
            description: "Form is currently active and accepting submissions",
        });
    } catch (error) {
        console.error("Error fetching form status:", error);
        res.status(500).json({
            status: "failed",
            description: "Internal server error",
        });
    }
});

app.post("/form/:user/:formid", async (req, res) => {
    try {
        const { user: username, formid } = req.params;
        const userdocs = await User.findOne({ username });

        if (!userdocs) {
            return res.status(404).json({
                status: "failed",
                description: "Form is not yet created",
            });
        }

        if (!userdocs.formsid.includes(formid)) {
            return res.status(403).json({
                status: "failed",
                description: "Form is not accepting submissions",
            });
        }

        const docs = await Form.findOne({ formid });
        if (!docs) {
            return res.status(404).json({
                status: "failed",
                description: "Form not found",
            });
        }

        const data = Object.entries(req.body)
            .map(([key, value]) => `${key.toUpperCase()} : ${value}`)
            .join("<br>");

        const mailData = `Form Submission for ${username} on ${formid}<br>---------------------------<br>${data}<br>---------------------------<br>`;

        try {
            await sendMail(mailData, userdocs.email, username);
            res.redirect(docs.redirectUrl);
        } catch (error) {
            console.error("Error sending email:", error);
            res.status(500).json({
                status: "failed",
                description: "Email sending failed",
            });
        }
    } catch (error) {
        console.error("Error processing form submission:", error);
        res.status(500).json({
            status: "failed",
            description: "Internal server error",
        });
    }
});


app.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/");
    });
});

app.use((req, res) => res.status(404).render("message", { msgcode: "6" }));

export { app };
