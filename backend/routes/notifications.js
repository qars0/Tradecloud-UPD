const express = require('express');
const router = express.Router();
const controller = require('../controllers/notificationController');

router.get('/', controller.getMyNotifications);
router.post('/read', controller.markRead);
router.get('/count', controller.getUnreadCount);

module.exports = router;