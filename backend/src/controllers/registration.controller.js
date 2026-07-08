const registrationService = require('../services/registration.service');

exports.register = async (req, res, next) => {
  try {
    const registration = await registrationService.registerForEvent(
      req.params.eventId,
      req.user.userId,
      req.user.role
    );
    res.status(201).json({ success: true, data: registration });
  } catch (err) {
    next(err);
  }
};

exports.cancel = async (req, res, next) => {
  try {
    const registration = await registrationService.cancelRegistration(
      req.params.eventId,
      req.user.userId
    );
    res.status(200).json({ success: true, data: registration });
  } catch (err) {
    next(err);
  }
};

exports.myRegistrations = async (req, res, next) => {
  try {
    const registrations = await registrationService.getMyRegistrations(req.user.userId);
    res.status(200).json({ success: true, data: registrations });
  } catch (err) {
    next(err);
  }
};

exports.getAttendees = async (req, res, next) => {
  try {
    const attendees = await registrationService.getEventAttendees(
      req.params.eventId,
      req.user.userId
    );
    res.status(200).json({ success: true, data: attendees });
  } catch (err) {
    next(err);
  }
};

exports.markAttendance = async (req, res, next) => {
  try {
    const { attendanceStatus } = req.body;
    const registration = await registrationService.markAttendance(
      req.params.eventId,
      req.params.registrationId,
      req.user.userId,
      attendanceStatus
    );
    res.status(200).json({ success: true, data: registration });
  } catch (err) {
    next(err);
  }
};
