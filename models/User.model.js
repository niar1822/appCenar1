import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    nombre: String,
    apellido: String,
    telefono: String,
    foto: String,
    email: {
        type: String,
        unique: true
    },
    username: {
        type: String,
        unique: true
    },
    password: String,
    cedula: String,
    role: {
        type: String,
        enum: ["cliente", "delivery", "comercio", "admin"]
    },
    horarioApertura: String,
    horarioCierre: String,
    tipoComercio: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CommerceType",
        default: null
    },
    activo: {
        type: Boolean,
        default: false
    },
    token: String // para activación o reset
}, { timestamps: true });

export const User = mongoose.model("User", userSchema);
