import { Router } from "express";
import {
    clienteHome,
    listComercios,
    viewMenu,
    viewOrders,
    viewOrderDetail,
    viewCart,
    cancelOrder,
    addToCart,
    removeFromCart,
    clearCart,
    checkoutView,
    checkout,
    toggleFavorite,
    viewFavorites,
    viewAddresses,
    createAddressView,
    createAddress,
    editAddressView,
    updateAddress,
    confirmDeleteAddressView,
    deleteAddress
} from "../controllers/cliente.controller.js";
import { isAuth, hasRole } from "../middlewares/auth.middlewares.js";

const router = Router();

router.get("/cliente", isAuth, hasRole("cliente"), clienteHome);
router.get("/cliente/comercios/:typeId", isAuth, hasRole("cliente"), listComercios);
router.post("/cliente/favorites/:comercioId", isAuth, hasRole("cliente"), toggleFavorite);
router.get("/cliente/favorites", isAuth, hasRole("cliente"), viewFavorites);
router.get("/cliente/addresses", isAuth, hasRole("cliente"), viewAddresses);
router.get("/cliente/addresses/new", isAuth, hasRole("cliente"), createAddressView);
router.post("/cliente/addresses", isAuth, hasRole("cliente"), createAddress);
router.get("/cliente/addresses/edit/:id", isAuth, hasRole("cliente"), editAddressView);
router.post("/cliente/addresses/edit/:id", isAuth, hasRole("cliente"), updateAddress);
router.get("/cliente/addresses/delete/:id", isAuth, hasRole("cliente"), confirmDeleteAddressView);
router.post("/cliente/addresses/delete/:id", isAuth, hasRole("cliente"), deleteAddress);

router.get("/cliente/menu/:id", isAuth, hasRole("cliente"), viewMenu);

router.get("/cliente/orders", isAuth, hasRole("cliente"), viewOrders);
router.get("/cliente/orders/:id", isAuth, hasRole("cliente"), viewOrderDetail);

router.post("/cliente/cart/add/:id", isAuth, hasRole("cliente"), addToCart);

router.get("/cliente/cart", isAuth, hasRole("cliente"), viewCart);

router.post("/cliente/cart/remove/:comercioId/:productoId", isAuth, hasRole("cliente"), removeFromCart);

router.post("/cliente/cart/clear", isAuth, hasRole("cliente"), clearCart);

router.get("/cliente/checkout/:comercioId", isAuth, hasRole("cliente"), checkoutView);
router.post("/cliente/checkout/:comercioId", isAuth, hasRole("cliente"), checkout);

router.post("/cliente/orders/cancel/:id", isAuth, hasRole("cliente"), cancelOrder);

export default router;
