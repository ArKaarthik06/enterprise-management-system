const express = require('express');
const router = express.Router();
const passport = require('passport');
const { authorize } = require('../../auth/middleware/rbac');
const { sendMessage, getMessages } = require('../controllers/messaging.controller');

const requireAuth = passport.authenticate('jwt', { session: false });

router.route('/')
  .post(requireAuth, authorize('messaging:send'), sendMessage)
  .get(requireAuth, authorize('messaging:view'), getMessages);

module.exports = router;
