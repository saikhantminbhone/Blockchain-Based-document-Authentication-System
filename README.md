# Block Lease: A Blockchain-Based Document Authentication System

**Document Version:** 1.1
**Last Updated:** August 19, 2025

A final year project demonstrating a full-stack, AI-powered document authentication platform for the real estate rental market, secured by blockchain technology.


## 📖 Project Overview

Block Lease is a sophisticated web application designed to combat document fraud and bring immutable trust to the property rental process. It provides a complete ecosystem for landlords, tenants, and third-party verifiers (like banks) to manage and authenticate rental agreements.

The system leverages a powerful combination of third-party KYC, custom AI document analysis, and a gasless blockchain implementation to create a seamless and secure user experience. The core innovation is the "chain of trust," where participants and assets are first verified off-chain before their agreements are permanently sealed on-chain.

<details>
<summary><strong>Click to view the full System Flow & Data Model</strong></summary>

### The Complete System Flow

The system is divided into three main stages: onboarding trusted participants, managing the lifecycle of a rental agreement, and providing public, verifiable proof.

#### Stage 1: Landlord Onboarding & Verification (Establishing Trust)
* **1. Landlord Registration** 👤
    * A new landlord, Niran, signs up using either Google Sign-In or a traditional email and password.
    * **Backend:** Creates a `landlords` record in MongoDB with `emailStatus: 'unverified'` and `kycStatus: 'pending'`. A unique, hashed verification token is generated and saved to the user's record.
    * **Result:** A verification email is sent to Niran. The frontend shows a "Please check your email" message. The user is **not** logged in yet.

* **2. Email Verification** 📧
    * Niran opens his email and clicks the verification link (`.../verify-email/:token`).
    * **Frontend:** The `VerifyEmailPage` opens and sends the token to the backend.
    * **Backend:** The `/api/verify-email` endpoint validates the token. If valid, it updates the landlord's record to `emailStatus: 'verified'`.
    * **Result:** The backend issues a JWT login token. The frontend logs Niran in and automatically redirects him to the `/kyc` page.

* **3. Identity Verification (KYC)** 🕵️‍♂️
    * On the `/kyc` page, Niran clicks "Start Verification."
    * **Backend:** Calls the **Veriff** API to create a secure session.
    * **Frontend:** Niran is redirected to Veriff's UI to scan his government ID and complete a live selfie check.
    * **Webhook:** Veriff's servers send a secure webhook to the backend.
    * **Backend:** Upon an `approved` status, the server updates Niran's record, setting `kycStatus: 'approved'` and updating his name to match the official one from his ID.
    * **Outcome:** Niran is now a **Trusted Landlord**.

* **4. Adding a Property (Landlord-Led)** 🏡
    * On his dashboard, the approved Niran clicks "+ Add New Property."
    * **Frontend:** He fills out a detailed address form and uploads two documents: a **Title Deed** and a recent **Utility Bill**.
    * **Backend (`/api/units`):**
        * Uses **Gemini AI** to perform a multi-step check:
            1.  `checkDocumentAuthenticity`: Ensures the uploaded files are legitimate scans.
            2.  `extractDeedData` & `extractUtilityBillData`: Reads the names and addresses from both documents.
            3.  **3-Way Match:** Confirms the name from the Deed, the Bill, and Niran's verified KYC profile are all the same.
            4.  `compareAddressesAI`: Confirms the address on the Deed and the Bill match each other.
        * If there's a minor address mismatch with his form input, the frontend prompts him to confirm the AI-suggested address.
    * **Outcome:** If all checks pass, the unit is saved with `isVerified: true`, becoming a **Trusted Property**.

#### Stage 2: The Contract Lifecycle (Tenant-Led)

* **5. Tenant Uploads Contract** 📤
    * A tenant, Malee, visits the homepage, uploads her signed `rental-contract.pdf`, and enters her email.
    * **Backend (`/api/contracts/initiate`):**
        * **Duplicate Check:** First checks if this exact contract is already pending or approved.
        * **Gemini AI (`extractContractFingerprint`):** Scans the contract to get the initial fingerprint.
        * **Gemini AI (`findBestUnitMatchAI`):** Intelligently compares the `Unit Info` from the contract against the landlord's property portfolio to find the correct unit, even with typos.
    * **Result:** A `pending_contracts` record is created. Niran is notified.

* **6. Landlord Approval & Blockchain Signature** ✍️🔗
    * Niran sees the pending contract on his dashboard.
    * **Scenario A (Unit is new):** He clicks "Add Unit & Approve." The backend creates a *placeholder* unit with `isVerified: false`, and the contract remains pending.
    * **Scenario B (Unit exists but is unverified):** The "Approve" button is disabled, prompting him to verify the unit's title deed first.
    * **Scenario C (Unit exists and is verified):** He clicks "Approve."
        * **Backend (`/api/approve-contract`):** Reconstructs a **Canonical Fingerprint** using the official, verified data from the database.
        * It calculates the SHA-256 hash of this *corrected* fingerprint (`docHash`).
        * It uses the Admin Wallet to call the `addDocument` function on the smart contract, writing the hash and details to the blockchain.
    * **Email Notification:** The tenant (Malee) immediately receives an email with a sharable link and QR code for the public verification page.

#### Stage 3: Public Verification & Sharing

* **7. Sharing the Proof** 📲
    * The landlord (from their dashboard) or the tenant (from their email) can access and share the unique QR code and verification link.

* **8. Public Verification** 🌍
    * A third party (like a bank) opens the link (`https:/blocklease.site/verify/[docHash]`).
    * **Backend (`/api/verify/:docHash`):**
        1.  Queries the **blockchain** to confirm the `docHash` exists and retrieves the on-chain data.
        2.  Queries **MongoDB** to get the S3 key for the original document. If the off-chain record is missing, it gracefully handles it as a "Terminated" status.
        3.  Generates a **secure, temporary presigned URL** for the document preview.
    * **Result:** The verifier sees a "Certificate of Authenticity" page, displaying the verified on-chain data alongside a preview of the original document.

### Storage & Data Model Summary

| Data Type | Stored In | Method / Details |
| :--- | :--- | :--- |
| **Landlord Personal Data** | MongoDB (`landlords`) | `name` (updated by Veriff), `email`, `hashedPassword`, `kycStatus`, `emailStatus`, `emailVerificationToken`, `authProvider`, `veriffData`. |
| **Landlord Identity Documents** | Veriff's Secure Vault | **NEVER STORED ON YOUR SYSTEM.** Your app only stores the final verification decision from Veriff's webhook. |
| **Property Unit Data** | MongoDB (`units`) | `landlordId`, `unitNumber`, `floor`, detailed `address` object, `isVerified`, `status` (`active`/`archived`), `aiExtractedData`. |
| **Title Deed & Utility Bill Files** | AWS S3 (Private) | Uploaded by the landlord. Verified by your custom **Gemini AI**. Accessed only via secure, temporary presigned URLs. |
| **Pending Rental Contracts** | MongoDB (`pending_contracts`) | Temporary records containing the initial AI-scanned `fingerprint`, the `tenantEmail`, the S3 key for the contract file, and the unit matching status. |
| **Approved Contract Data (Off-Chain)** | MongoDB (`approved_contracts`) | The permanent record. Stores the **corrected/canonical** `docHash` and `fingerprint`, `unitId`, `tenantEmail`, `contractS3Key`, `txHash`, and `status` (`active`/`terminated`). |
| **Approved Contract Record (On-Chain)** | Polygon Blockchain | The smart contract stores the **corrected `docHash`** and key metadata: `landlordName`, `tenantName`, `unitInfo`, `from`, `to`, and a `timestamp`. This data is **public and permanent**. |

</details>

## ✨ Core Features

* **Secure Onboarding Flow:** A multi-step process including **Email Verification**, professional KYC with **Veriff**, and a custom **multi-document AI verification** (Title Deed + Utility Bill) for properties.
* **Intelligent Contract Initiation:** Tenants can upload contracts, and the system uses **Gemini AI** to parse the content and intelligently match it to the correct landlord and property, even with typos.
* **Canonical Fingerprinting:** Ensures data integrity by creating a clean, "canonical" version of contract details before hashing, overriding potential typos from scanned documents with official database records.
* **Gasless Blockchain Transactions:** The system admin wallet sponsors all Polygon blockchain transactions, providing a seamless Web2 experience for all users (no MetaMask or crypto required).
* **Sharable Proof:** Every approved contract generates a unique public URL and QR code, leading to a "Certificate of Authenticity" page that displays on-chain data and the original document.
* **Modern Full-Stack:** Built with React, Node.js, and Tailwind CSS, featuring a polished UI with interactive components, toast notifications, and a premium "Lightbox" document viewer.

## 🛠️ Technology Stack

* **Frontend:** React (Vite), Tailwind CSS, Framer Motion, Recharts, React Leaflet
* **Backend:** Node.js, Express.js
* **Database:** MongoDB Atlas
* **File Storage:** AWS S3 (Private)
* **Blockchain:** Solidity, Polygon (Amoy Testnet), Hardhat, Ethers.js
* **AI / ML:** Google Gemini (via Google AI Studio)
* **Identity Verification (KYC):** Veriff
* **Email Service:** Nodemailer with SendGrid

## 🚀 Getting Started

Follow these instructions to set up and run the project locally.

### Prerequisites

* Node.js (v18 or later)
* npm or yarn
* MongoDB Atlas account
* AWS S3 Bucket
* Google Cloud Console Project (for OAuth Client ID)
* Veriff Account (Free Trial)
* Google AI Studio Account (for Gemini API Key)
* SendGrid Account (for email)

### Backend Setup
1. Navigate to the `backend` directory.
2. Install dependencies: `npm install`
3. Create a `.env` file and populate it with your keys (use `.env.example` as a template).
4. Run the server: `npm run dev`

### Smart Contract Setup
1. Navigate to the `blockchain` directory.
2. Install dependencies: `npm install`
3. Update the `hardhat.config.js` and `.env` file with your details.
4. Compile: `npx hardhat compile`
5. Deploy: `npx hardhat run scripts/deploy.js --network amoy`
6. Copy the deployed contract address into your backend `.env` file.

### Frontend Setup
1. Navigate to the `frontend` directory.
2. Install dependencies: `npm install`
3. Create a `.env.local` file and add your `REACT_APP_GOOGLE_CLIENT_ID`.
4. Run the dev server: `npm run dev`