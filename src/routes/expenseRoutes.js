const express = require('express');
const router = express.Router();
const { getExpenses, createExpense } = require('../controllers/expenseController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.route('/').get(getExpenses).post(createExpense);

module.exports = router;
