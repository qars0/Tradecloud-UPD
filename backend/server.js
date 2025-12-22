const express = require('express');
const cors = require('cors');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session); // Для хранения сессий в БД
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
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

// Routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

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

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});