-- =============================================================================
-- БАЗА ДАННЫХ ПЛАТФОРМЫ ОБЪЯВЛЕНИЙ
-- =============================================================================

-- 1. СБРОС СУЩЕСТВУЮЩИХ ТАБЛИЦ (Очистка)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS "session" CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS chats CASCADE;
DROP TABLE IF EXISTS favorites CASCADE;
DROP TABLE IF EXISTS listing_images CASCADE;
DROP TABLE IF EXISTS bids CASCADE;
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS listings CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;


-- 2. ПОЛЬЗОВАТЕЛИ И СЕССИИ
-- -----------------------------------------------------------------------------
CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(50) UNIQUE NOT NULL,
    full_name     VARCHAR(100),
    email         VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone         VARCHAR(20),
    avatar_url    VARCHAR(255),
    rating        DECIMAL(3, 2) DEFAULT 0.00,
    is_admin      BOOLEAN DEFAULT FALSE,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "session" (
    "sid"    VARCHAR NOT NULL PRIMARY KEY,
    "sess"   JSON NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL
) WITH (OIDS=FALSE);

CREATE INDEX "IDX_session_expire" ON "session" ("expire");


-- 3. КАТЕГОРИИ И ОБЪЯВЛЕНИЯ
-- -----------------------------------------------------------------------------
CREATE TABLE categories (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    slug       VARCHAR(100) UNIQUE NOT NULL,
    icon_class VARCHAR(50)
);

CREATE TABLE listings (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER REFERENCES users(id) ON DELETE CASCADE,
    category_id         INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    title               VARCHAR(255) NOT NULL,
    description         TEXT,
    price               DECIMAL(10, 2) NOT NULL,
    
    -- Типизация: sell (продажа), rent (аренда), service (услуга), auction (аукцион)
    type                VARCHAR(50) DEFAULT 'sell',
    status              VARCHAR(20) DEFAULT 'active', -- active, reserved, sold, archived

    -- Параметры аренды/услуг
    price_unit          VARCHAR(20) DEFAULT NULL,    -- hour, day, piece, sqm
    is_price_from       BOOLEAN DEFAULT FALSE,

    -- Параметры аукциона
    auction_start_price DECIMAL(10, 2),
    auction_step        DECIMAL(10, 2),
    auction_end_date    TIMESTAMP,

    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE listing_images (
    id         SERIAL PRIMARY KEY,
    listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
    image_url  VARCHAR(255) NOT NULL,
    is_main    BOOLEAN DEFAULT FALSE
);


-- 4. ВЗАИМОДЕЙСТВИЕ: СТАВКИ, ИЗБРАННОЕ, ЖАЛОБЫ
-- -----------------------------------------------------------------------------
CREATE TABLE bids (
    id         SERIAL PRIMARY KEY,
    listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
    bidder_id  INTEGER REFERENCES users(id) ON DELETE CASCADE,
    amount     DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE favorites (
    user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
    listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, listing_id)
);

CREATE TABLE reports (
    id          SERIAL PRIMARY KEY,
    listing_id  INTEGER REFERENCES listings(id) ON DELETE CASCADE,
    reporter_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reason      VARCHAR(50) NOT NULL, -- spam, fraud, forbidden, other
    comment     TEXT,
    status      VARCHAR(20) DEFAULT 'pending', -- pending, resolved, dismissed
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- 5. КОММУНИКАЦИИ И ОТЗЫВЫ
-- -----------------------------------------------------------------------------
CREATE TABLE chats (
    id         SERIAL PRIMARY KEY,
    listing_id INTEGER REFERENCES listings(id) ON DELETE SET NULL,
    buyer_id   INTEGER REFERENCES users(id) ON DELETE CASCADE,
    seller_id  INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE messages (
    id         SERIAL PRIMARY KEY,
    chat_id    INTEGER REFERENCES chats(id) ON DELETE CASCADE,
    sender_id  INTEGER REFERENCES users(id) ON DELETE CASCADE,
    content    TEXT NOT NULL,
    is_read    BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE reviews (
    id         SERIAL PRIMARY KEY,
    target_id  INTEGER REFERENCES users(id) ON DELETE CASCADE, -- Получатель
    author_id  INTEGER REFERENCES users(id) ON DELETE CASCADE, -- Автор
    rating     INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment    TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =============================================================================
-- НАПОЛНЕНИЕ ТЕСТОВЫМИ ДАННЫМИ (SEEDING)
-- =============================================================================

-- Категории
INSERT INTO categories (name, slug, icon_class) VALUES
('Электроника',    'electronics', 'bx bx-laptop'),
('Одежда и обувь', 'clothing',    'bx bx-closet'),
('Дом и уют',      'home',        'bx bx-home-alt'),
('Услуги и работа','services',    'bx bx-wrench'),
('Хобби и спорт',  'hobbies',     'bx bx-basketball'),
('Учеба и книги',  'books',       'bx bx-book');

-- Пользователи
INSERT INTO users (username, full_name, email, phone, password_hash, avatar_url, rating, is_admin) VALUES
('admin', 'Администратор', 'admin@admin.com', '+79990001122', '$2a$12$jufDd6CgR57Qg5LfZRP4BecfDvvI4DQEJgPEW6OLp.HJDOznvjzqu', 'https://randomuser.me/api/portraits/lego/1.jpg', 5.0, TRUE),
('alex_student', 'Алексей Петров', 'alex@test.com', '+79001112233', '$2a$12$jufDd6CgR57Qg5LfZRP4BecfDvvI4DQEJgPEW6OLp.HJDOznvjzqu', 'https://randomuser.me/api/portraits/men/32.jpg', 4.8, FALSE),
('maria_design', 'Мария Иванова', 'maria@test.com', '+79998887766', '$2a$12$jufDd6CgR57Qg5LfZRP4BecfDvvI4DQEJgPEW6OLp.HJDOznvjzqu', 'https://randomuser.me/api/portraits/women/44.jpg', 5.0, FALSE),
('teacher_john', 'Иван Сидоров', 'ivan@test.com', '+79005554433', '$2a$12$jufDd6CgR57Qg5LfZRP4BecfDvvI4DQEJgPEW6OLp.HJDOznvjzqu', 'https://randomuser.me/api/portraits/men/85.jpg', 4.5, FALSE);

-- Объявления и Изображения
-- 1. MacBook (Продажа)
INSERT INTO listings (user_id, category_id, title, description, price, type, status) 
VALUES (2, 1, 'MacBook Pro 14 M1 Pro', 'В идеальном состоянии, полный комплект. Использовался для учебы.', 120000, 'sell', 'active');
INSERT INTO listing_images (listing_id, image_url, is_main) VALUES 
(1, 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80', TRUE),
(1, 'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?auto=format&fit=crop&w=800&q=80', FALSE);

-- 2. Репетитор (Услуга)
INSERT INTO listings (user_id, category_id, title, description, price, type, price_unit, is_price_from) 
VALUES (3, 4, 'Репетитор по высшей математике', 'Помогу подготовиться к экзаменам, решить контрольные. Опыт 3 года.', 800, 'service', 'hour', TRUE);
INSERT INTO listing_images (listing_id, image_url, is_main) VALUES 
(2, 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=800&q=80', TRUE);

-- 3. PS5 (Аренда)
INSERT INTO listings (user_id, category_id, title, description, price, type, price_unit) 
VALUES (2, 1, 'Sony PlayStation 5 + 2 геймпада', 'Сдаю в аренду на выходные. Игры: FIFA 24, MK1, Spider-Man 2.', 1500, 'rent', 'day');
INSERT INTO listing_images (listing_id, image_url, is_main) VALUES 
(3, 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?auto=format&fit=crop&w=800&q=80', TRUE);

-- 4. Монета (Аукцион)
INSERT INTO listings (user_id, category_id, title, description, price, type, auction_start_price, auction_step, auction_end_date) 
VALUES (4, 5, 'Коллекционная монета 1 рубль 1898 года', 'Оригинал. Состояние на фото.', 5000, 'auction', 5000, 100, NOW() + INTERVAL '3 days');
INSERT INTO listing_images (listing_id, image_url, is_main) VALUES 
(4, 'https://images.unsplash.com/photo-1519751138087-5bf79df62d5b?auto=format&fit=crop&w=800&q=80', TRUE);

-- 5. Книги (Продано)
INSERT INTO listings (user_id, category_id, title, description, price, type, status) 
VALUES (3, 6, 'Учебники English File B2', 'Учебник и рабочая тетрадь. Исписаны карандашом.', 1000, 'sell', 'sold');
INSERT INTO listing_images (listing_id, image_url, is_main) VALUES 
(5, 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=800&q=80', TRUE);