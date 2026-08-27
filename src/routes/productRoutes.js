const express = require('express');
const router = express.Router();
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  adjustStock,
} = require('../controllers/productController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/:id/adjust-stock', adjustStock);
router.route('/').get(getProducts).post(createProduct);
router.route('/:id').get(getProductById).put(updateProduct);

module.exports = router;
