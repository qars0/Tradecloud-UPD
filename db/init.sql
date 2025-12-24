-- =============================================================================
-- БАЗА ДАННЫХ ПЛАТФОРМЫ ОБЪЯВЛЕНИЙ (ПЕРЕРАБОТАННАЯ)
-- =============================================================================

BEGIN;

-- 1. СБРОС И ТИПЫ ДАННЫХ
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS notifications, reviews, messages, chats, reports, favorites, bids, listing_images, listings, categories, session, users CASCADE;
DROP TYPE IF EXISTS listing_type, listing_status, report_reason, report_status, unit_type;

CREATE TYPE listing_type AS ENUM ('sell', 'rent', 'service', 'auction');
CREATE TYPE listing_status AS ENUM ('active', 'reserved', 'sold', 'archived');
CREATE TYPE unit_type AS ENUM ('hour', 'day', 'piece', 'sqm');
CREATE TYPE report_reason AS ENUM ('spam', 'fraud', 'forbidden', 'other');
CREATE TYPE report_status AS ENUM ('pending', 'resolved', 'dismissed');

-- 2. ПОЛЬЗОВАТЕЛИ И СЕССИИ
-- -----------------------------------------------------------------------------
CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(50) UNIQUE NOT NULL,
    full_name     VARCHAR(100),
    email         VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone         VARCHAR(20),
    avatar_url    VARCHAR(255),
    rating        DECIMAL(3, 2) DEFAULT 0.00 CHECK (rating >= 0 AND rating <= 5),
    is_admin      BOOLEAN DEFAULT FALSE,
    created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "session" (
    sid    VARCHAR NOT NULL PRIMARY KEY,
    sess   JSON NOT NULL,
    expire TIMESTAMPTZ NOT NULL
);
CREATE INDEX "IDX_session_expire" ON "session" (expire);

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
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id         INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    title               VARCHAR(255) NOT NULL,
    description         TEXT,
    price               DECIMAL(12, 2) NOT NULL CHECK (price >= 0),
    
    type                listing_type DEFAULT 'sell',
    status              listing_status DEFAULT 'active',

    -- Параметры аренды/услуг
    price_unit          unit_type DEFAULT NULL,
    is_price_from       BOOLEAN DEFAULT FALSE,

    -- Параметры аукциона
    auction_start_price DECIMAL(12, 2) CHECK (auction_start_price >= 0),
    auction_step        DECIMAL(12, 2) CHECK (auction_step > 0),
    auction_end_date    TIMESTAMPTZ,
    winner_notified     BOOLEAN DEFAULT FALSE,

    created_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT check_auction_dates CHECK (
        (type = 'auction' AND auction_end_date IS NOT NULL) OR (type <> 'auction')
    )
);

CREATE TABLE listing_images (
    id         SERIAL PRIMARY KEY,
    listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    image_url  VARCHAR(255) NOT NULL,
    is_main    BOOLEAN DEFAULT FALSE
);

-- 4. ВЗАИМОДЕЙСТВИЕ
-- -----------------------------------------------------------------------------
CREATE TABLE bids (
    id         SERIAL PRIMARY KEY,
    listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    bidder_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount     DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
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
    reason      report_reason NOT NULL,
    comment     TEXT,
    status      report_status DEFAULT 'pending',
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. КОММУНИКАЦИИ И УВЕДОМЛЕНИЯ
-- -----------------------------------------------------------------------------
CREATE TABLE chats (
    id         SERIAL PRIMARY KEY,
    listing_id INTEGER REFERENCES listings(id) ON DELETE SET NULL,
    buyer_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seller_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_chat UNIQUE (listing_id, buyer_id, seller_id)
);

CREATE TABLE messages (
    id         SERIAL PRIMARY KEY,
    chat_id    INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    sender_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content    TEXT NOT NULL,
    is_read    BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE reviews (
    id         SERIAL PRIMARY KEY,
    target_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    author_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating     INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment    TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT self_review_check CHECK (target_id <> author_id)
);

CREATE TABLE notifications (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       VARCHAR(50) NOT NULL,
    title      VARCHAR(255) NOT NULL,
    message    TEXT,
    link       VARCHAR(255),
    is_read    BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для оптимизации поиска
CREATE INDEX idx_listings_user ON listings(user_id);
CREATE INDEX idx_listings_category ON listings(category_id);
CREATE INDEX idx_messages_chat ON messages(chat_id);
CREATE INDEX idx_bids_listing ON bids(listing_id);

COMMIT;
-- =============================================================================
-- НАПОЛНЕНИЕ ТЕСТОВЫМИ ДАННЫМИ (SEEDING)
-- =============================================================================

BEGIN;

-- 1. КАТЕГОРИИ
-- -----------------------------------------------------------------------------
INSERT INTO categories (name, slug, icon_class) VALUES
('Электроника',    'electronics', 'bx bx-laptop'),
('Одежда и обувь', 'clothing',    'bx bx-closet'),
('Дом и уют',      'home',        'bx bx-home-alt'),
('Услуги и работа','services',    'bx bx-wrench'),
('Хобби и спорт',  'hobbies',     'bx bx-basketball'),
('Учеба и книги',  'books',       'bx bx-book');

-- 2. ПОЛЬЗОВАТЕЛИ
-- (Пароль везде одинаковый: 'password123' в хэше)
-- -----------------------------------------------------------------------------
INSERT INTO users (username, full_name, email, phone, password_hash, avatar_url, rating, is_admin) VALUES
('admin', 'Администратор', 'admin@admin.com', '+79990001122', '$2a$12$jufDd6CgR57Qg5LfZRP4BecfDvvI4DQEJgPEW6OLp.HJDOznvjzqu', 'https://randomuser.me/api/portraits/lego/1.jpg', 5.0, TRUE),
('alex_student', 'Алексей Петров', 'alex@test.com', '+79001112233', '$2a$12$jufDd6CgR57Qg5LfZRP4BecfDvvI4DQEJgPEW6OLp.HJDOznvjzqu', 'https://randomuser.me/api/portraits/men/32.jpg', 4.8, FALSE),
('maria_design', 'Мария Иванова', 'maria@test.com', '+79998887766', '$2a$12$jufDd6CgR57Qg5LfZRP4BecfDvvI4DQEJgPEW6OLp.HJDOznvjzqu', 'https://randomuser.me/api/portraits/women/44.jpg', 5.0, FALSE),
('teacher_john', 'Иван Сидоров', 'ivan@test.com', '+79005554433', '$2a$12$jufDd6CgR57Qg5LfZRP4BecfDvvI4DQEJgPEW6OLp.HJDOznvjzqu', 'https://randomuser.me/api/portraits/men/85.jpg', 4.5, FALSE);

-- 3. ОБЪЯВЛЕНИЯ
-- -----------------------------------------------------------------------------
-- MacBook (Продажа)
INSERT INTO listings (user_id, category_id, title, description, price, type, status) 
VALUES (2, 1, 'MacBook Pro 14 M1 Pro', 'В идеальном состоянии, полный комплект. Использовался для учебы.', 120000, 'sell', 'active');

-- Репетитор (Услуга)
INSERT INTO listings (user_id, category_id, title, description, price, type, price_unit, is_price_from) 
VALUES (3, 4, 'Репетитор по высшей математике', 'Помогу подготовиться к экзаменам, решить контрольные.', 800, 'service', 'hour', TRUE);

-- PS5 (Аренда)
INSERT INTO listings (user_id, category_id, title, description, price, type, price_unit) 
VALUES (2, 1, 'Sony PlayStation 5 + 2 геймпада', 'Сдаю в аренду на выходные. Игры в комплекте.', 1500, 'rent', 'day');

-- Монета (Аукцион)
INSERT INTO listings (user_id, category_id, title, description, price, type, auction_start_price, auction_step, auction_end_date) 
VALUES (4, 5, 'Коллекционная монета 1 рубль 1898 года', 'Оригинал. Состояние на фото.', 5000, 'auction', 5000, 100, NOW() + INTERVAL '3 days');

-- Книги (Продано)
INSERT INTO listings (user_id, category_id, title, description, price, type, status) 
VALUES (3, 6, 'Учебники English File B2', 'Учебник и рабочая тетрадь.', 1000, 'sell', 'sold');

-- 4. ИЗОБРАЖЕНИЯ
-- -----------------------------------------------------------------------------
INSERT INTO listing_images (listing_id, image_url, is_main) VALUES 
(1, 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800', TRUE),
(1, 'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=800', FALSE),
(2, 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800', TRUE),
(3, 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=800', TRUE),
(4, 'https://images.unsplash.com/photo-1519751138087-5bf79df62d5b?w=800', TRUE);

-- 5. СТАВКИ (Для аукциона)
-- -----------------------------------------------------------------------------
INSERT INTO bids (listing_id, bidder_id, amount) VALUES 
(4, 2, 5100),
(4, 3, 5200);

-- 6. ЧАТЫ И СООБЩЕНИЯ
-- -----------------------------------------------------------------------------
INSERT INTO chats (listing_id, buyer_id, seller_id) VALUES (1, 3, 2);

INSERT INTO messages (chat_id, sender_id, content) VALUES 
(1, 3, 'Здравствуйте! Макбук еще продается?'),
(1, 2, 'Добрый день! Да, актуально. Состояние отличное.');

-- 7. ОТЗЫВЫ
-- -----------------------------------------------------------------------------
INSERT INTO reviews (target_id, author_id, rating, comment) VALUES 
(2, 3, 5, 'Отличный продавец, все честно и быстро!'),
(4, 2, 4, 'Хороший преподаватель, доходчиво объясняет.');

-- 8. УВЕДОМЛЕНИЯ
-- -----------------------------------------------------------------------------
INSERT INTO notifications (user_id, type, title, message) VALUES 
(2, 'bid_placed', 'Новая ставка', 'На ваш аукцион по монете поступила новая ставка: 5200 руб.');

COMMIT;