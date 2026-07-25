const express = require('express');
const router = express.Router();
const passport = require('passport');
const { authorize, isOwner } = require('../../auth/middleware/rbac');
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  prefetchProduct,
  createProductReview
} = require('../controllers/product.controller');

const requireAuth = passport.authenticate('jwt', { session: false });

router.route('/')
  .get(getProducts)
  .post(requireAuth, authorize('product:create'), createProduct);

router.route('/:id')
  .get(getProductById)
  .put(requireAuth, authorize('product:update:own'), prefetchProduct, isOwner('ownerId'), updateProduct)
  .delete(requireAuth, authorize('product:delete:own'), prefetchProduct, isOwner('ownerId'), deleteProduct);

router.route('/:id/reviews')
  .post(requireAuth, authorize('review:create'), createProductReview);

module.exports = router;
