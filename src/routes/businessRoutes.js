const express = require('express');
const router = express.Router();
const { getBusiness, updateBusiness, clearBusinessData } = require('../controllers/businessController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.route('/').get(getBusiness).put(updateBusiness);
router.post('/clear-data', clearBusinessData);

module.exports = router;
