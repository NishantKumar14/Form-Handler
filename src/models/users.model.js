import mongoose from "mongoose";
import bcrypt from "bcrypt";

const userSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: [true, "Username is required."],
            unique: true,
            lowercase: true,
            trim: true,
            index: true,
        },
        password: {
            type: String,
            required: [true, "Password is required."],
        },
        fullName: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        phoneNumber: {
            type: String,
            required: true,
        },
        formsId: {
            type: [String],
            required: true,
        },
        isAdmin: {
            type: Boolean,
            required: true,
        },
    },
    { timestamps: true }
);

userSchema.statics.findAndValidate = async function (username, password) {
    const foundUser = await this.findOne({
        username: username,
    });
    if (!foundUser) {
        return false;
    }
    const isValid = await bcrypt.compare(password, foundUser.password);
    return isValid ? foundUser : false;
};

userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) {
        return next();
    }
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

export const User = mongoose.model("User", userSchema);
