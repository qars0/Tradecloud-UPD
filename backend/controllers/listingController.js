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


// Получить список объявлений (с фильтрами)
exports.getListings = async (req, res) => {
    try {
        const { user_id, limit } = req.query;
        // Получаем ID текущего юзера из сессии (если он вошел)
        const currentUserId = req.session.user ? req.session.user.id : null;

        let query = `
            SELECT 
                l.*, 
                u.username, 
                u.full_name,
                u.avatar_url as author_avatar,
                img.image_url,
                -- Магия SQL: Проверяем наличие в таблице favorites
                (CASE WHEN f.user_id IS NOT NULL THEN TRUE ELSE FALSE END) as is_favorite
            FROM listings l
            JOIN users u ON l.user_id = u.id
            LEFT JOIN listing_images img ON l.id = img.listing_id AND img.is_main = TRUE
            LEFT JOIN favorites f ON l.id = f.listing_id AND f.user_id = $1
        `;

        // $1 - это currentUserId. Следующие параметры пойдут с индекса 2
        const values = [currentUserId]; 
        const conditions = [];

        // Фильтр по пользователю (для профиля)
        if (user_id) {
            conditions.push(`l.user_id = $${values.length + 1}`);
            values.push(user_id);
        }

        // Добавляем WHERE, если есть условия
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        // Сортировка (по умолчанию новые сверху)
        query += ' ORDER BY l.created_at DESC';

        if (limit) {
            query += ` LIMIT ${parseInt(limit) || 20}`;
        }

        const result = await pool.query(query, values);

        // Форматируем ответ (собираем images в массив, чтобы фронтенд понимал формат)
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
            
            is_favorite: row.is_favorite // <--- Передаем на фронтенд
        }));

        res.json(listings);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Ошибка получения списка' });
    }
};