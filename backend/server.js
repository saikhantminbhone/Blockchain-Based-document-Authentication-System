// server.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { ethers } = require('ethers');
const crypto = require('crypto');
const { ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { connectDB, getDB } = require('./utils/db');
const sendEmail = require('./utils/sendEmail');
const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { v4: uuidv4 } = require('uuid');
const { OAuth2Client } = require('google-auth-library');
const QRCode = require('qrcode');
const { fileTypeFromBuffer } = require('file-type');
const mime = require('mime-types');
let sharpLib = null;
sharpLib = require('sharp');

const {
  AiScanContract,
  AiExtractDeedData,
  AiCompareAddresses,
  AiFindBestUnitMatch,
  AiextractUtilityBillData,
  AiclassifyDocument
} = require('./utils/aiModel');

// ------------------------------------------------------------------
// App & Middleware
// ------------------------------------------------------------------
const app = express();
app.use(cors({ origin: "*" }));

// IMPORTANT: parse raw only for Veriff webhook path
app.use('/api/veriff/webhook', express.raw({ type: 'application/json' }));

// Then normal parsers for the rest of the app
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

const upload = multer({ storage: multer.memoryStorage() });

// ------------------------------------------------------------------
// Env
// ------------------------------------------------------------------
const {
  PORT,
  BASE_SMOY_RPC_URL,
  ADMIN_PRIVATE_KEY,
  CONTRACT_ADDRESS,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_REGION,
  AWS_S3_BUCKET_NAME,
  JWT_SECRET,
  VERIFF_API_KEY,
  VERIFF_SECRET_KEY,
  VERIFF_PUBLIC_URL,
  GOOGLE_CLIENT_ID,
  FRONTEND_URL
} = process.env;

// ------------------------------------------------------------------
// Clients
// ------------------------------------------------------------------
const veriffApi = axios.create({
  baseURL: 'https://api.veriff.me/v1',
  headers: { 'Content-Type': 'application/json', 'X-AUTH-CLIENT': VERIFF_API_KEY },
});

const s3 = new S3Client({
  region: AWS_REGION,
  credentials: { accessKeyId: AWS_ACCESS_KEY_ID, secretAccessKey: AWS_SECRET_ACCESS_KEY }
});

const contractABI = require('../blockchain/artifacts/contracts/DocumentRegistry.sol/DocumentRegistry.json').abi;
const provider = new ethers.JsonRpcProvider(BASE_SMOY_RPC_URL);
const adminWallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, adminWallet);

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
const BRAND = {
  logoUrl: 'https://blocklease.site/assests/logo.png',
  primary: '#1E3A8A',
  accent: '#3B82F6',
  success: '#059669',
  warning: '#D97706',
  danger:  '#DC2626',
  bg: '#F9FAFB',
  card: '#FFFFFF',
  text: '#111827',
  textMuted: '#6B7280',
  border: '#E5E7EB'
};

/**
 * Bulletproof single-element CTA with Outlook VML fallback.
 */
function renderButton(href, label) {
  const bg = BRAND.primary;
  return `
  <!--[if mso]>
    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${href}"
      style="height:46px;v-text-anchor:middle;width:260px;" arcsize="10%"
      stroke="f" fillcolor="${bg}">
      <w:anchorlock/>
      <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:700;">
        ${label}
      </center>
    </v:roundrect>
  <![endif]-->
  <!--[if !mso]><!-- -->
    <a href="${href}" target="_blank" rel="noopener noreferrer"
       style="
         display:inline-block;
         background:${bg};
         color:#ffffff !important;
         text-decoration:none;
         font-weight:600;
         font-size:16px;
         line-height:46px;
         padding:0 28px;
         border-radius:8px;
         -webkit-text-size-adjust:none;
         mso-hide:all;
         cursor:pointer;">
      ${label}
    </a>
  <!--<![endif]-->
  `;
}

/**
 * Unified email shell.
 */
function renderEmail({ title, intro, bodyHtml, button, footerNote }) {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>${title}</title>
    <style>
      html,body { margin:0 !important; padding:0 !important; }
      img { border:0; outline:none; text-decoration:none; display:block; height:auto; }
      table { border-collapse: separate !important; }
      a { text-decoration:none; }
      @media (max-width:600px){ .container{width:100% !important; padding:16px !important;} }
    </style>
  </head>
  <body style="margin:0;padding:0;background:${BRAND.bg}">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BRAND.bg}">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="600" class="container" cellspacing="0" cellpadding="0"
                 style="background:${BRAND.card};border-radius:12px;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);overflow:hidden;">
            <tr>
              <td align="center" style="padding:24px;border-bottom:1px solid ${BRAND.border}">
                <img src="${BRAND.logoUrl}" width="160" alt="Block Lease">
              </td>
            </tr>

            <tr>
              <td style="padding:24px 24px 0 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND.text}">
                <h1 style="margin:0 0 8px;font-size:24px;line-height:1.25;color:${BRAND.primary};">${title}</h1>
                ${intro ? `<p style="margin:0 0 12px;color:${BRAND.textMuted};">${intro}</p>` : ''}
              </td>
            </tr>

            <tr>
              <td style="padding:0 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND.text}">
                ${bodyHtml || ''}
              </td>
            </tr>

            ${button ? `
            <tr>
              <td align="center" style="padding:32px 24px 8px 24px;">
                ${renderButton(button.href, button.label)}
              </td>
            </tr>` : ''}

            ${footerNote ? `
            <tr>
              <td style="padding:8px 24px 0 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND.textMuted};font-size:14px;">
                ${footerNote}
              </td>
            </tr>` : ''}

            <tr>
              <td align="center" style="padding:16px 24px;border-top:1px solid ${BRAND.border};
                  font-size:12px;color:#9CA3AF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                © ${new Date().getFullYear()} Block Lease™. All rights reserved.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
}

function splitName(fullName = '') {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'Unknown', lastName: undefined };
  if (parts.length === 1) return { firstName: parts[0], lastName: undefined };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function hmacHex(secret, dataBufferOrString) {
  return crypto.createHmac('sha256', secret).update(dataBufferOrString).digest('hex');
}

/** S3 presigned URL for inline preview */
async function getPresignedUrl(s3Key) {
  if (!s3Key) return null;
  const command = new GetObjectCommand({
    Bucket: AWS_S3_BUCKET_NAME,
    Key: s3Key,
    ResponseContentDisposition: 'inline'
  });
  try {
    return await getSignedUrl(s3, command, { expiresIn: 3600 }); // 1h
  } catch (err) {
    console.error(`❌ Presign error for ${s3Key}:`, err);
    return null;
  }
}

async function normalizeImageToPng(buffer, mimetype = '', originalname = '') {
  const looksHeic =
    /heic|heif/i.test(mimetype || '') ||
    /\.hei[c|f]$/i.test(originalname || '');

  if (looksHeic) {
    const convert = require('heic-convert');
    const out = await convert({ buffer, format: 'PNG', quality: 1 });
    return { buffer: out, ext: 'png', contentType: 'image/png' };
  }

  if (sharpLib) {
    try {
      const out = await sharpLib(buffer)
        .rotate()
        .png({ compressionLevel: 9 })
        .toBuffer();
      return { buffer: out, ext: 'png', contentType: 'image/png' };
    } catch (e) { /* fall through */ }
  }

  const ft = await fileTypeFromBuffer(buffer);
  const contentType = ft?.mime || mimetype || 'application/octet-stream';
  const ext = ft?.ext || mime.extension(contentType) || 'bin';
  return { buffer, ext, contentType };
}

// ---- Canonical normalisation helpers (avoid hash drift due to casing/spacing) ----
const normalise = (s) => (s ?? '')
  .toString()
  .trim()
  .replace(/\s+/g, ' ')
  .toLowerCase();

/** Build the canonical fingerprint (lowercased) used for hashing */
function buildCanonicalFingerprint({ landlord, tenant, unit, from, to, rent }) {
  return `Landlord: ${normalise(landlord)} | ` +
         `Tenant: ${normalise(tenant)} | ` +
         `Unit: ${normalise(unit)} | ` +
         `From: ${(from ?? '').toString().trim()} | ` +
         `To: ${(to ?? '').toString().trim()} | ` +
         `Rent: ${(rent ?? '').toString().trim()}`;
}

/** Build a display fingerprint (preserve case) */
function buildDisplayFingerprint({ landlord, tenant, unit, from, to, rent }) {
  return `Landlord: ${(landlord ?? '').toString().trim()} | ` +
         `Tenant: ${(tenant ?? '').toString().trim()} | ` +
         `Unit: ${(unit ?? '').toString().trim()} | ` +
         `From: ${(from ?? '').toString().trim()} | ` +
         `To: ${(to ?? '').toString().trim()} | ` +
         `Rent: ${(rent ?? '').toString().trim()}`;
}

/** AI fingerprint parser */
function parseFingerprint(fingerprint) {
  const details = fingerprint.split('|').reduce((acc, part) => {
    const idx = part.indexOf(':');
    if (idx !== -1) {
      const key = part.substring(0, idx).trim().toLowerCase();
      const value = part.substring(idx + 1).trim();
      acc[key] = value;
    }
    return acc;
  }, {});
  return {
    landlordName: details.landlord || 'N/A',
    tenantName: details.tenant || 'N/A',
    unitInfo: details.unit || 'N/A',
    from: details.from || 'N/A',
    to: details.to || 'N/A',
    rent: details.rent || 'N/A',
  };
}

/** JWT auth */
const authMiddleware = (req, res, next) => {
  const authHeader = req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ status: 'error', message: 'No token, authorization denied.' });
  }
  const token = authHeader.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.landlordId = new ObjectId(decoded.landlordId);
    req.landlordName = decoded.name;
    next();
  } catch {
    res.status(401).json({ status: 'error', message: 'Token is not valid.' });
  }
};

// helper: escape for regex (used in landlord lookups)
const escapeRegex = (s = '') => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ------------------------------------------------------------------
// Auth & Registration
// ------------------------------------------------------------------
app.post('/api/register-landlord', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ status: 'error', message: "Name, email, and password are required." });
    }
    const lowerEmail = email.toLowerCase();
    const coll = getDB().collection('landlords');

    if (await coll.findOne({ email: lowerEmail })) {
      return res.status(409).json({ status: 'error', message: "An account with this email already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
    const emailVerificationExpires = new Date(Date.now() + 15 * 60 * 1000);

    const newLandlord = {
      name,
      email: lowerEmail,
      password: hashedPassword,
      phone: phone || '',
      kycStatus: 'pending',
      emailStatus: 'unverified',
      emailVerificationToken,
      emailVerificationExpires,
      createdAt: new Date(),
    };
    await coll.insertOne(newLandlord);

    const verificationUrl = `${FRONTEND_URL}/verify-email/${verificationToken}`;
    const subject = 'Verify Your Email Address for Block Lease';

    const html = renderEmail({
      title: 'Verify your email',
      intro: `Hello ${name},`,
      bodyHtml: `<p style="margin:0 0 8px;color:${BRAND.textMuted}">Thanks for registering with Block Lease. Click the button below to verify your email address. This link is valid for <strong>15 minutes</strong>.</p>`,
      button: { href: verificationUrl, label: 'Verify Email Address' },
      footerNote: `<small>If the button doesn’t work, copy and paste this URL into your browser:<br><a href="${verificationUrl}" style="color:${BRAND.accent};">${verificationUrl}</a></small>`
    });

    await sendEmail({ to: lowerEmail, subject, html });

    res.status(201).json({ status: 'success', message: 'Registration successful! Please check your email to verify your account.' });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ status: 'error', message: 'Server error during registration.' });
  }
});

app.post('/api/verify-email', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ status: 'error', message: "Verification token is missing." });

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const coll = getDB().collection('landlords');

    const landlord = await coll.findOne({ emailVerificationToken: hashedToken });
    if (!landlord) return res.status(400).json({ status: 'error', message: "This verification link is invalid." });
    if (landlord.emailStatus === 'verified') {
      return res.status(200).json({ status: 'info', message: "This email address has already been verified. Please log in." });
    }
    if (new Date() > landlord.emailVerificationExpires) {
      return res.status(400).json({ status: 'error', message: "This verification link has expired. Please request a new one." });
    }

    await coll.updateOne(
      { _id: landlord._id },
      { $set: { emailStatus: 'verified' }, $unset: { emailVerificationToken: "", emailVerificationExpires: "" } }
    );

    const payload = { landlordId: landlord._id.toString(), email: landlord.email, name: landlord.name };
    const appToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });

    res.status(200).json({
      status: 'success',
      message: 'Email verified successfully!',
      token: appToken,
      landlord: { id: landlord._id, name: landlord.name, kycStatus: landlord.kycStatus }
    });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ status: 'error', message: 'Server error during email verification.' });
  }
});

app.post('/api/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ status: 'error', message: "Email is required." });

    const coll = getDB().collection('landlords');
    const landlord = await coll.findOne({ email: email.toLowerCase() });
    if (!landlord) return res.status(404).json({ status: 'error', message: "No account found with that email address." });
    if (landlord.emailStatus === 'verified') {
      return res.status(200).json({ status: 'info', message: "This email address has already been verified. You can log in." });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
    const emailVerificationExpires = new Date(Date.now() + 15 * 60 * 1000);

    await coll.updateOne(
      { _id: landlord._id },
      { $set: { emailVerificationToken, emailVerificationExpires } }
    );

    const verificationUrl = `${FRONTEND_URL}/verify-email/${verificationToken}`;
    const subject = 'Your New Verification Link for Block Lease';
    const html = renderEmail({
      title: 'New verification link',
      intro: `Hello ${landlord.name},`,
      bodyHtml: `<p style="margin:0 0 8px;color:${BRAND.textMuted}">As requested, here is a new link to verify your email address. This link is valid for <strong>15 minutes</strong>.</p>`,
      button: { href: verificationUrl, label: 'Verify Email Address' }
    });

    await sendEmail({ to: landlord.email, subject, html });
    res.status(200).json({ status: 'success', message: "A new verification email has been sent. Please check your inbox." });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ status: 'error', message: 'Server error while resending verification email.' });
  }
});

// Forgot / Reset Password
app.post('/api/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const coll = getDB().collection('landlords');
    const landlord = await coll.findOne({ email: (email || '').toLowerCase() });

    // Always respond 200 for privacy
    if (!landlord) {
      return res.status(200).json({ status: 'success', message: "If an account with this email exists, a password reset link has been sent." });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000);

    await coll.updateOne(
      { _id: landlord._id },
      { $set: { passwordResetToken, passwordResetExpires } }
    );

    const resetUrl = `${FRONTEND_URL}/reset-password/${resetToken}`;
    const subject = 'Your Password Reset Request for Block Lease';
    const html = renderEmail({
      title: 'Password reset request',
      intro: `Hello ${landlord.name},`,
      bodyHtml: `<p style="margin:0 0 8px;color:${BRAND.textMuted}">We received a request to reset your password. Click the button below to securely create a new password. This link will expire in <strong>10 minutes</strong>.</p>`,
      button: { href: resetUrl, label: 'Reset Your Password' },
      footerNote: `<small>If you did not request this, you can safely ignore this email.</small>`
    });

    await sendEmail({ to: landlord.email, subject, html });
    res.status(200).json({ status: 'success', message: "If an account with this email exists, a password reset link has been sent." });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    res.status(500).json({ status: 'error', message: 'Server error.' });
  }
});

app.post('/api/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!password || password.length < 8) {
      return res.status(400).json({ status: 'error', message: "Password must be at least 8 characters long." });
    }
    const coll = getDB().collection('landlords');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const landlord = await coll.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() }
    });
    if (!landlord) {
      return res.status(400).json({ status: 'error', message: "Password reset token is invalid or has expired." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await coll.updateOne(
      { _id: landlord._id },
      { $set: { password: hashedPassword }, $unset: { passwordResetToken: "", passwordResetExpires: "" } }
    );

    res.status(200).json({ status: 'success', message: "Password has been reset successfully. You can now log in." });
  } catch (error) {
    console.error("Reset Password Error:", error);
    res.status(500).json({ status: 'error', message: 'Server error.' });
  }
});

// Google Auth
app.post('/api/auth/google', async (req, res) => {
  try {
    const { token } = req.body;
    const ticket = await googleClient.verifyIdToken({ idToken: token, audience: GOOGLE_CLIENT_ID });
    const gp = ticket.getPayload();
    const email = (gp.email || '').toLowerCase();
    const name = gp.name || 'Google User';
    const picture = gp.picture || null;

    const coll = getDB().collection('landlords');
    let landlord = await coll.findOne({ email });
    let isNewUser = false;

    if (landlord) {
      if (landlord.authProvider !== 'google') {
        await coll.updateOne(
          { _id: landlord._id },
          { $set: { authProvider: 'google', profilePicture: picture, emailStatus: 'verified' } }
        );
      }
    } else {
      isNewUser = true;
      const toInsert = {
        name,
        email,
        password: null,
        authProvider: 'google',
        profilePicture: picture,
        kycStatus: 'pending',
        emailStatus: 'verified',
        createdAt: new Date(),
      };
      const result = await coll.insertOne(toInsert);
      landlord = { _id: result.insertedId, ...toInsert };
    }

    const appPayload = { landlordId: landlord._id.toString(), email: landlord.email, name: landlord.name };
    const appToken = jwt.sign(appPayload, JWT_SECRET, { expiresIn: '8h' });

    res.status(200).json({
      status: 'success',
      message: 'Google sign-in successful!',
      token: appToken,
      landlord: { id: landlord._id, name: landlord.name, kycStatus: landlord.kycStatus },
      isNewUser
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(401).json({ status: 'error', message: 'Google authentication failed.' });
  }
});

app.post('/api/login-landlord', async (req, res) => {
  try {
    const { email, password } = req.body;
    const lowerEmail = (email || '').toLowerCase();
    const coll = getDB().collection('landlords');

    const landlord = await coll.findOne({ email: lowerEmail });
    if (!landlord) return res.status(401).json({ status: 'error', message: 'Invalid credentials.' });

    if (landlord.emailStatus === 'unverified') {
      return res.status(403).json({ status: 'error', message: "Your email is not verified. Please check your inbox.", errorCode: 'EMAIL_NOT_VERIFIED' });
    }

    if (!landlord.password) {
      return res.status(403).json({ status: 'error', message: "This account uses Google Sign-In. Please log in with Google.", errorCode: 'GOOGLE_ONLY' });
    }

    if (landlord.kycStatus !== 'approved' && landlord.kycStatus !== 'pending') {
      return res.status(403).json({ status: 'error', message: `Account not active. KYC status: ${landlord.kycStatus}.`, kycStatus: landlord.kycStatus });
    }

    const isMatch = await bcrypt.compare(password, landlord.password);
    if (!isMatch) return res.status(401).json({ status: 'error', message: 'Invalid credentials.' });

    const payload = { landlordId: landlord._id.toString(), email: landlord.email, name: landlord.name };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });

    res.status(200).json({
      status: 'success',
      message: 'Logged in successfully!',
      token,
      landlord: { id: landlord._id, name: landlord.name, email: landlord.email, kycStatus: landlord.kycStatus }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ status: 'error', message: 'Server error during login.' });
  }
});

app.get('/api/landlord/me', authMiddleware, async (req, res) => {
  try {
    const landlord = await getDB().collection('landlords').findOne({ _id: req.landlordId }, { projection: { password: 0 } });
    if (!landlord) return res.status(404).json({ status: 'error', message: 'Landlord profile not found for this token.' });
    res.status(200).json({ landlord });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Server error fetching landlord profile.' });
  }
});

// ------------------------------------------------------------------
// Veriff
// ------------------------------------------------------------------
app.post('/api/veriff/create-session', authMiddleware, async (req, res) => {
  console.log("landlord KYC veriff start create the session");
  try {
    const { type } = req.body;
    if (type !== 'kyc') {
      return res.status(400).json({ status: 'error', message: 'This endpoint is only for KYC verification.' });
    }

    const landlords = getDB().collection('landlords');
    const landlord = await landlords.findOne({ _id: new ObjectId(String(req.landlordId)) });
    if (!landlord) return res.status(404).json({ status: 'error', message: 'Landlord not found.' });

    const { firstName, lastName } = splitName(landlord.name || '');
    const veriffPayload = {
      verification: {
        callback: `${VERIFF_PUBLIC_URL}/kyc-submitted`,
        vendorData: String(req.landlordId),
        person: { firstName, lastName },
        timestamp: new Date().toISOString(),
      },
    };
    const bodyStr = JSON.stringify(veriffPayload);
    const signature = hmacHex(VERIFF_SECRET_KEY, bodyStr);

    const response = await veriffApi.post('sessions', bodyStr, {
      headers: { 'X-HMAC-SIGNATURE': signature },
      transformRequest: [(data) => data]
    });

    const { verification } = response.data || {};
    const { url, id } = verification || {};
    if (!url || !id) {
      return res.status(502).json({
        status: 'error',
        message: 'Unexpected Veriff response (missing url/id).',
        raw: response.data,
      });
    }

    await landlords.updateOne(
      { _id: new ObjectId(String(req.landlordId)) },
      { $set: { veriffSessionId: id, kycStatus: 'pending', lastKycUpdate: new Date() } }
    );

    res.status(201).json({ sessionUrl: url });
  } catch (error) {
    console.error('Veriff create-session error:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    res.status(500).json({
      status: 'error',
      message: error.response?.data?.message || error.message || 'Server error during Veriff session creation.',
      code: error.response?.data?.code,
    });
  }
});

// KYC result emails
async function sendKycEmail(landlord, kycStatus) {
  const name = landlord.name || 'Valued User';
  const to = landlord.email;

  let subject = '';
  let color = BRAND.primary;
  let bodyHtml = '';
  let button = null;

  if (kycStatus === 'approved') {
    subject = 'Congratulations! Your Block Lease account is verified.';
    color = BRAND.success;
    bodyHtml = `<p style="margin:0 0 8px;color:${BRAND.textMuted}">Your identity has been verified and your Block Lease account is now fully active.</p>
                <p style="margin:0 0 8px;color:${BRAND.textMuted}">You can now log in to manage your properties and contracts.</p>`;
    button = { href: `${FRONTEND_URL}/dashboard`, label: 'Go to Dashboard' };
  } else if (kycStatus === 'resubmission_requested') {
    subject = 'Action needed: Please resubmit your verification';
    color = BRAND.warning;
    bodyHtml = `<p style="margin:0 0 8px;color:${BRAND.textMuted}">We couldn’t complete your verification — this may be due to glare, blur, or cropped ID images.</p>
                <ul style="margin:0 0 8px;color:${BRAND.textMuted}">
                  <li>Retake your ID photo clearly and ensure all corners are visible</li>
                  <li>Remove masks/hats and use good lighting</li>
                </ul>`;
    button = { href: `${FRONTEND_URL}/verify-again`, label: 'Retry Verification' };
  } else {
    subject = 'Verification unsuccessful – please try again';
    color = BRAND.danger;
    bodyHtml = `<p style="margin:0 0 8px;color:${BRAND.textMuted}">WeThe comprehensive testing and validation programme verified that all functional and non-functional requirements were achieved. Empirical results confirm secure operation, high performance, and strong user acceptance. Together, the Jest unit tests, performance benchmarks, security audits, and UAT results demonstrate a mature, production-ready prototype. These validated outcomes provide the evidential basis for the concluding analysis presented in Chapter 7. were unable to verify your identity. This can happen due to unclear images or mismatched information.</p>
                <p style="margin:0 0 8px;color:${BRAND.textMuted}">You can log in and start a new verification attempt when ready.</p>`;
    button = { href: `${FRONTEND_URL}/login`, label: 'Log In to Retry' };
  }

  const html = renderEmail({
    title: `<span style="color:${color}">KYC Update</span>`,
    intro: `Hello ${name},`,
    bodyHtml,
    button
  });

  await sendEmail({ to, subject, html });
}

// Veriff webhook (raw body)
app.post('/api/veriff/webhook', async (req, res) => {
  console.log('[WEBHOOK]',
    'isBuffer=', Buffer.isBuffer(req.body),
    'ctor=', req.body?.constructor?.name,
    'len=', req.body?.length,
    'ct=', req.headers['content-type']
  );

  try {
    let raw;
    if (Buffer.isBuffer(req.body)) raw = req.body;
    else if (typeof req.body === 'string') raw = Buffer.from(req.body, 'utf8');
    else raw = Buffer.from(JSON.stringify(req.body || {}), 'utf8');

    const sigHeader = (req.headers['x-hmac-signature'] || req.headers['x-signature'] || '').toString().trim();
    if (!sigHeader) return res.status(400).send('Missing signature header');
    if (!VERIFF_SECRET_KEY) return res.status(500).send('Server misconfiguration');

    const expectedHex = crypto.createHmac('sha256', VERIFF_SECRET_KEY).update(raw).digest('hex');
    const a = Buffer.from(expectedHex, 'hex');
    const b = Buffer.from(sigHeader, 'hex');

    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(403).send('Invalid signature');
    }

    let event;
    try { event = JSON.parse(raw.toString('utf8')); }
    catch { console.log(event); return res.status(400).send('Invalid JSON'); }

    const v = event?.verification;
    if (!v) return res.status(200).send('OK');

    const statusMap = {
      approved: 'approved',
      declined: 'failed',
      resubmission_requested: 'resubmission_requested',
      expired: 'failed',
      abandoned: 'failed',
    };
    const kycStatus = statusMap[v.status] ?? 'failed';
    const vendorData = v.vendorData;
    if (!vendorData) return res.status(200).send('OK');

    // ACK quickly
    res.status(200).send('Webhook received.');

    // async post-work
    (async () => {
      try {
        // Idempotency
        try {
          await getDB().collection('veriff_events').insertOne({
            _id: v.id,
            decision: v.status,
            receivedAt: new Date(),
          });
        } catch (dup) {
          if (dup?.code === 11000) {
            console.log('ℹ️ Duplicate event ignored:', v.id);
            return;
          }
          throw dup;
        }

        const person = v.person || {};
        const document = v.document || {};
        const updateData = {
          kycStatus,
          name: person.fullName || [person.firstName, person.lastName].filter(Boolean).join(' ') || undefined,
          veriffData: {
            decision: v.status,
            firstName: person.firstName,
            lastName: person.lastName,
            fullName: person.fullName,
            dateOfBirth: person.dateOfBirth,
            address: document.address,
            documentType: document.type,
            documentNumber: document.number,
            country: document.country,
            veriffId: v.id,
            decisionTime: v.decisionTime,
            submissionTime: v.submissionTime,
            acceptanceTime: v.acceptanceTime,
            attemptId: v.attemptId,
          },
          lastKycUpdate: new Date(),
        };

        let landlordObjectId;
        try {
          landlordObjectId = new ObjectId(String(vendorData));
        } catch {
          console.error('⚠️ vendorData is not a valid ObjectId:', vendorData);
          return;
        }

        const landlords = getDB().collection('landlords');
        await landlords.updateOne({ _id: landlordObjectId }, { $set: updateData });

        const landlord = await landlords.findOne({ _id: landlordObjectId });
        if (landlord?.email) {
          await sendKycEmail(landlord, kycStatus);
        }
      } catch (e) {
        console.error('Webhook post-processing error:', e);
      }
    })();
  } catch (err) {
    console.error('Veriff webhook error:', err);
    if (!res.headersSent) res.status(500).send('Server error processing webhook.');
  }
});

// ------------------------------------------------------------------
//
// Units (with AI)
//
/* Upload: titleDeed + utilityBill */
app.post('/api/units', authMiddleware, upload.fields([
  { name: 'titleDeed', maxCount: 1 },
  { name: 'utilityBill', maxCount: 1 }
]), async (req, res) => {
  try {
    const { unitNumber, floor, streetAddress, subdistrict, district, province, zipCode, country, isConfirmed } = req.body;
    const titleDeedFile = req.files?.titleDeed?.[0];
    const utilityBillFile = req.files?.utilityBill?.[0];

    if (!titleDeedFile || !utilityBillFile) {
      return res.status(400).json({
        status: 'error',
        message: 'Both a Title Deed and a recent Utility Bill are required.',
        hint: 'Upload one clear image for each.'
      });
    }

    // --- AI extraction with friendly error forwarding ---
    const [deedData, billData] = await Promise.allSettled([
      AiExtractDeedData(titleDeedFile.buffer, titleDeedFile.mimetype),
      AiextractUtilityBillData(utilityBillFile.buffer, utilityBillFile.mimetype)
    ]);

    if (deedData.status === 'rejected' && deedData.reason?.expose) {
      return res.status(deedData.reason.status).json({
        status: 'error',
        code: deedData.reason.code,
        message: deedData.reason.message,
        hint: deedData.reason.hint,
        field: deedData.reason.field
      });
    }
    if (billData.status === 'rejected' && billData.reason?.expose) {
      return res.status(billData.reason.status).json({
        status: 'error',
        code: billData.reason.code,
        message: billData.reason.message,
        hint: billData.reason.hint,
        field: billData.reason.field
      });
    }

    if (deedData.status !== 'fulfilled' || billData.status !== 'fulfilled')
      throw new Error('AI extraction failed unexpectedly.');

    const deed = deedData.value;
    const bill = billData.value;

    // --- Verification ---
    const landlord = await getDB().collection('landlords').findOne({ _id: req.landlordId });
    const profile = (landlord?.name || '').toLowerCase();

    if (profile !== (deed.ownerName || '').toLowerCase() ||
        profile !== (bill.nameOnBill || '').toLowerCase()) {
      return res.status(403).json({
        status: 'error',
        message: 'Ownership Mismatch.',
        hint: 'Ensure your account name matches both documents.'
      });
    }

    const sameAddress = await AiCompareAddresses(deed.propertyAddress, bill.addressOnBill);
    if (!sameAddress) {
      return res.status(400).json({
        status: 'error',
        message: 'Address Mismatch between deed and bill.',
        hint: 'Upload documents showing the same property.'
      });
    }

    // --- Address confirmation check ---
    const userInputAddress = `${streetAddress}, ${subdistrict}, ${district}, ${province}, ${zipCode}`;
    const addressMatch = await AiCompareAddresses(userInputAddress, deed.propertyAddress);

    if (!addressMatch && !isConfirmed) {
      return res.status(200).json({
        status: 'address_mismatch',
        message: 'Your entered address does not exactly match the title deed.',
        userInputAddress,
        aiSuggestedAddress: deed.propertyAddress,
        hint: 'If correct, confirm and resubmit.'
      });
    }

    // --- Upload to S3 ---
    const [titleDeedS3Key, utilityBillS3Key] = await Promise.all([
      uploadFileToS3(titleDeedFile.buffer, 'verified-title-deeds', titleDeedFile.originalname, titleDeedFile.mimetype),
      uploadFileToS3(utilityBillFile.buffer, 'verified-utility-bills', utilityBillFile.originalname, utilityBillFile.mimetype)
    ]);

    // --- Save to DB ---
    const newUnit = {
      landlordId: req.landlordId,
      unitNumber,
      floor: floor || '',
      address: { streetAddress, subdistrict, district, province, zipCode, country },
      titleDeedS3Key,
      utilityBillS3Key,
      isVerified: true,
      verificationStatus: `verified_by_ai_multi_doc_${bill.issuer}`,
      aiExtractedData: { deed, bill },
      createdAt: new Date()
    };

    const result = await getDB().collection('units').insertOne(newUnit);
    return res.status(201).json({
      status: 'success',
      message: 'Unit created and verified successfully!',
      unit: { _id: result.insertedId, ...newUnit }
    });

  } catch (error) {
    console.error('Create unit error:', error);
    if (error?.expose) {
      return res.status(error.status || 400).json({
        status: 'error',
        code: error.code,
        message: error.message,
        hint: error.hint,
        field: error.field
      });
    }
    return res.status(500).json({
      status: 'error',
      message: 'Unexpected server error. Please try again later.'
    });
  }
});

async function uploadFileToS3(fileBuffer, folder, originalname, mimetype = '') {
  let body = fileBuffer;
  let ext = (originalname.split('.').pop() || '').toLowerCase();
  let contentType = mimetype || 'application/octet-stream';

  const nameIsPdf = /\.pdf$/i.test(originalname) || contentType === 'application/pdf';
  const nameIsImage = /^image\//.test(contentType) ||
                      /\.(heic|heif|jpg|jpeg|png|gif|webp|tif|tiff|bmp)$/i.test(originalname);

  if (nameIsPdf) {
    ext = 'pdf';
    contentType = 'application/pdf';
  } else if (nameIsImage) {
    const normalized = await normalizeImageToPng(fileBuffer, mimetype, originalname);
    body = normalized.buffer;
    ext = normalized.ext;                  // 'png'
    contentType = normalized.contentType;  // 'image/png'
  } else {
    const ft = await fileTypeFromBuffer(fileBuffer);
    if (ft?.mime) {
      contentType = ft.mime;
      ext = ft.ext || ext || 'bin';
    } else {
      const guessed = mime.extension(contentType);
      if (guessed) ext = guessed;
      if (!ext) ext = 'bin';
    }
  }

  const fileName = `${uuidv4()}.${ext}`;
  const s3Key = `${folder}/${fileName}`;

  await s3.send(new PutObjectCommand({
    Bucket: AWS_S3_BUCKET_NAME,
    Key: s3Key,
    Body: body,
    ContentType: contentType,
    Metadata: { originalname }
  }));

  console.log(`✅ Uploaded ${originalname} -> ${s3Key} (${contentType})`);
  return s3Key;
}

app.get('/api/landlord/dashboard', authMiddleware, async (req, res) => {
  try {
    const landlord = await getDB().collection('landlords').findOne({ _id: req.landlordId }, { projection: { password: 0 } });
    if (!landlord) return res.status(404).json({ status: 'error', message: "Landlord not found." });

    const units = await getDB().collection('units').find({ landlordId: req.landlordId }).toArray();
    const pendingContracts = await getDB().collection('pending_contracts').find({ assignedLandlordId: req.landlordId }).toArray();
    const approvedContracts = await getDB().collection('approved_contracts').find({ landlordId: req.landlordId }).toArray();

    const unitsWithUrls = await Promise.all(units.map(async (u) => ({
      ...u,
      titleDeedUrl: await getPresignedUrl(u.titleDeedS3Key)
    })));

    res.status(200).json({ landlord, units: unitsWithUrls, pendingContracts, approvedContracts });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Server error fetching dashboard data.' });
  }
});

app.post('/api/units/:unitId/verify', authMiddleware, upload.fields([
  { name: 'titleDeed', maxCount: 1 },
  { name: 'utilityBill', maxCount: 1 }
]), async (req, res) => {
  try {
    const { unitId } = req.params;
    const titleDeedFile = req.files['titleDeed']?.[0];
    const utilityBillFile = req.files['utilityBill']?.[0];
    if (!titleDeedFile || !utilityBillFile) {
      return res.status(400).json({ status: 'error', message: "Both a Title Deed and a Utility Bill are required." });
    }

    const [deedData, billData] = await Promise.all([
      AiExtractDeedData(titleDeedFile.buffer, titleDeedFile.mimetype),
      AiextractUtilityBillData(utilityBillFile.buffer, utilityBillFile.mimetype)
    ]);

    const landlord = await getDB().collection('landlords').findOne({ _id: req.landlordId });
    if (
      landlord.name.toLowerCase() !== (deedData.ownerName || '').toLowerCase() ||
      landlord.name.toLowerCase() !== (billData.nameOnBill || '').toLowerCase()
    ) {
      return res.status(403).json({ status: 'error', message: "Ownership Mismatch: The name on the documents does not match your verified profile." });
    }

    if (!await AiCompareAddresses(deedData.propertyAddress, billData.addressOnBill)) {
      return res.status(400).json({ status: 'error', message: "Address Mismatch: The address on the deed does not match the utility bill." });
    }

    const titleDeedS3Key = await uploadFileToS3(titleDeedFile.buffer, 'verified-title-deeds', titleDeedFile.originalname, titleDeedFile.mimetype);
    const utilityBillS3Key = await uploadFileToS3(utilityBillFile.buffer, 'verified-utility-bills', utilityBillFile.originalname, utilityBillFile.mimetype);

    await getDB().collection('units').updateOne(
      { _id: new ObjectId(unitId), landlordId: req.landlordId },
      {
        $set: {
          isVerified: true,
          verificationStatus: 'verified_by_ai_multi_doc',
          titleDeedS3Key,
          utilityBillS3Key,
          aiExtractedData: { deedData, billData },
        }
      }
    );

    res.status(200).json({ status: 'success', message: "Unit deed verified successfully!" });
  } catch (error) {
    console.error('Unit verify error:', error);
    res.status(500).json({ status: 'error', message: 'Server error during deed verification.' });
  }
});

app.delete('/api/units/:unitId/archive', authMiddleware, async (req, res) => {
  try {
    const { unitId } = req.params;
    const result = await getDB().collection('units').updateOne(
      { _id: new ObjectId(unitId), landlordId: req.landlordId },
      { $set: { status: 'archived', archivedOn: new Date() } }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Unit not found or you don't have permission." });
    }
    res.status(200).json({ message: "Unit has been archived." });
  } catch (error) {
    res.status(500).json({ message: 'Server error while archiving unit.' });
  }
});

app.post('/api/units/:unitId/restore', authMiddleware, async (req, res) => {
  try {
    const { unitId } = req.params;
    const result = await getDB().collection('units').updateOne(
      { _id: new ObjectId(unitId), landlordId: req.landlordId },
      { $set: { status: 'active', archivedOn: null } }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Archived unit not found." });
    }
    res.status(200).json({ message: "Unit has been restored." });
  } catch (error) {
    res.status(500).json({ message: 'Server error while restoring unit.' });
  }
});

// ------------------------------------------------------------------
// Tenant-led Contract Flow
// ------------------------------------------------------------------
app.post('/api/contracts/initiate', upload.single('contract'), async (req, res) => {
  try {
    const { tenantEmail } = req.body;
    const contractFile = req.file;
    if (!contractFile || !tenantEmail) {
      return res.status(400).json({ status: 'error', message: "Contract file and tenant email are required." });
    }

    const validation = await AiclassifyDocument(contractFile.buffer, contractFile.mimetype);
    if (validation.type !== 'contract' || validation.confidence < 0.90) {
      return res.status(400).json({ status: 'error', message: `Invalid Document: The uploaded file does not appear to be a rental contract (AI detected type: '${validation.type}').` });
    }

    // Extract fields (NOT lowercased)
    const fingerprintAI = await AiScanContract(contractFile.buffer, contractFile.mimetype);
    const fp = parseFingerprint(fingerprintAI);

    // Build both fingerprints
    const fingerprintDisplay = buildDisplayFingerprint({
      landlord: fp.landlordName,
      tenant: fp.tenantName,
      unit: fp.unitInfo,
      from: fp.from,
      to: fp.to,
      rent: fp.rent
    });

    const fingerprintCanonical = buildCanonicalFingerprint({
      landlord: fp.landlordName,
      tenant: fp.tenantName,
      unit: fp.unitInfo,
      from: fp.from,
      to: fp.to,
      rent: fp.rent
    });

    const docHash = ethers.keccak256(ethers.toUtf8Bytes(fingerprintCanonical));

    const collPending = getDB().collection('pending_contracts');
    const collApproved = getDB().collection('approved_contracts');

    if (await collPending.findOne({ docHash })) {
      return res.status(200).json({ status: 'already_pending', message: 'This document is already pending landlord approval.' });
    }
    if (await collApproved.findOne({ docHash })) {
      return res.status(200).json({ status: 'already_approved', message: 'This document has already been approved.', docHash });
    }

    // Find landlord (case-insensitive, prefer approved)
    const landlord = await getDB().collection('landlords').findOne({
      name: { $regex: `^${escapeRegex(fp.landlordName)}$`, $options: 'i' },
      kycStatus: 'approved'
    });

    const contractS3Key = await uploadFileToS3(req.file.buffer, 'pending-contracts', contractFile.originalname, contractFile.mimetype);

    // Pending record
    const pendingContract = {
      docHash,
      fingerprintDisplay,
      fingerprintCanonical,
      contractS3Key,
      tenantEmail,
      createdAt: new Date()
    };

    if (landlord) {
      pendingContract.assignedLandlordId = landlord._id;

      const landlordUnits = await getDB().collection('units')
        .find({ landlordId: landlord._id, status: { $ne: 'archived' } }).toArray();

      let matchedUnit = null;
      if (landlordUnits.length && fp.unitInfo) {
        try {
          const bestMatchUnitId = await AiFindBestUnitMatch(
            (fp.unitInfo || '').toLowerCase(),
            landlordUnits.map(u => ({
              ...u,
              unitNumber: (u.unitNumber || '').toLowerCase(),
              address: {
                streetAddress: (u.address?.streetAddress || '').toLowerCase(),
                district: (u.address?.district || '').toLowerCase()
              }
            }))
          );
          if (bestMatchUnitId) {
            matchedUnit = landlordUnits.find(u => String(u._id) === String(bestMatchUnitId));
          }
        } catch (e) {
          console.warn('AiFindBestUnitMatch failed; will try exact match:', e?.message);
        }
      }

      if (!matchedUnit && fp.unitInfo) {
        const unitNumberCandidate = (fp.unitInfo || '').split(',')[0].trim();
        matchedUnit = await getDB().collection('units').findOne({
          landlordId: landlord._id,
          unitNumber: unitNumberCandidate
        });
      }

      if (matchedUnit) {
        pendingContract.unitId = matchedUnit._id;
        pendingContract.unitStatus = 'matched';
      } else {
        pendingContract.unitStatus = 'unmatched';
        pendingContract.unmatchedUnitIdentifier = fp.unitInfo;
      }

      await collPending.insertOne(pendingContract);
      return res.status(200).json({ status: 'pending_approval', message: 'Landlord found. Contract sent for approval.', docHash });
    } else {
      pendingContract.status = 'awaiting_landlord_registration';
      pendingContract.unmatchedUnitIdentifier = fp.unitInfo;
      await collPending.insertOne(pendingContract);
      return res.status(200).json({ status: 'landlord_not_found', message: 'Landlord not found. Please provide their email to invite them.', docHash });
    }
  } catch (error) {
    console.error('Initiate contract error:', error);
    res.status(500).json({ status: 'error', message: 'Server error during contract initiation.' });
  }
});

app.post('/api/approve-and-create-unit', authMiddleware, async (req, res) => {
  try {
    const { docHash } = req.body;
    const pending = await getDB().collection('pending_contracts').findOne({ docHash, assignedLandlordId: req.landlordId, unitStatus: 'unmatched' });
    if (!pending) return res.status(404).json({ status: 'error', message: "No unmatched pending contract found." });

    const newUnit = {
      landlordId: req.landlordId,
      unitNumber: (pending.unmatchedUnitIdentifier || '').split(',')[0].trim(),
      floor: '',
      address: {
        streetAddress: `Details from contract: ${pending.unmatchedUnitIdentifier || ''}`,
        subdistrict: '', district: '', province: '', zipCode: '', country: ''
      },
      isVerified: false,
      verificationStatus: 'pending_scan',
      createdAt: new Date(),
    };
    const result = await getDB().collection('units').insertOne(newUnit);
    await getDB().collection('pending_contracts').updateOne({ _id: pending._id }, { $set: { unitId: result.insertedId, unitStatus: 'matched' } });

    res.status(200).json({ status: 'success', message: `Unit '${newUnit.unitNumber}' was added. Please verify its title deed to approve the contract.` });
  } catch (error) {
    console.error('Approve-create unit error:', error);
    res.status(500).json({ status: 'error', message: 'Server error during this process.' });
  }
});

app.post('/api/approve-contract', authMiddleware, async (req, res) => {
  try {
    const { docHash } = req.body;
    const db = getDB();

    // 1) Find the pending contract assigned to this landlord
    const pending = await db.collection('pending_contracts').findOne({
      docHash,
      assignedLandlordId: req.landlordId,
    });

    if (!pending) {
      return res.status(404).json({ status: 'error', message: "No matching pending contract found." });
    }

    // 2) Guards (must have verified unit)
    const landlord = await db.collection('landlords').findOne({ _id: req.landlordId });
    const unit = await db.collection('units').findOne({ _id: pending.unitId });

    if (!unit || !unit.isVerified) {
      return res.status(403).json({
        status: 'error',
        message: "Action Required: You must verify the title deed for this unit before approving.",
      });
    }

    // 3) Build canonical + display fingerprints for the FINAL (corrected) info
    const originalDisplay = pending.fingerprintDisplay
      ? parseFingerprint(pending.fingerprintDisplay)
      : parseFingerprint(pending.fingerprintCanonical || pending.fingerprint || '');

    const officialUnitInfo =
      `${unit.floor ? `Floor ${unit.floor}, ` : ''}${unit.unitNumber}, ${unit.address?.streetAddress || ''}, ${unit.address?.district || ''}`;

    const correctedDisplayFingerprint = buildDisplayFingerprint({
      landlord: landlord.name,                      // keep original case
      tenant: originalDisplay.tenantName,          // may be lowercased in old data; accepted
      unit: officialUnitInfo,
      from: originalDisplay.from,
      to: originalDisplay.to,
      rent: originalDisplay.rent
    });

    const correctedCanonicalFingerprint = buildCanonicalFingerprint({
      landlord: landlord.name,
      tenant: originalDisplay.tenantName,
      unit: officialUnitInfo,
      from: originalDisplay.from,
      to: originalDisplay.to,
      rent: originalDisplay.rent
    });

    const correctedDocHash = ethers.keccak256(ethers.toUtf8Bytes(correctedCanonicalFingerprint));

    // 4) Idempotency: check chain first
    const ts = await contract.getDocumentTimestamp(correctedDocHash);
    const alreadyOnChain = (typeof ts === 'bigint') ? (ts > 0n) : (Number(ts) > 0);

    // Helper: converge DB state
    const convergeAndReturn = async (txHashOrNull, chainWasExisting) => {
      try {
        const upsertResult = await db.collection('approved_contracts').updateOne(
          { docHash: correctedDocHash },
          {
            $set: {
              docHash: correctedDocHash,
              fingerprintDisplay: correctedDisplayFingerprint,
              fingerprintCanonical: correctedCanonicalFingerprint,
              // keep legacy "fingerprint" for older UIs as the display string
              fingerprint: correctedDisplayFingerprint,
              landlordId: req.landlordId,
              unitId: pending.unitId,
              tenantEmail: pending.tenantEmail,
              contractS3Key: pending.contractS3Key,
              status: 'active',
              ...(txHashOrNull ? { txHash: txHashOrNull } : {}),
            },
            $setOnInsert: { approvedOn: new Date() },
          },
          { upsert: true }
        );

        const deleteResult = await db.collection('pending_contracts').deleteOne({ _id: pending._id });

        return res.status(200).json({
          status: 'success',
          message: chainWasExisting
            ? 'Contract already recorded on-chain. Marked as approved.'
            : 'Contract approved and recorded on the blockchain!',
          docHash: correctedDocHash,
          txHash: txHashOrNull || null,
          db: {
            upsert: {
              matchedCount: upsertResult.matchedCount,
              modifiedCount: upsertResult.modifiedCount,
              upsertedId: upsertResult.upsertedId || null,
            },
            deletedPending: deleteResult.deletedCount,
          },
        });
      } catch (e) {
        console.error('❌ DB converge error:', e);
        return res.status(500).json({
          status: 'error',
          message: 'Database error while finalizing approval.',
          detail: e?.message,
        });
      }
    };

    if (alreadyOnChain) {
      return await convergeAndReturn(null, true);
    }

    // 5) Not yet on-chain: send tx
    let receipt;
    try {
      const tx = await contract.addDocument(
        correctedDocHash,
        landlord.name,
        officialUnitInfo,
        originalDisplay.tenantName,
        originalDisplay.from,
        originalDisplay.to
      );
      receipt = await tx.wait();
      console.log('✅ chain receipt:', { txHash: receipt.hash });
    } catch (err) {
      if (err?.reason === 'Document already verified') {
        console.warn('ℹ️ chain reports already verified during send — converging as success');
        return await convergeAndReturn(null, true);
      }
      console.error('❌ approve-contract tx error:', err);
      return res.status(500).json({ status: 'error', message: 'Blockchain transaction failed during approval.' });
    }

    // 6) Converge DB after success
    return await convergeAndReturn(receipt.hash, false);

  } catch (error) {
    console.error('❌ Approve contract error (outer):', error);
    return res.status(500).json({ status: 'error', message: 'Server error during approval.' });
  }
});

app.post('/api/contracts/:docHash/terminate', authMiddleware, async (req, res) => {
  try {
    const { docHash } = req.params;
    const result = await getDB().collection('approved_contracts').updateOne(
      { docHash, landlordId: req.landlordId },
      { $set: { status: 'terminated', terminatedOn: new Date() } }
    );
    if (result.matchedCount === 0) return res.status(404).json({ status: 'error', message: "Approved contract not found." });
    res.status(200).json({ status: 'success', message: "Contract has been terminated." });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Server error while terminating contract.' });
  }
});

// ------------------------------------------------------------------
// Verification Endpoints
// ------------------------------------------------------------------

/**
 * Upload a contract and verify against chain & DB.
 * Backward compatible: tries canonical (lowercased) hash first, then legacy mixed-case.
 */
app.post('/api/verify-document', upload.single('contract'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ status: 'error', message: "Contract file is required." });
    }

    // 1) Basic validation
    const validation = await AiclassifyDocument(req.file.buffer, req.file.mimetype);
    if (validation.type !== 'contract' || validation.confidence < 0.90) {
      console.log(validation)
      return res.status(400).json({ status: 'error', message: "Invalid Document: The file does not appear to be a rental contract." });
    }

    // 2) AI scan -> fields (NOT forced lowercase)
    const initialFingerprint = await AiScanContract(req.file.buffer, req.file.mimetype);
    const initial = parseFingerprint(initialFingerprint); // landlordName, tenantName, unitInfo, from, to, rent

    const db = getDB();
    const landlordNameRaw = (initial.landlordName || '').trim();
    const unitInfoRaw     = (initial.unitInfo || '').trim();

    // 3) Robust landlord match (case-insensitive, prefer approved)
    const landlord =
      await db.collection('landlords').findOne({
        name: { $regex: `^${escapeRegex(landlordNameRaw)}$`, $options: 'i' },
        kycStatus: 'approved'
      })
      || await db.collection('landlords').findOne({
        name: { $regex: `^${escapeRegex(landlordNameRaw)}$`, $options: 'i' }
      });

    if (!landlord) {
      return res.status(200).json({ verified: false, message: "Could not match landlord from the document." });
    }

    // 4) Find a unit owned by this landlord (AI fuzzy → exact fallback)
    const units = await db.collection('units').find({
      landlordId: landlord._id,
      status: { $ne: 'archived' }
    }).toArray();

    let matchedUnit = null;
    if (units.length && unitInfoRaw) {
      try {
        const bestMatchUnitId = await AiFindBestUnitMatch(
          unitInfoRaw.toLowerCase(),
          units.map(u => ({
            ...u,
            unitNumber: (u.unitNumber || '').toLowerCase(),
            address: {
              streetAddress: (u.address?.streetAddress || '').toLowerCase(),
              district: (u.address?.district || '').toLowerCase()
            }
          }))
        );
        if (bestMatchUnitId) {
          matchedUnit = units.find(u => String(u._id) === String(bestMatchUnitId));
        }
      } catch (e) {
        console.warn('AiFindBestUnitMatch failed; will try exact match:', e?.message);
      }
    }

    if (!matchedUnit && unitInfoRaw) {
      const unitNumberCandidate = unitInfoRaw.split(',')[0].trim();
      matchedUnit = await db.collection('units').findOne({
        landlordId: landlord._id,
        unitNumber: unitNumberCandidate
      });
    }

    if (!matchedUnit) {
      return res.status(200).json({ verified: false, message: "Could not match unit from the document." });
    }

    // 5) Build official unit info
    const street = matchedUnit.address?.streetAddress || '';
    const district = matchedUnit.address?.district || '';
    const officialUnitInfo =
      `${matchedUnit.floor ? `Floor ${matchedUnit.floor}, ` : ''}` +
      `${matchedUnit.unitNumber}, ${street}, ${district}`;

    // --- A) Canonicalfingerprint + hash ---
    const canonicalFingerprint = buildCanonicalFingerprint({
      landlord: landlord.name,
      tenant: initial.tenantName,
      unit: officialUnitInfo,
      from: initial.from,
      to: initial.to,
      rent: initial.rent
    });
    const canonicalDocHash = ethers.keccak256(ethers.toUtf8Bytes(canonicalFingerprint));

    // --- B) Legacy (old) fingerprint + hash (no lowercasing) ---
    const legacyFingerprint = buildDisplayFingerprint({
      landlord: landlord.name,
      tenant: initial.tenantName,
      unit: officialUnitInfo,
      from: initial.from,
      to: initial.to,
      rent: initial.rent
    });
    const legacyDocHash = ethers.keccak256(ethers.toUtf8Bytes(legacyFingerprint));

    // 6) On-chain check (first canonical, then legacy for backward compatibility)
    const tsCanonical = await contract.getDocumentTimestamp(canonicalDocHash);
    const isCanonical = tsCanonical && (typeof tsCanonical === 'bigint' ? tsCanonical > 0n : Number(tsCanonical) > 0);

    let chosen = {
      isVerified: isCanonical,
      docHash: canonicalDocHash,
      fingerprint: canonicalFingerprint,
      ts: tsCanonical
    };

    if (!isCanonical) {
      const tsLegacy = await contract.getDocumentTimestamp(legacyDocHash);
      const isLegacy = tsLegacy && (typeof tsLegacy === 'bigint' ? tsLegacy > 0n : Number(tsLegacy) > 0);
      if (!isLegacy) {
        return res.status(200).json({ verified: false, message: "Document not found or not verified on the blockchain." });
      }
      chosen = {
        isVerified: true,
        docHash: legacyDocHash,
        fingerprint: legacyFingerprint,
        ts: tsLegacy
      };
    }

    // 7) Business status from DB (active vs terminated) + presigned URL if active
    const approved = await db.collection('approved_contracts').findOne({ docHash: chosen.docHash });
    const contractStatus = approved?.status || 'active';
    const isActive = contractStatus === 'active';

    // Prefer DB display fingerprint if present
    const fingerprintOut = approved?.fingerprintDisplay || approved?.fingerprint || approved?.fingerprintCanonical || chosen.fingerprint;

    let documentUrl = null;
    if (isActive && approved?.contractS3Key) {
      try { documentUrl = await getPresignedUrl(approved.contractS3Key); } catch (_) {}
    }

    // 8) Response
    return res.status(200).json({
      verified: true,
      contractStatus, // "active" | "terminated"
      onChainDetails: {
        verifiedOn: new Date(Number(String(chosen.ts)) * 1000).toUTCString(),
        txHash: approved?.txHash || null
      },
      documentUrl, // only when active
      fingerprint: fingerprintOut,
      landlord: landlord.name,
      unit: officialUnitInfo,
      tenant: initial.tenantName,
      period: { from: initial.from, to: initial.to },
      rent: initial.rent || null,
      docHash: chosen.docHash
    });

  } catch (error) {
    console.error('Verify document error:', error);
    return res.status(500).json({ status: 'error', message: 'Server error during verification.' });
  }
});

/**
 * Public verify by docHash (no upload).
 */
app.get('/api/verify/:docHash', async (req, res) => {
  try {
    const { docHash } = req.params;
    if (!docHash) {
      return res.status(400).json({ status: 'error', message: "Document hash is required." });
    }

    // On-chain authenticity
    const ts = await contract.getDocumentTimestamp(docHash);
    const isVerified = ts && (typeof ts === 'bigint' ? ts > 0n : Number(ts) > 0);

    if (!isVerified) {
      return res.status(404).json({ status: 'error', message: "A verified record for this document was not found on the blockchain." });
    }

    // Business status + fingerprint/document from DB
    const approved = await getDB().collection('approved_contracts').findOne({ docHash });

    if (!approved) {
      const placeholderFingerprint =
        "Landlord: Archived | Tenant: Archived | Unit: Archived | From: N/A | To: N/A | Rent: N/A";

      return res.status(200).json({
        contractStatus: 'terminated',
        onChainDetails: {
          landlordName: "Archived",
          tenantName: "Archived",
          unitInfo: "Archived",
          from: "N/A",
          to: "N/A",
          verifiedOn: new Date(Number(String(ts)) * 1000).toUTCString(),
          txHash: null
        },
        documentUrl: null,
        fingerprint: placeholderFingerprint
      });
    }

    const isActive = (approved.status || 'active') === 'active';
    const documentUrl = (isActive && approved.contractS3Key)
      ? await getPresignedUrl(approved.contractS3Key)
      : null;

    const displayFp = approved.fingerprintDisplay || approved.fingerprint || approved.fingerprintCanonical || '';
    const details = parseFingerprint(displayFp);

    return res.status(200).json({
      contractStatus: approved.status || 'active',
      onChainDetails: {
        landlordName: details.landlordName,
        unitInfo: details.unitInfo,
        tenantName: details.tenantName,
        from: details.from,
        to: details.to,
        verifiedOn: new Date(Number(String(ts)) * 1000).toUTCString(),
        txHash: approved.txHash || null
      },
      documentUrl,
      fingerprint: displayFp
    });

  } catch (error) {
    console.error('Public verify error:', error);
    return res.status(500).json({ status: 'error', message: "Server error during public verification." });
  }
});

// Invitations
app.post('/api/invitations/send', async (req, res) => {
  try {
    const { docHash, landlordEmail } = req.body;
    if (!docHash || !landlordEmail) return res.status(400).json({ status: 'error', message: "Document hash and landlord email are required." });

    const pending = await getDB().collection('pending_contracts').findOne({ docHash });
    if (!pending) return res.status(404).json({ status: 'error', message: "No pending contract found for that document hash." });

    const lowerEmail = landlordEmail.toLowerCase();
    const collLandlords = getDB().collection('landlords');
    const existingLandlord = await collLandlords.findOne({ email: lowerEmail });

    const fpForEmail = pending.fingerprintDisplay || pending.fingerprint || pending.fingerprintCanonical || 'N/A';

    let subject, html;

    if (existingLandlord) {
      // Link contract and notify existing landlord
      await getDB().collection('pending_contracts').updateOne(
        { docHash },
        { $set: { assignedLandlordId: existingLandlord._id, inviteeEmail: lowerEmail, status: 'awaiting_approval' } }
      );

      subject = 'A New Rental Contract is Ready for Your Approval';
      html = renderEmail({
        title: 'New document notification',
        intro: `Hello ${existingLandlord.name},`,
        bodyHtml: `
          <p style="margin:0 0 8px;color:${BRAND.textMuted}">A new rental agreement has been submitted by a tenant and requires your approval.</p>
          <h3 style="margin:16px 0 8px;color:${BRAND.text}">Contract Fingerprint</h3>
          <div style="background:${BRAND.bg};padding:12px;border:1px solid ${BRAND.border};border-radius:8px;font-family:monospace;color:${BRAND.text}">
            ${fpForEmail}
          </div>
        `,
        button: { href: `${FRONTEND_URL}/login`, label: 'Go to Dashboard' }
      });
    } else {
      // Invite new landlord to register
      await getDB().collection('pending_contracts').updateOne(
        { docHash },
        { $set: { inviteeEmail: lowerEmail, status: 'invitation_sent' } }
      );

      subject = 'You Have a New Document to Approve on Block Lease';
      html = renderEmail({
        title: 'You’re invited to Block Lease',
        intro: `Hello,`,
        bodyHtml: `
          <p style="margin:0 0 8px;color:${BRAND.textMuted}">A tenant has submitted a rental agreement for your approval on the Block Lease platform.</p>
          <h3 style="margin:16px 0 8px;color:${BRAND.text}">Contract Fingerprint</h3>
          <div style="background:${BRAND.bg};padding:12px;border:1px solid ${BRAND.border};border-radius:8px;font-family:monospace;color:${BRAND.text}">
            ${fpForEmail}
          </div>
          <p style="margin:12px 0 0;color:${BRAND.textMuted}">Please create your free account to review and approve this document. Once you sign up with this email address, the contract will be waiting for you on your dashboard.</p>
        `,
        button: { href: `${FRONTEND_URL}/register`, label: 'Create Your Account' }
      });
    }

    await sendEmail({ to: lowerEmail, subject, html });
    res.status(200).json({ status: 'success', message: `Notification sent successfully to ${lowerEmail}!` });
  } catch (error) {
    console.error('Invitation error:', error);
    res.status(500).json({ status: 'error', message: 'Server error while sending invitation.' });
  }
});

// Utility
app.get('/api/s3/presigned-url', authMiddleware, async (req, res) => {
  try {
    const { key } = req.query;
    if (!key) return res.status(400).json({ status: 'error', message: "S3 key is required." });
    const url = await getPresignedUrl(key);
    if (!url) return res.status(404).json({ status: 'error', message: "Could not generate URL or file not found." });
    res.status(200).json({ url });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Server error while generating presigned URL.' });
  }
});

// ------------------------------------------------------------------
// Start
// ------------------------------------------------------------------
module.exports = { app, connectDB, getPresignedUrl };

if (require.main === module) {
  connectDB().then(() => {
    app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
  });
}