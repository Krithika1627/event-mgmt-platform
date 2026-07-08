const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth.routes');
const eventRoutes = require('./routes/event.routes');
const organizerRoutes = require('./routes/organizer.routes');
const registrationRoutes = require('./routes/registration.routes');
const materialRoutes = require('./routes/material.routes');
const notificationRoutes = require('./routes/notification.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const errorMiddleware = require('./middleware/error.middleware');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// === TEMPORARY: Test-error route for Application Insights verification ===
// TODO: Remove this route and its comment block before final submission.
// It intentionally throws an error so you can confirm the error appears
// in Application Insights (or your configured APM).
app.get('/api/debug/test-error', (req, res, next) => {
  next(new Error('Test error for Application Insights verification.'));
});
// ===============================================================

app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/organizer', organizerRoutes);
app.use('/api', registrationRoutes);
app.use('/api/events/:eventId/materials', materialRoutes);
app.use('/api/events/:eventId/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.originalUrl} not found.` }
  });
});

app.use(errorMiddleware);

module.exports = app;
