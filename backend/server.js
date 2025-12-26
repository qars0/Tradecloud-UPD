const express = require('express');
const cors = require('cors');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const http = require('http'); // <--- 1
const { Server } = require('socket.io'); // <--- 2
require('dotenv').config();

const notifService = require('./services/notificationService');

const app = express();
const server = http.createServer(app); // <--- 3. Создаем HTTP сервер
const io = new Server(server, {        // <--- 4. Инициализируем Socket.io
    cors: {
        origin: "*", // Разрешаем подключение с фронтенда
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// DB Setup
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Session Config (ВАЖНО)
app.use(session({
    store: new pgSession({
        pool: pool,                // Используем наш пул подключений
        tableName: 'session'       // Таблица, которую мы создали
    }),
    secret: process.env.SESSION_SECRET || 'dev_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 дней
        httpOnly: true
    }
}));

notifService.init(io); 

// Запускаем проверку аукционов каждую минуту
setInterval(() => {
    notifService.checkAuctions();
}, 60000); // 60 секунд


// SOCKET.IO LOGIC 
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    // Подписка на личные уведомления
    socket.on('login', (userId) => {
        socket.join(`user_${userId}`);
    })
    
    // Вход в комнату чата
    socket.on('join_chat', (chatId) => {
        socket.join(chatId);
        console.log(`Socket ${socket.id} joined chat ${chatId}`);
    });

    // Отправка сообщения
    socket.on('send_message', async (data) => {
        const { chatId, senderId, content } = data;

        try {
            // Сохраняем сообщение в базу
            const msgResult = await pool.query(
                'INSERT INTO messages (chat_id, sender_id, content) VALUES ($1, $2, $3) RETURNING *',
                [chatId, senderId, content]
            );
            const savedMsg = msgResult.rows[0];

            // Отправляем сообщение в комнату чата (для реалтайм обновления окна чата)
            io.to(chatId).emit('receive_message', savedMsg);

            // Находим, кому отправить уведомление
            const chatRes = await pool.query(
                'SELECT buyer_id, seller_id FROM chats WHERE id = $1',
                [chatId]
            );

            if (chatRes.rows.length > 0) {
                const { buyer_id, seller_id } = chatRes.rows[0];
                // Получатель — это тот, кто НЕ является отправителем
                const recipientId = (senderId == buyer_id) ? seller_id : buyer_id;

                // Находим имя отправителя для текста уведомления
                const senderRes = await pool.query('SELECT full_name, username FROM users WHERE id = $1', [senderId]);
                const senderName = senderRes.rows[0].full_name || senderRes.rows[0].username;

                // Отправляем уведомление через сервис
                await notifService.send(
                    recipientId,
                    'message',
                    'Новое сообщение',
                    `От ${senderName}: "${content.substring(0, 30)}${content.length > 30 ? '...' : ''}"`,
                    `/chat.html?chat_id=${chatId}`
                );
            }
            
        } catch (err) {
            console.error('Socket Message Error:', err);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const listingRoutes = require('./routes/listings');
const favoriteRoutes = require('./routes/favorites');
const chatRoutes = require('./routes/chats');
const reviewRoutes = require('./routes/reviews');
const adminRoutes = require('./routes/admin');
const notifRoutes = require('./routes/notifications');

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notifRoutes);

// Test Route
app.get('/api/health', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({ 
            status: 'OK', 
            message: 'Backend works!', 
            db_time: result.rows[0].now 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'Error', error: err.message });
    }
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});