import bcrypt from "bcrypt";
import crypto from "crypto";
import { validationResult } from "express-validator";
import { isMailerConfigured, transporter } from "../config/mailer.js";
import { CommerceType } from "../models/CommerceType.model.js";
import { User } from "../models/User.model.js";

const redirectByRole = (res, role) => {
    switch (role) {
        case "cliente":
            return res.redirect("/cliente");
        case "comercio":
            return res.redirect("/comercio");
        case "delivery":
            return res.redirect("/delivery");
        case "admin":
            return res.redirect("/admin");
        default:
            return res.redirect("/");
    }
};

const buildRegisterContext = async (values = {}, error = null) => ({
    layout: "auth",
    values,
    error,
    tiposComercio: await CommerceType.find().lean()
});

const normalizeText = value => value?.trim() || "";
const normalizeEmail = value => normalizeText(value).toLowerCase();
const cleanEnv = value => normalizeText(String(value ?? "")).replace(/^["']|["']$/g, "");

const shouldBypassEmail = () => cleanEnv(process.env.AUTH_EMAIL_OPTIONAL || "false") === "true";

const getMailErrorMessage = error => {
    if (!error) {
        return "No fue posible enviar el correo.";
    }

    return error.message || "No fue posible enviar el correo.";
};

const getMissingMailConfigMessage = () => "El correo no esta configurado en este entorno. Revisa SENDGRID_API_KEY y SENDGRID_FROM, o BREVO_API_KEY y BREVO_SENDER_EMAIL.";

export const loginView = (req, res) => {
    if (req.session.user) {
        return redirectByRole(res, req.session.user.role);
    }

    res.render("auth/login", {
        layout: "auth",
        activated: req.query.activated,
        reset: req.query.reset
    });
};

export const login = async (req, res) => {
    const { username, password } = req.body;
    const identifier = username?.trim();

    if (!identifier || !password) {
        return res.render("auth/login", {
            layout: "auth",
            error: "Debes completar usuario o correo y contrasena"
        });
    }

    const normalizedIdentifier = normalizeEmail(identifier);
    const user = await User.findOne({
        $or: [{ username: identifier }, { email: normalizedIdentifier }]
    });

    if (!user) {
        return res.render("auth/login", {
            layout: "auth",
            error: "Las credenciales ingresadas no son validas"
        });
    }

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
        return res.render("auth/login", {
            layout: "auth",
            error: "Las credenciales ingresadas no son validas"
        });
    }

    if (!user.activo) {
        return res.render("auth/login", {
            layout: "auth",
            error: "Tu cuenta esta inactiva. Revisa tu correo o contacta a un administrador"
        });
    }

    req.session.user = {
        id: user._id.toString(),
        nombre: user.nombre,
        role: user.role
    };

    return redirectByRole(res, user.role);
};

export const registerView = async (req, res) => {
    if (req.session.user) {
        return redirectByRole(res, req.session.user.role);
    }

    res.render("auth/register", await buildRegisterContext({
        role: req.query.role === "comercio" ? "comercio" : "cliente"
    }));
};

export const register = async (req, res) => {
    try {
        const errors = validationResult(req);
        const values = { ...req.body };

        if (!errors.isEmpty()) {
            return res.render("auth/register", await buildRegisterContext(values, errors.array()[0].msg));
        }

        const nombre = normalizeText(req.body.nombre);
        const apellido = normalizeText(req.body.apellido);
        const telefono = normalizeText(req.body.telefono);
        const email = normalizeEmail(req.body.email);
        const username = normalizeText(req.body.username);
        const role = normalizeText(req.body.role);
        const password = req.body.password;
        const confirmPassword = req.body.confirmPassword;
        const horarioApertura = normalizeText(req.body.horarioApertura);
        const horarioCierre = normalizeText(req.body.horarioCierre);
        const tipoComercio = normalizeText(req.body.tipoComercio);

        const generatedUsername = role === "comercio" ? email : username;

        if (!["cliente", "delivery", "comercio"].includes(role)) {
            return res.render("auth/register", await buildRegisterContext(values, "No puedes registrarte con ese rol"));
        }

        if (password !== confirmPassword) {
            return res.render("auth/register", await buildRegisterContext(values, "Las contrasenas no coinciden"));
        }

        const exist = await User.findOne({
            $or: [{ email }, { username: generatedUsername }]
        });

        if (exist) {
            return res.render("auth/register", await buildRegisterContext(values, "El usuario o el correo ya existen"));
        }

        if (role === "comercio" && (!horarioApertura || !horarioCierre || !tipoComercio)) {
            return res.render("auth/register", await buildRegisterContext(values, "Completa los datos requeridos del comercio"));
        }

        const hashed = await bcrypt.hash(password, 10);

        const user = await User.create({
            nombre,
            apellido: role === "comercio" ? "" : apellido,
            telefono,
            email,
            username: generatedUsername,
            role,
            password: hashed,
            activo: true,
            token: null,
            foto: req.file ? `/uploads/${req.file.filename}` : null,
            horarioApertura: role === "comercio" ? horarioApertura : null,
            horarioCierre: role === "comercio" ? horarioCierre : null,
            tipoComercio: role === "comercio" ? tipoComercio : null
        });

        if (!shouldBypassEmail()) {
            if (!isMailerConfigured()) {
                throw new Error(getMissingMailConfigMessage());
            }

            const token = crypto.randomBytes(20).toString("hex");
            user.token = token;
            user.activo = false;
            await user.save();

            const url = `${process.env.BASE_URL}/activate/${token}`;

            await transporter.sendMail({
                to: email,
                subject: "Activa tu cuenta",
                html: `
                    <h2>Bienvenido a AppCenar</h2>
                    <p>Haz clic en el siguiente enlace para activar tu cuenta:</p>
                    <a href="${url}">Activar cuenta</a>
                `
            });

            return res.render("auth/check-email", {
                email,
                layout: "auth"
            });
        }

        return res.render("auth/check-email", {
            email,
            layout: "auth",
            success: "Cuenta creada y activada correctamente. Ya puedes iniciar sesion.",
            bypassEmail: true
        });
    } catch (error) {
        if (error?.code === 11000) {
            return res.render("auth/register", await buildRegisterContext(req.body, "El usuario o el correo ya existen"));
        }

        if (!shouldBypassEmail()) {
            const normalizedRole = normalizeText(req.body.role);
            const generatedUsername = normalizedRole === "comercio"
                ? normalizeEmail(req.body.email)
                : normalizeText(req.body.username);

            await User.deleteOne({
                email: normalizeEmail(req.body.email),
                username: generatedUsername
            });
        }

        const errorMessage = error?.name === "ValidationError"
            ? Object.values(error.errors)[0]?.message || "Datos invalidos"
            : getMailErrorMessage(error);

        console.log("Error en registro:", error);
        return res.render("auth/register", await buildRegisterContext(req.body, `Error en el registro: ${errorMessage}`));
    }
};

export const activateAccount = async (req, res) => {
    try {
        const { token } = req.params;
        const user = await User.findOne({ token });

        if (!user) {
            return res.send("Token invalido");
        }

        user.activo = true;
        user.token = null;
        await user.save();

        res.redirect("/?activated=1");
    } catch (error) {
        console.log(error);
        res.send("Error al activar la cuenta");
    }
};

export const forgotPassword = async (req, res) => {
    const { identifier } = req.body;

    if (!identifier?.trim()) {
        return res.render("auth/forgot", {
            layout: "auth",
            error: "Debes indicar tu correo o nombre de usuario"
        });
    }

    const normalizedIdentifier = normalizeEmail(identifier);
    const user = await User.findOne({
        $or: [{ email: normalizedIdentifier }, { username: identifier.trim() }]
    });

    if (!user) {
        return res.render("auth/forgot", {
            layout: "auth",
            error: "No existe una cuenta con ese correo o usuario"
        });
    }

    const token = crypto.randomBytes(20).toString("hex");
    user.token = token;
    await user.save();
    if (!shouldBypassEmail()) {
        if (!isMailerConfigured()) {
            return res.render("auth/forgot", {
                layout: "auth",
                error: getMissingMailConfigMessage()
            });
        }

        const url = `${process.env.BASE_URL}/reset/${token}`;

        try {
            await transporter.sendMail({
                to: user.email,
                subject: "Restablecimiento de contrasena",
                html: `<a href="${url}">Cambiar contrasena</a>`
            });

            return res.render("auth/check-email", {
                layout: "auth",
                email: user.email
            });
        } catch (error) {
            user.token = null;
            await user.save();

            return res.render("auth/forgot", {
                layout: "auth",
                error: getMailErrorMessage(error)
            });
        }
    }

    res.redirect(`/reset/${token}`);
};

export const resetPasswordView = async (req, res) => {
    const { token } = req.params;
    const user = await User.findOne({ token });

    if (!user) {
        return res.send("Token invalido");
    }

    res.render("auth/reset", { token, layout: "auth" });
};

export const resetPassword = async (req, res) => {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    if (!password || !confirmPassword) {
        return res.render("auth/reset", {
            layout: "auth",
            token,
            error: "Debes completar ambos campos"
        });
    }

    if (password !== confirmPassword) {
        return res.render("auth/reset", {
            layout: "auth",
            token,
            error: "Las contrasenas no coinciden"
        });
    }

    const user = await User.findOne({ token });

    if (!user) {
        return res.send("Token invalido");
    }

    user.password = await bcrypt.hash(password, 10);
    user.token = null;
    await user.save();

    res.redirect("/?reset=1");
};

export const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;

        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.render("auth/change-password", {
                error: "Todos los campos son requeridos"
            });
        }

        if (newPassword !== confirmPassword) {
            return res.render("auth/change-password", {
                error: "Las contrasenas no coinciden"
            });
        }

        const user = await User.findById(req.session.user.id);

        if (!user) {
            return res.redirect("/");
        }

        const valid = await bcrypt.compare(currentPassword, user.password);

        if (!valid) {
            return res.render("auth/change-password", {
                error: "La contrasena actual es incorrecta"
            });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        res.render("auth/change-password", {
            success: "Contrasena actualizada correctamente"
        });
    } catch (error) {
        console.log(error);
        res.render("auth/change-password", {
            error: "Error al cambiar la contrasena"
        });
    }
};

export const profileView = async (req, res) => {
    const user = await User.findById(req.session.user.id).populate("tipoComercio").lean();
    res.render("auth/profile", {
        user,
        tiposComercio: await CommerceType.find().lean()
    });
};

export const updateProfile = async (req, res) => {
    const user = await User.findById(req.session.user.id);

    if (!user) {
        return res.redirect("/");
    }

    user.nombre = req.body.nombre?.trim() || user.nombre;
    user.apellido = req.body.apellido?.trim() ?? user.apellido;
    user.telefono = req.body.telefono?.trim() || user.telefono;

    if (user.role === "comercio") {
        user.horarioApertura = req.body.horarioApertura?.trim() || user.horarioApertura;
        user.horarioCierre = req.body.horarioCierre?.trim() || user.horarioCierre;
        user.tipoComercio = req.body.tipoComercio || user.tipoComercio;
    }

    if (req.file) {
        user.foto = "/uploads/" + req.file.filename;
    }

    await user.save();

    req.session.user.nombre = user.nombre;

    return res.redirect("/profile");
};

export const logout = (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.log(err);
            return res.redirect("/");
        }

        res.clearCookie("connect.sid");
        res.redirect("/");
    });
};
