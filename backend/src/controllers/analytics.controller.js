const analyticsService = require('../services/analytics.service');

exports.getOverview = async (req, res, next) => {
  try {
    const data = await analyticsService.getOverview(req.user.userId);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

exports.getEventAnalytics = async (req, res, next) => {
  try {
    const data = await analyticsService.getEventAnalytics(req.params.eventId, req.user.userId);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
