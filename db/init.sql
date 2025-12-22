-- Проверка работоспособности
CREATE TABLE IF NOT EXISTS system_check (
    id SERIAL PRIMARY KEY,
    status VARCHAR(50) DEFAULT 'OK',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO system_check (status) VALUES ('Database Initialized Successfully');