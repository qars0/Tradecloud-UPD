const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Получить данные своего профиля
exports.getMe = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ message: 'Не авторизован' });
        }

        const userId = req.session.user.id;
        
        // Получаем свежие данные из БД (вдруг рейтинг изменился)
        const userQuery = await pool.query(
            'SELECT id, username, email, phone, avatar_url, rating, created_at FROM users WHERE id = $1',
            [userId]
        );

        if (userQuery.rows.length === 0) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        res.json(userQuery.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};

// Обновить профиль (включая аватар)
exports.updateProfile = async (req, res) => {
    if (!req.session.user) return res.status(401).json({ message: 'Не авторизован' });

    const userId = req.session.user.id;
    const { username, phone, email } = req.body;
    
    // Если есть файл, берем путь, иначе null
    const avatarUrl = req.file ? `/uploads/${req.file.filename}` : null;

    try {
        // Динамическое построение запроса (обновляем только то, что пришло)
        let query = 'UPDATE users SET ';
        const values = [];
        let count = 1;

        if (username) { query += `username = $${count++}, `; values.push(username); }
        if (phone) { query += `phone = $${count++}, `; values.push(phone); }
        if (email) { query += `email = $${count++}, `; values.push(email); }
        if (avatarUrl) { query += `avatar_url = $${count++}, `; values.push(avatarUrl); }

        // Убираем последнюю запятую
        query = query.slice(0, -2);
        query += ` WHERE id = $${count} RETURNING id, username, email, phone, avatar_url, rating`;
        values.push(userId);

        const result = await pool.query(query, values);

        // Обновляем сессию
        req.session.user = result.rows[0];

        res.json({ message: 'Профиль обновлен', user: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Ошибка при обновлении' });
    }
};

// Получить публичный профиль другого пользователя
exports.getUserById = async (req, res) => {
    const userId = req.params.id;

    try {
        const query = `
            SELECT id, username, avatar_url, rating, created_at 
            FROM users 
            WHERE id = $1
        `;
        const result = await pool.query(query, [userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        // Возвращаем только публичные данные
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};