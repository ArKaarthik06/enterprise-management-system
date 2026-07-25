const express = require('express');
const router = express.Router();
const passport = require('passport');
const { authorize } = require('../../auth/middleware/rbac');
const { placeOrder, getMyOrders, getOrderById } = require('../controllers/order.controller');

const requireAuth = passport.authenticate('jwt', { session: false });

router.route('/')
  .post(requireAuth, authorize('order:create'), placeOrder)
  .get(requireAuth, authorize('order:view:own'), getMyOrders);

router.route('/:id')
  .get(requireAuth, authorize('order:view:own'), getOrderById);

module.exports = router;
