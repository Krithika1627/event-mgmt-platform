const notificationService = require('../services/notification.service');

exports.sendUpdate = async (req, res, next) => {
  try {
    const { subject, message } = req.body;

    if (!subject || !subject.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Subject is required.' }
      });
    }
    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Message is required.' }
      });
    }

    const result = await notificationService.triggerEventUpdateNotification(
      req.params.eventId,
      req.user.userId,
      subject.trim(),
      message.trim()
    );

    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};
