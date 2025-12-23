const express = require('express');
const cors = require('cors');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const http = require('http'); // <--- 1
const { Server } = require('socket.io'); // <--- 2
require('dotenv').config();

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

// --- SOCKET.IO LOGIC ---
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Вход в комнату чата
    socket.on('join_chat', (chatId) => {
        socket.join(chatId);
        console.log(`Socket ${socket.id} joined chat ${chatId}`);
    });

    // Отправка сообщения
    socket.on('send_message', async (data) => {
        // data = { chatId, senderId, content }
        const { chatId, senderId, content } = data;

        try {
            // Сохраняем в БД
            const result = await pool.query(
                'INSERT INTO messages (chat_id, sender_id, content) VALUES ($1, $2, $3) RETURNING *',
                [chatId, senderId, content]
            );
            
            const savedMsg = result.rows[0];

            // Отправляем всем в комнате (включая отправителя, чтобы подтвердить)
            io.to(chatId).emit('receive_message', savedMsg);
            
        } catch (err) {
            console.error('Ошибка сохранения сообщения:', err);
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

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/chats', chatRoutes);

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