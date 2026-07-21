import express from "express";
import dotenv from "dotenv";
import session from "express-session";
import MongoStore from "connect-mongo";
import path from "path";
import { engine } from "express-handlebars";
import { connectDB } from "./config/db.js";
import { verifyMailer } from "./config/mailer.js";
import adminRoutes from "./routes/admin.routes.js";
import router from "./routes/auth.routes.js";
import clienteRouter from "./routes/cliente.routes.js";
import comercioRoutes from "./routes/comercio.routes.js";
import deliveryRoutes from "./routes/delivery.routes.js";
import { projectRoot } from "./utils/paths.js";

dotenv.config();

const appEnv = (process.env.APP_ENV || process.env.NODE_ENV || "development")
    .replace(/^["']|["']$/g, "");

dotenv.config({
    path: `.env.${appEnv}`,
    override: false
});

const app = express();
const port = Number(process.env.PORT) || 3000;
const sessionSecret = process.env.SESSION_SECRET || "appcenar-session-secret";
const mongoUri = await connectDB();
verifyMailer().catch(error => {
    console.log("Error inicializando mailer:", error.message);
});

app.set("trust proxy", 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: mongoUri,
        ttl: 14 * 24 * 60 * 60
    }),
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000
    }
}));

app.engine("hbs", engine({
    layoutsDir: "views/layouts",
    defaultLayout: "main",
    extname: "hbs",
    helpers: {
        eq: (a, b) => String(a) === String(b),
        ne: (a, b) => String(a) !== String(b),
        gt: (a, b) => Number(a) > Number(b),
        formatCurrency: value => Number(value || 0).toFixed(2)
    }
}));

app.set("view engine", "hbs");
app.set("views", "views");

app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.cartCount = Object.values(req.session.cart || {})
        .reduce((total, items) => total + items.length, 0);
    next();
});

app.use(express.static(path.join(projectRoot, "public")));

app.use("/", router);
app.use("/", clienteRouter);
app.use("/", deliveryRoutes);
app.use("/", adminRoutes);
app.use("/", comercioRoutes);

app.listen(port, () => {
    console.log(`Servidor corriendo en puerto ${port}`);
});
