const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Получить список категорий (для выпадающего списка)
exports.getCategories = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM categories ORDER BY name');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Ошибка получения категорий' });
    }
};

// Создать объявление
exports.createListing = async (req, res) => {
    if (!req.session.user) return res.status(401).json({ message: 'Нужна авторизация' });

    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // Получаем новые поля
        const { 
            title, description, price, category_id, type,
            price_unit, is_price_from,                  // Для аренды/услуг
            auction_start_price, auction_step, auction_end_date // Для аукциона
        } = req.body;

        const userId = req.session.user.id;
        const files = req.files;

        // Определяем финальную цену для записи в основную колонку 'price'
        // Если это аукцион, то текущая цена = начальной ставке
        let finalPrice = price;
        if (type === 'auction') {
            finalPrice = auction_start_price;
        }

        const insertListingQuery = `
            INSERT INTO listings (
                user_id, category_id, title, description, price, type, status,
                price_unit, is_price_from, auction_start_price, auction_step, auction_end_date
            )
            VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8, $9, $10, $11)
            RETURNING id
        `;

        const listingRes = await client.query(insertListingQuery, [
            userId, category_id, title, description, finalPrice, type || 'sell',
            price_unit, is_price_from || false, 
            auction_start_price || null, auction_step || null, auction_end_date || null
        ]);

        const listingId = listingRes.rows[0].id;

        // Сохранение картинок (тот же код)
        if (files && files.length > 0) {
            const insertImageQuery = `INSERT INTO listing_images (listing_id, image_url, is_main) VALUES ($1, $2, $3)`;
            for (let i = 0; i < files.length; i++) {
                const isMain = (i === 0); 
                const imageUrl = `/uploads/${files[i].filename}`;
                await client.query(insertImageQuery, [listingId, imageUrl, isMain]);
            }
        }

        await client.query('COMMIT');
        res.status(201).json({ message: 'Объявление создано', listingId });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: 'Ошибка при создании объявления' });
    } finally {
        client.release();
    }
};