const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

router.post('/', chatController.createChat);       // Создать чат
router.get('/', chatController.getMyChats);        // Список чатов
router.get('/:id/messages', chatController.getMessages); // История

module.exports = router;