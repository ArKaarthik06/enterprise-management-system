const express = require('express');
const router = express.Router();
const passport = require('passport');
const { authorize } = require('../../auth/middleware/rbac');
const { getAnalytics, getAiSummary } = require('../controllers/analytics.controller');

const requireAuth = passport.authenticate('jwt', { session: false });

router.route('/')
  .get(requireAuth, (req, res, next) => {
    if (req.user.role === 'root_admin' || req.user.role === 'product_owner') {
      return next();
    }
    return res.status(403).json({ message: 'Forbidden' });
  }, getAnalytics);

router.route('/ai-summary')
  .get(requireAuth, authorize('analytics:view:global'), getAiSummary);

module.exports = router;
