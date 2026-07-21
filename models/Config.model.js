import mongoose from "mongoose";

const configSchema = new mongoose.Schema({
    itbis: {
        type: Number,
        required: true,
        default: 18
    }
}, { timestamps: true });

export const Config = mongoose.model("Config", configSchema);
