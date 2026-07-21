import bcrypt from "bcrypt";
import { Category } from "../models/Category.model.js";
import { CommerceType } from "../models/CommerceType.model.js";
import { Config } from "../models/Config.model.js";
import { Favorite } from "../models/Favorite.model.js";
import { Order } from "../models/Order.model.js";
import { Product } from "../models/Product.model.js";
import { User } from "../models/User.model.js";

export const adminDashboard = async (req, res) => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [
        totalOrders,
        todayOrders,
        activeComercios,
        inactiveComercios,
        activeClientes,
        inactiveClientes,
        activeDelivery,
        inactiveDelivery,
        productsCount
    ] = await Promise.all([
        Order.countDocuments(),
        Order.countDocuments({ createdAt: { $gte: startOfDay } }),
        User.countDocuments({ role: "comercio", activo: true }),
        User.countDocuments({ role: "comercio", activo: false }),
        User.countDocuments({ role: "cliente", activo: true }),
        User.countDocuments({ role: "cliente", activo: false }),
        User.countDocuments({ role: "delivery", activo: true }),
        User.countDocuments({ role: "delivery", activo: false }),
        Product.countDocuments()
    ]);

    res.render("admin/dashboard", {
        totalOrders,
        todayOrders,
        activeComercios,
        inactiveComercios,
        activeClientes,
        inactiveClientes,
        activeDelivery,
        inactiveDelivery,
        productsCount
    });
};

const buildUsersView = async role => {
    const users = await User.find({ role })
        .populate("tipoComercio")
        .sort({ createdAt: -1 })
        .lean();

    const usersWithStats = await Promise.all(users.map(async user => ({
        ...user,
        ordersCount: role === "delivery"
            ? await Order.countDocuments({ delivery: user._id, estado: "completado" })
            : role === "comercio"
                ? await Order.countDocuments({ comercio: user._id })
                : await Order.countDocuments({ cliente: user._id })
    })));

    return usersWithStats;
};

export const getUsers = async (req, res) => {
    const role = req.params.role || "cliente";
    const users = await buildUsersView(role);

    res.render("admin/users", {
        users,
        role
    });
};

export const toggleUser = async (req, res) => {
    const user = await User.findById(req.params.id);

    if (!user) {
        return res.redirect("back");
    }

    if (user.role === "admin" && user._id.toString() === req.session.user.id) {
        return res.redirect("/admin/admins");
    }

    user.activo = !user.activo;
    await user.save();

    const destination = user.role === "admin" ? "/admin/admins" : `/admin/users/${user.role}`;
    res.redirect(destination);
};

export const configView = async (req, res) => {
    const config = await Config.findOne().lean();
    res.render("admin/config", { config });
};

export const updateConfig = async (req, res) => {
    const itbis = Number(req.body.itbis);

    await Config.findOneAndUpdate({}, { itbis }, { upsert: true, new: true });
    res.redirect("/admin/config");
};

export const getCommerceTypes = async (req, res) => {
    const types = await CommerceType.find().sort({ nombre: 1 }).lean();

    const typesWithCount = await Promise.all(types.map(async type => ({
        ...type,
        comerciosCount: await User.countDocuments({ role: "comercio", tipoComercio: type._id })
    })));

    res.render("admin/commerce-types", { types: typesWithCount });
};

export const createCommerceType = async (req, res) => {
    if (!req.body.nombre?.trim() || !req.body.descripcion?.trim() || !req.file) {
        const types = await CommerceType.find().lean();
        return res.render("admin/commerce-types", {
            types,
            error: "Nombre, descripcion e icono son requeridos"
        });
    }

    await CommerceType.create({
        nombre: req.body.nombre,
        descripcion: req.body.descripcion,
        icono: "/uploads/" + req.file.filename
    });

    res.redirect("/admin/commerce-types");
};

export const updateCommerceType = async (req, res) => {
    const type = await CommerceType.findById(req.params.id);

    if (!type) {
        return res.redirect("/admin/commerce-types");
    }

    type.nombre = req.body.nombre?.trim() || type.nombre;
    type.descripcion = req.body.descripcion?.trim() || type.descripcion;

    if (req.file) {
        type.icono = "/uploads/" + req.file.filename;
    }

    await type.save();
    res.redirect("/admin/commerce-types");
};

export const deleteCommerceType = async (req, res) => {
    const comercios = await User.find({
        role: "comercio",
        tipoComercio: req.params.id
    }).select("_id").lean();

    const comercioIds = comercios.map(comercio => comercio._id);

    if (comercioIds.length > 0) {
        await Promise.all([
            Favorite.deleteMany({ comercio: { $in: comercioIds } }),
            Order.deleteMany({ comercio: { $in: comercioIds } }),
            Product.deleteMany({ comercio: { $in: comercioIds } }),
            Category.deleteMany({ comercio: { $in: comercioIds } }),
            User.deleteMany({ _id: { $in: comercioIds } })
        ]);
    }

    await CommerceType.deleteOne({ _id: req.params.id });
    res.redirect("/admin/commerce-types");
};

export const adminsView = async (req, res) => {
    const admins = await User.find({ role: "admin" }).sort({ createdAt: -1 }).lean();
    res.render("admin/admins", { admins });
};

export const editCommerceTypeView = async (req, res) => {
    const type = await CommerceType.findById(req.params.id).lean();

    if (!type) {
        return res.redirect("/admin/commerce-types");
    }

    res.render("admin/edit-commerce-type", { type });
};

export const editAdminView = async (req, res) => {
    const admin = await User.findOne({
        _id: req.params.id,
        role: "admin"
    }).lean();

    if (!admin || admin._id.toString() === req.session.user.id) {
        return res.redirect("/admin/admins");
    }

    res.render("admin/edit-admin", { admin });
};

export const createAdmin = async (req, res) => {
    const {
        nombre,
        apellido,
        cedula,
        email,
        username,
        password,
        confirmPassword
    } = req.body;

    if (!nombre || !apellido || !cedula || !email || !username || !password || !confirmPassword) {
        const admins = await User.find({ role: "admin" }).lean();
        return res.render("admin/admins", {
            admins,
            error: "Todos los campos son requeridos"
        });
    }

    if (password !== confirmPassword) {
        const admins = await User.find({ role: "admin" }).lean();
        return res.render("admin/admins", {
            admins,
            error: "Las contraseñas no coinciden"
        });
    }

    const exists = await User.findOne({
        $or: [{ email }, { username }]
    });

    if (exists) {
        const admins = await User.find({ role: "admin" }).lean();
        return res.render("admin/admins", {
            admins,
            error: "Ese correo o usuario ya existe"
        });
    }

    await User.create({
        nombre,
        apellido,
        cedula,
        email,
        username,
        password: await bcrypt.hash(password, 10),
        role: "admin",
        activo: true
    });

    res.redirect("/admin/admins");
};

export const updateAdmin = async (req, res) => {
    const admin = await User.findOne({
        _id: req.params.id,
        role: "admin"
    });

    if (!admin || admin._id.toString() === req.session.user.id) {
        return res.redirect("/admin/admins");
    }

    const {
        nombre,
        apellido,
        cedula,
        email,
        username,
        password,
        confirmPassword
    } = req.body;

    if (!nombre || !apellido || !cedula || !email || !username) {
        return res.render("admin/edit-admin", {
            admin: { ...admin.toObject(), ...req.body },
            error: "Todos los campos salvo la contrasena son requeridos"
        });
    }

    const duplicate = await User.findOne({
        _id: { $ne: admin._id },
        $or: [{ email }, { username }]
    });

    if (duplicate) {
        return res.render("admin/edit-admin", {
            admin: { ...admin.toObject(), ...req.body },
            error: "Ese correo o usuario ya existe"
        });
    }

    admin.nombre = nombre;
    admin.apellido = apellido;
    admin.cedula = cedula;
    admin.email = email;
    admin.username = username;

    if (password || confirmPassword) {
        if (password !== confirmPassword) {
            return res.render("admin/edit-admin", {
                admin: { ...admin.toObject(), ...req.body },
                error: "Las contrasenas no coinciden"
            });
        }

        admin.password = await bcrypt.hash(password, 10);
    }

    await admin.save();
    res.redirect("/admin/admins");
};

export const confirmDeleteCommerceType = async (req, res) => {
    const type = await CommerceType.findById(req.params.id).lean();

    if (!type) {
        return res.redirect("/admin/commerce-types");
    }

    const comerciosCount = await User.countDocuments({
        role: "comercio",
        tipoComercio: type._id
    });

    res.render("admin/delete-commerce-type", {
        type,
        comerciosCount
    });
};
