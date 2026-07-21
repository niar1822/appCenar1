import { Category } from "../models/Category.model.js";
import { Order } from "../models/Order.model.js";
import { Product } from "../models/Product.model.js";
import { User } from "../models/User.model.js";

const loadCommerceCategories = async (comercioId) => {
    const categories = await Category.find({ comercio: comercioId })
        .sort({ createdAt: -1 })
        .lean();

    return Promise.all(categories.map(async category => ({
        ...category,
        productsCount: await Product.countDocuments({
            comercio: comercioId,
            categoria: category._id
        })
    })));
};

const buildCategoryForm = (values = {}, error = null, mode = "create") => ({
    values,
    error,
    mode
});

const buildProductForm = async (comercioId, values = {}, error = null, mode = "create") => ({
    categories: await Category.find({ comercio: comercioId }).sort({ nombre: 1 }).lean(),
    values,
    error,
    mode
});

export const comercioDashboard = async (req, res) => {
    const [productsCount, categoriesCount, activeOrders, orders] = await Promise.all([
        Product.countDocuments({ comercio: req.session.user.id }),
        Category.countDocuments({ comercio: req.session.user.id }),
        Order.countDocuments({
            comercio: req.session.user.id,
            estado: { $in: ["pendiente", "en proceso"] }
        }),
        Order.find({
            comercio: req.session.user.id
        })
            .populate("cliente")
            .populate("delivery")
            .sort({ createdAt: -1 })
            .lean()
    ]);

    res.render("comercio/dashboard", {
        productsCount,
        categoriesCount,
        activeOrders,
        orders
    });
};

export const createCategoryView = (req, res) => {
    res.render("comercio/category-form", buildCategoryForm());
};

export const getCategories = async (req, res) => {
    const categories = await loadCommerceCategories(req.session.user.id);

    res.render("comercio/categories", { categories });
};

export const createCategory = async (req, res) => {
    const nombre = req.body.nombre?.trim();
    const descripcion = req.body.descripcion?.trim();

    if (!nombre || !descripcion) {
        return res.render("comercio/category-form", buildCategoryForm(req.body, "Nombre y descripcion son requeridos"));
    }

    await Category.create({
        nombre,
        descripcion,
        comercio: req.session.user.id
    });

    res.redirect("/comercio/categories");
};

export const editCategoryView = async (req, res) => {
    const category = await Category.findOne({
        _id: req.params.id,
        comercio: req.session.user.id
    }).lean();

    if (!category) {
        return res.redirect("/comercio/categories");
    }

    res.render("comercio/category-form", buildCategoryForm(category, null, "edit"));
};

export const updateCategory = async (req, res) => {
    const category = await Category.findOne({
        _id: req.params.id,
        comercio: req.session.user.id
    });

    if (!category) {
        return res.redirect("/comercio/categories");
    }

    const nombre = req.body.nombre?.trim();
    const descripcion = req.body.descripcion?.trim();

    if (!nombre || !descripcion) {
        return res.render("comercio/category-form", buildCategoryForm({
            ...category.toObject(),
            ...req.body
        }, "Nombre y descripcion son requeridos", "edit"));
    }

    category.nombre = nombre;
    category.descripcion = descripcion;
    await category.save();

    res.redirect("/comercio/categories");
};

export const confirmDeleteCategoryView = async (req, res) => {
    const category = await Category.findOne({
        _id: req.params.id,
        comercio: req.session.user.id
    }).lean();

    if (!category) {
        return res.redirect("/comercio/categories");
    }

    const productsCount = await Product.countDocuments({
        comercio: req.session.user.id,
        categoria: category._id
    });

    res.render("comercio/delete-category", {
        category,
        productsCount
    });
};

export const deleteCategory = async (req, res) => {
    await Category.deleteOne({
        _id: req.params.id,
        comercio: req.session.user.id
    });

    await Product.updateMany(
        { categoria: req.params.id, comercio: req.session.user.id },
        { $set: { categoria: null } }
    );

    res.redirect("/comercio/categories");
};

export const getProducts = async (req, res) => {
    const products = await Product.find({
        comercio: req.session.user.id
    })
        .populate("categoria")
        .sort({ createdAt: -1 })
        .lean();

    res.render("comercio/products", { products });
};

export const createProductView = async (req, res) => {
    res.render("comercio/product-form", await buildProductForm(req.session.user.id));
};

export const createProduct = async (req, res) => {
    const { nombre, precio, descripcion, categoria } = req.body;

    if (!nombre?.trim() || !precio || !descripcion?.trim() || !categoria || !req.file) {
        return res.render("comercio/product-form", await buildProductForm(
            req.session.user.id,
            req.body,
            "Nombre, precio, descripcion, categoria e imagen son requeridos"
        ));
    }

    const category = await Category.findOne({
        _id: categoria,
        comercio: req.session.user.id
    });

    if (!category) {
        return res.render("comercio/product-form", await buildProductForm(
            req.session.user.id,
            req.body,
            "La categoria seleccionada no es valida"
        ));
    }

    await Product.create({
        nombre: nombre.trim(),
        precio: Number(precio),
        descripcion: descripcion.trim(),
        imagen: "/uploads/" + req.file.filename,
        categoria,
        comercio: req.session.user.id
    });

    res.redirect("/comercio/products");
};

export const editProductView = async (req, res) => {
    const product = await Product.findOne({
        _id: req.params.id,
        comercio: req.session.user.id
    }).lean();

    if (!product) {
        return res.redirect("/comercio/products");
    }

    res.render("comercio/product-form", await buildProductForm(
        req.session.user.id,
        product,
        null,
        "edit"
    ));
};

export const updateProduct = async (req, res) => {
    const product = await Product.findOne({
        _id: req.params.id,
        comercio: req.session.user.id
    });

    if (!product) {
        return res.redirect("/comercio/products");
    }

    const { nombre, precio, descripcion, categoria } = req.body;

    if (!nombre?.trim() || !precio || !descripcion?.trim() || !categoria) {
        return res.render("comercio/product-form", await buildProductForm(
            req.session.user.id,
            {
                ...product.toObject(),
                ...req.body
            },
            "Nombre, precio, descripcion y categoria son requeridos",
            "edit"
        ));
    }

    const category = await Category.findOne({
        _id: categoria,
        comercio: req.session.user.id
    });

    if (!category) {
        return res.render("comercio/product-form", await buildProductForm(
            req.session.user.id,
            {
                ...product.toObject(),
                ...req.body
            },
            "La categoria seleccionada no es valida",
            "edit"
        ));
    }

    product.nombre = nombre.trim();
    product.precio = Number(precio);
    product.descripcion = descripcion.trim();
    product.categoria = category._id;

    if (req.file) {
        product.imagen = "/uploads/" + req.file.filename;
    }

    await product.save();
    res.redirect("/comercio/products");
};

export const confirmDeleteProductView = async (req, res) => {
    const product = await Product.findOne({
        _id: req.params.id,
        comercio: req.session.user.id
    }).populate("categoria").lean();

    if (!product) {
        return res.redirect("/comercio/products");
    }

    res.render("comercio/delete-product", { product });
};

export const deleteProduct = async (req, res) => {
    await Product.deleteOne({
        _id: req.params.id,
        comercio: req.session.user.id
    });

    res.redirect("/comercio/products");
};

export const getOrders = async (req, res) => {
    const orders = await Order.find({
        comercio: req.session.user.id
    })
        .populate("cliente")
        .populate("delivery")
        .sort({ createdAt: -1 })
        .lean();

    res.render("comercio/orders", { orders });
};

export const orderDetailView = async (req, res) => {
    const order = await Order.findOne({
        _id: req.params.id,
        comercio: req.session.user.id
    })
        .populate("cliente")
        .populate("delivery")
        .lean();

    if (!order) {
        return res.redirect("/comercio/orders");
    }

    res.render("comercio/order-detail", { order });
};

export const assignOrderView = async (req, res) => {
    const order = await Order.findOne({
        _id: req.params.id,
        comercio: req.session.user.id
    })
        .populate("cliente")
        .lean();

    if (!order || order.estado !== "pendiente") {
        return res.redirect("/comercio/orders");
    }

    const deliveries = await User.find({
        role: "delivery",
        activo: true
    }).sort({ nombre: 1 }).lean();

    const busyDeliveryIds = new Set((await Order.find({
        estado: "en proceso",
        delivery: { $ne: null }
    }).select("delivery").lean()).map(item => item.delivery?.toString()));

    const availableDeliveries = deliveries.filter(delivery => !busyDeliveryIds.has(delivery._id.toString()));

    res.render("comercio/assign-order", {
        order,
        deliveries: availableDeliveries
    });
};

export const assignOrder = async (req, res) => {
    const order = await Order.findOne({
        _id: req.params.id,
        comercio: req.session.user.id
    });

    if (!order || order.estado !== "pendiente") {
        return res.redirect("/comercio/orders");
    }

    const delivery = await User.findOne({
        _id: req.body.deliveryId,
        role: "delivery",
        activo: true
    });

    if (!delivery) {
        return res.redirect(`/comercio/orders/${req.params.id}/assign`);
    }

    const busyOrder = await Order.findOne({
        delivery: delivery._id,
        estado: "en proceso"
    });

    if (busyOrder) {
        return res.redirect(`/comercio/orders/${req.params.id}/assign`);
    }

    order.delivery = delivery._id;
    order.estado = "en proceso";
    await order.save();

    res.redirect(`/comercio/orders/${order._id}`);
};

export const updateOrderStatus = async (req, res) => {
    const order = await Order.findById(req.params.id);

    if (!order || order.comercio.toString() !== req.session.user.id) {
        return res.redirect("/comercio/orders");
    }

    res.redirect("/comercio/orders");
};
