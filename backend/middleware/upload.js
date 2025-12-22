const multer = require('multer');
const path = require('path');

// Настройка хранилища
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Путь внутри контейнера. Мы примонтируем его к хосту.
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        // Уникальное имя файла: timestamp + random + расширение
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// Фильтр файлов (только картинки)
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Только изображения разрешены!'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // Ограничение 5MB
});

module.exports = upload;