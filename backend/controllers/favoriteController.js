const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Добавить или Удалить из избранного (Toggle)
exports.toggleFavorite = async (req, res) => {
    if (!req.session.user) return res.status(401).json({ message: 'Нужна авторизация' });

    const userId = req.session.user.id;
    const { listing_id } = req.body;

    try {
        // 1. Проверяем, есть ли уже лайк
        const check = await pool.query(
            'SELECT * FROM favorites WHERE user_id = $1 AND listing_id = $2',
            [userId, listing_id]
        );

        if (check.rows.length > 0) {
            // Удаляем
            await pool.query(
                'DELETE FROM favorites WHERE user_id = $1 AND listing_id = $2',
                [userId, listing_id]
            );
            res.json({ status: 'removed', message: 'Удалено из избранного' });
        } else {
            // Добавляем
            await pool.query(
                'INSERT INTO favorites (user_id, listing_id) VALUES ($1, $2)',
                [userId, listing_id]
            );
            res.json({ status: 'added', message: 'Добавлено в избранное' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};

// Получить список избранных товаров пользователя
exports.getMyFavorites = async (req, res) => {
    if (!req.session.user) return res.status(401).json({ message: 'Нужна авторизация' });
    const userId = req.session.user.id;

    try {
        // Запрос похож на getListings, но через INNER JOIN favorites
        const query = `
            SELECT 
                l.*, 
                u.username, 
                u.full_name,
                img.image_url
            FROM favorites f
            JOIN listings l ON f.listing_id = l.id
            JOIN users u ON l.user_id = u.id
            LEFT JOIN listing_images img ON l.id = img.listing_id AND img.is_main = TRUE
            WHERE f.user_id = $1
            ORDER BY f.listing_id DESC
        `;

        const result = await pool.query(query, [userId]);

        const listings = result.rows.map(row => ({
            id: row.id,
            title: row.title,
            price: row.price,
            type: row.type,
            status: row.status,
            created_at: row.created_at,
            user_id: row.user_id,
            username: row.username,
            full_name: row.full_name,
            price_unit: row.price_unit,
            is_price_from: row.is_price_from,
            images: row.image_url ? [{ image_url: row.image_url }] : [],
            is_favorite: true // Раз мы в списке избранного, то это true
        }));

        res.json(listings);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Ошибка получения избранного' });
    }
};