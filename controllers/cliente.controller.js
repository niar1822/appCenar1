import mongoose from "mongoose";
import { Address } from "../models/Address.model.js";
import { CommerceType } from "../models/CommerceType.model.js";
import { Config } from "../models/Config.model.js";
import { Favorite } from "../models/Favorite.model.js";
import { Order } from "../models/Order.model.js";
import { Product } from "../models/Product.model.js";
import { User } from "../models/User.model.js";

const normalizeCart = req => {
    if (!req.session.cart || typeof req.session.cart !== "object" || Array.isArray(req.session.cart)) {
        req.session.cart = {};
    }

    return req.session.cart;
};

const buildCheckoutTotals = async products => {
    const config = await Config.findOne().lean();
    const subtotal = products.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
    const itbisRate = config?.itbis ?? 18;
    const itbisAmount = subtotal * (itbisRate / 100);
    const total = subtotal + itbisAmount;

    return {
        subtotal,
        itbisRate,
        itbisAmount,
        total
    };
};

export const clienteHome = async (req, res) => {
    const [tipos, comerciosActivos, comerciosSinTipo] = await Promise.all([
        CommerceType.find().lean(),
        User.find({ role: "comercio", activo: true })
            .sort({ nombre: 1 })
            .lean(),
        User.countDocuments({
            role: "comercio",
            activo: true,
            $or: [{ tipoComercio: null }, { tipoComercio: { $exists: false } }]
        })
    ]);

    const tiposConCantidad = await Promise.all(
        tipos.map(async tipo => ({
            ...tipo,
            cantidadComercios: await User.countDocuments({ role: "comercio", tipoComercio: tipo._id, activo: true })
        }))
    );

    if (comerciosSinTipo > 0) {
        tiposConCantidad.push({
            _id: "sin-tipo",
            nombre: "Sin categoria",
            descripcion: "Comercios que aun no tienen tipo asignado",
            icono: null,
            cantidadComercios: comerciosSinTipo
        });
    }

    res.render("cliente/home", {
        tipos: tiposConCantidad,
        comerciosActivos,
        totalComercios: comerciosActivos.length
    });
};

export const listComercios = async (req, res) => {
    const { typeId } = req.params;
    const search = req.query.search?.trim() || "";
    const filtro = {
        role: "comercio",
        activo: true
    };

    let tipo = null;

    if (typeId === "sin-tipo") {
        filtro.$or = [{ tipoComercio: null }, { tipoComercio: { $exists: false } }];
        tipo = {
            _id: "sin-tipo",
            nombre: "Sin categoria"
        };
    } else if (typeId !== "todos") {
        filtro.tipoComercio = new mongoose.Types.ObjectId(typeId);
        tipo = await CommerceType.findById(typeId).lean();
    } else {
        tipo = {
            _id: "todos",
            nombre: "Todos los comercios"
        };
    }

    if (search) {
        filtro.nombre = { $regex: search, $options: "i" };
    }

    const [comercios, favoritos] = await Promise.all([
        User.find(filtro).lean(),
        Favorite.find({ cliente: req.session.user.id }).lean()
    ]);

    const favoritosSet = new Set(favoritos.map(item => item.comercio.toString()));
    const comerciosConFavorito = comercios.map(comercio => ({
        ...comercio,
        isFavorite: favoritosSet.has(comercio._id.toString())
    }));

    res.render("cliente/comercios", {
        tipo,
        comercios: comerciosConFavorito,
        total: comerciosConFavorito.length,
        search
    });
};

export const toggleFavorite = async (req, res) => {
    const { comercioId } = req.params;
    const existing = await Favorite.findOne({
        cliente: req.session.user.id,
        comercio: comercioId
    });

    if (existing) {
        await Favorite.deleteOne({ _id: existing._id });
    } else {
        await Favorite.create({
            cliente: req.session.user.id,
            comercio: comercioId
        });
    }

    res.redirect(req.get("referer") || "/cliente/favorites");
};

export const viewFavorites = async (req, res) => {
    const favorites = await Favorite.find({ cliente: req.session.user.id })
        .populate("comercio")
        .lean();

    res.render("cliente/favorites", { favorites });
};

export const viewMenu = async (req, res) => {
    const { id } = req.params;
    const comercio = await User.findById(id).populate("tipoComercio").lean();
    const productos = await Product.find({
        comercio: new mongoose.Types.ObjectId(id)
    })
        .populate("categoria")
        .lean();

    const cart = normalizeCart(req);
    const currentOrder = cart[id] || [];
    const selectedIds = new Set(currentOrder.map(item => item.productoId));
    const subtotal = currentOrder.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);

    const groupedProducts = [];

    for (const producto of productos) {
        const categoryName = producto.categoria?.nombre || "Sin categoria";
        let group = groupedProducts.find(item => item.nombre === categoryName);

        if (!group) {
            group = { nombre: categoryName, productos: [] };
            groupedProducts.push(group);
        }

        group.productos.push({
            ...producto,
            selected: selectedIds.has(producto._id.toString())
        });
    }

    res.render("cliente/menu", {
        comercio,
        categorias: groupedProducts,
        pedidoActual: currentOrder,
        subtotal
    });
};

export const addToCart = async (req, res) => {
    const { id } = req.params;
    const product = await Product.findById(id).lean();

    if (!product) {
        return res.redirect("/cliente");
    }

    const cart = normalizeCart(req);
    const comercioId = product.comercio.toString();

    if (!cart[comercioId]) {
        cart[comercioId] = [];
    }

    const alreadyAdded = cart[comercioId].some(item => item.productoId === id);

    if (!alreadyAdded) {
        cart[comercioId].push({
            productoId: id,
            nombre: product.nombre,
            precio: product.precio,
            cantidad: 1,
            imagen: product.imagen
        });
    }

    res.redirect(`/cliente/menu/${comercioId}`);
};

export const viewCart = async (req, res) => {
    const cart = normalizeCart(req);
    const comercios = [];
    let totalGeneral = 0;

    for (const comercioId of Object.keys(cart)) {
        const productos = cart[comercioId];
        const total = productos.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
        const comercio = await User.findById(comercioId).lean();

        totalGeneral += total;
        comercios.push({
            comercioId,
            comercioNombre: comercio?.nombre || "Comercio",
            productos,
            total
        });
    }

    res.render("cliente/cart", { comercios, totalGeneral });
};

export const removeFromCart = (req, res) => {
    const { comercioId, productoId } = req.params;
    const cart = normalizeCart(req);

    if (!cart[comercioId]) {
        return res.redirect("/cliente/cart");
    }

    cart[comercioId] = cart[comercioId].filter(item => item.productoId !== productoId);

    if (cart[comercioId].length === 0) {
        delete cart[comercioId];
    }

    req.session.cart = cart;
    res.redirect(req.get("referer") || "/cliente/cart");
};

export const clearCart = (req, res) => {
    req.session.cart = {};
    res.redirect("/cliente/cart");
};

export const checkoutView = async (req, res) => {
    const { comercioId } = req.params;
    const cart = normalizeCart(req);
    const productos = cart[comercioId] || [];

    if (productos.length === 0) {
        return res.redirect(`/cliente/menu/${comercioId}`);
    }

    const [direcciones, comercio, totals] = await Promise.all([
        Address.find({ cliente: req.session.user.id }).lean(),
        User.findById(comercioId).lean(),
        buildCheckoutTotals(productos)
    ]);

    res.render("cliente/checkout", {
        comercio,
        comercioId,
        productos,
        direcciones,
        ...totals
    });
};

export const checkout = async (req, res) => {
    const { comercioId } = req.params;
    const { addressId } = req.body;
    const cart = normalizeCart(req);
    const productos = cart[comercioId] || [];

    if (productos.length === 0) {
        return res.redirect(`/cliente/menu/${comercioId}`);
    }

    const address = await Address.findOne({
        _id: addressId,
        cliente: req.session.user.id
    }).lean();

    if (!address) {
        return res.redirect(`/cliente/checkout/${comercioId}`);
    }

    const totals = await buildCheckoutTotals(productos);

    await Order.create({
        cliente: req.session.user.id,
        productos,
        subtotal: totals.subtotal,
        itbis: totals.itbisAmount,
        total: totals.total,
        comercio: comercioId,
        numeroPedido: `ORD-${Date.now()}`,
        direccionEntrega: {
            alias: address.alias,
            direccion: address.direccion,
            referencia: address.referencia
        }
    });

    delete cart[comercioId];
    req.session.cart = cart;

    res.redirect("/cliente");
};

export const viewOrders = async (req, res) => {
    const orders = await Order.find({
        cliente: req.session.user.id
    })
        .populate("comercio")
        .sort({ createdAt: -1 })
        .lean();

    res.render("cliente/orders", {
        orders: orders.map(order => ({
            ...order,
            productosCount: order.productos?.reduce((sum, item) => sum + (item.cantidad || 0), 0) || 0
        }))
    });
};

export const viewOrderDetail = async (req, res) => {
    const order = await Order.findOne({
        _id: req.params.id,
        cliente: req.session.user.id
    })
        .populate("comercio")
        .lean();

    if (!order) {
        return res.redirect("/cliente/orders");
    }

    res.render("cliente/order-detail", {
        order,
        productosCount: order.productos?.reduce((sum, item) => sum + (item.cantidad || 0), 0) || 0
    });
};

export const cancelOrder = async (req, res) => {
    const { id } = req.params;
    const order = await Order.findById(id);

    if (!order || order.cliente.toString() !== req.session.user.id) {
        return res.redirect("/cliente/orders");
    }

    if (order.estado !== "pendiente") {
        return res.send("Solo se pueden cancelar pedidos pendientes");
    }

    order.estado = "cancelado";
    await order.save();

    res.redirect("/cliente/orders");
};

export const viewAddresses = async (req, res) => {
    const addresses = await Address.find({ cliente: req.session.user.id })
        .sort({ createdAt: -1 })
        .lean();

    res.render("cliente/addresses", { addresses });
};

export const createAddressView = (req, res) => {
    res.render("cliente/address-form", {
        mode: "create",
        values: {}
    });
};

export const createAddress = async (req, res) => {
    const { alias, direccion, referencia } = req.body;

    if (!alias?.trim() || !direccion?.trim()) {
        return res.render("cliente/address-form", {
            mode: "create",
            values: req.body,
            error: "Alias y direccion son requeridos"
        });
    }

    await Address.create({
        cliente: req.session.user.id,
        alias: alias.trim(),
        direccion: direccion.trim(),
        referencia: referencia?.trim() || ""
    });

    res.redirect("/cliente/addresses");
};

export const editAddressView = async (req, res) => {
    const address = await Address.findOne({
        _id: req.params.id,
        cliente: req.session.user.id
    }).lean();

    if (!address) {
        return res.redirect("/cliente/addresses");
    }

    res.render("cliente/address-form", {
        mode: "edit",
        values: address
    });
};

export const updateAddress = async (req, res) => {
    const address = await Address.findOne({
        _id: req.params.id,
        cliente: req.session.user.id
    });

    if (!address) {
        return res.redirect("/cliente/addresses");
    }

    const { alias, direccion, referencia } = req.body;

    if (!alias?.trim() || !direccion?.trim()) {
        return res.render("cliente/address-form", {
            mode: "edit",
            values: {
                ...address.toObject(),
                ...req.body
            },
            error: "Alias y direccion son requeridos"
        });
    }

    address.alias = alias.trim();
    address.direccion = direccion.trim();
    address.referencia = referencia?.trim() || "";
    await address.save();

    res.redirect("/cliente/addresses");
};

export const confirmDeleteAddressView = async (req, res) => {
    const address = await Address.findOne({
        _id: req.params.id,
        cliente: req.session.user.id
    }).lean();

    if (!address) {
        return res.redirect("/cliente/addresses");
    }

    res.render("cliente/delete-address", { address });
};

export const deleteAddress = async (req, res) => {
    await Address.deleteOne({
        _id: req.params.id,
        cliente: req.session.user.id
    });

    res.redirect("/cliente/addresses");
};
