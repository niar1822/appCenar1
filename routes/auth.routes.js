import { Router } from "express";
import { loginView, login, activateAccount, forgotPassword, logout, profileView, resetPasswordView, resetPassword } from "../controllers/auth.controller.js";
import { registerView, register } from "../controllers/auth.controller.js";
import { upload } from "../middlewares/upload.middleware.js";
import { isAuth } from "../middlewares/auth.middlewares.js";
import { changePassword, updateProfile } from "../controllers/auth.controller.js";
import { registerValidation } from "../middlewares/validators.js";

const router = Router();

router.get("/", loginView);
router.post("/login", login);

router.get("/register", registerView);
router.get("/activate/:token", activateAccount);

router.get("/forgot", (req, res) => res.render("auth/forgot", { layout: "auth" }));
router.post("/forgot", forgotPassword);

router.get("/reset/:token", resetPasswordView);
router.post("/reset/:token", resetPassword);

router.post(
    "/register",
    upload.single("foto"),
    registerValidation,
    register
);

router.get("/profile", isAuth, profileView);
router.post("/profile", isAuth, upload.single("foto"), updateProfile);

router.get("/change-password", isAuth, (req, res) => {
    res.render("auth/change-password");
});

router.post("/change-password", isAuth, changePassword);

router.get("/logout", logout);

export default router;
