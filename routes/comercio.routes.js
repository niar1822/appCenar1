import { Router } from "express";
import { upload } from "../middlewares/upload.middleware.js";
import { isAuth, hasRole } from "../middlewares/auth.middlewares.js";
import {
    comercioDashboard,
    getCategories,
    createCategoryView,
    createCategory,
    editCategoryView,
    updateCategory,
    confirmDeleteCategoryView,
    deleteCategory,
    getProducts,
    createProductView,
    createProduct,
    editProductView,
    updateProduct,
    confirmDeleteProductView,
    deleteProduct,
    getOrders,
    orderDetailView,
    assignOrderView,
    assignOrder,
    updateOrderStatus
} from "../controllers/comercio.controller.js";

const router = Router();

router.get("/comercio", isAuth, hasRole("comercio"), comercioDashboard);
router.get("/comercio/categories", isAuth, hasRole("comercio"), getCategories);
router.get("/comercio/categories/new", isAuth, hasRole("comercio"), createCategoryView);
router.post("/comercio/categories", isAuth, hasRole("comercio"), createCategory);
router.get("/comercio/categories/edit/:id", isAuth, hasRole("comercio"), editCategoryView);
router.post("/comercio/categories/edit/:id", isAuth, hasRole("comercio"), updateCategory);
router.get("/comercio/categories/delete/:id", isAuth, hasRole("comercio"), confirmDeleteCategoryView);
router.post("/comercio/categories/delete/:id", isAuth, hasRole("comercio"), deleteCategory);

router.get("/comercio/products", isAuth, hasRole("comercio"), getProducts);
router.get("/comercio/products/new", isAuth, hasRole("comercio"), createProductView);
router.post("/comercio/products", isAuth, hasRole("comercio"), upload.single("imagen"), createProduct);
router.get("/comercio/products/edit/:id", isAuth, hasRole("comercio"), editProductView);
router.post("/comercio/products/edit/:id", isAuth, hasRole("comercio"), upload.single("imagen"), updateProduct);
router.get("/comercio/products/delete/:id", isAuth, hasRole("comercio"), confirmDeleteProductView);
router.post("/comercio/products/delete/:id", isAuth, hasRole("comercio"), deleteProduct);

router.get("/comercio/orders", isAuth, hasRole("comercio"), getOrders);
router.get("/comercio/orders/:id", isAuth, hasRole("comercio"), orderDetailView);
router.get("/comercio/orders/:id/assign", isAuth, hasRole("comercio"), assignOrderView);
router.post("/comercio/orders/:id/assign", isAuth, hasRole("comercio"), assignOrder);
router.post("/comercio/orders/:id", isAuth, hasRole("comercio"), updateOrderStatus);

export default router;
