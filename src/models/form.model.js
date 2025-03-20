import mongoose from "mongoose";

const formSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
        },
        formTitle: {
            type: String,
            requried: true,
        },
        formId: {
            type: String,
            required: true,
        },
        redirectUrl: {
            type: String,
            required: true,
        },
    },
    { timestamps: true }
);

export const Form = mongoose.model("Form", formSchema);
