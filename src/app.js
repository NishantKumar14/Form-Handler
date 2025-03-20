import express from "express";
import ejsMate from "ejs-mate";
import MongoDBStore from "connect-mongo";
import Session from "express-session";

const app = express();

app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", "views");

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


// Routes

export { app };
