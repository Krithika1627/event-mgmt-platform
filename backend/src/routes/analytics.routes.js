const { Router } = require('express');
const analyticsController = require('../controllers/analytics.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');
const ownershipMiddleware = require('../middleware/ownership.middleware');

const router = Router();

router.get(
  '/overview',
  authMiddleware,
  requireRole('ORGANIZER'),
  analyticsController.getOverview
);

router.get(
  '/events/:eventId',
  authMiddleware,
  requireRole('ORGANIZER'),
  ownershipMiddleware,
  analyticsController.getEventAnalytics
);

module.exports = router;
