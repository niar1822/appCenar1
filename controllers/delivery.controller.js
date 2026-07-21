import { Order } from "../models/Order.model.js";

const buildOrdersForView = orders => orders.map(order => ({
    ...order,
    productosCount: order.productos?.reduce((sum, item) => sum + (item.cantidad || 0), 0) || 0
}));

export const deliveryHome = async (req, res) => {
    const [activeOrder, completedOrders, orders] = await Promise.all([
        Order.findOne({
            delivery: req.session.user.id,
            estado: "en proceso"
        }).lean(),
        Order.countDocuments({
            delivery: req.session.user.id,
            estado: "completado"
        }),
        Order.find({
            delivery: req.session.user.id
        })
            .populate("comercio")
            .sort({ createdAt: -1 })
            .lean()
    ]);

    res.render("delivery/home", {
        hasActiveOrder: Boolean(activeOrder),
        completedOrders,
        orders: buildOrdersForView(orders)
    });
};

export const myOrders = async (req, res) => {
    const orders = await Order.find({
        delivery: req.session.user.id
    })
        .populate("comercio")
        .sort({ createdAt: -1 })
        .lean();

    res.render("delivery/myOrders", {
        orders: buildOrdersForView(orders)
    });
};

export const viewOrderDetail = async (req, res) => {
    const order = await Order.findOne({
        _id: req.params.id,
        delivery: req.session.user.id
    })
        .populate("comercio")
        .lean();

    if (!order) {
        return res.redirect("/delivery");
    }

    res.render("delivery/order-detail", {
        order,
        productosCount: order.productos?.reduce((sum, item) => sum + (item.cantidad || 0), 0) || 0
    });
};

export const completeOrder = async (req, res) => {
    const order = await Order.findById(req.params.id);

    if (!order || order.delivery?.toString() !== req.session.user.id) {
        return res.redirect("/delivery/myOrders");
    }

    if (order.estado !== "en proceso") {
        return res.redirect(`/delivery/orders/${order._id}`);
    }

    order.estado = "completado";
    await order.save();

    res.redirect(`/delivery/orders/${order._id}`);
};
