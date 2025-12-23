const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Добавить отзыв
exports.addReview = async (req, res) => {
    if (!req.session.user) return res.status(401).json({ message: 'Нужна авторизация' });

    const authorId = req.session.user.id;
    const { target_id, rating, comment } = req.body;

    if (parseInt(authorId) === parseInt(target_id)) {
        return res.status(400).json({ message: 'Нельзя ставить отзыв самому себе' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Добавляем отзыв
        await client.query(
            'INSERT INTO reviews (author_id, target_id, rating, comment) VALUES ($1, $2, $3, $4)',
            [authorId, target_id, rating, comment]
        );

        // 2. Пересчитываем средний рейтинг пользователя
        const avgRes = await client.query(
            'SELECT AVG(rating) as new_rating FROM reviews WHERE target_id = $1',
            [target_id]
        );
        
        const newRating = parseFloat(avgRes.rows[0].new_rating).toFixed(1);

        // 3. Обновляем рейтинг в таблице users
        await client.query(
            'UPDATE users SET rating = $1 WHERE id = $2',
            [newRating, target_id]
        );

        await client.query('COMMIT');

        res.json({ message: 'Отзыв опубликован', newRating });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: 'Ошибка сервера' });
    } finally {
        client.release();
    }
};

// Получить отзывы пользователя
exports.getReviews = async (req, res) => {
    const targetId = req.params.userId;

    try {
        const query = `
            SELECT r.*, u.full_name, u.username, u.avatar_url
            FROM reviews r
            JOIN users u ON r.author_id = u.id
            WHERE r.target_id = $1
            ORDER BY r.created_at DESC
        `;
        const result = await pool.query(query, [targetId]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Ошибка получения отзывов' });
    }
};