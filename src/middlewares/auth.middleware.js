// import { User } from "../models/users.model";

export const requireLogin = (req, res, next) => {
    try {
        if (!req.session?.user_id) {
            req.session.returnTo = req.originalUrl;
            return res.redirect("/login");
        }
        next();
    } catch (error) {
        console.error("Error in requireLogin middleware:", error);
        next(error);
    }
};

// const setLocal = async (req, res, next) => {
//     try {
//         res.locals = {
//             url: req.url,
//             currentUser: req.session.user_id || "",
//             currentUsername: "",
//         };

//         if (req.session.user_id) {
//             const user = await User.findById(req.session.user_id); // User -> Not define
//             if (user) {
//                 res.locals.currentUsername = user.username;
//             }
//         }

//         next();
//     } catch (error) {
//         console.error("Error in setLocal middleware: ", error);
//         next(error);
//     }
// };

// export { requireLogin, setLocal };
