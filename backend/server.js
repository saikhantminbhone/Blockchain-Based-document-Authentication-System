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
const {
    AiScanContract,
    AiCheckDocumentAuthenticity,
    AiExtractDeedData,
    AiCompareAddresses,
    AiFindBestUnitMatch,
    AiextractUtilityBillData,
    AiclassifyDocument
} = require('./utils/aiModel');

const app = express();

// --- Global Middleware ---

app.use(cors({ origin: "*" }));
const upload = multer({ storage: multer.memoryStorage() });

// --- Environment Variables ---
const {
    PORT, BASE_SMOY_RPC_URL, ADMIN_PRIVATE_KEY, CONTRACT_ADDRESS,
    AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_S3_BUCKET_NAME,
    JWT_SECRET, VERIFF_API_KEY, VERIFF_SECRET_KEY, VERIFF_PUBLIC_URL, GOOGLE_CLIENT_ID
} = process.env;

// --- Service Clients ---
// ---------- AXIOS CLIENT ----------
const veriffApi = axios.create({
  baseURL: 'https://api.veriff.me/v1', // no trailing slash
  headers: {
    'Content-Type': 'application/json',
    'X-AUTH-CLIENT': VERIFF_API_KEY,
  },
});

const s3 = new S3Client({ region: AWS_REGION, credentials: { accessKeyId: AWS_ACCESS_KEY_ID, secretAccessKey: AWS_SECRET_ACCESS_KEY } });
const contractABI = require('../blockchain/artifacts/contracts/DocumentRegistry.sol/DocumentRegistry.json').abi;
const provider = new ethers.JsonRpcProvider(BASE_SMOY_RPC_URL);
const adminWallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, adminWallet);
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// ##################################################################
// ### HELPER FUNCTIONS
// ##################################################################

/**
 * Uploads a file buffer to AWS S3.
 * @param {Buffer} fileBuffer The file data.
 * @param {string} folder The S3 folder (e.g., 'verified-title-deeds').
 * @param {string} originalname The original file name.
 * @returns {Promise<string>} The S3 key of the uploaded file.
 */
const uploadFileToS3 = async (fileBuffer, folder, originalname) => {
    const fileExtension = originalname.split('.').pop();
    const fileName = `${uuidv4()}.${fileExtension}`;
    const s3Key = `${folder}/${fileName}`;
    const params = { Bucket: AWS_S3_BUCKET_NAME, Key: s3Key, Body: fileBuffer, ContentType: 'application/octet-stream' };
    const command = new PutObjectCommand(params);
    await s3.send(command);
    console.log(`✅ File uploaded to S3: ${s3Key}`);
    return s3Key;
};
const webhookRaw = express.raw({ type: '*/*' });

function splitName(fullName = '') {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { firstName: 'Unknown', lastName: undefined };
    if (parts.length === 1) return { firstName: parts[0], lastName: undefined };
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function hmacHex(secret, dataBufferOrString) {
    return crypto.createHmac('sha256', secret).update(dataBufferOrString).digest('hex');
}

function timingSafeEqualHex(aHex, bHex) {
    try {
        const a = Buffer.from(String(aHex), 'utf8');
        const b = Buffer.from(String(bHex), 'utf8');
        return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch {
        return false;
    }
}


/**
 * Generates a temporary, secure URL to preview a private S3 object.
 * @param {string} s3Key The S3 key of the file.
 * @returns {Promise<string|null>} The presigned URL.
 */
const getPresignedUrl = async (s3Key) => {
    if (!s3Key) return null;
    let contentType = 'application/octet-stream';
    if (s3Key.endsWith('.pdf')) contentType = 'application/pdf';
    else if (s3Key.endsWith('.jpg') || s3Key.endsWith('.jpeg')) contentType = 'image/jpeg';
    else if (s3Key.endsWith('.png')) contentType = 'image/png';

    const command = new GetObjectCommand({
        Bucket: AWS_S3_BUCKET_NAME, Key: s3Key,
        ResponseContentDisposition: 'inline', // Instructs the browser to preview, not download
        ResponseContentType: contentType
    });
    try {
        const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
        return url;
    } catch (err) {
        console.error(`❌ Error generating presigned URL for key ${s3Key}:`, err);
        return null;
    }
};

/**
 * Parses the AI-generated fingerprint string into a structured object.
 * @param {string} fingerprint The pipe-separated string from the AI.
 * @returns {object} A structured object with keys like 'landlordName', 'tenantName', etc.
 */
const parseFingerprint = (fingerprint) => {
    const details = fingerprint.split('|').reduce((acc, part) => {
        const delimiterIndex = part.indexOf(':');
        if (delimiterIndex !== -1) {
            const key = part.substring(0, delimiterIndex).trim().toLowerCase();
            const value = part.substring(delimiterIndex + 1).trim();
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
};

/**
 * Middleware to verify a user's JWT token and attach their info to the request.
 */
const authMiddleware = (req, res, next) => {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ status: 'error', message: 'No token, authorization denied.' });
    const token = authHeader.replace('Bearer ', '');
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.landlordId = new ObjectId(decoded.landlordId);
        req.landlordName = decoded.name;
        next();
    } catch (err) {
        res.status(401).json({ status: 'error', message: 'Token is not valid.' });
    }
};

// ##################################################################
// ### LANDLORD AUTHENTICATION & REGISTRATION
// ##################################################################

app.post('/api/register-landlord', async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;
        if (!name || !email || !password) return res.status(400).json({ status: 'error', message: "Name, email, and password are required." });

        const lowerCaseEmail = email.toLowerCase();
        if (await getDB().collection('landlords').findOne({ email: lowerCaseEmail })) {
            return res.status(409).json({ status: 'error', message: "An account with this email already exists." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Create a secure token for email verification
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const emailVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex'); // Store the hash, not the token
        const emailVerificationExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        const newLandlord = {
            name, email: lowerCaseEmail, password: hashedPassword, phone: phone || '',
            kycStatus: 'pending', emailStatus: 'unverified',
            emailVerificationToken, emailVerificationExpires,
            createdAt: new Date(),
        };
        await getDB().collection('landlords').insertOne(newLandlord);

        const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
        const subject = 'Verify Your Email Address for Block Lease';
        const emailHtml = `... (Your styled HTML email template) ...`; // Full HTML is omitted for brevity

        await sendEmail({ to: newLandlord.email, subject, html: emailHtml });

        res.status(201).json({
            status: 'success',
            message: 'Registration successful! Please check your email to verify your account.'
        });
    } catch (error) { res.status(500).json({ status: 'error', message: 'Server error during registration.' }); }
});

app.post('/api/verify-email', async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ status: 'error', message: "Verification token is missing." });

        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        const landlord = await getDB().collection('landlords').findOne({ emailVerificationToken: hashedToken });
        if (!landlord) return res.status(400).json({ status: 'error', message: "This verification link is invalid." });

        if (landlord.emailStatus === 'verified') {
            return res.status(200).json({ status: 'info', message: "This email address has already been verified. Please log in." });
        }
        if (new Date() > landlord.emailVerificationExpires) {
            return res.status(400).json({ status: 'error', message: "This verification link has expired. Please request a new one." });
        }

        await getDB().collection('landlords').updateOne(
            { _id: landlord._id },
            { $set: { emailStatus: 'verified', emailVerificationToken: undefined, emailVerificationExpires: undefined } }
        );

        const payload = { landlordId: landlord._id.toString(), email: landlord.email, name: landlord.name };
        const appToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });

        res.status(200).json({
            status: 'success', message: 'Email verified successfully!', token: appToken,
            landlord: { id: landlord._id, name: landlord.name, kycStatus: landlord.kycStatus }
        });
    } catch (error) { res.status(500).json({ status: 'error', message: 'Server error during email verification.' }); }
});

app.post('/api/resend-verification', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ status: 'error', message: "Email is required." });

        const landlord = await getDB().collection('landlords').findOne({ email: email.toLowerCase() });
        if (!landlord) return res.status(404).json({ status: 'error', message: "No account found with that email address." });
        if (landlord.emailStatus === 'verified') {
            return res.status(200).json({ status: 'info', message: "This email address has already been verified. You can log in." });
        }

        // Generate a new token and send a new email
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const emailVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
        const emailVerificationExpires = new Date(Date.now() + 15 * 60 * 1000);

        await getDB().collection('landlords').updateOne(
            { _id: landlord._id },
            { $set: { emailVerificationToken, emailVerificationExpires } }
        );

        const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
        const subject = 'Your New Verification Link for Block Lease';
        const emailHtml = `... (Your styled HTML email template) ...`;
        await sendEmail({ to: landlord.email, subject, html: emailHtml });

        res.status(200).json({ status: 'success', message: "A new verification email has been sent. Please check your inbox." });
    } catch (error) { res.status(500).json({ status: 'error', message: 'Server error while resending verification email.' }); }
});

app.post('/api/auth/google', async (req, res) => {
    try {
        const { token } = req.body;
        const ticket = await googleClient.verifyIdToken({ idToken: token, audience: GOOGLE_CLIENT_ID });
        const googlePayload = ticket.getPayload();
        const { email, name, picture } = googlePayload;

        let landlord = await getDB().collection('landlords').findOne({ email: email });
        let isNewUser = false;
        if (landlord) {
            // User exists. Update their auth provider if they're switching from email to Google.
            if (landlord.authProvider !== 'google') {
                await getDB().collection('landlords').updateOne(
                    { _id: landlord._id },
                    { $set: { authProvider: 'google', profilePicture: picture, emailStatus: 'verified' } }
                );
            }
        } else {
            // New user via Google. Email is implicitly verified.
            isNewUser = true;
            const newLandlord = {
                name: name, email: email, password: null, authProvider: 'google',
                profilePicture: picture, kycStatus: 'pending', emailStatus: 'verified',
                createdAt: new Date(),
            };
            const result = await getDB().collection('landlords').insertOne(newLandlord);
            landlord = { _id: result.insertedId, ...newLandlord };
        }

        const appPayload = { landlordId: landlord._id.toString(), email: landlord.email, name: landlord.name };
        const appToken = jwt.sign(appPayload, JWT_SECRET, { expiresIn: '8h' });
console.log(appToken)
        res.status(200).json({
            status: 'success', message: 'Google sign-in successful!', token: appToken,
            landlord: { id: landlord._id, name: landlord.name, kycStatus: landlord.kycStatus },
            isNewUser: isNewUser
        });
    } catch (error) { res.status(401).json({ status: 'error', message: 'Google authentication failed.' }); }
});

app.post('/api/login-landlord', async (req, res) => {
    try {
        const { email, password } = req.body;
        const lowerCaseEmail = email.toLowerCase();
        const landlord = await getDB().collection('landlords').findOne({ email: lowerCaseEmail });
        if (!landlord) return res.status(401).json({ status: 'error', message: 'Invalid credentials.' });

        if (landlord.emailStatus === 'unverified') {
            return res.status(403).json({ status: 'error', message: "Your email is not verified. Please check your inbox.", errorCode: 'EMAIL_NOT_VERIFIED' });
        }

        // Allow 'pending' KYC users to log in, but block 'failed'
        if (landlord.kycStatus !== 'approved' && landlord.kycStatus !== 'pending') {
            return res.status(403).json({ status: 'error', message: `Account not active. KYC status: ${landlord.kycStatus}.`, kycStatus: landlord.kycStatus });
        }

        const isMatch = await bcrypt.compare(password, landlord.password);
        if (!isMatch) return res.status(401).json({ status: 'error', message: 'Invalid credentials.' });

        const payload = { landlordId: landlord._id.toString(), email: landlord.email, name: landlord.name };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });

        res.status(200).json({
            status: 'success', message: 'Logged in successfully!', token,
            landlord: { id: landlord._id, name: landlord.name, email: landlord.email, kycStatus: landlord.kycStatus }
        });
    } catch (error) { res.status(500).json({ status: 'error', message: 'Server error during login.' }); }
});

app.get('/api/landlord/me', authMiddleware, async (req, res) => {
    try {
        const landlord = await getDB().collection('landlords').findOne({ _id: req.landlordId }, { projection: { password: 0 } });
        if (!landlord) return res.status(404).json({ status: 'error', message: 'Landlord profile not found for this token.' });
        res.status(200).json({ landlord });
    } catch (error) { res.status(500).json({ status: 'error', message: 'Server error fetching landlord profile.' }); }
});

// ##################################################################
// ### VERIFF INTEGRATION (LANDLORD KYC ONLY)
// ##################################################################
app.post('/api/veriff/create-session', authMiddleware, async (req, res) => {
    try {
        const { type } = req.body;
        if (type !== 'kyc') {
            return res
                .status(400)
                .json({ status: 'error', message: 'This endpoint is only for KYC verification.' });
        }

        // Fetch landlord
        const landlords = getDB().collection('landlords');
        const landlord = await landlords.findOne({ _id: new ObjectId(String(req.landlordId)) });
        if (!landlord) {
            return res.status(404).json({ status: 'error', message: 'Landlord not found.' });
        }

        // Person fields
        const { firstName, lastName } = splitName(landlord.name || '');

        // Build payload
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

        const response = await veriffApi.post(
            'sessions',
            bodyStr,
            {
                headers: { 'X-HMAC-SIGNATURE': signature },
                transformRequest: [(data) => data],
            }
        );

        const { verification } = response.data || {};
        const { url, id } = verification || {};

        if (!url || !id) {
            return res.status(502).json({
                status: 'error',
                message: 'Unexpected Veriff response (missing url/id).',
                raw: response.data,
            });
        }

        // Save the session id on landlord
        await landlords.updateOne(
            { _id: new ObjectId(String(req.landlordId)) },
            { $set: { veriffSessionId: id, kycStatus: 'pending', lastKycUpdate: new Date() } }
        );

        return res.status(201).json({ sessionUrl: url });
    } catch (error) {
        console.error('Veriff create-session error:', {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message,
        });
        return res.status(500).json({
            status: 'error',
            message:
                error.response?.data?.message ||
                error.message ||
                'Server error during Veriff session creation.',
            code: error.response?.data?.code,
        });
    }
});

// --- Email builder ---
async function sendKycEmail(landlord, kycStatus, { FRONTEND_URL, LOGO_URL }) {
  const year = new Date().getFullYear();
  const name = landlord.name || 'Valued User';
  const email = landlord.email;

  const wrapEmail = (titleColor, titleText, bodyHtml, buttonUrl, buttonText) => `
  <!DOCTYPE html>
  <html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
  <title>${titleText}</title>
  <style>@media (max-width:600px){.container{width:100%!important}.p24{padding:16px!important}.btn{display:block!important;width:100%!important}}</style>
  </head>
  <body style="margin:0;padding:0;background-color:#F9FAFB;">
    <table width="100%" cellspacing="0" cellpadding="0" style="background:#F9FAFB;">
      <tr><td align="center" style="padding:32px 16px;">
        <table width="600" class="container" cellspacing="0" cellpadding="0"
          style="background:#FFFFFF;border-radius:12px;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);">
          <tr><td align="center" style="padding:24px;border-bottom:1px solid #E5E7EB;">
            <img src="${LOGO_URL}" width="160" alt="Block Lease" style="display:block;height:auto;">
          </td></tr>
          <tr><td class="p24" style="padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
            <h1 style="margin:0 0 8px;font-size:24px;line-height:1.25;color:${titleColor};">${titleText}</h1>
            <p style="margin:0 0 16px;color:#6B7280;">Hello ${name},</p>
            ${bodyHtml}
            <div style="text-align:center;margin:32px 0;">
              <a href="${buttonUrl}" target="_blank"
                 style="display:inline-block;padding:14px 28px;font-weight:600;font-size:16px;
                        color:#fff;background-color:#1E3A8A;text-decoration:none;border-radius:8px;">
                 ${buttonText}</a>
            </div>
          </td></tr>
          <tr><td align="center" style="padding:16px 24px;border-top:1px solid #E5E7EB;
              font-size:12px;color:#9CA3AF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            © ${year} Block Lease™. All rights reserved.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;

  let subject = '';
  let html = '';

  switch (kycStatus) {
    case 'approved':
      subject = 'Congratulations! Your Block Lease account is verified.';
      html = wrapEmail(
        '#10B981',
        'Account Verified!',
        `<p style="color:#6B7280;">Your identity has been verified and your Block Lease account is now fully active.</p>
         <p style="color:#6B7280;">You can now log in to manage your properties and contracts.</p>`,
        `${process.env.FRONTEND_URL}/dashboard`,
        'Go to Dashboard'
      );
      break;

    case 'resubmission_requested':
      subject = 'Action needed: Please resubmit your verification';
      html = wrapEmail(
        '#F59E0B',
        'Action Needed: Resubmit Verification',
        `<p style="color:#6B7280;">We couldn’t complete your verification — this may be due to glare, blur, or cropped ID images.</p>
         <ul style="color:#6B7280;">
           <li>Retake your ID photo clearly and ensure all corners are visible</li>
           <li>Remove masks/hats and use good lighting</li>
         </ul>`,
        `${process.env.FRONTEND_URL}/verify-again`,
        'Retry Verification'
      );
      break;

    default:
      subject = 'Verification unsuccessful – please try again';
      html = wrapEmail(
        '#EF4444',
        'Verification Unsuccessful',
        `<p style="color:#6B7280;">We were unable to verify your identity. This can happen due to unclear images or mismatched information.</p>
         <p style="color:#6B7280;">You can log in and start a new verification attempt when ready.</p>`,
        `${process.env.FRONTEND_URL}/login`,
        'Log In to Retry'
      );
      break;
  }

  await sendEmail({ to: email, subject, html });
}

// --- Express webhook route (with raw parser) ---

app.post('/api/veriff/webhook', webhookRaw, async (req, res) => {
  console.log('[WEBHOOK]', 
    'isBuffer=', Buffer.isBuffer(req.body),
    'ctor=', req.body?.constructor?.name,
    'len=', req.body?.length,
    'ct=', req.headers['content-type']
  );

  try {
    // 0) Normalize to Buffer (be forgiving if a different parser touched it)
    let raw;
    if (Buffer.isBuffer(req.body)) raw = req.body;
    else if (typeof req.body === 'string') raw = Buffer.from(req.body, 'utf8');
    else raw = Buffer.from(JSON.stringify(req.body || {}), 'utf8');

    // 1) Signature header (Veriff may send either)
    const sigHeader = (req.headers['x-hmac-signature'] || req.headers['x-signature'] || '').toString().trim();
    if (!sigHeader) return res.status(400).send('Missing signature header');

    if (!process.env.VERIFF_SECRET_KEY) {
      console.error('⚠️ VERIFF_SECRET_KEY is not set');
      return res.status(500).send('Server misconfiguration');
    }

    // 2) HMAC verification on the exact raw bytes
    const expectedHex = crypto.createHmac('sha256', process.env.VERIFF_SECRET_KEY).update(raw).digest('hex');
    const a = Buffer.from(expectedHex, 'hex');
    const b = Buffer.from(sigHeader, 'hex');

    // TEMP: small debug; remove once verified
    console.log('[HMAC]', expectedHex.slice(0, 16), '… vs …', sigHeader.slice(0, 16), 'len=', expectedHex.length);

    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(403).send('Invalid signature');
    }

    // 3) Parse AFTER HMAC
    let event;
    try { event = JSON.parse(raw.toString('utf8')); }
    catch { return res.status(400).send('Invalid JSON'); }

    const v = event?.verification;
    if (!v) return res.status(200).send('OK');

    // 4) Map Veriff status to your KYC status
    const statusMap = {
      approved: 'approved',
      declined: 'failed',
      resubmission_requested: 'resubmission_requested',
      expired: 'failed',
      abandoned: 'failed',
    };
    const decision = v.status; // e.g., "approved"
    const kycStatus = statusMap[decision] ?? 'failed';

    // 5) Identify landlord from vendorData
    const vendorData = v.vendorData; // "68fe1962322e00bc9e772f76" in your sample
    if (!vendorData) return res.status(200).send('OK');

    // 6) ACK EARLY so Veriff won’t retry
    res.status(200).send('Webhook received.');

    // 7) Async post-processing: update DB + email
    (async () => {
      try {
        // Optional idempotency: avoid re-processing the same verification.id
        try {
          await getDB().collection('veriff_events').insertOne({
            _id: v.id,                  // e.g., "3991eafe-f035-44c0-87c6-575d84004084"
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

        // Prepare update
        const person = v.person || {};
        const document = v.document || {};
        const updateData = {
          kycStatus,                                     // "approved" in your sample
          name: person.fullName ||
                [person.firstName, person.lastName].filter(Boolean).join(' ') ||
                undefined,                               // => "Sai Khant Min Bhone"
          veriffData: {
            decision: v.status,                          // "approved"
            firstName: person.firstName,                 // "Sai"
            lastName: person.lastName,                   // "Khant Min Bhone"
            fullName: person.fullName,                   // might be undefined in sample
            dateOfBirth: person.dateOfBirth,
            address: document.address,                   // not present in sample
            documentType: document.type,                 // "DRIVERS_LICENSE"
            documentNumber: document.number,             // null
            country: document.country,                   // "TH"
            veriffId: v.id,
            decisionTime: v.decisionTime,                // present in sample
            submissionTime: v.submissionTime,
            acceptanceTime: v.acceptanceTime,
            attemptId: v.attemptId,
          },
          lastKycUpdate: new Date(),
        };

        // Defensively coerce ObjectId
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
          await sendKycEmail(landlord, kycStatus, {
            FRONTEND_URL: process.env.FRONTEND_URL,
            LOGO_URL: 'https://blocklease.site/assets/logo.png',
          });
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



// ##################################################################
// ### UNIT MANAGEMENT (WITH CUSTOM AI)
// ##################################################################

// Increase payload limit to accept large file uploads (e.g., camera scans)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));


app.post('/api/units', authMiddleware, upload.fields([
    { name: 'titleDeed', maxCount: 1 },
    { name: 'utilityBill', maxCount: 1 }
]), async (req, res) => {
    try {
        const { unitNumber, floor, streetAddress, subdistrict, district, province, zipCode, country, isConfirmed } = req.body;
        const titleDeedFile = req.files['titleDeed']?.[0];
        const utilityBillFile = req.files['utilityBill']?.[0];

        if (!titleDeedFile || !utilityBillFile) {
            return res.status(400).json({ status: 'error', message: "Both a Title Deed and a recent Utility Bill are required." });
        }

        // Run AI analysis
        const [deedData, billData] = await Promise.all([
            AiExtractDeedData(titleDeedFile.buffer, titleDeedFile.mimetype),
            AiextractUtilityBillData(utilityBillFile.buffer, utilityBillFile.mimetype)
        ]);

        const landlord = await getDB().collection('landlords').findOne({ _id: req.landlordId });

        // Perform 3-Way Name Match (KYC Profile vs. Title Deed vs. Utility Bill)
        if (landlord.name.toLowerCase() !== deedData.ownerName.toLowerCase() || landlord.name.toLowerCase() !== billData.nameOnBill.toLowerCase()) {
            return res.status(403).json({ status: 'error', message: `Ownership Mismatch: The name on the documents (${deedData.ownerName}, ${billData.nameOnBill}) does not match your verified profile name (${landlord.name}).` });
        }

        // Compare addresses on the two documents
        if (!await AiCompareAddresses(deedData.propertyAddress, billData.addressOnBill)) {
            return res.status(400).json({ status: 'error', message: "Address Mismatch: The address on the title deed does not match the address on the utility bill." });
        }

        // Compare user's form input with the AI-extracted address
        const userInputAddress = `${streetAddress}, ${subdistrict}, ${district}, ${province}, ${zipCode}`;
        const aiAddress = deedData.propertyAddress;
        const isMatch = await AiCompareAddresses(userInputAddress, aiAddress);

        if (!isMatch && !isConfirmed) {
            return res.status(200).json({
                status: 'address_mismatch', message: 'The address you entered does not exactly match the one on the title deed.',
                userInputAddress, aiSuggestedAddress: aiAddress,
            });
        }

        const titleDeedS3Key = await uploadFileToS3(titleDeedFile.buffer, 'verified-title-deeds', titleDeedFile.originalname);
        const utilityBillS3Key = await uploadFileToS3(utilityBillFile.buffer, 'verified-utility-bills', utilityBillFile.originalname);

        const newUnit = {
            landlordId: req.landlordId, unitNumber, floor: floor || '',
            address: { streetAddress, subdistrict, district, province, zipCode, country },
            titleDeedS3Key, utilityBillS3Key, isVerified: true, verificationStatus: 'verified_by_ai_multi_doc',
            aiExtractedData: { deedData, billData }, createdAt: new Date()
        };
        const result = await getDB().collection('units').insertOne(newUnit);
        res.status(201).json({ status: 'success', message: "Unit created and verified successfully!", unit: { _id: result.insertedId, ...newUnit } });
    } catch (error) { res.status(500).json({ status: 'error', message: 'Server error while creating unit.' }); }
});

app.get('/api/landlord/dashboard', authMiddleware, async (req, res) => {
    try {
        const landlord = await getDB().collection('landlords').findOne({ _id: req.landlordId }, { projection: { password: 0 } });
        if (!landlord) return res.status(404).json({ status: 'error', message: "Landlord not found." });

        const units = await getDB().collection('units').find({ landlordId: req.landlordId }).toArray();
        const pendingContracts = await getDB().collection('pending_contracts').find({ assignedLandlordId: req.landlordId }).toArray();
        const approvedContracts = await getDB().collection('approved_contracts').find({ landlordId: req.landlordId }).toArray();

        const unitsWithUrls = await Promise.all(units.map(async (unit) => ({ ...unit, titleDeedUrl: await getPresignedUrl(unit.titleDeedS3Key) })));

        res.status(200).json({ landlord, units: unitsWithUrls, pendingContracts, approvedContracts });
    } catch (error) { res.status(500).json({ status: 'error', message: 'Server error fetching dashboard data.' }); }
});

app.post('/api/units/:unitId/verify', authMiddleware, upload.fields([
    { name: 'titleDeed', maxCount: 1 },
    { name: 'utilityBill', maxCount: 1 }
]), async (req, res) => {
    try {
        const { unitId } = req.params;
        const titleDeedFile = req.files['titleDeed']?.[0];
        const utilityBillFile = req.files['utilityBill']?.[0];
        if (!titleDeedFile || !utilityBillFile) return res.status(400).json({ status: 'error', message: "Both a Title Deed and a Utility Bill are required." });

        const [deedData, billData] = await Promise.all([
            AiExtractDeedData(titleDeedFile.buffer, titleDeedFile.mimetype),
            AiextractUtilityBillData(utilityBillFile.buffer, utilityBillFile.mimetype)
        ]);

        const landlord = await getDB().collection('landlords').findOne({ _id: req.landlordId });

        if (landlord.name.toLowerCase() !== deedData.ownerName.toLowerCase() || landlord.name.toLowerCase() !== billData.nameOnBill.toLowerCase()) {
            return res.status(403).json({ status: 'error', message: `Ownership Mismatch: The name on the documents does not match your verified profile.` });
        }
        if (!await AiCompareAddresses(deedData.propertyAddress, billData.addressOnBill)) {
            return res.status(400).json({ status: 'error', message: "Address Mismatch: The address on the deed does not match the utility bill." });
        }

        const titleDeedS3Key = await uploadFileToS3(titleDeedFile.buffer, 'verified-title-deeds', titleDeedFile.originalname);
        const utilityBillS3Key = await uploadFileToS3(utilityBillFile.buffer, 'verified-utility-bills', utilityBillFile.originalname);

        await getDB().collection('units').updateOne(
            { _id: new ObjectId(unitId), landlordId: req.landlordId },
            {
                $set: {
                    isVerified: true, verificationStatus: 'verified_by_ai_multi_doc',
                    titleDeedS3Key, utilityBillS3Key,
                    aiExtractedData: { deedData, billData },
                }
            }
        );
        res.status(200).json({ status: 'success', message: "Unit deed verified successfully!" });
    } catch (error) { res.status(500).json({ status: 'error', message: 'Server error during deed verification.' }); }
});

app.delete('/api/units/:unitId', authMiddleware, async (req, res) => {
    try {
        const { unitId } = req.params;
        const result = await getDB().collection('units').updateOne(
            { _id: new ObjectId(unitId), landlordId: req.landlordId },
            { $set: { status: 'archived', archivedOn: new Date() } }
        );
        if (result.matchedCount === 0) return res.status(404).json({ status: 'error', message: "Unit not found." });
        res.status(200).json({ status: 'success', message: "Unit has been archived." });
    } catch (error) { res.status(500).json({ status: 'error', message: 'Server error while archiving unit.' }); }
});

app.post('/api/units/:unitId/restore', authMiddleware, async (req, res) => {
    try {
        const { unitId } = req.params;
        const result = await getDB().collection('units').updateOne(
            { _id: new ObjectId(unitId), landlordId: req.landlordId },
            { $set: { status: 'active', archivedOn: null } }
        );
        if (result.matchedCount === 0) return res.status(404).json({ status: 'error', message: "Archived unit not found." });
        res.status(200).json({ status: 'success', message: "Unit has been restored." });
    } catch (error) { res.status(500).json({ status: 'error', message: 'Server error while restoring unit.' }); }
});

// ##################################################################
// ### TENANT-LED CONTRACT & BLOCKCHAIN FLOW
// ##################################################################
app.post('/api/contracts/initiate', upload.single('contract'), async (req, res) => {
    try {
        const { tenantEmail } = req.body;
        const contractFile = req.file;
        if (!contractFile || !tenantEmail) return res.status(400).json({ status: 'error', message: "Contract file and tenant email are required." });

        const validation = await AiclassifyDocument(contractFile.buffer, contractFile.mimetype);
        if (validation.type !== 'contract' || validation.confidence < 0.90) {
            return res.status(400).json({ status: 'error', message: `Invalid Document: The uploaded file does not appear to be a rental contract (AI detected type: '${validation.type}').` });
        }

        const fingerprint = await AiScanContract(contractFile.buffer, contractFile.mimetype);
        const docHash = ethers.keccak256(ethers.toUtf8Bytes(fingerprint));

        if (await getDB().collection('pending_contracts').findOne({ docHash })) {
            return res.status(200).json({ status: 'already_pending', message: 'This document is already pending landlord approval.' });
        }
        if (await getDB().collection('approved_contracts').findOne({ docHash })) {
            return res.status(200).json({ status: 'already_approved', message: 'This document has already been approved.', docHash });
        }

        const details = parseFingerprint(fingerprint);
        const landlord = await getDB().collection('landlords').findOne({ name: details.landlordName, kycStatus: 'approved' });
        const contractS3Key = await uploadFileToS3(req.file.buffer, 'pending-contracts', contractFile.originalname);
        const pendingContract = { docHash, fingerprint, contractS3Key, tenantEmail, createdAt: new Date() };

        if (landlord) {
            pendingContract.assignedLandlordId = landlord._id;
            const landlordUnits = await getDB().collection('units').find({ landlordId: landlord._id, status: { $ne: 'archived' } }).toArray();
            let matchedUnit = null;
            if (landlordUnits.length > 0) {
                const bestMatchUnitId = await AiFindBestUnitMatch(details.unitInfo, landlordUnits);
                if (bestMatchUnitId) matchedUnit = landlordUnits.find(u => u._id.toString() === bestMatchUnitId);
            }
            if (matchedUnit) {
                pendingContract.unitId = matchedUnit._id;
                pendingContract.unitStatus = 'matched';
            } else {
                pendingContract.unitStatus = 'unmatched';
                pendingContract.unmatchedUnitIdentifier = details.unitInfo;
            }
            await getDB().collection('pending_contracts').insertOne(pendingContract);
            return res.status(200).json({ status: 'pending_approval', message: 'Landlord found. Contract sent for approval.', docHash });
        } else {
            pendingContract.status = 'awaiting_landlord_registration';
            pendingContract.unmatchedUnitIdentifier = details.unitInfo;
            await getDB().collection('pending_contracts').insertOne(pendingContract);
            return res.status(200).json({ status: 'landlord_not_found', message: 'Landlord not found. Please provide their email to invite them.', docHash });
        }
    } catch (error) { res.status(500).json({ status: 'error', message: 'Server error during contract initiation.' }); }
});

app.post('/api/approve-and-create-unit', authMiddleware, async (req, res) => {
    try {
        const { docHash } = req.body;
        const pendingContract = await getDB().collection('pending_contracts').findOne({ docHash, assignedLandlordId: req.landlordId, unitStatus: 'unmatched' });
        if (!pendingContract) return res.status(404).json({ status: 'error', message: "No unmatched pending contract found." });
        const newUnit = {
            landlordId: req.landlordId,
            unitNumber: pendingContract.unmatchedUnitIdentifier.split(',')[0].trim(),
            floor: '',
            address: {
                streetAddress: `Details from contract: ${pendingContract.unmatchedUnitIdentifier}`,
                subdistrict: '', district: '', province: '', zipCode: '', country: ''
            },
            isVerified: false, verificationStatus: 'pending_scan', createdAt: new Date(),
        };
        const result = await getDB().collection('units').insertOne(newUnit);
        await getDB().collection('pending_contracts').updateOne({ _id: pendingContract._id }, { $set: { unitId: result.insertedId, unitStatus: 'matched' } });
        res.status(200).json({ status: 'success', message: `Unit '${newUnit.unitNumber}' was added. Please verify its title deed to approve the contract.` });
    } catch (error) { res.status(500).json({ status: 'error', message: 'Server error during this process.' }); }
});

app.post('/api/approve-contract', authMiddleware, async (req, res) => {
    try {
        const { docHash } = req.body;
        const pendingContract = await getDB().collection('pending_contracts').findOne({ docHash, assignedLandlordId: req.landlordId });
        if (!pendingContract) return res.status(404).json({ status: 'error', message: "No matching pending contract found." });

        const landlord = await getDB().collection('landlords').findOne({ _id: req.landlordId });
        const unit = await getDB().collection('units').findOne({ _id: pendingContract.unitId });
        if (!unit || !unit.isVerified) return res.status(403).json({ status: 'error', message: "Action Required: You must verify the title deed for this unit before approving." });

        const originalDetails = parseFingerprint(pendingContract.fingerprint);
        const officialUnitInfo = `${unit.floor ? `Floor ${unit.floor}, ` : ''}${unit.unitNumber}, ${unit.address.streetAddress}, ${unit.address.district}`;
        const correctedFingerprint = `Landlord: ${landlord.name} | Tenant: ${originalDetails.tenantName} | Unit: ${officialUnitInfo} | From: ${originalDetails.from} | To: ${originalDetails.to} | Rent: ${originalDetails.rent}`;
        const correctedDocHash = ethers.keccak256(ethers.toUtf8Bytes(correctedFingerprint));

        const tx = await contract.addDocument(correctedDocHash, landlord.name, officialUnitInfo, originalDetails.tenantName, originalDetails.from, originalDetails.to);
        const receipt = await tx.wait();

        const approvedContract = {
            docHash: correctedDocHash, fingerprint: correctedFingerprint, landlordId: req.landlordId,
            unitId: pendingContract.unitId, tenantEmail: pendingContract.tenantEmail, contractS3Key: pendingContract.contractS3Key,
            txHash: receipt.hash, approvedOn: new Date(), status: 'active'
        };
        await getDB().collection('approved_contracts').insertOne(approvedContract);
        await getDB().collection('pending_contracts').deleteOne({ _id: pendingContract._id });

        // Asynchronously send the confirmation email to the tenant
        try {
            const tenantEmail = approvedContract.tenantEmail;
            if (tenantEmail) {
                const shareUrl = `${process.env.FRONTEND_URL}/verify/${correctedDocHash}`;
                const qrCodeDataUrl = await QRCode.toDataURL(shareUrl);
                const subject = 'Your Rental Agreement has been Verified on the Blockchain!';
                const emailHtml = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #F9FAFB; } /* bg-background */
                            .container { max-width: 600px; margin: 20px auto; background-color: #FFFFFF; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); } /* bg-card with shadow */
                            .header { text-align: center; padding-bottom: 20px; border-bottom: 1px solid #E5E7EB; }
                            .header img { height: 50px; }
                            .header h2 { color: #1E3A8A; font-size: 24px; margin-top: 10px; } /* text-primary */
                            .content { padding: 20px 0; color: #111827; } /* text-text-primary */
                            .content h1 { color: #1E3A8A; } /* text-primary */
                            .content p { color: #6B7280; line-height: 1.6; } /* text-text-secondary */
                            .details { background-color: #F9FAFB; padding: 15px; border: 1px solid #E5E7EB; border-radius: 5px; font-family: monospace, sans-serif; color: #111827; } /* bg-background */
                            .button { display: inline-block; padding: 12px 24px; background-color: #14B8A6; color: #ffffff !important; text-decoration: none; border-radius: 5px; font-weight: bold; } /* bg-accent */
                            .qr-section { text-align: center; padding-top: 20px; }
                            .qr-section h3 { color: #111827; }
                            .footer { text-align: center; padding-top: 20px; border-top: 1px solid #E5E7EB; font-size: 12px; color: #6B7280; } /* text-text-secondary */
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <img src="https://blocklease.site/assests/logo.png" alt="Block Lease Logo">
                                <h2>Block Lease</h2>
                            </div>
                            <div class="content">
                                <h1>Your Document is Secured!</h1>
                                <p>Hello ${originalDetails.tenantName},</p>
                                <p>The rental agreement for the property below has been approved by your landlord, ${landlord.name}, and securely recorded on the blockchain.</p>
                                <h3>Contract Details:</h3>
                                <div class="details">
                                    <strong>Tenant:</strong> ${originalDetails.tenantName}<br>
                                    <strong>Unit:</strong> ${officialUnitInfo}<br>
                                    <strong>Period:</strong> ${originalDetails.from} to ${originalDetails.to}
                                </div>
                                <p>You can view and share the permanent verification record using the link or QR code below. This can be shared with anyone who needs to verify your contract, such as banks or employers.</p>
                                <div style="text-align: center; margin: 30px 0;">
                                    <a href="${shareUrl}" class="button">View Verified Document</a>
                                </div>
                            </div>
                            <div class="qr-section">
                                <h3>Scan to Verify</h3>
                                <img src="${qrCodeDataUrl}" alt="Verification QR Code">
                            </div>
                            <div class="footer">
                                <p>© ${new Date().getFullYear()} Block Lease™. All Rights Reserved.</p>
                            </div>
                        </div>
                    </body>
                    </html>
                `;
                await sendEmail({ to: tenantEmail, subject, html: emailHtml });
                console.log(`✅ Verification link and QR code sent to tenant: ${tenantEmail}`);
            }
        } catch (emailError) {
            console.error("⚠️ Could not send email notification to tenant:", emailError);
        }

        res.status(200).json({ status: 'success', message: "Contract approved and recorded on the blockchain!", docHash: correctedDocHash, txHash: receipt.hash });
    } catch (error) { res.status(500).json({ status: 'error', message: 'Server error during approval.' }); }
});

app.post('/api/contracts/:docHash/terminate', authMiddleware, async (req, res) => {
    try {
        const { docHash } = req.params;
        const result = await getDB().collection('approved_contracts').updateOne(
            { docHash: docHash, landlordId: req.landlordId },
            { $set: { status: 'terminated', terminatedOn: new Date() } }
        );
        if (result.matchedCount === 0) return res.status(404).json({ status: 'error', message: "Approved contract not found." });
        res.status(200).json({ status: 'success', message: "Contract has been terminated." });
    } catch (error) { res.status(500).json({ status: 'error', message: 'Server error while terminating contract.' }); }
});

app.post('/api/verify-document', upload.single('contract'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ status: 'error', message: "Contract file is required." });

        const validation = await AiclassifyDocument(req.file.buffer, req.file.mimetype);
        if (validation.type !== 'contract' || validation.confidence < 0.90) {
            return res.status(400).json({ status: 'error', message: `Invalid Document: The file does not appear to be a rental contract.` });
        }

        const initialFingerprint = await AiScanContract(req.file.buffer, req.file.mimetype);
        const initialDetails = parseFingerprint(initialFingerprint);

        const landlord = await getDB().collection('landlords').findOne({ name: initialDetails.landlordName });
        const unitNumberToFind = initialDetails.unitInfo.split(',')[0].trim();
        const unit = await getDB().collection('units').findOne({ landlordId: landlord?._id, unitNumber: unitNumberToFind });

        if (!landlord || !unit) {
            return res.status(200).json({ verified: false, message: "Could not match landlord or unit from the document." });
        }

        const officialUnitInfo = `${unit.floor ? `Floor ${unit.floor}, ` : ''}${unit.unitNumber}, ${unit.address.streetAddress}, ${unit.address.district}`;
        const correctedFingerprint = `Landlord: ${landlord.name} | Tenant: ${initialDetails.tenantName} | Unit: ${officialUnitInfo} | From: ${originalDetails.from} | To: ${originalDetails.to} | Rent: ${originalDetails.rent}`;
        const correctedDocHash = ethers.keccak256(ethers.toUtf8Bytes(correctedFingerprint));

        const timestamp = await contract.getDocumentTimestamp(correctedDocHash);
        const isVerified = timestamp > 0;

        if (isVerified) {
            res.status(200).json({
                docHash: correctedDocHash,
                verified: true,
                message: "Document is authentic and verified on the blockchain!",
            });
        } else {
            res.status(200).json({ verified: false, message: "Document not found or not verified on the blockchain." });
        }
    } catch (error) { res.status(500).json({ status: 'error', message: 'Server error during verification.' }); }
});

app.get('/api/verify/:docHash', async (req, res) => {
    try {
        const { docHash } = req.params;
        if (!docHash) return res.status(400).json({ status: 'error', message: "Document hash is required." });

        const timestamp = await contract.getDocumentTimestamp(docHash);
        const isVerified = timestamp > 0;

        if (!isVerified) {
            return res.status(404).json({ status: 'error', message: "A verified record for this document was not found on the blockchain." });
        }

        const approvedContract = await getDB().collection('approved_contracts').findOne({ docHash });

        if (!approvedContract) {
            return res.status(200).json({
                contractStatus: 'terminated',
                onChainDetails: {
                    landlordName: "Archived", tenantName: "Archived", unitInfo: "Archived",
                    from: "N/A", to: "N/A",
                    verifiedOn: new Date(Number(timestamp.toString()) * 1000).toUTCString(),
                    txHash: null
                },
                documentUrl: null,
                fingerprint: "Fingerprint data is archived."
            });
        }

        const documentUrl = await getPresignedUrl(approvedContract.contractS3Key);
        const details = parseFingerprint(approvedContract.fingerprint);

        res.status(200).json({
            contractStatus: approvedContract.status || 'active',
            onChainDetails: {
                landlordName: details.landlordName, unitInfo: details.unitInfo, tenantName: details.tenantName,
                from: details.from, to: details.to,
                verifiedOn: new Date(Number(timestamp.toString()) * 1000).toUTCString(),
                txHash: approvedContract.txHash
            },
            documentUrl: documentUrl,
            fingerprint: approvedContract.fingerprint
        });
    } catch (error) { res.status(500).json({ status: 'error', message: "Server error during public verification." }); }
});

app.post('/api/invitations/send', async (req, res) => {
    try {
        const { docHash, landlordEmail } = req.body;
        if (!docHash || !landlordEmail) return res.status(400).json({ status: 'error', message: "Document hash and landlord email are required." });

        const pendingContract = await getDB().collection('pending_contracts').findOne({ docHash });
        if (!pendingContract) return res.status(404).json({ status: 'error', message: "No pending contract found for that document hash." });

        const lowerCaseEmail = landlordEmail.toLowerCase();
        const existingLandlord = await getDB().collection('landlords').findOne({ email: lowerCaseEmail });

        let subject, emailHtml;
        const loginUrl = `${process.env.FRONTEND_URL}/login`;
        const registerUrl = `${process.env.FRONTEND_URL}/register`;

        if (existingLandlord) {
            // --- SCENARIO A: Landlord is found. Link the contract and send a notification. ---
            await getDB().collection('pending_contracts').updateOne(
                { docHash: docHash },
                { $set: { assignedLandlordId: existingLandlord._id, inviteeEmail: lowerCaseEmail, status: 'awaiting_approval' } }
            );
            subject = 'A New Rental Contract is Ready for Your Approval';
            emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #F9FAFB; }
                    .container { max-width: 600px; margin: 20px auto; background-color: #FFFFFF; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                    .header { text-align: center; padding-bottom: 20px; border-bottom: 1px solid #E5E7EB; }
                    .header img { height: 50px; }
                    .header h2 { color: #1E3A8A; font-size: 24px; margin-top: 10px; }
                    .content { padding: 20px 0; color: #111827; }
                    .content h1 { color: #1E3A8A; }
                    .content p { color: #6B7280; line-height: 1.6; }
                    .details { background-color: #F9FAFB; padding: 15px; border: 1px solid #E5E7EB; border-radius: 5px; font-family: monospace, sans-serif; color: #111827; }
                    .button { display: inline-block; padding: 12px 24px; background-color: #1E3A8A; color: #ffffff !important; text-decoration: none; border-radius: 5px; font-weight: bold; }
                    .footer { text-align: center; padding-top: 20px; border-top: 1px solid #E5E7EB; font-size: 12px; color: #6B7280; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <img src="https://blocklease.site/assests/logo.png" alt="Block Lease Logo">
                        <h2>Block Lease</h2>
                    </div>
                    <div class="content">
                        <h1>New Document Notification</h1>
                        <p>Hello ${existingLandlord.name},</p>
                        <p>A new rental agreement has been submitted by a tenant and requires your approval. The contract details are:</p>
                        <h3>Contract Fingerprint:</h3>
                        <div class="details">
                            <code>${pendingContract.fingerprint}</code>
                        </div>
                        <p>Please log in to your dashboard to review and approve this document.</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${loginUrl}" class="button">Go to Dashboard</a>
                        </div>
                    </div>
                    <div class="footer">
                        <p>© ${new Date().getFullYear()} Block Lease™. All Rights Reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
        } else {
            // --- SCENARIO B: Landlord is not found. Send the registration invitation. ---
            await getDB().collection('pending_contracts').updateOne(
                { docHash: docHash },
                { $set: { inviteeEmail: lowerCaseEmail, status: 'invitation_sent' } }
            );
            subject = 'You Have a New Document to Approve on Block Lease';
            emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #F9FAFB; }
                    .container { max-width: 600px; margin: 20px auto; background-color: #FFFFFF; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                    .header { text-align: center; padding-bottom: 20px; border-bottom: 1px solid #E5E7EB; }
                    .header img { height: 50px; }
                    .header h2 { color: #1E3A8A; font-size: 24px; margin-top: 10px; }
                    .content { padding: 20px 0; color: #111827; }
                    .content h1 { color: #1E3A8A; }
                    .content p { color: #6B7280; line-height: 1.6; }
                    .details { background-color: #F9FAFB; padding: 15px; border: 1px solid #E5E7EB; border-radius: 5px; font-family: monospace, sans-serif; color: #111827; }
                    .button { display: inline-block; padding: 12px 24px; background-color: #14B8A6; color: #ffffff !important; text-decoration: none; border-radius: 5px; font-weight: bold; } /* Using accent color */
                    .footer { text-align: center; padding-top: 20px; border-top: 1px solid #E5E7EB; font-size: 12px; color: #6B7280; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <img src="https://blocklease.site/assests/logo.png" alt="Block Lease Logo">
                        <h2>Block Lease</h2>
                    </div>
                    <div class="content">
                        <h1>You're Invited to Block Lease</h1>
                        <p>Hello,</p>
                        <p>A tenant has submitted a rental agreement for your approval on the Block Lease platform. To securely review, approve, and record this document on the blockchain, please create your free account.</p>
                        <h3>Contract Fingerprint:</h3>
                        <div class="details">
                            <code>${pendingContract.fingerprint}</code>
                        </div>
                        <p>Please register on our website to review this document. Once you sign up with this email address, the contract will be waiting for you on your dashboard.</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${registerUrl}" class="button">Create Your Account</a>
                        </div>
                    </div>
                    <div class="footer">
                        <p>© ${new Date().getFullYear()} Block Lease™. All Rights Reserved.</p>
                    </div>
                </div>
            </body>
            </html>
            `;
        }
        await sendEmail({ to: lowerCaseEmail, subject, html: emailHtml });
        res.status(200).json({ status: 'success', message: `Notification sent successfully to ${lowerCaseEmail}!` });
    } catch (error) { res.status(500).json({ status: 'error', message: 'Server error while sending invitation.' }); }
});

// ##################################################################
// ### UTILITY ENDPOINTS
// ##################################################################
app.get('/api/s3/presigned-url', authMiddleware, async (req, res) => {
    try {
        const { key } = req.query;
        if (!key) return res.status(400).json({ status: 'error', message: "S3 key is required." });
        const url = await getPresignedUrl(key);
        if (!url) return res.status(404).json({ status: 'error', message: "Could not generate URL or file not found." });
        res.status(200).json({ url });
    } catch (error) { res.status(500).json({ status: 'error', message: 'Server error while generating presigned URL.' }); }
});

// --- SERVER START ---
connectDB().then(() => { app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`)); });