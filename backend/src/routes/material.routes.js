const { Router } = require('express');
const multer = require('multer');
const materialController = require('../controllers/material.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');
const ownershipMiddleware = require('../middleware/ownership.middleware');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB
});

const router = Router({ mergeParams: true });

// POST /api/events/:eventId/materials — upload a material
router.post(
  '/',
  authMiddleware,
  requireRole('ORGANIZER'),
  ownershipMiddleware,
  upload.single('file'),
  materialController.upload
);

// GET /api/events/:eventId/materials — list materials (with SAS URLs)
router.get(
  '/',
  authMiddleware,
  materialController.list
);

// DELETE /api/events/:eventId/materials/:materialId — delete a material
router.delete(
  '/:materialId',
  authMiddleware,
  requireRole('ORGANIZER'),
  ownershipMiddleware,
  materialController.delete
);

module.exports = router;
