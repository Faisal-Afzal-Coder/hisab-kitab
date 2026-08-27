const express = require('express');
const router = express.Router();
const {
  getPurchases,
  getPurchaseById,
  createPurchase,
} = require('../controllers/purchaseController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.route('/').get(getPurchases).post(createPurchase);
router.route('/:id').get(getPurchaseById);

module.exports = router;
