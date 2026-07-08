const { getEventsContainer } = require('../config/cosmos');

async function ownershipMiddleware(req, res, next) {
  try {
    const { eventId } = req.params;
    if (!eventId) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Event ID is required.' }
      });
    }

    const container = getEventsContainer();
    const { resource: event } = await container.item(eventId, eventId).read();

    if (!event) {
      return res.status(404).json({
        success: false,
        error: { code: 'EVENT_NOT_FOUND', message: 'Event not found.' }
      });
    }

    if (event.organizerId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN_NOT_OWNER', message: 'You do not own this event.' }
      });
    }

    req.event = event;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = ownershipMiddleware;
