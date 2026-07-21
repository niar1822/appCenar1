import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
    nombre: String,
    precio: Number,
    descripcion: String,
    imagen: String,
    categoria: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        default: null
    },

    comercio: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }
}, { timestamps: true });

export const Product = mongoose.model("Product", productSchema);
