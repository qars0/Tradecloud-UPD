-- 1. Сброс таблиц (чистый лист)
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS chats CASCADE;
DROP TABLE IF EXISTS favorites CASCADE;
DROP TABLE IF EXISTS listing_images CASCADE;
DROP TABLE IF EXISTS bids CASCADE;
DROP TABLE IF EXISTS listings CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS "session" CASCADE;

-- 2. Создание таблицы Пользователи
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(100), -- Добавили имя
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    avatar_url VARCHAR(255),
    rating DECIMAL(3, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Категории
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    icon_class VARCHAR(50)
);

-- 4. Объявления (со всеми новыми полями)
CREATE TABLE listings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    
    -- Тип и статус
    type VARCHAR(50) DEFAULT 'sell', -- sell, rent, service, auction
    status VARCHAR(20) DEFAULT 'active', -- active, reserved, sold, archived

    -- Для услуг и аренды
    price_unit VARCHAR(20) DEFAULT NULL, -- hour, day, piece, service, sqm
    is_price_from BOOLEAN DEFAULT FALSE,

    -- Для аукциона
    auction_start_price DECIMAL(10, 2),
    auction_step DECIMAL(10, 2),
    auction_end_date TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Изображения
CREATE TABLE listing_images (
    id SERIAL PRIMARY KEY,
    listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
    image_url VARCHAR(255) NOT NULL,
    is_main BOOLEAN DEFAULT FALSE
);

-- 6. Ставки аукциона
CREATE TABLE bids (
    id SERIAL PRIMARY KEY,
    listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
    bidder_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Избранное
CREATE TABLE favorites (
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, listing_id)
);

-- 8. Чаты
CREATE TABLE chats (
    id SERIAL PRIMARY KEY,
    listing_id INTEGER REFERENCES listings(id) ON DELETE SET NULL,
    buyer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    seller_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Сообщения
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    chat_id INTEGER REFERENCES chats(id) ON DELETE CASCADE,
    sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. Отзывы
CREATE TABLE reviews (
    id SERIAL PRIMARY KEY,
    target_id INTEGER REFERENCES users(id) ON DELETE CASCADE, -- Кому отзыв
    author_id INTEGER REFERENCES users(id) ON DELETE CASCADE, -- Кто написал
    rating INTEGER NOT NULL,
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. Сессии
CREATE TABLE "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
)
WITH (OIDS=FALSE);
ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;
CREATE INDEX "IDX_session_expire" ON "session" ("expire");


-- =============================================
-- ЗАПОЛНЕНИЕ ТЕСТОВЫМИ ДАННЫМИ (SEEDING)
-- =============================================

-- 1. Категории
INSERT INTO categories (name, slug, icon_class) VALUES
('Электроника', 'electronics', 'bx bx-laptop'),
('Одежда и обувь', 'clothing', 'bx bx-closet'),
('Дом и уют', 'home', 'bx bx-home-alt'),
('Услуги и работа', 'services', 'bx bx-wrench'),
('Хобби и спорт', 'hobbies', 'bx bx-basketball'),
('Учеба и книги', 'books', 'bx bx-book');

-- 2. Пользователи
-- Пароль у всех одинаковый (тот хэш, что ты дал)
INSERT INTO users (username, full_name, email, phone, password_hash, avatar_url, rating) VALUES
('alex_student', 'Алексей Петров', 'alex@test.com', '+79001112233', '$2a$12$jufDd6CgR57Qg5LfZRP4BecfDvvI4DQEJgPEW6OLp.HJDOznvjzqu', 'https://randomuser.me/api/portraits/men/32.jpg', 4.8),
('maria_design', 'Мария Иванова', 'maria@test.com', '+79998887766', '$2a$12$jufDd6CgR57Qg5LfZRP4BecfDvvI4DQEJgPEW6OLp.HJDOznvjzqu', 'https://randomuser.me/api/portraits/women/44.jpg', 5.0),
('teacher_john', 'Иван Сидоров', 'ivan@test.com', '+79005554433', '$2a$12$jufDd6CgR57Qg5LfZRP4BecfDvvI4DQEJgPEW6OLp.HJDOznvjzqu', 'https://randomuser.me/api/portraits/men/85.jpg', 4.5);

-- 3. Объявления

-- Лот 1: MacBook (Товар) - Продавец alex_student (id: 1)
INSERT INTO listings (user_id, category_id, title, description, price, type, status) 
VALUES (1, 1, 'MacBook Pro 14 M1 Pro', 'В идеальном состоянии, полный комплект. Использовался для учебы.', 120000, 'sell', 'active');

INSERT INTO listing_images (listing_id, image_url, is_main) VALUES 
(1, 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80', TRUE),
(1, 'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?auto=format&fit=crop&w=800&q=80', FALSE);


-- Лот 2: Репетитор (Услуга) - Продавец maria_design (id: 2)
INSERT INTO listings (user_id, category_id, title, description, price, type, price_unit, is_price_from) 
VALUES (2, 4, 'Репетитор по высшей математике', 'Помогу подготовиться к экзаменам, решить контрольные. Опыт 3 года.', 800, 'service', 'hour', TRUE);

INSERT INTO listing_images (listing_id, image_url, is_main) VALUES 
(2, 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=800&q=80', TRUE);


-- Лот 3: PS5 (Аренда) - Продавец alex_student (id: 1)
INSERT INTO listings (user_id, category_id, title, description, price, type, price_unit) 
VALUES (1, 1, 'Sony PlayStation 5 + 2 геймпада', 'Сдаю в аренду на выходные. Игры: FIFA 24, MK1, Spider-Man 2.', 1500, 'rent', 'day');

INSERT INTO listing_images (listing_id, image_url, is_main) VALUES 
(3, 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?auto=format&fit=crop&w=800&q=80', TRUE);


-- Лот 4: Редкая монета (Аукцион) - Продавец teacher_john (id: 3)
INSERT INTO listings (user_id, category_id, title, description, price, type, auction_start_price, auction_step, auction_end_date) 
VALUES (3, 5, 'Коллекционная монета 1 рубль 1898 года', 'Оригинал. Состояние на фото. Стартуем с 5000 рублей.', 5000, 'auction', 5000, 100, NOW() + INTERVAL '3 days');

INSERT INTO listing_images (listing_id, image_url, is_main) VALUES 
(4, 'https://images.unsplash.com/photo-1519751138087-5bf79df62d5b?auto=format&fit=crop&w=800&q=80', TRUE);


-- Лот 5: Книги (Продано) - Продавец maria_design (id: 2)
INSERT INTO listings (user_id, category_id, title, description, price, type, status) 
VALUES (2, 6, 'Учебники English File B2', 'Учебник и рабочая тетрадь. Исписаны карандашом.', 1000, 'sell', 'sold');

INSERT INTO listing_images (listing_id, image_url, is_main) VALUES 
(5, 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=800&q=80', TRUE);