const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Глобальная переменная для IO
let socketIo = null;

exports.init = (io) => {
    socketIo = io;
};

exports.send = async (userId, type, title, message, link) => {
    try {
        // Сохраняем в БД
        const result = await pool.query(
            'INSERT INTO notifications (user_id, type, title, message, link) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [userId, type, title, message, link]
        );
        const notif = result.rows[0];

        // Отправляем через Socket.io (если юзер онлайн)
        if (socketIo) {
            // Отправляем в комнату user_ID
            socketIo.to(`user_${userId}`).emit('new_notification', notif);
        }
        
        return notif;
    } catch (err) {
        console.error('Notification Error:', err);
    }
};

// Функция проверки завершенных аукционов
exports.checkAuctions = async () => {
    try {
        // Ищем аукционы, которые кончились, но победитель еще не уведомлен
        const result = await pool.query(`
            SELECT l.*, 
                   (SELECT bidder_id FROM bids WHERE listing_id = l.id ORDER BY amount DESC LIMIT 1) as winner_id,
                   (SELECT amount FROM bids WHERE listing_id = l.id ORDER BY amount DESC LIMIT 1) as win_amount
            FROM listings l
            WHERE l.type = 'auction' 
              AND l.auction_end_date < NOW() 
              AND l.winner_notified = FALSE
              AND l.status = 'active'
        `);

        for (const listing of result.rows) {
            // 1. Уведомляем владельца
            await this.send(
                listing.user_id,
                'system',
                'Аукцион завершен',
                `Ваш лот "${listing.title}" завершен.`,
                `/listing.html?id=${listing.id}`
            );

            // 2. Уведомляем победителя (если были ставки)
            if (listing.winner_id) {
                await this.send(
                    listing.winner_id,
                    'win',
                    'Поздравляем! Вы победили!',
                    `Вы выиграли лот "${listing.title}" за ${Math.floor(listing.win_amount)} ₽.`,
                    `/listing.html?id=${listing.id}`
                );
            }

            // 3. Помечаем, что уведомления отправлены
            await pool.query('UPDATE listings SET winner_notified = TRUE WHERE id = $1', [listing.id]);
        }
    } catch (err) {
        console.error('Auction Check Error:', err);
    }
};