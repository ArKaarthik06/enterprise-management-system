const express = require('express');
const router = express.Router();
const passport = require('passport');
const { authorize, isOwner } = require('../../auth/middleware/rbac');
const { updateStock, getLowStock } = require('../controllers/inventory.controller');
const { prefetchProduct } = require('../../catalog/controllers/product.controller');

const requireAuth = passport.authenticate('jwt', { session: false });

router.route('/low-stock')
  .get(
    requireAuth, 
    // Either root admin or product owner can view their relevant low stock
    (req, res, next) => {
      if (req.user.role === 'root_admin' || req.user.role === 'product_owner') {
        return next();
      }
      return res.status(403).json({ message: 'Forbidden' });
    },
    getLowStock
  );

router.route('/:productId')
  .post(
    requireAuth, 
    authorize('inventory:update:own'), 
    (req, res, next) => {
      // Map productId to id for prefetchProduct
      req.params.id = req.params.productId;
      next();
    },
    prefetchProduct, 
    isOwner('ownerId'), 
    updateStock
  );

module.exports = router;
