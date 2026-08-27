const express = require('express');
const router = express.Router();
const { register, login, getMe, getBrothers, switchBrother } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.get('/brothers', protect, getBrothers);
router.post('/switch-brother', protect, switchBrother);

module.exports = router;
