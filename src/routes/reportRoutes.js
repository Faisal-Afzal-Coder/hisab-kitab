const express = require('express');
const router = express.Router();
const { getProfitAndLoss, getDaybook } = require('../controllers/reportController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/profit-and-loss', getProfitAndLoss);
router.get('/daybook', getDaybook);

module.exports = router;
