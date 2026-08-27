const express = require('express');
const router = express.Router();
const {
  getTransactions,
  getTransactionById,
  createTransaction,
} = require('../controllers/transactionController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.route('/').get(getTransactions).post(createTransaction);
router.route('/:id').get(getTransactionById);

module.exports = router;
