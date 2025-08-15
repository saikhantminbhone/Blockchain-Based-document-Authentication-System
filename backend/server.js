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
const { AiScanContract, AiCheckDocumentAuthenticity, AiExtractDeedData, AiCompareAddresses, AiFindBestUnitMatch,AiextractUtilityBillData } = require('./utils/aiModel');

const app = express();
app.use('/api/veriff/webhook', express.raw({ type: 'application/json' }));
app.use(cors());
app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() });

// --- Environment Variables ---
const {
    PORT, BASE_SMOY_RPC_URL, ADMIN_PRIVATE_KEY, CONTRACT_ADDRESS,
    AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_S3_BUCKET_NAME,
    JWT_SECRET, VERIFF_API_KEY, VERIFF_SECRET_KEY, VERIFF_PUBLIC_URL, GOOGLE_CLIENT_ID
} = process.env;

// --- Service Clients ---
const veriffApi = axios.create({ baseURL: 'https://api.veriff.me/v1/', headers: { 'Content-Type': 'application/json', 'X-AUTH-CLIENT': VERIFF_API_KEY } });
const s3 = new S3Client({ region: AWS_REGION, credentials: { accessKeyId: AWS_ACCESS_KEY_ID, secretAccessKey: AWS_SECRET_ACCESS_KEY } });
const contractABI = require('../blockchain/artifacts/contracts/DocumentRegistry.sol/DocumentRegistry.json').abi;
const provider = new ethers.JsonRpcProvider(BASE_SMOY_RPC_URL);
const adminWallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, adminWallet);
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// --- Helper Functions ---
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

const getPresignedUrl = async (s3Key) => {
    if (!s3Key) return null;
    const command = new GetObjectCommand({ Bucket: AWS_S3_BUCKET_NAME, Key: s3Key });
    try {
        const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
        return url;
    } catch (err) {
        console.error(`❌ Error generating presigned URL for key ${s3Key}:`, err);
        return null;
    }
};



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

const authMiddleware = (req, res, next) => {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ message: 'No token, authorization denied.' });
    const token = authHeader.replace('Bearer ', '');
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.landlordId = new ObjectId(decoded.landlordId);
        req.landlordName = decoded.name;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Token is not valid.' });
    }
};

// ##################################################################
// ### LANDLORD AUTHENTICATION & REGISTRATION
// ##################################################################
app.get('/insert-unit', async (req, res) => {
    try {
        const db = getDB(); // Your DB connection function

        const newUnit = {
            landlordId: new ObjectId('68834314570cf3a137f078f1'),
            unitNumber: '279/19',
            address: {
                street: 'UNIO SUKHUMVIT72, 285 Village No. 1, Soi Sukhumvit 72',
                city: 'Samut Prakan',
                province: 'Samut Prakan',
                zipCode: '10270',
                country: 'Thailand'
            },
            tenantName: 'Sai Khant Min Bhone',
            rentStartDate: new Date('2024-11-16'),
            rentEndDate: new Date('2025-11-15'),
            monthlyRent: 8000,
            titleDeedS3Key: null,
            isVerified: true,
            verificationStatus: 'verified_by_ai',
            aiExtractedData: null,
            createdAt: new Date()
        };

        const result = await db.collection('units').insertOne(newUnit);
        res.status(200).json({ insertedId: result.insertedId });
    } catch (err) {
        console.error('Error inserting unit:', err);
        res.status(500).json({ error: 'Insertion failed' });
    }
});


app.post('/api/register-landlord', async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;
        if (!name || !email || !password) return res.status(400).json({ message: "Name, email, and password are required." });
        const lowerCaseEmail = email.toLowerCase();
        if (await getDB().collection('landlords').findOne({ email: lowerCaseEmail })) {
            return res.status(409).json({ message: "An account with this email already exists." });
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const emailVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
        const emailVerificationExpires = new Date(Date.now() + 155 * 60 * 1000);
               const newLandlord = {
            name,
            email: lowerCaseEmail,
            password: hashedPassword,
            phone: phone || '',
            kycStatus: 'pending',
            emailStatus: 'unverified',
            emailVerificationToken, 
            emailVerificationExpires,
            createdAt: new Date(),
        };
        const result = await getDB().collection('landlords').insertOne(newLandlord);
        const verificationUrl = `https://blocklease.site/verify-email/${verificationToken}`;
        const subject = 'Verify Your Email Address for Block Lease';
        const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #F9FAFB; }
                    .container { max-width: 600px; margin: 40px auto; background-color: #FFFFFF; padding: 40px; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }
                    .header { text-align: center; padding-bottom: 20px; }
                    .header img { height: 50px; }
                    .content h1 { color: #111827; font-size: 24px; } /* text-text-primary */
                    .content p { color: #6B7280; line-height: 1.6; } /* text-text-secondary */
                    .button-container { text-align: center; margin: 30px 0; }
                    .button { display: inline-block; padding: 14px 28px; background-color: #1E3A8A; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; } /* bg-primary */
                    .link { font-size: 12px; color: #6B7280; text-align: center; word-break: break-all; }
                    .footer { text-align: center; padding-top: 20px; border-top: 1px solid #E5E7EB; font-size: 12px; color: #9CA3AF; } /* text-text-muted */
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <img src="https://blocklease.site/assests/logo.png" alt="Block Lease Logo">
                    </div>
                    <div class="content">
                        <h1>One Last Step...</h1>
                        <p>Hello ${name},</p>
                        <p>Thank you for registering with Block Lease. Please click the button below to verify your email address and activate your account. This link is valid for 15 minutes.</p>
                        <div class="button-container">
                            <a href="${verificationUrl}" class="button">Verify Email Address</a>
                        </div>
                        <p class="link">If you're having trouble, copy and paste this URL into your browser:<br/> <a href="${verificationUrl}" style="color: #3B82F6;">${verificationUrl}</a></p>
                        <p>If you did not create this account, you can safely ignore this email.</p>
                    </div>
                    <div class="footer">
                        <p>© ${new Date().getFullYear()} Block Lease™. All Rights Reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
        await sendEmail({ to: newLandlord.email, subject, html: emailHtml });
        res.status(201).json({
            message: 'Registration successful! Please check your email to verify your account.'
        });
    } catch (error) { res.status(500).json({ message: 'Server error during registration.' }); }
});



app.post('/api/verify-email', async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ message: "Verification token is missing." });

        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
        const landlord = await getDB().collection('landlords').findOne({
            emailVerificationToken: hashedToken,
        });

        if (!landlord) {
            return res.status(400).json({ message: "This verification link is invalid." });
        }
        if (landlord.emailStatus === 'verified') {
            return res.status(200).json({ 
                message: "This email address has already been verified. Please log in." 
            });
        }
        if (new Date() > landlord.emailVerificationExpires) {
            return res.status(400).json({ message: "This verification link has expired. Please request a new one." });
        }
        await getDB().collection('landlords').updateOne(
            { _id: landlord._id },
            { $set: {
                emailStatus: 'verified',
                emailVerificationToken: undefined,
                emailVerificationExpires: undefined,
            }}
        );
        
        const payload = { landlordId: landlord._id.toString(), email: landlord.email, name: landlord.name };
        const appToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
        
        res.status(200).json({
            message: 'Email verified successfully!',
            token: appToken,
            landlord: { id: landlord._id, name: landlord.name, kycStatus: landlord.kycStatus }
        });

    } catch (error) { 
        console.error("Email Verification Error:", error);
        res.status(500).json({ message: 'Server error during email verification.' }); 
    }
});

app.post('/api/resend-verification', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: "Email is required." });

        const landlord = await getDB().collection('landlords').findOne({ email: email.toLowerCase() });
        if (!landlord) return res.status(404).json({ message: "No account found with that email address." });

        if (landlord.emailStatus === 'verified') {
            return res.status(200).json({ message: "This email address has already been verified. You can log in." });
        }

        const verificationToken = crypto.randomBytes(32).toString('hex');
        const emailVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
        const emailVerificationExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        await getDB().collection('landlords').updateOne(
            { _id: landlord._id },
            { $set: { emailVerificationToken, emailVerificationExpires } }
        );
        
        const verificationUrl = `https://blocklease.site/verify-email/${verificationToken}`;
        const subject = 'Your New Verification Link for Block Lease';
        const emailHtml = `
            <!DOCTYPE html><html><head><style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #F9FAFB; }
                .container { max-width: 600px; margin: 40px auto; background-color: #FFFFFF; padding: 40px; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }
                .header { text-align: center; padding-bottom: 20px; }
                .header img { height: 50px; }
                .content h1 { color: #111827; }
                .content p { color: #6B7280; line-height: 1.6; }
                .button-container { text-align: center; margin: 30px 0; }
                .button { display: inline-block; padding: 14px 28px; background-color: #1E3A8A; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; }
                .footer { text-align: center; padding-top: 20px; border-top: 1px solid #E5E7EB; font-size: 12px; color: #9CA3AF; }
            </style></head><body>
                <div class="container">
                    <div class="header"><img src="https://blocklease.site/assests/logo.png" alt="Block Lease Logo"></div>
                    <div class="content">
                        <h1>New Verification Link</h1>
                        <p>Hello ${landlord.name},</p>
                        <p>As requested, here is a new link to verify your email address. Please click the button below to activate your account. This link is valid for 15 minutes.</p>
                        <div class="button-container"><a href="${verificationUrl}" class="button">Verify Email Address</a></div>
                        <p>If you did not request this, you can safely ignore this email.</p>
                    </div>
                    <div class="footer"><p>© ${new Date().getFullYear()} Block Lease™. All Rights Reserved.</p></div>
                </div>
            </body></html>
        `;

        await sendEmail({ to: landlord.email, subject, html: emailHtml });

        res.status(200).json({ message: "A new verification email has been sent. Please check your inbox." });

    } catch (error) {
        res.status(500).json({ message: 'Server error while resending verification email.' });
    }
});

app.post('/api/auth/google', async (req, res) => {
    try {
        const { token } = req.body; 
        const ticket = await googleClient.verifyIdToken({
            idToken: token,
            audience: GOOGLE_CLIENT_ID,
        });
        const googlePayload = ticket.getPayload();
        const { email, name, picture } = googlePayload;

        // 1. Find a user with the Google email
        let landlord = await getDB().collection('landlords').findOne({ email: email });
        let isNewUser = false;

        if (landlord) {
            // --- SCENARIO A: USER ALREADY EXISTS ---
            console.log(`✅ Existing landlord logged in with Google: ${email}`);
            // Optional: If they signed up with email first, you can link their Google account here.
            if (landlord.authProvider !== 'google') {
                await getDB().collection('landlords').updateOne(
                    { _id: landlord._id },
                    { $set: { authProvider: 'google', profilePicture: picture } }
                );
            }
        } else {
            console.log(`✨ New landlord registering with Google: ${email}`);
            isNewUser = true;
            const newLandlord = {
                name: name,
                email: email,
                password: null, // No password for OAuth users
                authProvider: 'google',
                profilePicture: picture,
                kycStatus: 'pending',
                createdAt: new Date(),
            };
            const result = await getDB().collection('landlords').insertOne(newLandlord);
            landlord = { _id: result.insertedId, ...newLandlord };
        }

        const appPayload = { landlordId: landlord._id.toString(), email: landlord.email, name: landlord.name };
        const appToken = jwt.sign(appPayload, JWT_SECRET, { expiresIn: '8h' });

        res.status(200).json({
            message: 'Google sign-in successful!',
            token: appToken,
            landlord: { id: landlord._id, name: landlord.name, kycStatus: landlord.kycStatus },
            isNewUser: isNewUser 
        });

    } catch (error) {
        console.error("Google Auth Error:", error);
        res.status(401).json({ message: 'Google authentication failed.' });
    }
});

app.post('/api/login-landlord', async (req, res) => {
    try {
        const { email, password } = req.body;
        const lowerCaseEmail = email.toLowerCase();
        const landlord = await getDB().collection('landlords').findOne({ email: lowerCaseEmail });
        if (landlord.emailStatus === 'unverified') {
        return res.status(403).json({ 
            message: "Your email is not verified. Please check your inbox.",
            errorCode: 'EMAIL_NOT_VERIFIED' // Special code for the frontend
            });
        }
        if (!landlord) return res.status(401).json({ message: 'Invalid credentials.' });
        const isMatch = await bcrypt.compare(password, landlord.password);
        if (!isMatch) return res.status(401).json({ message: 'Invalid credentials.' });
        const payload = { landlordId: landlord._id.toString(), email: landlord.email, name: landlord.name };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
        res.status(200).json({
            message: 'Logged in successfully!', token,
            landlord: { id: landlord._id, name: landlord.name, email: landlord.email, kycStatus: landlord.kycStatus }
        });
    } catch (error) { res.status(500).json({ message: 'Server error during login.' }); }
});

app.get('/api/landlord/me', authMiddleware, async (req, res) => {
    try {
        const landlord = await getDB().collection('landlords').findOne({ _id: req.landlordId }, { projection: { password: 0 } });
        if (!landlord) return res.status(404).json({ message: 'Landlord profile not found for this token.' });
        res.status(200).json({ landlord });
    } catch (error) { res.status(500).json({ message: 'Server error fetching landlord profile.' }); }
});

// ##################################################################
// ### VERIFF INTEGRATION (LANDLORD KYC ONLY)
// ##################################################################
app.post('/api/veriff/create-session', authMiddleware, async (req, res) => {
    try {
        const { type } = req.body;
        if (type !== 'kyc') return res.status(400).json({ message: "This endpoint is only for KYC verification." });
        const landlord = await getDB().collection('landlords').findOne({ _id: req.landlordId });
        const person = { firstName: landlord.name.split(' ')[0], lastName: landlord.name.split(' ').slice(1).join(' ') || landlord.name };
        const veriffPayload = { verification: { callback: `${VERIFF_PUBLIC_URL}/api/veriff/webhook`, vendorData: req.landlordId.toString(), person, timestamp: new Date().toISOString() } };
        const response = await veriffApi.post('/v1/sessions', veriffPayload, { headers: { 'X-AUTH-CLIENT': VERIFF_API_KEY } });
        const { url, id } = response.data.verification;
        await getDB().collection('landlords').updateOne({ _id: req.landlordId }, { $set: { veriffSessionId: id } });
        res.status(201).json({ sessionUrl: url });
    } catch (error) { res.status(500).json({ message: 'Server error during Veriff session creation.' }); }
});

app.post('/api/veriff/webhook', async (req, res) => {
    try {
        const signature = req.headers['x-hmac-signature'];
        const hmac = crypto.createHmac('sha256', VERIFF_SECRET_KEY);
        hmac.update(req.body);
        if (crypto.timingSafeEqual(Buffer.from(hmac.digest('hex')), Buffer.from(signature))) {
            const event = JSON.parse(req.body.toString());
            if (event.status === 'success' && event.verification?.person?.firstName) {
                const { status, vendorData, person, document } = event.verification;
                const kycStatus = status === 'approved' ? 'approved' : 'failed';
                const veriffData = { decision: status, fullName: person.fullName, dateOfBirth: person.dateOfBirth, address: document.address };
                await getDB().collection('landlords').updateOne({ _id: new ObjectId(vendorData) }, { $set: { kycStatus, veriffData, lastKycUpdate: new Date() } });
            }
        } else { return res.status(403).send('Invalid signature.'); }
        res.status(200).send('Webhook received.');
    } catch (error) { res.status(500).send('Server error processing webhook.'); }
});

// ##################################################################
// ### UNIT MANAGEMENT (WITH CUSTOM AI)
// ##################################################################
app.post('/api/units', authMiddleware, upload.fields([
    { name: 'titleDeed', maxCount: 1 },
    { name: 'utilityBill', maxCount: 1 }
]), async (req, res) => {
    try {
        const { unitNumber, streetAddress, city, province, zipCode, country, isConfirmed } = req.body;
        const titleDeedFile = req.files['titleDeed']?.[0];
        const utilityBillFile = req.files['utilityBill']?.[0];
        if (!unitNumber || !streetAddress || !city || !province || !zipCode || !country || !titleDeedFile) {
            return res.status(400).json({ message: "All fields and a title deed image are required." });
        }
        if (!titleDeedFile || !utilityBillFile) {
            return res.status(400).json({ message: "Both a Title Deed and a recent Utility Bill are required." });
        }

       const [deedData, billData] = await Promise.all([
            AiExtractDeedData(titleDeedFile.buffer, titleDeedFile.mimetype),
            AiextractUtilityBillData(utilityBillFile.buffer, utilityBillFile.mimetype)
        ]);
        const landlord = await getDB().collection('landlords').findOne({ _id: req.landlordId });
        const veriffName = landlord.name.toLowerCase();
        const deedName = deedData.ownerName.toLowerCase();
        const billName = billData.nameOnBill.toLowerCase();
        if (veriffName !== deedName || veriffName !== billName) {
            return res.status(403).json({ message: `Ownership Mismatch: The name on the uploaded documents (${deedName}, ${billName}) does not match your verified profile name (${landlord.name}).` });
        }
        const addressesMatch = await AiCompareAddresses(deedData.propertyAddress, billData.addressOnBill);
        if (!addressesMatch) {
            return res.status(400).json({ message: "Address Mismatch: The address on the title deed does not match the address on the utility bill." });
        }
        
        const userInputAddress = `${unitNumber}, ${streetAddress}, ${city}, ${province}, ${zipCode}, ${country}`;
        const aiAddress = deedData.propertyAddress;
        const isMatch = await AiCompareAddresses(userInputAddress, aiAddress);
        if (!isMatch && !isConfirmed) {
            return res.status(200).json({
             message: 'Address Mismatch: The address you entered does not exactly match the one on the title deed.',
                userInputAddress, aiSuggestedAddress: aiAddress,
            });
        }
        const titleDeedS3Key = await uploadFileToS3(titleDeedFile.buffer, 'verified-title-deeds', titleDeedFile.originalname);
        const newUnit = {
            landlordId: req.landlordId, unitNumber, address: { street: streetAddress, city, province, zipCode, country },
            titleDeedS3Key, isVerified: true, verificationStatus: 'verified_by_ai',
            aiExtractedData: { deedData, billData }, createdAt: new Date()
        };
        const result = await getDB().collection('units').insertOne(newUnit);
        res.status(201).json({ status: 'success', message: "Unit created and verified successfully!", unit: { _id: result.insertedId, ...newUnit } });
    } catch (error) { console.log(error); res.status(500).json({ message: 'Server error while creating unit.' }); }
});

app.get('/api/landlord/dashboard', authMiddleware, async (req, res) => {
    try {
        const landlord = await getDB().collection('landlords').findOne({ _id: req.landlordId }, { projection: { password: 0 } });
        if (!landlord) return res.status(404).json({ message: "Landlord not found." });
        
        const units = await getDB().collection('units').find({ landlordId: req.landlordId }).toArray();
        
        const pendingContracts = await getDB().collection('pending_contracts').find({ assignedLandlordId: req.landlordId }).toArray();
        const approvedContracts = await getDB().collection('approved_contracts').find({ landlordId: req.landlordId }).toArray();
        
        const unitsWithUrls = await Promise.all(units.map(async (unit) => ({ ...unit, titleDeedUrl: await getPresignedUrl(unit.titleDeedS3Key) })));
        
        res.status(200).json({ landlord, units: unitsWithUrls, pendingContracts, approvedContracts });
    } catch (error) { 
        console.error("Dashboard Error:", error);
        res.status(500).json({ message: 'Server error fetching dashboard data.' }); 
    }
});

app.post('/api/units/:unitId/verify', 
    authMiddleware,
    upload.fields([
        { name: 'titleDeed', maxCount: 1 },
        { name: 'utilityBill', maxCount: 1 }
    ]),
    async (req, res) => {
    try {
        const { unitId } = req.params;
        const titleDeedFile = req.files['titleDeed']?.[0];
        const utilityBillFile = req.files['utilityBill']?.[0];

        if (!titleDeedFile || !utilityBillFile) {
            return res.status(400).json({ message: "Both a Title Deed and a recent Utility Bill are required for verification." });
        }
         const authenticityScore = await AiCheckDocumentAuthenticity(titleDeedFile.buffer, titleDeedFile.mimetype);
        if (authenticityScore < 85) return res.status(400).json({ message: `Document authenticity score is too low (${authenticityScore}%).` });
        const [deedData, billData] = await Promise.all([
            AiExtractDeedData(titleDeedFile.buffer, titleDeedFile.mimetype),
            AiextractUtilityBillData(utilityBillFile.buffer, utilityBillFile.mimetype)
        ]);
        const landlord = await getDB().collection('landlords').findOne({ _id: req.landlordId });

        // 3. Perform the Three-Way Name Match
        const veriffName = landlord.name.toLowerCase();
        const deedName = deedData.ownerName.toLowerCase();
        const billName = billData.nameOnBill.toLowerCase();

        if (veriffName !== deedName || veriffName !== billName) {
            return res.status(403).json({ message: `Ownership Mismatch: The name on the uploaded documents does not match your verified profile name.` });
        }
        
        const addressesMatch = await compareAddressesAI(deedData.propertyAddress, billData.addressOnBill);
        if (!addressesMatch) {
            return res.status(400).json({ message: "Address Mismatch: The address on the title deed does not appear to match the address on the utility bill." });
        }
        const titleDeedS3Key = await uploadFileToS3(titleDeedFile.buffer, 'verified-title-deeds', titleDeedFile.originalname);
        const utilityBillS3Key = await uploadFileToS3(utilityBillFile.buffer, 'verified-utility-bills', utilityBillFile.originalname);

        await getDB().collection('units').updateOne(
            { _id: new ObjectId(unitId), landlordId: req.landlordId },
            { $set: {
                isVerified: true,
                verificationStatus: 'verified_by_ai',
                titleDeedS3Key: titleDeedS3Key,
                utilityBillS3Key: utilityBillS3Key,
                aiExtractedData: { deedData, billData },
            }}
        );
        
        res.status(200).json({ message: "Unit deed verified successfully!" });

    } catch (error) {
        console.error("Verify Unit Deed Error:", error);
        res.status(500).json({ message: 'Server error during deed verification.' });
    }
});

app.delete('/api/units/:unitId/archive', authMiddleware, async (req, res) => {
    try {
        const { unitId } = req.params;
        console.log(unitId)
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


// ##################################################################
// ### TENANT-LED CONTRACT & BLOCKCHAIN FLOW
// ##################################################################
app.post('/api/contracts/initiate', upload.single('contract'), async (req, res) => {
    try {
        const { tenantEmail } = req.body;
        const contractFile = req.file;
        if (!contractFile || !tenantEmail) {
            return res.status(400).json({ message: "Contract file and tenant email are required." });
        }
        const fingerprint = await AiScanContract(req.file.buffer, req.file.mimetype);
        const docHash = ethers.keccak256(ethers.toUtf8Bytes(fingerprint));
        const existingPending = await getDB().collection('pending_contracts').findOne({ docHash });
        if (existingPending) {
            return res.status(200).json({
                status: 'already_pending',
                message: 'This document has already been submitted and is awaiting landlord approval.'
            });
        }

        const existingApproved = await getDB().collection('approved_contracts').findOne({ docHash });
        if (existingApproved) {
            return res.status(200).json({
                status: 'already_approved',
                message: 'This document has already been approved and recorded on the blockchain.',
                docHash: docHash // Send the hash so the frontend can redirect
            });
        }
        const details = parseFingerprint(fingerprint);
        console.log(fingerprint)
        const landlord = await getDB().collection('landlords').findOne({ name: details.landlordName, kycStatus: 'approved' });
        const contractS3Key = await uploadFileToS3(req.file.buffer, 'pending-contracts', req.file.originalname);
        const pendingContract = { docHash, fingerprint, contractS3Key, tenantEmail, createdAt: new Date() };
        if (landlord) {
            pendingContract.assignedLandlordId = landlord._id;
            const landlordUnits = await getDB().collection('units').find({ landlordId: landlord._id }).toArray();
            const officialUnitNumbers = landlordUnits.map(u => u.unitNumber);

            let matchedUnit = null;
            if (officialUnitNumbers.length > 0) {
                console.log(details.unitInfo)
                const bestMatchUnitNumber = await AiFindBestUnitMatch(details.unitInfo, officialUnitNumbers);

                if (bestMatchUnitNumber) {
                    matchedUnit = landlordUnits.find(u => u.unitNumber === bestMatchUnitNumber);
                }
            }
            console.log(matchUnit)
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
    } catch (error) { res.status(500).json({ message: 'Server error during contract initiation.' }); }
});

app.post('/api/approve-and-create-unit', authMiddleware, async (req, res) => {
    try {
        const { docHash } = req.body;
        const pendingContract = await getDB().collection('pending_contracts').findOne({ docHash, assignedLandlordId: req.landlordId, unitStatus: 'unmatched' });
        if (!pendingContract) return res.status(404).json({ message: "No unmatched pending contract found." });
        const newUnit = {
            landlordId: req.landlordId,
            unitNumber: pendingContract.unmatchedUnitIdentifier.split(',')[0].trim(),
            address: { 
                streetAddress: `Details from contract: ${pendingContract.unmatchedUnitIdentifier}`,
                subdistrict: '', district: '', province: '', zipCode: '', country: '' 
            },
            isVerified: false, 
            verificationStatus: 'pending_scan',
            createdAt: new Date(),
        };
        const result = await getDB().collection('units').insertOne(newUnit);

        await getDB().collection('pending_contracts').updateOne(
            { _id: pendingContract._id },
            { $set: {
                unitId: result.insertedId,
                unitStatus: 'matched' 
            }}
        );
        res.status(200).json({ 
            message: `Unit '${newUnit.unitNumber}' was added to your portfolio. You must now verify its title deed before you can approve this contract.`
        });
    } catch (error) {
        console.error("Approve and Create Unit Error:", error);
        res.status(500).json({ message: 'Server error during this process.' });
    }
});

app.post('/api/approve-contract', authMiddleware, async (req, res) => {
    try {
        const { docHash } = req.body;
        const pendingContract = await getDB().collection('pending_contracts').findOne({ docHash, assignedLandlordId: req.landlordId });
        if (!pendingContract) return res.status(404).json({ message: "No matching pending contract found." });
        const landlord = await getDB().collection('landlords').findOne({ _id: req.landlordId });
        const unit = await getDB().collection('units').findOne({ _id: pendingContract.unitId });
        if (!unit || !unit.isVerified) return res.status(403).json({ message: "Action Required: You must verify the title deed for this unit before approving." });
        const originalDetails = parseFingerprint(pendingContract.fingerprint);
        const officialUnitInfo = `${unit.unitNumber}, ${unit.address.street}, ${unit.address.city}`;
        const correctedFingerprint = `Landlord: ${landlord.name} | Tenant: ${originalDetails.tenantName} | Unit: ${officialUnitInfo} | From: ${originalDetails.from} | To: ${originalDetails.to} | Rent: ${originalDetails.rent}`;
        const correctedDocHash = ethers.keccak256(ethers.toUtf8Bytes(correctedFingerprint));
        const tx = await contract.addDocument(correctedDocHash, landlord.name, officialUnitInfo, originalDetails.tenantName, originalDetails.from, originalDetails.to);
        const receipt = await tx.wait();
        const approvedContract = {
            docHash: correctedDocHash, fingerprint: correctedFingerprint, landlordId: req.landlordId,
            unitId: pendingContract.unitId, tenantEmail: pendingContract.tenantEmail, contractS3Key: pendingContract.contractS3Key,
            txHash: receipt.hash, approvedOn: new Date(),
        };
        await getDB().collection('approved_contracts').insertOne(approvedContract);
        await getDB().collection('pending_contracts').deleteOne({ _id: pendingContract._id });
        try {
            const tenantEmail = approvedContract.tenantEmail;
            if (tenantEmail) {
                const shareUrl = `https://blocklease.site/verify/${correctedDocHash}`;
                const qrCodeDataUrl = await QRCode.toDataURL(shareUrl);
                const subject = 'Your Rental Agreement has been Verified on the Blockchain!';

                // --- STYLED HTML EMAIL TEMPLATE ---
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
        res.status(200).json({ message: "Contract approved and recorded on the blockchain!", docHash: correctedDocHash, txHash: receipt.hash });
    } catch (error) { res.status(500).json({ message: 'Server error during approval.' }); }
});

app.post('/api/contracts/:docHash/terminate', authMiddleware, async (req, res) => {
    try {
        const { docHash } = req.params;
        console.log(docHash);
        return res.status(200).json({ message: "Contract has been terminated." });
        const result = await getDB().collection('approved_contracts').updateOne(
            { docHash: docHash, landlordId: req.landlordId },
            { $set: { status: 'terminated', terminatedOn: new Date() } }
        );
        if (result.matchedCount === 0) {
            return res.status(404).json({ message: "Approved contract not found or you don't have permission." });
        }
        res.status(200).json({ message: "Contract has been terminated." });
    } catch (error) {
        res.status(500).json({ message: 'Server error while terminating contract.' });
    }
});

app.post('/api/verify-document', upload.single('contract'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: "Contract file is required." });
        const initialFingerprint = await AiScanContract(req.file.buffer, req.file.mimetype);
        const initialDetails = parseFingerprint(initialFingerprint);
        console.log(initialDetails)
        const landlord = await getDB().collection('landlords').findOne({ name: initialDetails.landlordName });
        const unit = await getDB().collection('units').findOne({ landlordId: landlord?._id, unitNumber: initialDetails.unitInfo.split(',')[0].trim() });
        if (!landlord) {
            return res.status(200).json({verified: false, message: "Document not found or not verified on the blockchain.", fingerprint: initialFingerprint, details: null });
        }
        const officialUnitInfo = `${unit.unitNumber}, ${unit.address.street}, ${unit.address.city}`;
        const correctedFingerprint = `Landlord: ${landlord.name} | Tenant: ${initialDetails.tenantName} | Unit: ${officialUnitInfo} | From: ${initialDetails.from} | To: ${initialDetails.to} | Rent: ${initialDetails.rent}`;
        const correctedDocHash = ethers.keccak256(ethers.toUtf8Bytes(correctedFingerprint));
        const docHash = correctedDocHash;
        const [isVerified, landlordName, unitInfo, tenantName, from, to, timestamp] = await contract.getDocument(correctedDocHash);
        if (isVerified) {
            res.status(200).json({
                docHash: docHash,
                verified: true,
                message: "Document is authentic and verified on the blockchain!",
                fingerprint: correctedFingerprint,
                details: { landlordName, unitInfo, tenantName, from, to, verifiedOn: new Date(Number(timestamp.toString()) * 1000).toUTCString() }
            });
        } else {
            res.status(200).json({ verified: false, message: "Document not found or not verified on the blockchain.", fingerprint: initialFingerprint, details: null });
        }
    } catch (error) { console.log(error); res.status(500).json({ message: 'Server error during verification.' }); }
});

app.get('/api/verify/:docHash', async (req, res) => {
    try {
        const { docHash } = req.params;
        if (!docHash) {
            return res.status(400).json({ message: "Document hash is required." });
        }
        const [isVerified, landlordName, unitInfo, tenantName, from, to, timestamp] = await contract.getDocument(docHash);
        if (!isVerified) {
            return res.status(404).json({ message: "A verified record for this document was not found on the blockchain." });
        }
        const approvedContract = await getDB().collection('approved_contracts').findOne({ docHash });
        if (!approvedContract) {
            console.log(`Verification for valid on-chain hash ${docHash} but missing off-chain record.`);
            return res.status(200).json({
                contractStatus: 'terminated', // We assign the 'terminated' status
                onChainDetails: {
                    // We can still return the data we got directly from the blockchain
                    landlordName,
                    unitInfo,
                    tenantName,
                    from,
                    to,
                    verifiedOn: new Date(Number(timestamp.toString()) * 1000).toUTCString(),
                    txHash: null // We don't have the txHash because the off-chain record is gone
                },
                documentUrl: null, // We can't provide a preview URL
                fingerprint: "Fingerprint data is archived."
            });
        }
        const documentUrl = await getPresignedUrl(approvedContract.contractS3Key);
        res.status(200).json({
            contractStatus: approvedContract.status || 'active', // Use its actual status
            onChainDetails: {
                landlordName, unitInfo, tenantName, from, to,
                verifiedOn: new Date(Number(timestamp.toString()) * 1000).toUTCString(),
                txHash: approvedContract.txHash
            },
            documentUrl: documentUrl,
            fingerprint: approvedContract.fingerprint
        });

    } catch (error) {
        console.error("Public Verification Error:", error);
        res.status(500).json({ message: "Server error during public verification." });
    }
});

app.post('/api/invitations/send', async (req, res) => {
    try {
        const { docHash, landlordEmail } = req.body;
        if (!docHash || !landlordEmail) return res.status(400).json({ message: "Document hash and landlord email are required." });
        const pendingContract = await getDB().collection('pending_contracts').findOne({ docHash });
        if (!pendingContract) return res.status(404).json({ message: "No pending contract found for that document hash." });
        const subject = 'You Have a New Document to Approve';
        const loginUrl = `https://blocklease.site/login`;

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
                    .button { display: inline-block; padding: 12px 24px; background-color: #1E3A8A; color: #ffffff !important; text-decoration: none; border-radius: 5px; font-weight: bold; } /* bg-primary */
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
                        <h1>Document Approval Request</h1>
                        <p>Hello,</p>
                        <p>You have received a new rental agreement that requires your approval on our platform. A tenant has uploaded a contract with the following details:</p>
                        <h3>Contract Fingerprint:</h3>
                        <div class="details">
                            <code>${pendingContract.fingerprint}</code>
                        </div>
                        <p>Please log in or register on our website to review and approve this document. Once approved, its authenticity will be permanently recorded on the blockchain.</p>
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

        await sendEmail({ to: landlordEmail, subject, html: emailHtml });
        await getDB().collection('pending_contracts').updateOne({ docHash: docHash }, { $set: { inviteeEmail: landlordEmail.toLowerCase(), status: 'invitation_sent' } });
        res.status(200).json({ message: `Invitation sent successfully to ${landlordEmail}!` });
    } catch (error) { res.status(500).json({ message: 'Server error while sending invitation.' }); }
});



// ##################################################################
// ### UTILITY ENDPOINTS
// ##################################################################
app.get('/api/s3/presigned-url', authMiddleware, async (req, res) => {
    try {
        const { key } = req.query;
        if (!key) return res.status(400).json({ message: "S3 key is required." });
        let contentType = 'application/octet-stream';
        if (key.endsWith('.pdf')) contentType = 'application/pdf';
        else if (key.endsWith('.jpg') || key.endsWith('.jpeg')) contentType = 'image/jpeg';
        else if (key.endsWith('.png')) contentType = 'image/png';
        const command = new GetObjectCommand({
            Bucket: AWS_S3_BUCKET_NAME, Key: key,
            ResponseContentDisposition: 'inline', ResponseContentType: contentType
        });
        const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
        if (!url) return res.status(404).json({ message: "Could not generate URL or file not found." });
        res.status(200).json({ url });
    } catch (error) { res.status(500).json({ message: 'Server error while generating presigned URL.' }); }
});

// --- SERVER START ---
connectDB().then(() => { app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`)); });