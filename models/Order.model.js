import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
    cliente: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },

    productos: [
        {
            productoId: String,
            nombre: String,
            imagen: String,
            precio: Number,
            cantidad: Number
        }
    ],

    subtotal: Number,
    itbis: Number,
    total: Number,

    estado: {
        type: String,
        enum: ["pendiente", "preparando", "listo", "en proceso", "completado", "cancelado"],
        default: "pendiente"
    },

    delivery: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    comercio: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    direccionEntrega: {
        direccion: String,
        alias: String,
        referencia: String
    },
    numeroPedido: String
}, { timestamps: true });

export const Order = mongoose.model("Order", orderSchema);
