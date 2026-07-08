const materialService = require('../services/material.service');

exports.upload = async (req, res, next) => {
  try {
    const material = await materialService.uploadMaterial(
      req.params.eventId,
      req.user.userId,
      req.file
    );
    res.status(201).json({ success: true, data: material });
  } catch (err) {
    next(err);
  }
};

exports.list = async (req, res, next) => {
  try {
    const materials = await materialService.getMaterials(
      req.params.eventId,
      req.user
    );
    res.status(200).json({ success: true, data: materials });
  } catch (err) {
    next(err);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const result = await materialService.deleteMaterial(
      req.params.eventId,
      req.params.materialId,
      req.user.userId
    );
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};
