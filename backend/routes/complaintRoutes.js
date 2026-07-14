const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getCustomers,
  getInvoices,
  getInvoiceDetails,
  getLookups,
  createComplaint,
  getComplaints,
  getComplaintDetails,
  getDashboardStats
} = require('../controllers/complaintController');

// All complaint routes are protected
router.use(protect);

// Master / Lookup routes
router.get('/customers', getCustomers);
router.get('/employees', require('../controllers/complaintController').getEmployees);
router.get('/invoices', getInvoices);
router.get('/invoices/:invoiceNo', getInvoiceDetails);
router.get('/lookups', getLookups);

// Complaint core routes
router.post('/', createComplaint);
router.get('/', getComplaints);
router.get('/dashboard/stats', getDashboardStats);
router.post('/:id/ts-review', require('../controllers/complaintController').submitTsReview);
router.post('/:id/qc-review', require('../controllers/complaintController').submitQcReview);
router.get('/:id/ts-review', require('../controllers/complaintController').getTsReviewDetails);
router.get('/:id/qc-review', require('../controllers/complaintController').getQcReviewDetails);
router.post('/:id/capa', require('../controllers/complaintController').submitCapa);
router.get('/:id/capa', require('../controllers/complaintController').getCapaDetails);
router.post('/:id/approve', require('../controllers/complaintController').approveStage);
router.post('/:id/finance', require('../controllers/complaintController').submitFinanceCreditNote);
router.post('/:id/action', require('../controllers/complaintController').timelineAction);
router.get('/:id', getComplaintDetails);

module.exports = router;
