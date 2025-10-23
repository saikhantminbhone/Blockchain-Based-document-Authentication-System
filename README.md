# Block Lease: A Blockchain-Based Document Authentication System

**Document Version:** 1.2
**Last Updated:** August 29, 2025

A final year project demonstrating a full-stack, AI-powered document authentication platform for the real estate rental market, secured by blockchain technology.

## 📖 Project Overview

Block Lease is a sophisticated web application designed to combat document fraud and bring immutable trust to the property rental process. It provides a complete ecosystem for landlords, tenants, and third-party verifiers (like banks) to manage and authenticate rental agreements.

The system leverages a powerful combination of third-party KYC, custom AI document analysis, and a gasless blockchain implementation to create a seamless and secure user experience. The core innovation is the "chain of trust," where participants and assets are first verified off-chain before their agreements are permanently sealed on-chain.

<details>
<summary><strong>Click to view the full System Flow & Data Model</strong></summary>

### The Complete System Flow

The system is divided into three main stages: onboarding trusted participants, managing the lifecycle of a rental agreement, and providing public, verifiable proof.

#### Stage 1: Landlord Onboarding & Verification (Establishing Trust)
* **1. Landlord Registration & Email Verification** 👤
    * A new landlord signs up using Google Sign-In or an email/password.
    * **Backend:** Creates a `landlords` record with `emailStatus: 'unverified'` and sends a time-sensitive verification link.
    * **Result:** The user must click the link in their email to verify their account, at which point they are logged in and redirected to the KYC page.

* **2. Identity Verification (KYC)** 🕵️‍♂️
    * On the `/kyc` page, the landlord starts a secure session with **Veriff**.
    * **Webhook:** Veriff's servers send a secure webhook to the backend. Upon an `approved` status, the server updates the landlord's record to `kycStatus: 'approved'` and updates their name to match the official one from their ID.
    * **Outcome:** The user is now a **Trusted Landlord**.

* **3. Property Verification (Landlord-Led)** 🏡
    * On their dashboard, the approved landlord adds a property, filling out a detailed address form and uploading a **Title Deed** and a recent **Utility Bill**.
    * **Backend (`/api/units`):**
        * Uses **Gemini AI** to perform a multi-step check:
            1.  `checkDocumentAuthenticity`: Ensures the uploaded files are legitimate scans.
            2.  `extractDeedData` & `extractUtilityBillData`: Reads the names and addresses from both documents.
            3.  **3-Way Match:** Confirms the name from the Deed, the Bill, and the landlord's verified KYC profile are all the same.
            4.  `compareAddressesAI`: Confirms the address on the Deed and the Bill match each other.
        * If there's a minor address mismatch with the form input, the frontend prompts for confirmation.
    * **Outcome:** If all checks pass, the unit is saved with `isVerified: true`, becoming a **Trusted Property**.

#### Stage 2: The Contract Lifecycle (Tenant-Led)

* **4. Tenant Uploads Contract** 📤
    * A tenant visits the homepage, uploads their signed `rental-contract.pdf`, and enters their email.
    * **Backend (`/api/contracts/initiate`):**
        * **AI Validation Pipeline:** First classifies the document to ensure it's a contract, rejecting random photos.
        * **Duplicate Check:** Checks if this exact contract is already pending or approved.
        * **AI Fingerprinting & Matching:** Scans the contract to get the initial fingerprint and intelligently matches the `Unit Info` against the landlord's property portfolio.
    * **Result:** A `pending_contracts` record is created. The landlord is notified.

* **5. Landlord Approval & Blockchain Signature** ✍️🔗
    * The landlord sees the pending contract on their dashboard. Approval is blocked if the associated unit is not yet verified.
    * Upon clicking "Approve," the backend reconstructs a **Canonical Fingerprint** using the official, verified data from the database.
    * It calculates the SHA-256 hash of this *corrected* fingerprint (`docHash`) and uses the Admin Wallet to call the `addDocument` function on the smart contract.
    * **Email Notification:** The tenant immediately receives an email with a sharable link and QR code for the public verification page.

#### Stage 3: Public Verification & Sharing

This stage has two distinct paths for a third party to verify a document.

* **6. Verification by Direct Upload (Homepage)** 🔍
    * A third party (like a bank) visits the homepage and uploads a contract file to the main verifier tool.
    * **Backend (`/api/verify-document`):** Re-generates the canonical fingerprint, hashes it, and checks the blockchain for a match.
    * **Result:** If a match is found, the user is automatically redirected to the official, sharable "Certificate of Authenticity" page for that document.

* **7. Verification by Sharable Link** 📲
    * A landlord (from their dashboard) or a tenant (from their email) shares the unique QR code or verification link (e.g., `https://.../verify/[docHash]`).
    * A third party opens the link.
    * **Backend (`/api/verify/:docHash`):**
        1.  Queries the **blockchain** with the `docHash` to confirm it exists and retrieve the on-chain data.
        2.  Queries **MongoDB** to get the S3 key for the original document. If the off-chain record is missing, it gracefully handles it as a "Terminated" status.
        3.  Generates a **secure, temporary presigned URL** for the document preview.
    * **Result:** The verifier sees the "Certificate of Authenticity" page, displaying the verified on-chain data alongside a preview of the original document.

### Storage & Data Model Summary

| Data Type | Stored In | Method / Details |
| :--- | :--- | :--- |
| **Landlord Personal Data** | MongoDB (`landlords`) | `name` (updated by Veriff), `email`, `hashedPassword`, `kycStatus`, `emailStatus`, `authProvider`, `veriffData`. |
| **Landlord Identity Documents** | Veriff's Secure Vault | **NEVER STORED ON YOUR SYSTEM.** Your app only stores the final verification decision from Veriff's webhook. |
| **Property Unit Data** | MongoDB (`units`) | `landlordId`, `unitNumber`, `floor`, detailed `address` object, `isVerified`, `status` (`active`/`archived`), `aiExtractedData`. |
| **Title Deed & Utility Bill Files** | AWS S3 (Private) | Uploaded by the landlord. Verified by your custom **Gemini AI**. Accessed only via secure, temporary presigned URLs. |
| **Pending Rental Contracts** | MongoDB (`pending_contracts`) | Temporary records containing the initial AI-scanned `fingerprint`, the `tenantEmail`, the S3 key for the contract file, and the unit matching status. |
| **Approved Contract Data (Off-Chain)** | MongoDB (`approved_contracts`) | The permanent record. Stores the **corrected/canonical** `docHash` and `fingerprint`, `unitId`, `tenantEmail`, `contractS3Key`, `txHash`, and `status` (`active`/`terminated`). |
| **Approved Contract Record (On-Chain)** | Polygon Blockchain | The smart contract stores the **corrected `docHash`** and key metadata: `landlordName`, `tenantName`, `unitInfo`, `from`, `to`, and a `timestamp`. This data is **public and permanent**. |

</details>

## ✨ Core Features

* **Secure Onboarding Flow:** A multi-step process including **Email Verification**, professional KYC with **Veriff**, and a custom **multi-document AI verification** (Title Deed + Utility Bill) for properties.
* **Intelligent Contract Initiation:** An advanced AI pipeline classifies documents to reject non-contracts, prevents duplicate submissions, and intelligently matches contract details to the correct landlord and property.
* **Canonical Fingerprinting:** Ensures data integrity by creating a clean, "canonical" version of contract details before hashing, overriding potential typos from scanned documents with official database records.
* **Gasless Blockchain Transactions:** The system admin wallet sponsors all Polygon blockchain transactions, providing a seamless Web2 experience for all users.
* **Dual Verification Methods:** A public-facing tool for verification by direct upload, and a sharable URL/QR code for viewing a specific "Certificate of Authenticity."
* **Lifecycle Management:** Landlords can terminate active contracts and archive/restore properties from their dashboard.
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