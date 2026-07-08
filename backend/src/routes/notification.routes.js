const { Router } = require('express');
const notificationController = require('../controllers/notification.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');
const ownershipMiddleware = require('../middleware/ownership.middleware');

const router = Router({ mergeParams: true });

// POST /api/events/:eventId/notifications — send update to all registered attendees
router.post(
  '/',
  authMiddleware,
  requireRole('ORGANIZER'),
  ownershipMiddleware,
  notificationController.sendUpdate
);

module.exports = router;
