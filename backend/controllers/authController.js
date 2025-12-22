const bcrypt = require('bcrypt');
const { Pool } = require('pg');
require('dotenv').config();

// Подключаемся к тому же пулу, что и в server.js
// В идеале пул лучше вынести в отдельный файл config/db.js, но пока дублируем конфиг для простоты
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

exports.register = async (req, res) => {
    // Добавили full_name
    const { username, full_name, email, password, phone } = req.body;

    try {
        // 1. Проверка существования пользователя
        const userCheck = await pool.query(
            'SELECT * FROM users WHERE email = $1 OR username = $2', 
            [email, username]
        );

        if (userCheck.rows.length > 0) {
            return res.status(400).json({ message: 'Пользователь уже существует' });
        }

        // 2. Хэширование пароля
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Вставляем full_name
        const newUser = await pool.query(
            `INSERT INTO users (username, full_name, email, password_hash, phone) 
             VALUES ($1, $2, $3, $4, $5) 
             RETURNING id, username, full_name, email, avatar_url, phone`,
            [username, full_name, email, passwordHash, phone]
        );
        
        // 4. Автоматический вход
        req.session.user = newUser.rows[0];
        
        res.status(201).json({ 
            message: 'Регистрация успешна', 
            user: req.session.user 
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};

exports.login = async (req, res) => {
    const { username, password } = req.body;

    try {
        // 1. Поиск пользователя (можно по email или по username)
        const userResult = await pool.query(
            'SELECT * FROM users WHERE username = $1 OR email = $1', 
            [username]
        );

        if (userResult.rows.length === 0) {
            return res.status(400).json({ message: 'Неверный логин или пароль' });
        }

        const user = userResult.rows[0];

        // 2. Проверка пароля
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(400).json({ message: 'Неверный логин или пароль' });
        }

        // 3. Создание сессии
        // Убираем хэш пароля из сессии для безопасности
        delete user.password_hash; 
        req.session.user = user;

        res.json({ 
            message: 'Вход выполнен успешно', 
            user: user 
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Ошибка сервера при входе' });
    }
};

exports.logout = (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).json({ message: 'Ошибка при выходе' });
        res.clearCookie('connect.sid'); // Удаляем куку сессии
        res.json({ message: 'Выход выполнен' });
    });
};

exports.checkAuth = (req, res) => {
    if (req.session.user) {
        res.json({ isAuthenticated: true, user: req.session.user });
    } else {
        res.json({ isAuthenticated: false });
    }
};