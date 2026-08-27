const express = require('express');
const router = express.Router();
const {
  getAccounts,
  getAccountById,
  createAccount,
  transferFunds,
} = require('../controllers/accountController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/transfer', transferFunds);
router.route('/').get(getAccounts).post(createAccount);
router.route('/:id').get(getAccountById);

module.exports = router;
