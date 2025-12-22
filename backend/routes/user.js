const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const upload = require('../middleware/upload'); // Наш загрузчик картинок

// GET /api/user/me
router.get('/me', userController.getMe);

// PUT /api/user/update (с поддержкой файла 'avatar')
router.put('/update', upload.single('avatar'), userController.updateProfile);

module.exports = router;