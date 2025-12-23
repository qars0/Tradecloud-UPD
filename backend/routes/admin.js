const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const isAdmin = require('../middleware/isAdmin');

// Все роуты защищены middleware isAdmin
router.get('/stats', isAdmin, adminController.getStats);
router.get('/users', isAdmin, adminController.getUsers);
router.delete('/users/:id', isAdmin, adminController.deleteUser);
router.get('/reports', isAdmin, adminController.getReports);
router.post('/reports/resolve', isAdmin, adminController.resolveReport);

module.exports = router;