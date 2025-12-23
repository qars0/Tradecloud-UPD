const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Статистика для дашборда
exports.getStats = async (req, res) => {
    try {
        const usersCount = await pool.query('SELECT COUNT(*) FROM users');
        const listingsCount = await pool.query('SELECT COUNT(*) FROM listings');
        const reportsCount = await pool.query("SELECT COUNT(*) FROM reports WHERE status = 'pending'");
        const dealsCount = await pool.query("SELECT COUNT(*) FROM listings WHERE status = 'sold'");

        res.json({
            users: usersCount.rows[0].count,
            listings: listingsCount.rows[0].count,
            reports: reportsCount.rows[0].count,
            deals: dealsCount.rows[0].count
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};

// Получить все жалобы
exports.getReports = async (req, res) => {
    try {
        const query = `
            SELECT r.*, l.title as listing_title, u.username as reporter_name 
            FROM reports r
            LEFT JOIN listings l ON r.listing_id = l.id
            LEFT JOIN users u ON r.reporter_id = u.id
            ORDER BY r.created_at DESC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Ошибка' });
    }
};

// Действия с жалобами (Удалить товар или отклонить жалобу)
exports.resolveReport = async (req, res) => {
    const { reportId, action } = req.body; // action: 'delete_listing', 'dismiss'

    try {
        if (action === 'delete_listing') {
            // Находим ID объявления
            const report = await pool.query('SELECT listing_id FROM reports WHERE id = $1', [reportId]);
            if (report.rows.length > 0) {
                const listingId = report.rows[0].listing_id;
                await pool.query('DELETE FROM listings WHERE id = $1', [listingId]);
                await pool.query("UPDATE reports SET status = 'resolved' WHERE id = $1", [reportId]);
                return res.json({ message: 'Объявление удалено, жалоба закрыта' });
            }
        } else {
            await pool.query("UPDATE reports SET status = 'dismissed' WHERE id = $1", [reportId]);
            return res.json({ message: 'Жалоба отклонена' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Ошибка' });
    }
};

// Получить всех пользователей
exports.getUsers = async (req, res) => {
    try {
        const result = await pool.query('SELECT id, username, full_name, email, is_admin, created_at FROM users ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Ошибка' });
    }
};

// Удалить пользователя (Бан)
exports.deleteUser = async (req, res) => {
    const userId = req.params.id;
    try {
        await pool.query('DELETE FROM users WHERE id = $1', [userId]);
        res.json({ message: 'Пользователь удален' });
    } catch (err) {
        res.status(500).json({ message: 'Ошибка' });
    }
};