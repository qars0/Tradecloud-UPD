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
        const { 
            user_id, limit, 
            search, category_id, type, 
            min_price, max_price, sort,
            status // <--- Добавим возможность передать статус извне
        } = req.query;
        
        const currentUserId = req.session.user ? req.session.user.id : null;

        // ... начало запроса (SELECT ...) без изменений ...
        let query = `
            SELECT 
                l.*, 
                u.username, u.full_name, u.avatar_url as author_avatar,
                img.image_url,
                (CASE WHEN f.user_id IS NOT NULL THEN TRUE ELSE FALSE END) as is_favorite
            FROM listings l
            JOIN users u ON l.user_id = u.id
            LEFT JOIN listing_images img ON l.id = img.listing_id AND img.is_main = TRUE
            LEFT JOIN favorites f ON l.id = f.listing_id AND f.user_id = $1
        `;

        const values = [currentUserId]; 
        const conditions = []; // <--- УБИРАЕМ отсюда жесткий 'active'

        // --- ЛОГИКА СТАТУСА ---
        if (status) {
            // Если статус передан явно (например ?status=sold)
            conditions.push(`l.status = $${values.length + 1}`);
            values.push(status);
        } else if (user_id) {
            // Если мы смотрим профиль конкретного юзера - показываем ВСЁ (active, sold, reserved)
            // Кроме 'archived' (удаленных), если они у тебя будут
            conditions.push(`l.status != 'archived'`);
        } else {
            // Во всех остальных случаях (Главная, Каталог) - только активные
            conditions.push(`l.status = 'active'`);
        }

        if (user_id) {
            conditions.push(`l.user_id = $${values.length + 1}`);
            values.push(user_id);
        }
        if (category_id) {
            conditions.push(`l.category_id = $${values.length + 1}`);
            values.push(category_id);
        }
        if (type) {
            conditions.push(`l.type = $${values.length + 1}`);
            values.push(type);
        }
        if (search) {
            conditions.push(`(l.title ILIKE $${values.length + 1} OR l.description ILIKE $${values.length + 1})`);
            values.push(`%${search}%`);
        }
        if (min_price) {
            conditions.push(`l.price >= $${values.length + 1}`);
            values.push(min_price);
        }
        if (max_price) {
            conditions.push(`l.price <= $${values.length + 1}`);
            values.push(max_price);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        // --- Сортировка ---
        if (sort === 'cheap') {
            query += ' ORDER BY l.price ASC';
        } else if (sort === 'expensive') {
            query += ' ORDER BY l.price DESC';
        } else {
            query += ' ORDER BY l.created_at DESC'; // По умолчанию новые
        }

        if (limit) {
            query += ` LIMIT ${parseInt(limit) || 20}`;
        }

        const result = await pool.query(query, values);
        
        // ... (mapping результата в listings остается прежним) ...
        const listings = result.rows.map(row => ({
            id: row.id,
            title: row.title,
            price: row.price,
            type: row.type,
            status: row.status, // Важно возвращать статус
            created_at: row.created_at,
            user_id: row.user_id,
            username: row.username,
            full_name: row.full_name,
            price_unit: row.price_unit,
            is_price_from: row.is_price_from,
            images: row.image_url ? [{ image_url: row.image_url }] : [],
            is_favorite: row.is_favorite
        }));

        res.json(listings);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Ошибка получения списка' });
    }
};

// Получить одно объявление по ID
exports.getListingById = async (req, res) => {
    try {
        const listingId = req.params.id;
        console.log(`🔎 Ищу объявление с ID: ${listingId}`);
        const currentUserId = req.session.user ? req.session.user.id : null;

        // 1. Получаем само объявление + инфо об авторе
        // Используем LEFT JOIN с bids, чтобы сразу найти макс. ставку
        const query = `
            SELECT 
                l.*, 
                u.username, u.full_name, u.phone, u.avatar_url as author_avatar, u.rating as author_rating, u.created_at as author_joined,
                (SELECT MAX(amount) FROM bids WHERE listing_id = l.id) as current_max_bid,
                (SELECT COUNT(*) FROM bids WHERE listing_id = l.id) as bid_count,
                (CASE WHEN f.user_id IS NOT NULL THEN TRUE ELSE FALSE END) as is_favorite
            FROM listings l
            JOIN users u ON l.user_id = u.id
            LEFT JOIN favorites f ON l.id = f.listing_id AND f.user_id = $2
            WHERE l.id = $1
        `;
        const listingRes = await pool.query(query, [listingId, currentUserId]);

        if (listingRes.rows.length === 0) {
            return res.status(404).json({ message: 'Объявление не найдено' });
        }
        const listing = listingRes.rows[0];

        // 2. Получаем картинки
        const imagesRes = await pool.query(
            'SELECT image_url FROM listing_images WHERE listing_id = $1 ORDER BY is_main DESC',
            [listingId]
        );
        listing.images = imagesRes.rows;
        // 3. Получаем историю ставок (только для аукциона)
        if (listing.type === 'auction') {
            const historyRes = await pool.query(`
                SELECT b.amount, b.created_at, u.username 
                FROM bids b
                JOIN users u ON b.bidder_id = u.id
                WHERE b.listing_id = $1
                ORDER BY b.amount DESC
                LIMIT 10
            `, [listingId]);
            listing.bid_history = historyRes.rows;
            // Если ставок нет, текущая цена = начальной
            listing.current_price = listing.current_max_bid || listing.auction_start_price;
        }
        res.json(listing);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};

// Сделать ставку (Аукцион)
exports.placeBid = async (req, res) => {
    if (!req.session.user) return res.status(401).json({ message: 'Нужна авторизация' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { listing_id, amount } = req.body;
        const userId = req.session.user.id;
        const bidAmount = parseFloat(amount);

        // 1. Блокируем строку объявления для проверки (чтобы избежать гонки ставок)
        const listingRes = await client.query('SELECT * FROM listings WHERE id = $1 FOR UPDATE', [listing_id]);
        
        if (listingRes.rows.length === 0) throw new Error('Объявление не найдено');
        const listing = listingRes.rows[0];

        if (listing.type !== 'auction') throw new Error('Это не аукцион');
        if (listing.user_id === userId) throw new Error('Нельзя ставить на свой лот');
        if (new Date(listing.auction_end_date) < new Date()) throw new Error('Аукцион завершен');

        // 2. Получаем текущую макс ставку
        const maxBidRes = await client.query('SELECT MAX(amount) as max_bid FROM bids WHERE listing_id = $1', [listing_id]);
        const currentMax = parseFloat(maxBidRes.rows[0].max_bid) || parseFloat(listing.auction_start_price);

        // 3. Валидация
        // Ставка должна быть больше текущей МИНИМУМ на шаг (если ставок нет — то >= стартовой)
        const minNextBid = (maxBidRes.rows[0].max_bid) 
            ? currentMax + parseFloat(listing.auction_step) 
            : parseFloat(listing.auction_start_price);

        if (bidAmount < minNextBid) {
            throw new Error(`Минимальная ставка: ${minNextBid} ₽`);
        }

        // 4. Записываем ставку
        await client.query(
            'INSERT INTO bids (listing_id, bidder_id, amount) VALUES ($1, $2, $3)',
            [listing_id, userId, bidAmount]
        );

        // 5. Можно добавить уведомление предыдущему лидеру (тут пропустим для простоты)

        await client.query('COMMIT');
        res.json({ message: 'Ставка принята!', new_price: bidAmount });

    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: err.message || 'Ошибка ставки' });
    } finally {
        client.release();
    }
};

// Удалить объявление
exports.deleteListing = async (req, res) => {
    if (!req.session.user) return res.status(401).json({ message: 'Нет авторизации' });
    
    const listingId = req.params.id;
    const userId = req.session.user.id;

    try {
        // Проверяем владельца
        const check = await pool.query('SELECT user_id FROM listings WHERE id = $1', [listingId]);
        if (check.rows.length === 0) return res.status(404).json({ message: 'Не найдено' });
        
        if (check.rows[0].user_id !== userId) {
            return res.status(403).json({ message: 'Это не ваше объявление' });
        }

        // Удаляем (Postgres CASCADE удалит картинки, ставки и чаты сам)
        await pool.query('DELETE FROM listings WHERE id = $1', [listingId]);
        
        // В идеале надо еще удалить файлы картинок с диска (fs.unlink), 
        // но для учебного проекта можно пропустить.

        res.json({ message: 'Объявление удалено' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};

// Изменить статус (например, на 'sold')
exports.updateStatus = async (req, res) => {
    if (!req.session.user) return res.status(401).json({ message: 'Нет авторизации' });

    const listingId = req.params.id;
    const { status } = req.body; // 'active', 'sold', 'reserved'
    const userId = req.session.user.id;

    try {
        const check = await pool.query('SELECT user_id FROM listings WHERE id = $1', [listingId]);
        if (check.rows.length === 0) return res.status(404).json({ message: 'Не найдено' });
        
        if (check.rows[0].user_id !== userId) {
            return res.status(403).json({ message: 'Нет прав' });
        }

        await pool.query('UPDATE listings SET status = $1 WHERE id = $2', [status, listingId]);
        res.json({ message: 'Статус обновлен' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};