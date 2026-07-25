const express = require('express');
const router = express.Router();
const { signup, login, approveOwner, getUsers, updateProfile } = require('../controllers/auth.controller');
const passport = require('passport');
const { authorize } = require('../middleware/rbac');

router.post('/signup', signup);
router.post('/login', login);

// Requires root_admin role
router.post('/approve-owner', passport.authenticate('jwt', { session: false }), authorize('owner:approve'), approveOwner);

// Profile and Users
router.get('/users', passport.authenticate('jwt', { session: false }), getUsers);
router.put('/profile', passport.authenticate('jwt', { session: false }), updateProfile);

module.exports = router;
