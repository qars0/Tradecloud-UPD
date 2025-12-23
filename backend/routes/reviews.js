const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');

router.post('/', reviewController.addReview); // Добавить
router.get('/:userId', reviewController.getReviews); // Получить список

module.exports = router;