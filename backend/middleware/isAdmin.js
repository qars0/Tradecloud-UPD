module.exports = (req, res, next) => {
    if (req.session.user && req.session.user.is_admin) {
        next();
    } else {
        res.status(403).json({ message: 'Доступ запрещен. Требуются права администратора.' });
    }
};