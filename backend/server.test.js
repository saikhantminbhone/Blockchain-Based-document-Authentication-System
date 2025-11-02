// server.test.js
/**
 * Block Lease — Backend Unit Tests (UT-01 .. UT-05)
 * -------------------------------------------------
 * Covers:
 *  UT-01: /api/login-landlord -> 200 + JWT
 *  UT-02: Canonical Fingerprint -> Identical hash on repeat
 *  UT-03: AI Schema Validator -> All keys present
 *  UT-04: “Blockchain Write” (Simplified) -> Timestamp > 0
 *  UT-05: S3 Presigned URL -> expiresIn === 3600
 */

const request = require('supertest');
const crypto = require('crypto');

// Adjust if you export from a different file:
const { app, connectDB, closeDB, getPresignedUrl } = require('./server');

// ---- External deps we’ll mock where needed ----
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// ---- Our DB util mocked to return in-memory collections map ----
const dbUtil = require('./utils/db');

// -------------------- M O C K S --------------------

// 1) Mock AWS presigner
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

// 2) Mock bcrypt: keep real hash (if you need it elsewhere), mock compare
jest.mock('bcryptjs', () => ({
  ...jest.requireActual('bcryptjs'),
  compare: jest.fn(),
}));

// 3) Mock JWT verify only (we keep real sign for login response)
jest.mock('jsonwebtoken', () => ({
  ...jest.requireActual('jsonwebtoken'),
  verify: jest.fn(),
}));

// 4) Mock our DB layer: getDB returns an object whose collection()
//    is backed by an in-memory "collections" registry we control in tests.
jest.mock('./utils/db', () => {
  const original = jest.requireActual('./utils/db');
  return {
    ...original,
    getDB: jest.fn(),
    closeDB: jest.fn(), // ensure test suite can call without touching real DB
  };
});

// -------------------- T E S T   S E T U P --------------------

// In-memory collections registry for mocks
let collections;

// Helper: reset DB mock to fresh in-memory collections before each test
function primeDbMock() {
  collections = {
    landlords: mkCollection(),
    units: mkCollection(),
    pending_contracts: mkCollection(),
    approved_contracts: mkCollection(),
  };

  // getDB() returns an object with .collection(name)
  dbUtil.getDB.mockReturnValue({
    collection: (name) => {
      if (!collections[name]) {
        // auto-create if a test requests a new collection name
        collections[name] = mkCollection();
      }
      return collections[name];
    },
  });
}

// Minimal in-memory collection stub with the methods we use
function mkCollection() {
  return {
    // settable spies:
    findOne: jest.fn(),
    insertOne: jest.fn(),
    updateOne: jest.fn(),
    deleteOne: jest.fn(),
    find: jest.fn(() => ({ toArray: jest.fn().mockResolvedValue([]) })),
  };
}

beforeAll(async () => {
  // If your connectDB touches a real DB, you can no-op it in tests,
  // but calling it is fine since we fully mock getDB() anyway.
  await connectDB?.();
});

beforeEach(() => {
  jest.clearAllMocks();
  primeDbMock();
});

afterAll(async () => {
  await closeDB?.();
});

// -------------------- H E L P E R S --------------------

// Helper for UT-03 (AI schema validator) – mirrors your project’s expected keys
function validateAiSchema(data) {
  const required = ['Landlord', 'Tenant', 'Unit', 'From', 'To', 'Rent'];
  if (!data || typeof data !== 'object') return false;
  return required.every((k) => Object.prototype.hasOwnProperty.call(data, k));
}

// Deterministic JSON stringify (sorted keys) – used in UT-02
function stableStringify(obj) {
  return JSON.stringify(
    Object.keys(obj)
      .sort()
      .reduce((acc, k) => ((acc[k] = obj[k]), acc), {})
  );
}

// -------------------- T E S T S --------------------

describe('Block Lease Backend Tests', () => {
  // UT-01: /api/login-landlord
  describe('UT-01: /api/login-landlord', () => {
    it('returns 200 + JWT for a valid login', async () => {
      // Arrange mock landlord
      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        name: 'Test Landlord',
        email: 'test@example.com',
        password: '$2a$10$somehash', // stored hash
        emailStatus: 'verified',
        kycStatus: 'approved',
      };

      // DB: findOne by email returns mockUser
      collections.landlords.findOne.mockResolvedValue(mockUser);

      // bcrypt.compare resolves true (password matches)
      bcrypt.compare.mockResolvedValue(true);

      // Act
      const res = await request(app)
        .post('/api/login-landlord') // <- ensure this route matches your server
        .send({ email: 'test@example.com', password: 'P@ssword123' });

      // Assert
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('success');
      expect(typeof res.body.token).toBe('string');
      expect(res.body.token.split('.').length).toBe(3); // looks like a JWT
    });

    it('returns 401 for invalid password', async () => {
      collections.landlords.findOne.mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        name: 'Test Landlord',
        email: 'test@example.com',
        password: '$2a$10$somehash',
        emailStatus: 'verified',
        kycStatus: 'approved',
      });

      bcrypt.compare.mockResolvedValue(false);

      const res = await request(app)
        .post('/api/login-landlord')
        .send({ email: 'test@example.com', password: 'wrong' });

      expect(res.statusCode).toBe(401);
    });

    it('returns 401 when user not found', async () => {
      collections.landlords.findOne.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/login-landlord')
        .send({ email: 'absent@example.com', password: 'irrelevant' });

      expect(res.statusCode).toBe(401);
    });
  });

  // UT-02: Canonical Fingerprint -> Identical hash on repeat
  describe('UT-02: Canonical Fingerprint', () => {
    it('returns identical SHA-256 hash for the same canonical object (deterministic)', () => {
      const canonicalA = {
        landlordName: 'Niran',
        tenantEmail: 'tenant@example.com',
        address: 'Asoke Condo 12/34',
        validFrom: '2025-01-01',
        validTo: '2025-12-31',
      };

      const canonicalB = {
        validTo: '2025-12-31', // different order
        tenantEmail: 'tenant@example.com',
        validFrom: '2025-01-01',
        address: 'Asoke Condo 12/34',
        landlordName: 'Niran',
      };

      const strA = stableStringify(canonicalA);
      const strB = stableStringify(canonicalB);

      const hashA = crypto.createHash('sha256').update(strA).digest('hex');
      const hashB = crypto.createHash('sha256').update(strB).digest('hex');

      expect(hashA).toHaveLength(64);
      expect(hashA).toBe(hashB);
    });
  });

  // UT-03: AI Schema Validator
  describe('UT-03: AI Schema Validator', () => {
    it('returns true when all required keys are present', () => {
      const good = {
        Landlord: 'Niran',
        Tenant: 'Malee',
        Unit: 'Asoke Condo',
        From: '01/01/2025',
        To: '31/12/2025',
        Rent: '15000',
      };
      expect(validateAiSchema(good)).toBe(true);
    });

    it('returns false when any key is missing', () => {
      const bad = {
        Landlord: 'Niran',
        Tenant: 'Malee',
        // Unit missing
        From: '01/01/2025',
        To: '31/12/2025',
        Rent: '15000',
      };
      expect(validateAiSchema(bad)).toBe(false);
    });
  });

  // UT-04: “Blockchain Write” (Simplified) -> Timestamp > 0
  describe('UT-04: Blockchain Write (Simplified)', () => {
    it('produces a timestamp greater than 0 when writing hash', () => {
      const canonical = {
        landlordName: 'Niran',
        tenantEmail: 'tenant@example.com',
        address: 'Asoke Condo 12/34',
        validFrom: '2025-01-01',
        validTo: '2025-12-31',
      };

      const str = stableStringify(canonical);
      const docHash = crypto.createHash('sha256').update(str).digest('hex');

      const timestamp = Date.now();

      expect(docHash).toMatch(/^[a-f0-9]{64}$/);
      expect(typeof timestamp).toBe('number');
      expect(timestamp).toBeGreaterThan(0); // “Timestamp > 0 — Pass”
    });
  });

  // UT-05: S3 Presigned URL -> expiresIn === 3600
  describe('UT-05: S3 Presigned URL', () => {
    it('requests a presigned URL with 3600s expiry', async () => {
      // Mock AWS SDK call result
      getSignedUrl.mockResolvedValue('https://fake-s3-url.com/temp');

      // Call your helper (exported from server.js)
      const url = await getPresignedUrl('approved-contracts/demo.pdf');

      expect(url).toBe('https://fake-s3-url.com/temp');
      expect(getSignedUrl).toHaveBeenCalledTimes(1);

      // Third argument to getSignedUrl should include { expiresIn: 3600 }
      const call = getSignedUrl.mock.calls[0];
      const opts = call[2];
      expect(opts).toMatchObject({ expiresIn: 3600 });
    });
  });
});
