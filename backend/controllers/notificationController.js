const { Pool } = require('pg');
require('dotenv').config();

// Инициализируем пул соединений, используя данные из переменных окружения
const pool = new Pool({ 
    user: process.env.DB_USER, 
    host: process.env.DB_HOST, 
    database: process.env.DB_NAME, 
    password: process.env.DB_PASSWORD, 
    port: process.env.DB_PORT 
});

//Получение последних 20 уведомлений текущего пользователя

exports.getMyNotifications = async (req, res) => {
    // Проверка авторизации: если сессии нет, возвращаем 401 (Unauthorized)
    if (!req.session.user) return res.status(401).json([]);
    
    const userId = req.session.user.id;
    
    // Выполняем SQL-запрос с защитой от SQL-инъекций через параметры ($1)
    // Сортируем по дате создания (сначала новые) и ограничиваем выборку 20 записями
    const result = await pool.query(
        'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20', 
        [userId]
    );
    
    // Отправляем массив найденных строк клиенту в формате JSON
    res.json(result.rows);
};

// Метка всех уведомлений пользователя как прочитанных

exports.markRead = async (req, res) => {
    // Проверка авторизации
    if (!req.session.user) return res.status(401);
    
    const userId = req.session.user.id;
    
    // Обновляем флаг is_read для всех записей конкретного пользователя
    await pool.query(
        'UPDATE notifications SET is_read = TRUE WHERE user_id = $1', 
        [userId]
    );
    
    // Возвращаем подтверждение успешного выполнения
    res.json({ success: true });
};


// Получение количества непрочитанных уведомлений
 
exports.getUnreadCount = async (req, res) => {
    // Если пользователь не авторизован, просто возвращаем счетчик 0
    if (!req.session.user) return res.json({ count: 0 });
    
    const userId = req.session.user.id;
    
    // Используем агрегатную функцию COUNT(*) для подсчета строк с флагом is_read = FALSE
    const result = await pool.query(
        'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE', 
        [userId]
    );
    
    // Результат COUNT в pg возвращается в виде строки, поэтому используем parseInt
    res.json({ count: parseInt(result.rows[0].count) });
};