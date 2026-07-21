export const isAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect("/");
    }
    next();
};

export const hasRole = (...roles) => {
    return (req, res, next) => {
        if (!req.session.user) {
            return res.redirect("/");
        }

        if (!roles.includes(req.session.user.role)) {
            return res.send("No autorizado");
        }

        next();
    };
};