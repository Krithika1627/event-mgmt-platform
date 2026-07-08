const { Router } = require('express');
const eventController = require('../controllers/event.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { optionalAuthMiddleware } = authMiddleware;
const { requireRole } = require('../middleware/role.middleware');
const ownershipMiddleware = require('../middleware/ownership.middleware');

const router = Router();

router.post(
  '/',
  authMiddleware,
  requireRole('ORGANIZER'),
  eventController.create
);

router.get('/', eventController.listPublished);

router.get(
  '/:eventId',
  optionalAuthMiddleware,
  eventController.getById
);

router.patch(
  '/:eventId/status',
  authMiddleware,
  requireRole('ORGANIZER'),
  ownershipMiddleware,
  eventController.publish
);

router.patch(
  '/:eventId',
  authMiddleware,
  requireRole('ORGANIZER'),
  ownershipMiddleware,
  eventController.update
);

router.delete(
  '/:eventId',
  authMiddleware,
  requireRole('ORGANIZER'),
  ownershipMiddleware,
  eventController.cancel
);

module.exports = router;