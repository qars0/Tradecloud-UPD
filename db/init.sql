-- =============================================================================
-- БАЗА ДАННЫХ ПЛАТФОРМЫ ОБЪЯВЛЕНИЙ (FINAL VERSION)
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

-- Индексы
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
INSERT INTO categories (name, slug, icon_class) VALUES
('Электроника',    'electronics', 'bx bx-laptop'),
('Одежда и обувь', 'clothing',    'bx bx-closet'),
('Дом и уют',      'home',        'bx bx-home-alt'),
('Услуги и работа','services',    'bx bx-wrench'),
('Хобби и спорт',  'hobbies',     'bx bx-basketball'),
('Книги',          'books',       'bx bx-book'),
('Транспорт',      'transport',   'bx bx-car');

-- 2. ПОЛЬЗОВАТЕЛИ
-- Пароль у всех одинаковый (хэш для 'password123' или твой хэш)
-- Используем твой хэш: $2a$12$prgkXi/..UuP36YO1wkUhOZpF2ySAkk77T5QCj7l1NqSnDd2mIFpy
INSERT INTO users (username, full_name, email, phone, password_hash, avatar_url, rating, is_admin) VALUES
('admin', 'Администратор', 'admin@admin.com', '+79990001122', '$2a$12$prgkXi/..UuP36YO1wkUhOZpF2ySAkk77T5QCj7l1NqSnDd2mIFpy', 'https://cdn-icons-png.flaticon.com/512/2942/2942813.png', 5.0, TRUE), -- ID 1
('alex_tech', 'Алексей Смирнов', 'alex@test.com', '+79001112233', '$2a$12$prgkXi/..UuP36YO1wkUhOZpF2ySAkk77T5QCj7l1NqSnDd2mIFpy', 'https://randomuser.me/api/portraits/men/32.jpg', 4.8, FALSE), -- ID 2
('maria_art', 'Мария Иванова', 'maria@test.com', '+79998887766', '$2a$12$prgkXi/..UuP36YO1wkUhOZpF2ySAkk77T5QCj7l1NqSnDd2mIFpy', 'https://randomuser.me/api/portraits/women/44.jpg', 5.0, FALSE), -- ID 3
('dmitry_fix', 'Дмитрий Мастер', 'dim@test.com', '+79223334455', '$2a$12$prgkXi/..UuP36YO1wkUhOZpF2ySAkk77T5QCj7l1NqSnDd2mIFpy', 'https://randomuser.me/api/portraits/men/85.jpg', 4.5, FALSE), -- ID 4
('olga_style', 'Ольга Петрова', 'olga@test.com', '+79112223344', '$2a$12$prgkXi/..UuP36YO1wkUhOZpF2ySAkk77T5QCj7l1NqSnDd2mIFpy', 'https://randomuser.me/api/portraits/women/65.jpg', 4.9, FALSE), -- ID 5
('max_driver', 'Максим Водителев', 'max@test.com', '+79556667788', '$2a$12$prgkXi/..UuP36YO1wkUhOZpF2ySAkk77T5QCj7l1NqSnDd2mIFpy', 'https://randomuser.me/api/portraits/men/11.jpg', 3.8, FALSE), -- ID 6
('gamer_pro', 'Илья Игроков', 'game@test.com', '+79887776655', '$2a$12$prgkXi/..UuP36YO1wkUhOZpF2ySAkk77T5QCj7l1NqSnDd2mIFpy', 'https://randomuser.me/api/portraits/men/46.jpg', 5.0, FALSE), -- ID 7
('qars', 'Арсений Кузнецов', '123woter123@gmail.com', '+79620598606', '$2a$12$prgkXi/..UuP36YO1wkUhOZpF2ySAkk77T5QCj7l1NqSnDd2mIFpy', '', 5.0, TRUE); -- ID 8

-- 3. ОБЪЯВЛЕНИЯ

-- 1. MacBook (Товар) - Alex
INSERT INTO listings (user_id, category_id, title, description, price, type, status) 
VALUES (2, 1, 'MacBook Pro 14 M1 Pro', 'В идеальном состоянии. Коробка, чек. 16/512GB. Использовался для программирования.', 145000, 'sell', 'active');
INSERT INTO listing_images (listing_id, image_url, is_main) VALUES (1, '/uploads/default_15.jpg', TRUE);

-- 2. Репетитор (Услуга) - Maria
INSERT INTO listings (user_id, category_id, title, description, price, type, price_unit, is_price_from) 
VALUES (3, 6, 'Репетитор по Английскому языку', 'Готовлю к ЕГЭ и IELTS. Опыт 5 лет. Занятия онлайн.', 1200, 'service', 'hour', TRUE);
INSERT INTO listing_images (listing_id, image_url, is_main) VALUES (2, '/uploads/default_16.jpg', TRUE);

-- 3. PS5 (Аренда) - Gamer Pro
INSERT INTO listings (user_id, category_id, title, description, price, type, price_unit) 
VALUES (7, 1, 'Sony PlayStation 5 + 2 геймпада', 'Аренда на выходные. Игры: FIFA 24, Spider-Man 2, MK1. Доставка по городу.', 1500, 'rent', 'day');
INSERT INTO listing_images (listing_id, image_url, is_main) VALUES (3, '/uploads/default_17.jpg', TRUE);
INSERT INTO listing_images (listing_id, image_url, is_main) VALUES (3, '/uploads/default_18.jpg', FALSE);

-- 4. Монета (Аукцион) - Dmitry
INSERT INTO listings (user_id, category_id, title, description, price, type, auction_start_price, auction_step, auction_end_date) 
VALUES (4, 5, 'Редкая монета 1 рубль 1898 года', 'Оригинал. Состояние на фото. Идеально для коллекции.', 5000, 'auction', 5000, 100, NOW() + INTERVAL '2 days');
INSERT INTO listing_images (listing_id, image_url, is_main) VALUES (4, '/uploads/default_19.jpg', TRUE);
INSERT INTO listing_images (listing_id, image_url, is_main) VALUES (4, '/uploads/default_20.jpg', FALSE);

-- 5. iPhone 15 (Товар) - Olga
INSERT INTO listings (user_id, category_id, title, description, price, type, status) 
VALUES (5, 1, 'iPhone 15 Pink 128GB', 'Новый, запечатанный. Подарили, не нужен. Чек есть.', 75000, 'sell', 'active');
INSERT INTO listing_images (listing_id, image_url, is_main) VALUES (5, '/uploads/default_21.jpg', TRUE);
INSERT INTO listing_images (listing_id, image_url, is_main) VALUES (5, '/uploads/default_22.jpg', FALSE);

-- 6. Дрель (Аренда) - Dmitry
INSERT INTO listings (user_id, category_id, title, description, price, type, price_unit) 
VALUES (4, 3, 'Дрель-шуруповерт Makita', 'Мощная, 2 аккумулятора в комплекте. Залог 5000.', 500, 'rent', 'day');
INSERT INTO listing_images (listing_id, image_url, is_main) VALUES (6, '/uploads/default_23.jpg', TRUE);

-- 7. Уборка (Услуга) - Olga
INSERT INTO listings (user_id, category_id, title, description, price, type, price_unit, is_price_from) 
VALUES (5, 4, 'Генеральная уборка квартир', 'Быстро, чисто, качественно. Своя химия и техника.', 3000, 'service', 'piece', TRUE);
INSERT INTO listing_images (listing_id, image_url, is_main) VALUES (7, '/uploads/default_24.jpg', TRUE);

-- 8. Фотоаппарат (Аукцион) - Maria (Скоро кончается)
INSERT INTO listings (user_id, category_id, title, description, price, type, auction_start_price, auction_step, auction_end_date) 
VALUES (3, 5, 'Пленочный фотоаппарат Canon AE-1', 'Легендарная классика. Полностью рабочий. Объектив 50mm.', 10000, 'auction', 10000, 500, NOW() + INTERVAL '30 minutes');
INSERT INTO listing_images (listing_id, image_url, is_main) VALUES (8, '/uploads/default_25.jpg', TRUE);

-- 9. Кроссовки (Товар) - Alex
INSERT INTO listings (user_id, category_id, title, description, price, type, status) 
VALUES (2, 2, 'Nike Air Jordan 1 High', 'Оригинал, любые проверки. Размер 43. Носил пару раз.', 18000, 'sell', 'active');
INSERT INTO listing_images (listing_id, image_url, is_main) VALUES (9, '/uploads/default_26.jpg', TRUE);

-- 10. Гитара (Товар) - Gamer Pro
INSERT INTO listings (user_id, category_id, title, description, price, type, status) 
VALUES (7, 5, 'Электрогитара Fender Stratocaster', 'Мексиканец. Звучит отлично. Чехол в подарок.', 45000, 'sell', 'active');
INSERT INTO listing_images (listing_id, image_url, is_main) VALUES (10, '/uploads/default_27.jpg', TRUE);

-- 11. Перевозки (Услуга) - Max Driver
INSERT INTO listings (user_id, category_id, title, description, price, type, price_unit) 
VALUES (6, 7, 'Грузоперевозки на Газели', 'Переезды, доставка мебели. Грузчики есть.', 1500, 'service', 'hour');
INSERT INTO listing_images (listing_id, image_url, is_main) VALUES (11, '/uploads/default_28.jpg', TRUE);

-- 12. Сноуборд (Аренда) - Alex
INSERT INTO listings (user_id, category_id, title, description, price, type, price_unit) 
VALUES (2, 5, 'Сноуборд Burton + ботинки', 'Комплект для катания. Размер ботинок 42. Доска 156см.', 1200, 'rent', 'day');
INSERT INTO listing_images (listing_id, image_url, is_main) VALUES (12, '/uploads/default_29.jpg', TRUE);

-- 13. Диван (Товар) - Olga
INSERT INTO listings (user_id, category_id, title, description, price, type, status) 
VALUES (5, 3, 'Диван IKEA угловой', 'Серый цвет, раскладывается. Самовывоз.', 15000, 'sell', 'active');
INSERT INTO listing_images (listing_id, image_url, is_main) VALUES (13, '/uploads/default_1.jpg', TRUE);

-- 14. Велосипед (Товар) - Gamer Pro
INSERT INTO listings (user_id, category_id, title, description, price, type, status) 
VALUES (7, 5, 'Горный велосипед GT Avalanche', 'Колеса 29, гидравлика. После ТО.', 35000, 'sell', 'active');
INSERT INTO listing_images (listing_id, image_url, is_main) VALUES (14, '/uploads/default_2.jpg', TRUE);
INSERT INTO listing_images (listing_id, image_url, is_main) VALUES (14, '/uploads/default_3.jpg', FALSE);

-- 15. Картина (Аукцион) - Maria
INSERT INTO listings (user_id, category_id, title, description, price, type, auction_start_price, auction_step, auction_end_date) 
VALUES (3, 3, 'Картина маслом "Закат"', 'Авторская работа. Холст 50х70. Рама в комплекте.', 3000, 'auction', 3000, 200, NOW() + INTERVAL '5 days');
INSERT INTO listing_images (listing_id, image_url, is_main) VALUES (15, '/uploads/default_4.jpg', TRUE);

-- 16. Ремонт ПК (Услуга) - Dmitry
INSERT INTO listings (user_id, category_id, title, description, price, type, price_unit, is_price_from) 
VALUES (4, 4, 'Ремонт компьютеров и ноутбуков', 'Чистка, установка Windows, замена термопасты. Выезд на дом.', 1000, 'service', 'piece', TRUE);
INSERT INTO listing_images (listing_id, image_url, is_main) VALUES (16, '/uploads/default_5.jpg', TRUE);

-- 17. Платье (Аренда) - Maria
INSERT INTO listings (user_id, category_id, title, description, price, type, price_unit) 
VALUES (3, 2, 'Вечернее платье в пол', 'Идеально для выпускного или фотосессии. Размер S. Цвет красный.', 2500, 'rent', 'day');
INSERT INTO listing_images (listing_id, image_url, is_main) VALUES (17, '/uploads/default_6.jpg', TRUE);

-- 18. Учебники (Продано) - Alex
INSERT INTO listings (user_id, category_id, title, description, price, type, status) 
VALUES (2, 6, 'Комплект учебников English File', 'Уровни B1 и B2. Состояние среднее.', 1500, 'sell', 'sold');
INSERT INTO listing_images (listing_id, image_url, is_main) VALUES (18, '/uploads/default_18.jpg', TRUE);

-- 19. Кофемашина (Товар) - Olga
INSERT INTO listings (user_id, category_id, title, description, price, type, status) 
VALUES (5, 3, 'Капсульная кофемашина Nespresso', 'Компактная, варит вкусный кофе. В подарок 20 капсул.', 4500, 'sell', 'active');
INSERT INTO listing_images (listing_id, image_url, is_main) VALUES (19, '/uploads/default_7.jpg', TRUE);

-- 20. Часы (Аукцион) - Max
INSERT INTO listings (user_id, category_id, title, description, price, type, auction_start_price, auction_step, auction_end_date) 
VALUES (6, 1, 'Винтажные часы Casio', 'Япония. 90-е годы. Новая батарейка. Стильные.', 1000, 'auction', 1000, 100, NOW() + INTERVAL '1 day');
INSERT INTO listing_images (listing_id, image_url, is_main) VALUES (20, '/uploads/default_8.jpg', TRUE);

-- 21. Самокат (Аренда) - Gamer Pro
INSERT INTO listings (user_id, category_id, title, description, price, type, price_unit) 
VALUES (7, 5, 'Электросамокат Xiaomi', 'Запас хода 25км. Шлем в комплекте. Заряжен.', 800, 'rent', 'hour');
INSERT INTO listing_images (listing_id, image_url, is_main) VALUES (21, '/uploads/default_9.jpg', TRUE);

-- 22. Монитор (Товар) - Dmitry
INSERT INTO listings (user_id, category_id, title, description, price, type, status) 
VALUES (4, 1, 'Монитор LG 27 дюймов 4K', 'IPS матрица, отличная цветопередача. Для дизайнеров.', 22000, 'sell', 'active');
INSERT INTO listing_images (listing_id, image_url, is_main) VALUES (22, '/uploads/default_10.jpg', TRUE);
INSERT INTO listing_images (listing_id, image_url, is_main) VALUES (22, '/uploads/default_11.png', FALSE);

-- 23. Куртка (Товар) - Maria
INSERT INTO listings (user_id, category_id, title, description, price, type, status) 
VALUES (3, 2, 'Джинсовая куртка Levi`s', 'Винтаж. Размер M. Унисекс. Состояние отличное.', 3500, 'sell', 'active');
INSERT INTO listing_images (listing_id, image_url, is_main) VALUES (23, '/uploads/default_12.jpg', TRUE);

-- 24. Веб-дизайн (Услуга) - Maria
INSERT INTO listings (user_id, category_id, title, description, price, type, price_unit, is_price_from) 
VALUES (3, 4, 'Дизайн сайтов и презентаций', 'Figma, Tilda. Делаю стильно и быстро.', 5000, 'service', 'piece', TRUE);
INSERT INTO listing_images (listing_id, image_url, is_main) VALUES (24, '/uploads/default_13.jpg', TRUE);

-- 25. Стол (Товар) - Max
INSERT INTO listings (user_id, category_id, title, description, price, type, status) 
VALUES (6, 3, 'Письменный стол лофт', 'Дерево и металл. Ручная работа.', 12000, 'sell', 'active');
INSERT INTO listing_images (listing_id, image_url, is_main) VALUES (25, '/uploads/default_14.jpg', TRUE);

-- 4. СТАВКИ
INSERT INTO bids (listing_id, bidder_id, amount) VALUES 
(4, 2, 5100), (4, 3, 5200);

-- 5. ЧАТЫ
INSERT INTO chats (listing_id, buyer_id, seller_id) VALUES (1, 3, 2);
INSERT INTO messages (chat_id, sender_id, content) VALUES 
(1, 3, 'Здравствуйте! Макбук еще продается?'),
(1, 2, 'Добрый день! Да, актуально.');

-- 6. ОТЗЫВЫ
INSERT INTO reviews (target_id, author_id, rating, comment) VALUES 
(2, 3, 5, 'Отличный продавец, все честно и быстро!'),
(4, 2, 4, 'Хороший мастер, но опоздал на 10 минут.');

-- 7. УВЕДОМЛЕНИЯ
INSERT INTO notifications (user_id, type, title, message) VALUES 
(2, 'bid_placed', 'Новая ставка', 'На ваш аукцион по монете поступила новая ставка: 5200 руб.');

COMMIT;