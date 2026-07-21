import mongoose from "mongoose";

const addressSchema = new mongoose.Schema({
    cliente: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    alias: {
        type: String,
        required: true,
        trim: true
    },
    direccion: {
        type: String,
        required: true,
        trim: true
    },
    referencia: {
        type: String,
        default: "",
        trim: true
    }
}, { timestamps: true });

export const Address = mongoose.model("Address", addressSchema);
