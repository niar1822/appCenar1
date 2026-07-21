import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { CommerceType } from "../models/CommerceType.model.js";
import { Config } from "../models/Config.model.js";
import { User } from "../models/User.model.js";

const defaultCommerceTypes = [
    {
        nombre: "Restaurante",
        descripcion: "Comidas preparadas y menus",
        icono: "/images/commerce-type-placeholder.svg"
    },
    {
        nombre: "Supermercado",
        descripcion: "Compras del hogar y viveres",
        icono: "/images/commerce-type-placeholder.svg"
    },
    {
        nombre: "Farmacia",
        descripcion: "Medicinas y productos de cuidado",
        icono: "/images/commerce-type-placeholder.svg"
    }
];

const cleanEnv = (value) => {
    if (typeof value !== "string") {
        return "";
    }

    return value.trim().replace(/^["']|["']$/g, "");
};

const bootstrapAdminFromEnv = async () => {
    const adminsCount = await User.countDocuments({ role: "admin" });

    if (adminsCount > 0) {
        console.log("Bootstrap admin omitido: ya existe al menos un admin");
        return;
    }

    const ADMIN_NAME = cleanEnv(process.env.ADMIN_NAME);
    const ADMIN_LASTNAME = cleanEnv(process.env.ADMIN_LASTNAME);
    const ADMIN_EMAIL = cleanEnv(process.env.ADMIN_EMAIL).toLowerCase();
    const ADMIN_USERNAME = cleanEnv(process.env.ADMIN_USERNAME);
    const ADMIN_PASSWORD = cleanEnv(process.env.ADMIN_PASSWORD);
    const ADMIN_CEDULA = cleanEnv(process.env.ADMIN_CEDULA);

    if (!ADMIN_NAME || !ADMIN_LASTNAME || !ADMIN_EMAIL || !ADMIN_USERNAME || !ADMIN_PASSWORD || !ADMIN_CEDULA) {
        console.log("No se creo admin inicial: faltan variables ADMIN_* o estan vacias");
        return;
    }

    const exists = await User.findOne({
        $or: [
            { email: ADMIN_EMAIL },
            { username: ADMIN_USERNAME }
        ]
    });

    if (exists) {
        console.log(`Bootstrap admin omitido: ya existe usuario con email o username del admin (${exists._id})`);
        return;
    }

    await User.create({
        nombre: ADMIN_NAME,
        apellido: ADMIN_LASTNAME,
        cedula: ADMIN_CEDULA,
        email: ADMIN_EMAIL,
        username: ADMIN_USERNAME,
        password: await bcrypt.hash(ADMIN_PASSWORD, 10),
        role: "admin",
        activo: true
    });

    console.log("Admin inicial creado desde variables de entorno");
};

export const connectDB = async () => {
    try {
        const env = cleanEnv(process.env.APP_ENV || process.env.NODE_ENV || "development");
        const mongoUri = env === "qa"
            ? cleanEnv(process.env.MONGO_URI_QA) || cleanEnv(process.env.MONGO_URI)
            : env === "production"
                ? cleanEnv(process.env.MONGO_URI_PROD) || cleanEnv(process.env.MONGO_URI)
                : cleanEnv(process.env.MONGO_URI_DEV) || cleanEnv(process.env.MONGO_URI);

        if (!mongoUri) {
            throw new Error(`No hay cadena de Mongo configurada para el entorno "${env}"`);
        }

        await mongoose.connect(mongoUri);
        await Config.findOneAndUpdate(
            {},
            { $setOnInsert: { itbis: 18 } },
            { upsert: true, returnDocument: "after" }
        );
        const typesCount = await CommerceType.countDocuments();

        if (typesCount === 0) {
            await CommerceType.insertMany(defaultCommerceTypes);
        }

        await bootstrapAdminFromEnv();

        console.log(`MongoDB conectado (${env})`);
        return mongoUri;
    } catch (error) {
        console.log(error);
        throw error;
    }
};
