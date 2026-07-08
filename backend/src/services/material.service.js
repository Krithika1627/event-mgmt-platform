const { v4: uuidv4 } = require('uuid');
const { getEventsContainer } = require('../config/cosmos');
const { getContainerClient, getStorageCredential, generateBlobSASQueryParameters, BlobSASPermissions } = require('../config/blob');
const { getRegistrationsContainer } = require('../config/cosmos');
const { ServiceError } = require('./auth.service');
const logger = require('../utils/logger');

const ALLOWED_CONTENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const CONTAINER_NAME = 'event-materials';
const SAS_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

function sanitizeFilename(name) {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

async function uploadMaterial(eventId, organizerId, file) {
  // Verify organizer owns the event
  const eventsContainer = getEventsContainer();
  const { resource: event } = await eventsContainer.item(eventId, eventId).read();

  if (!event) {
    throw new ServiceError('EVENT_NOT_FOUND', 'Event not found.', 404);
  }

  if (event.organizerId !== organizerId) {
    throw new ServiceError('FORBIDDEN_NOT_OWNER', 'You do not own this event.', 403);
  }

  // Validate file
  if (!file) {
    throw new ServiceError('VALIDATION_ERROR', 'No file provided.', 400);
  }

  if (!ALLOWED_CONTENT_TYPES.includes(file.mimetype)) {
    throw new ServiceError(
      'INVALID_FILE_TYPE',
      `File type "${file.mimetype}" is not allowed. Allowed types: ${ALLOWED_CONTENT_TYPES.join(', ')}.`,
      400
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new ServiceError(
      'FILE_TOO_LARGE',
      'File size must be under 10 MB.',
      400
    );
  }

  const materialId = uuidv4();
  const safeName = sanitizeFilename(file.originalname);
  const blobName = `events/${eventId}/${materialId}-${safeName}`;

  // Upload to Blob Storage
  const containerClient = getContainerClient(CONTAINER_NAME);
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  try {
    await blockBlobClient.upload(file.buffer, file.buffer.length, {
      blobHTTPHeaders: { blobContentType: file.mimetype }
    });
  } catch (err) {
    logger.error('Blob upload failed:', err.message);
    throw new ServiceError('INTERNAL_ERROR', 'Failed to upload file to storage.', 500);
  }

  // Update event document's materials array
  const materialEntry = {
    id: materialId,
    name: file.originalname,
    originalFilename: file.originalname,
    blobName,
    contentType: file.mimetype,
    uploadedAt: new Date().toISOString()
  };

  const materials = event.materials || [];
  materials.push(materialEntry);

  try {
    const updatedEvent = {
      ...event,
      materials,
      updatedAt: new Date().toISOString()
    };
    await eventsContainer.item(event.id, event.id).replace(updatedEvent);
  } catch (err) {
    // Event-doc update failed — delete the orphaned blob
    try {
      await blockBlobClient.delete();
    } catch (cleanupErr) {
      logger.error('Failed to clean up orphaned blob:', cleanupErr.message);
    }
    throw new ServiceError('INTERNAL_ERROR', 'Failed to update event materials metadata.', 500);
  }

  return materialEntry;
}

async function getMaterials(eventId, requestingUser) {
  const eventsContainer = getEventsContainer();
  const { resource: event } = await eventsContainer.item(eventId, eventId).read();

  if (!event) {
    throw new ServiceError('EVENT_NOT_FOUND', 'Event not found.', 404);
  }

  const materials = event.materials || [];

  if (materials.length === 0) {
    return [];
  }

  // Access check: organizer or registered attendee
  if (event.organizerId === requestingUser.userId) {
    return attachSasUrls(materials);
  }

  // Check for active registration
  const registrationsContainer = getRegistrationsContainer();
  const { resources: registrations } = await registrationsContainer.items
    .query({
      query: 'SELECT * FROM c WHERE c.eventId = @eventId AND c.userId = @userId AND c.status = @status',
      parameters: [
        { name: '@eventId', value: eventId },
        { name: '@userId', value: requestingUser.userId },
        { name: '@status', value: 'REGISTERED' }
      ]
    })
    .fetchAll();

  if (registrations.length === 0) {
    throw new ServiceError(
      'FORBIDDEN_NOT_REGISTERED',
      'You must be registered for this event to view materials.',
      403
    );
  }

  return attachSasUrls(materials);
}

function attachSasUrls(materials) {
  const credential = getStorageCredential();
  const accountName = credential.accountName;

  return materials.map((material) => {
    const containerName = CONTAINER_NAME;
    const sasParams = generateBlobSASQueryParameters(
      {
        containerName,
        blobName: material.blobName,
        startsOn: new Date(Date.now() - 5 * 60 * 1000), // 5 min skew
        expiresOn: new Date(Date.now() + SAS_EXPIRY_MS),
        permissions: BlobSASPermissions.parse('r')
      },
      credential
    );

    const sasToken = sasParams.toString();
    const sasUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${material.blobName}?${sasToken}`;

    return {
      ...material,
      sasUrl
    };
  });
}

async function deleteMaterial(eventId, materialId, organizerId) {
  const eventsContainer = getEventsContainer();
  const { resource: event } = await eventsContainer.item(eventId, eventId).read();

  if (!event) {
    throw new ServiceError('EVENT_NOT_FOUND', 'Event not found.', 404);
  }

  if (event.organizerId !== organizerId) {
    throw new ServiceError('FORBIDDEN_NOT_OWNER', 'You do not own this event.', 403);
  }

  const materials = event.materials || [];
  const materialIndex = materials.findIndex((m) => m.id === materialId);

  if (materialIndex === -1) {
    throw new ServiceError('MATERIAL_NOT_FOUND', 'Material not found.', 404);
  }

  const material = materials[materialIndex];

  // Delete blob
  const containerClient = getContainerClient(CONTAINER_NAME);
  const blockBlobClient = containerClient.getBlockBlobClient(material.blobName);

  try {
    await blockBlobClient.delete();
  } catch (err) {
    logger.error('Blob deletion failed:', err.message);
    throw new ServiceError('INTERNAL_ERROR', 'Failed to delete file from storage.', 500);
  }

  // Remove metadata from event doc
  materials.splice(materialIndex, 1);
  const updatedEvent = {
    ...event,
    materials,
    updatedAt: new Date().toISOString()
  };
  await eventsContainer.item(event.id, event.id).replace(updatedEvent);

  return { deleted: true, materialId };
}

module.exports = {
  uploadMaterial,
  getMaterials,
  deleteMaterial
};
