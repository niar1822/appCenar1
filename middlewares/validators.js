import { body } from "express-validator";

export const registerValidation = [
    body("nombre").notEmpty().withMessage("Nombre requerido"),
    body("telefono").notEmpty().withMessage("Telefono requerido"),
    body("email").isEmail().withMessage("Email invalido"),
    body("role").isIn(["cliente", "delivery", "comercio"]).withMessage("Rol invalido"),
    body("username")
        .custom((value, { req }) => req.body.role === "comercio" || Boolean(value?.trim()))
        .withMessage("Usuario requerido"),
    body("apellido")
        .custom((value, { req }) => req.body.role === "comercio" || Boolean(value?.trim()))
        .withMessage("Apellido requerido"),
    body("horarioApertura")
        .custom((value, { req }) => req.body.role !== "comercio" || Boolean(value?.trim()))
        .withMessage("Hora de apertura requerida"),
    body("horarioCierre")
        .custom((value, { req }) => req.body.role !== "comercio" || Boolean(value?.trim()))
        .withMessage("Hora de cierre requerida"),
    body("tipoComercio")
        .custom((value, { req }) => req.body.role !== "comercio" || Boolean(value?.trim()))
        .withMessage("Tipo de comercio requerido"),
    body("password").isLength({ min: 4 }).withMessage("Minimo 4 caracteres")
];
