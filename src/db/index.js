import mongoose from "mongoose";
import express from "express";
import { DB_NAME } from "../constant.js"

const connectDB = async () => {
    try {
        const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
        console.log(`\nMONGODB CONNECTED !!! DB HOST: ${connectionInstance.connection.host}`)
    } catch (error) {
        console.error("MONGODB CONNECTION FAILED ", error);
        process.exit(1);
    }
}

export default connectDB;
 