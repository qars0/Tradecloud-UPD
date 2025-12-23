const express = require('express');
const router = express.Router();
const listingController = require('../controllers/listingController');
const upload = require('../middleware/upload');


// 1. Получить категории (В САМОМ ВЕРХУ)
router.get('/categories', listingController.getCategories);

// 2. Сделать ставку
router.post('/bid', listingController.placeBid);

// 3. Получить список всех объявлений
router.get('/', listingController.getListings);

// 4. Создать объявление
router.post('/', upload.array('images', 5), listingController.createListing);

// 5. Динамический маршрут с ID
router.get('/:id', listingController.getListingById);

router.get('/:id', listingController.getListingById); // Получить

router.delete('/:id', listingController.deleteListing); // Удалить (DELETE)

router.put('/:id/status', listingController.updateStatus); // Обновить статус (PUT)

router.post('/report', listingController.reportListing);

router.put('/:id', upload.array('images', 5), listingController.updateListing); // Обновить

router.delete('/:id/images/:imageId', listingController.deleteListingImage); // Удалить картинку

module.exports = router;