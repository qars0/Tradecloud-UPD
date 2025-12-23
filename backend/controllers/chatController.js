const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Создать чат (или вернуть существующий)
exports.createChat = async (req, res) => {
    if (!req.session.user) return res.status(401).json({ message: 'Авторизуйтесь' });

    const buyerId = req.session.user.id;
    const { listing_id, seller_id } = req.body;

    if (buyerId == seller_id) return res.status(400).json({ message: 'Нельзя писать самому себе' });

    try {
        // Проверяем, есть ли уже чат по этому товару между этими людьми
        const check = await pool.query(
            'SELECT * FROM chats WHERE listing_id = $1 AND buyer_id = $2 AND seller_id = $3',
            [listing_id, buyerId, seller_id]
        );

        if (check.rows.length > 0) {
            return res.json({ id: check.rows[0].id, isNew: false });
        }

        // Создаем новый
        const result = await pool.query(
            'INSERT INTO chats (listing_id, buyer_id, seller_id) VALUES ($1, $2, $3) RETURNING id',
            [listing_id, buyerId, seller_id]
        );

        res.json({ id: result.rows[0].id, isNew: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Ошибка создания чата' });
    }
};

// Получить список моих чатов
exports.getMyChats = async (req, res) => {
    if (!req.session.user) return res.status(401).json({ message: 'Авторизуйтесь' });
    const myId = req.session.user.id;

    try {
        const query = `
            SELECT 
                c.id, c.listing_id,
                l.title as listing_title, 
                img.image_url as listing_image,
                -- Выбираем имя собеседника (если я buyer, то берем seller, и наоборот)
                CASE 
                    WHEN c.buyer_id = $1 THEN seller.full_name 
                    ELSE buyer.full_name 
                END as other_name,
                CASE 
                    WHEN c.buyer_id = $1 THEN seller.avatar_url 
                    ELSE buyer.avatar_url 
                END as other_avatar,
                -- Последнее сообщение (для превью)
                (SELECT content FROM messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message,
                (SELECT created_at FROM messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_time
            FROM chats c
            JOIN users buyer ON c.buyer_id = buyer.id
            JOIN users seller ON c.seller_id = seller.id
            JOIN listings l ON c.listing_id = l.id
            LEFT JOIN listing_images img ON l.id = img.listing_id AND img.is_main = TRUE
            WHERE c.buyer_id = $1 OR c.seller_id = $1
            ORDER BY last_time DESC NULLS LAST
        `;

        const result = await pool.query(query, [myId]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Ошибка получения чатов' });
    }
};

// Получить историю сообщений
exports.getMessages = async (req, res) => {
    if (!req.session.user) return res.status(401).json({ message: 'Авторизуйтесь' });
    const chatId = req.params.id;

    try {
        const result = await pool.query(
            `SELECT m.*, u.avatar_url 
             FROM messages m 
             JOIN users u ON m.sender_id = u.id 
             WHERE chat_id = $1 
             ORDER BY created_at ASC`,
            [chatId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Ошибка истории' });
    }
};