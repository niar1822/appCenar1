import { Router } from "express";
import { isAuth, hasRole } from "../middlewares/auth.middlewares.js";
import {
    deliveryHome,
    myOrders,
    viewOrderDetail,
    completeOrder
} from "../controllers/delivery.controller.js";

const router = Router();

router.get("/delivery", isAuth, hasRole("delivery"), deliveryHome);

router.get("/delivery/myOrders", isAuth, hasRole("delivery"), myOrders);
router.get("/delivery/orders/:id", isAuth, hasRole("delivery"), viewOrderDetail);

router.post("/delivery/orders/complete/:id", isAuth, hasRole("delivery"), completeOrder);

export default router;
