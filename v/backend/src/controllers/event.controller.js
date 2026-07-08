const eventService = require('../services/event.service');

exports.create = async (req, res, next) => {
  try {
    const event = await eventService.createEvent(req.user.userId, req.body);
    res.status(201).json({ success: true, data: event });
  } catch (err) {
    next(err);
  }
};

exports.listPublished = async (req, res, next) => {
  try {
    const { category, location, search, upcoming } = req.query;
    const events = await eventService.getPublishedEvents({ category, location, search, upcoming });
    res.status(200).json({ success: true, data: events });
  } catch (err) {
    next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const event = await eventService.getEventById(req.params.eventId, req.user || null);
    res.status(200).json({ success: true, data: event });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const updated = await eventService.updateEvent(req.event, req.body);
    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

exports.publish = async (req, res, next) => {
  try {
    if (req.body.status !== 'PUBLISHED') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Body must contain { status: "PUBLISHED" }.' }
      });
    }
    const published = await eventService.publishEvent(req.event);
    res.status(200).json({ success: true, data: published });
  } catch (err) {
    next(err);
  }
};

exports.cancel = async (req, res, next) => {
  try {
    const cancelled = await eventService.cancelEvent(req.event);
    res.status(200).json({ success: true, data: cancelled });
  } catch (err) {
    next(err);
  }
};

exports.getOrganizerEvents = async (req, res, next) => {
  try {
    const events = await eventService.getOrganizerEvents(req.user.userId);
    res.status(200).json({ success: true, data: events });
  } catch (err) {
    next(err);
  }
};
