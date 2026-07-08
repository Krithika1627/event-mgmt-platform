const { BlobServiceClient, StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions } = require('@azure/storage-blob');
const config = require('./env');
const logger = require('../utils/logger');

let blobServiceClient;
let storageCredential;

function initBlobStorage() {
  if (!blobServiceClient) {
    blobServiceClient = BlobServiceClient.fromConnectionString(config.AZURE_STORAGE_CONNECTION_STRING);

    // Extract AccountName and AccountKey from connection string for SAS generation
    const parts = config.AZURE_STORAGE_CONNECTION_STRING.split(';').reduce((acc, part) => {
      const [key, ...vals] = part.split('=');
      acc[key.trim()] = vals.join('=').trim();
      return acc;
    }, {});

    storageCredential = new StorageSharedKeyCredential(parts.AccountName, parts.AccountKey);
    logger.info('Blob storage client initialized');
  }
  return blobServiceClient;
}

function getContainerClient(containerName) {
  if (!blobServiceClient) {
    initBlobStorage();
  }
  return blobServiceClient.getContainerClient(containerName);
}

function getStorageCredential() {
  if (!storageCredential) {
    initBlobStorage();
  }
  return storageCredential;
}

module.exports = {
  initBlobStorage,
  getContainerClient,
  getStorageCredential,
  BlobSASPermissions,
  generateBlobSASQueryParameters
};
