const express = require('express');
const router = express.Router();
const listingController = require('../controllers/listingController');
const upload = require('../middleware/upload');

// Получить список (ставим ДО '/:id', чтобы не конфликтовало)
router.get('/', listingController.getListings); 

// Получить категории
router.get('/categories', listingController.getCategories);

// Создать объявление (до 5 фото)
router.post('/', upload.array('images', 5), listingController.createListing);

module.exports = router;