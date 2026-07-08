const { Router } = require('express');
const eventController = require('../controllers/event.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');

const router = Router();

router.get('/events', authMiddleware, requireRole('ORGANIZER'), eventController.getOrganizerEvents);

module.exports = router;
