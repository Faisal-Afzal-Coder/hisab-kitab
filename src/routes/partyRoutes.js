const express = require('express');
const router = express.Router();
const {
  getParties,
  getReceivables,
  getPayables,
  getPartyById,
  getPartyStatement,
  createParty,
  updateParty,
  receivePayment,
  makePayment,
} = require('../controllers/partyController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/receivables', getReceivables); // Lene Hain
router.get('/payables', getPayables);       // Dene Hain
router.get('/:id/statement', getPartyStatement); // Full Khata Statement
router.post('/:id/receive-payment', receivePayment); // Receive Payment (Lene Hain action)
router.post('/:id/make-payment', makePayment);       // Make Payment (Dene Hain action)

router.route('/').get(getParties).post(createParty);
router.route('/:id').get(getPartyById).put(updateParty);

module.exports = router;
