const express = require('express');
const passport = require('passport');
const { authorize } = require('../../auth/middleware/rbac');
const ctrl = require('../controllers/chat.controller');

const router = express.Router();
const requireAuth = passport.authenticate('jwt', { session: false });

router.get('/status', requireAuth, ctrl.status);
router.post('/chat', requireAuth, ctrl.chat);
router.post('/confirm', requireAuth, ctrl.confirm);
router.get('/conversations/:id', requireAuth, ctrl.getConversation);

// Admin only (reuses your existing root_admin permission)
router.get('/audit', requireAuth, authorize('analytics:view:global'), ctrl.auditSummary);
router.post('/ingest', requireAuth, authorize('analytics:view:global'), ctrl.ingest);

module.exports = router;
