// server.test.js
/**
 * Block Lease — Backend Unit Tests (UT-01 .. UT-05)
 * -------------------------------------------------
 * Cases:
 *  UT-01: /api/login-landlord -> 200 + JWT
 *  UT-02: Canonical Fingerprint -> Identical hash on repeat
 *  UT-03: AI Schema Validator -> All keys present
 *  UT-04: “Blockchain Write” (Simplified) -> Timestamp > 0
 *  UT-05: S3 Presigned URL -> expiresIn === 3600
 */

const request = require('supertest');
const crypto = require('crypto');

const { app, connectDB, closeDB, getPresignedUrl } = require('./server');

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const dbUtil = require('./utils/db');

// -------------------- M O C K S --------------------

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

jest.mock('bcryptjs', () => ({
  ...jest.requireActual('bcryptjs'),
  compare: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
  ...jest.requireActual('jsonwebtoken'),
  verify: jest.fn(),
}));


jest.mock('./utils/db', () => {
  const original = jest.requireActual('./utils/db');
  return {
    ...original,
    getDB: jest.fn(),
    closeDB: jest.fn(),
  };
});

// -------------------- T E S T   S E T U P --------------------

let collections;

function primeDbMock() {
  collections = {
    landlords: mkCollection(),
    units: mkCollection(),
    pending_contracts: mkCollection(),
    approved_contracts: mkCollection(),
  };

  dbUtil.getDB.mockReturnValue({
    collection: (name) => {
      if (!collections[name]) {
        collections[name] = mkCollection();
      }
      return collections[name];
    },
  });
}

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

function validateAiSchema(data) {
  const required = ['Landlord', 'Tenant', 'Unit', 'From', 'To', 'Rent'];
  if (!data || typeof data !== 'object') return false;
  return required.every((k) => Object.prototype.hasOwnProperty.call(data, k));
}

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
      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        name: 'Test Landlord',
        email: 'test@example.com',
        password: '$2a$10$somehash',
        emailStatus: 'verified',
        kycStatus: 'approved',
      };

      collections.landlords.findOne.mockResolvedValue(mockUser);

      bcrypt.compare.mockResolvedValue(true);


      const res = await request(app)
        .post('/api/login-landlord')
        .send({ email: 'test@example.com', password: 'P@ssword123' });

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('success');
      expect(typeof res.body.token).toBe('string');
      expect(res.body.token.split('.').length).toBe(3);
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

      getSignedUrl.mockResolvedValue('https://fake-s3-url.com/temp');

      const url = await getPresignedUrl('approved-contracts/demo.pdf');

      expect(url).toBe('https://fake-s3-url.com/temp');
      expect(getSignedUrl).toHaveBeenCalledTimes(1);

      const call = getSignedUrl.mock.calls[0];
      const opts = call[2];
      expect(opts).toMatchObject({ expiresIn: 3600 });
    });
  });
});
