const express = require('express');
const router = express.Router();
const favoriteController = require('../controllers/favoriteController');

// Переключатель (POST /api/favorites/toggle)
router.post('/toggle', favoriteController.toggleFavorite);

// Получить список (GET /api/favorites)
router.get('/', favoriteController.getMyFavorites);

module.exports = router;