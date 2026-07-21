import mongoose from "mongoose";

const commerceTypeSchema = new mongoose.Schema({
    nombre: {
        type: String,
        required: true,
        trim: true
    },
    descripcion: {
        type: String,
        required: true,
        trim: true
    },
    icono: {
        type: String,
        required: true
    }
}, { timestamps: true });

export const CommerceType = mongoose.model("CommerceType", commerceTypeSchema);
