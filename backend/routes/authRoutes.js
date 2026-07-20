const express = require('express');
const router = express.Router();
const { 
  login, 
  logout,
  generateCustomerInvite, 
  activateCustomer,
  getCustomerPortalConfig,
  updateCustomerPortalConfig,
  checkRegistrationIdentity,
  selfRegisterCustomer
} = require('../controllers/authController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { sendSuccess } = require('../utils/responseHelper');

// Public routes
router.post('/login', login);
router.post('/logout', logout);
router.post('/activate', activateCustomer);
router.post('/register/check', checkRegistrationIdentity);
router.post('/register/submit', selfRegisterCustomer);

// Protected routes (Admin and KAM can generate invites for customers)
router.post(
  '/invite',
  protect,
  restrictTo('Administrator', 'KAM'),
  generateCustomerInvite
);

// Configuration routes
router.get(
  '/config/customer-portal',
  protect,
  restrictTo('Administrator', 'Customer'),
  getCustomerPortalConfig
);

router.put(
  '/config/customer-portal',
  protect,
  restrictTo('Administrator'),
  updateCustomerPortalConfig
);

router.get(
  '/config/kams',
  protect,
  restrictTo('Administrator'),
  require('../controllers/authController').getActiveKams
);

router.put(
  '/config/kam-assignment',
  protect,
  restrictTo('Administrator'),
  require('../controllers/authController').reassignCustomerKam
);

router.get(
  '/config/sla',
  protect,
  restrictTo('Administrator'),
  require('../controllers/authController').getWorkflowSlaConfig
);

router.put(
  '/config/sla',
  protect,
  restrictTo('Administrator'),
  require('../controllers/authController').updateWorkflowSlaConfig
);

router.get(
  '/config/md-limit',
  protect,
  restrictTo('Administrator', 'Managing Director'),
  require('../controllers/authController').getMdApprovalLimit
);

router.put(
  '/config/md-limit',
  protect,
  restrictTo('Administrator', 'Managing Director'),
  require('../controllers/authController').updateMdApprovalLimit
);

router.get(
  '/config/customer-assignments',
  protect,
  restrictTo('Administrator'),
  require('../controllers/authController').getCustomerAssignments
);

router.put(
  '/config/customer-assignments',
  protect,
  restrictTo('Administrator'),
  require('../controllers/authController').updateCustomerAssignment
);

router.get(
  '/profile',
  protect,
  require('../controllers/authController').getProfileDetails
);

router.post(
  '/change-password',
  protect,
  require('../controllers/authController').changePassword
);

// Get current user profile (Protected)
router.get('/me', protect, (req, res) => {
  return sendSuccess(res, { user: req.user }, 'User profile retrieved successfully.');
});

module.exports = router;
