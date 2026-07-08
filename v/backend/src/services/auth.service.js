const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const { getUsersContainer } = require('../config/cosmos');
const config = require('../config/env');

const ALLOWED_AGE_GROUPS = ['UNDER_18', '18_25', '26_35', '36_50', 'ABOVE_50'];

class ServiceError extends Error {
  constructor(code, message, statusCode) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.name = 'ServiceError';
  }
}

function normalizeEmail(email) {
  return email.toLowerCase().trim();
}

function generateToken(userId, role) {
  return jwt.sign({ userId, role }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN
  });
}

function stripPassword(user) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

async function registerUser(data) {
  const { name, email, password, role, ageGroup, gender } = data;

  if (!name || !name.trim()) {
    throw new ServiceError('VALIDATION_ERROR', 'Name is required.', 400);
  }
  if (!email || !email.trim()) {
    throw new ServiceError('VALIDATION_ERROR', 'Email is required.', 400);
  }
  if (!password || password.length < 6) {
    throw new ServiceError('VALIDATION_ERROR', 'Password must be at least 6 characters.', 400);
  }
  if (!role || !['ATTENDEE', 'ORGANIZER'].includes(role)) {
    throw new ServiceError('VALIDATION_ERROR', 'Role must be ATTENDEE or ORGANIZER.', 400);
  }

  if (role === 'ATTENDEE') {
    if (!ageGroup) {
      throw new ServiceError('VALIDATION_ERROR', 'Age group is required for ATTENDEE accounts.', 400);
    }
    if (!gender) {
      throw new ServiceError('VALIDATION_ERROR', 'Gender is required for ATTENDEE accounts.', 400);
    }
  }

  if (ageGroup && !ALLOWED_AGE_GROUPS.includes(ageGroup)) {
    throw new ServiceError(
      'VALIDATION_ERROR',
      `Age group must be one of: ${ALLOWED_AGE_GROUPS.join(', ')}.`,
      400
    );
  }

  const normalizedEmail = normalizeEmail(email);
  const container = getUsersContainer();

  const { resources: existing } = await container.items
    .query({
      query: 'SELECT * FROM c WHERE c.email = @email',
      parameters: [{ name: '@email', value: normalizedEmail }]
    })
    .fetchAll();

  if (existing.length > 0) {
    throw new ServiceError('EMAIL_ALREADY_EXISTS', 'An account with this email already exists.', 409);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const userId = uuidv4();
  const now = new Date().toISOString();

  const userDoc = {
    id: userId,
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
    role,
    ageGroup: ageGroup || null,
    gender: gender || null,
    createdAt: now
  };

  await container.items.create(userDoc);

  const token = generateToken(userId, role);
  const safeUser = stripPassword(userDoc);

  return { user: safeUser, token };
}

async function loginUser(email, password) {
  if (!email || !password) {
    throw new ServiceError('VALIDATION_ERROR', 'Email and password are required.', 400);
  }

  const normalizedEmail = normalizeEmail(email);
  const container = getUsersContainer();

  const { resources: users } = await container.items
    .query({
      query: 'SELECT * FROM c WHERE c.email = @email',
      parameters: [{ name: '@email', value: normalizedEmail }]
    })
    .fetchAll();

  if (users.length === 0) {
    throw new ServiceError('INVALID_CREDENTIALS', 'Invalid email or password.', 401);
  }

  const user = users[0];
  const match = await bcrypt.compare(password, user.passwordHash);

  if (!match) {
    throw new ServiceError('INVALID_CREDENTIALS', 'Invalid email or password.', 401);
  }

  const token = generateToken(user.id, user.role);
  const safeUser = stripPassword(user);

  return { user: safeUser, token };
}

async function getUserById(userId) {
  const container = getUsersContainer();
  const { resource: user } = await container.item(userId, userId).read();

  if (!user) {
    throw new ServiceError('USER_NOT_FOUND', 'User not found.', 404);
  }

  return stripPassword(user);
}

module.exports = { registerUser, loginUser, getUserById, ServiceError };
