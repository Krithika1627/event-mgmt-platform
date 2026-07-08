const { Router } = require('express');
const registrationController = require('../controllers/registration.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');

/*
 * This router is mounted at /api in app.js.
 * Routes are defined with their full path segments relative to /api.
 */
const router = Router();

// Attendee routes
router.post('/events/:eventId/register', authMiddleware, requireRole('ATTENDEE'), registrationController.register);
router.delete('/events/:eventId/register', authMiddleware, requireRole('ATTENDEE'), registrationController.cancel);
router.get('/me/registrations', authMiddleware, requireRole('ATTENDEE'), registrationController.myRegistrations);

// Organizer routes
router.get('/events/:eventId/attendees', authMiddleware, requireRole('ORGANIZER'), registrationController.getAttendees);
router.patch(
  '/events/:eventId/registrations/:registrationId/attendance',
  authMiddleware,
  requireRole('ORGANIZER'),
  registrationController.markAttendance
);

module.exports = router;
