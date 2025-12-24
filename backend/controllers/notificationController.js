const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ user: process.env.DB_USER, host: process.env.DB_HOST, database: process.env.DB_NAME, password: process.env.DB_PASSWORD, port: process.env.DB_PORT });

exports.getMyNotifications = async (req, res) => {
    if (!req.session.user) return res.status(401).json([]);
    const userId = req.session.user.id;
    const result = await pool.query('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20', [userId]);
    res.json(result.rows);
};

exports.markRead = async (req, res) => {
    if (!req.session.user) return res.status(401);
    const userId = req.session.user.id;
    await pool.query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1', [userId]);
    res.json({ success: true });
};

exports.getUnreadCount = async (req, res) => {
    if (!req.session.user) return res.json({ count: 0 });
    const userId = req.session.user.id;
    const result = await pool.query('SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE', [userId]);
    res.json({ count: parseInt(result.rows[0].count) });
};