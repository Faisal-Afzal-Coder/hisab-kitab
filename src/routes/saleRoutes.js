const express = require('express');
const router = express.Router();
const {
  getSales,
  getSaleById,
  createSale,
} = require('../controllers/saleController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.route('/').get(getSales).post(createSale);
router.route('/:id').get(getSaleById);

module.exports = router;
