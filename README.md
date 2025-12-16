# Block Lease: A Blockchain-Based Document Authentication System

**Document Version:** 1.3  
**Last Updated:** December 16, 2025

A final year project demonstrating a full-stack, AI-powered document authentication platform for the real estate rental market, secured by blockchain technology.

## 📖 Project Overview

Block Lease is a sophisticated web application designed to combat document fraud and bring immutable trust to the property rental process. It provides a complete ecosystem for landlords, tenants, and third-party verifiers (like banks) to manage and authenticate rental agreements.

The system leverages a powerful combination of third-party KYC, custom AI document analysis, and a gasless blockchain implementation to create a seamless and secure user experience. The core innovation is the **"Human-in-the-Loop" architecture**, where AI acts as an intelligent assistant to verify assets off-chain before agreements are permanently sealed on-chain.

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

* **3. Property Verification (Human-in-the-Loop)** 🏡
    * **Step A: Profile Creation:** The landlord creates a property profile manually (filling in address, unit number, etc.) via the "Add Unit" modal.
    * **Step B: Deed Verification:** The landlord clicks "Verify" on the unit and uploads a **Title Deed (Chanote)**.
    * **Backend AI Analysis:**
        1.  **Classification:** Ensures the document is a valid Thai Title Deed.
        2.  **Extraction:** Reads the Owner Name and Property Address using OCR.
        3.  **Semantic Comparison:** The AI compares the extracted data against the database record and generates a confidence score.
    * **Step C: Human Review:** The landlord sees the AI's findings in a popup. They can correct any AI reading errors and must explicitly "Confirm" the data matches.
    * **Outcome:** The unit is marked as `isVerified: true`, becoming a **Trusted Property**.

#### Stage 2: The Contract Lifecycle (Tenant-Led)

* **4. Tenant Uploads Contract** 📤
    * A tenant visits the homepage, uploads their signed `rental-contract.pdf`, and enters their email.
    * **Backend (`/api/contracts/initiate`):**
        * **AI Validation Pipeline:** Classifies the document to ensure it's a contract.
        * **Duplicate Check:** Checks if this exact contract is already pending or approved.
        * **AI Fingerprinting & Matching:** Scans the contract to get the initial fingerprint and intelligently matches the `Unit Info` against the landlord's property portfolio.
    * **Result:** A `pending_contracts` record is created. The landlord is notified.

* **5. Landlord Approval & Blockchain Signature** ✍️🔗
    * The landlord sees the pending contract on their dashboard.
    * **Unmatched Units:** If the contract is for a new unit, the landlord can "Add Unit & Approve" in one flow.
    * **Unverified Units:** Approval is blocked until the landlord verifies the unit's Title Deed.
    * **Blockchain Write:** Upon clicking "Approve," the backend calculates the SHA-256 hash of the canonical fingerprint (`docHash`) and uses the Admin Wallet to call the `addDocument` function on the smart contract.
    * **Email Notification:** The tenant immediately receives an email with a sharable link and QR code for the public verification page.

#### Stage 3: Public Verification & Sharing

This stage has two distinct paths for a third party to verify a document.

* **6. Verification by Direct Upload (Homepage)** 🔍
    * A third party (like a bank) visits the homepage and uploads a contract file to the main verifier tool.
    * **Backend:** Re-generates the fingerprint, hashes it, and checks the blockchain for a match.
    * **Result:** If a match is found, the user is automatically redirected to the official "Certificate of Authenticity" page.

* **7. Verification by Sharable Link** 📲
    * A landlord (via the Dashboard Share button) or a tenant (via Email) shares the unique link (e.g., `https://.../verify/[docHash]`).
    * A third party opens the link.
    * **Backend:**
        1.  Queries the **blockchain** to confirm the hash exists.
        2.  Queries **MongoDB** to get the S3 key for the original document.
        3.  Checks if the contract status is `terminated` (revoked).
    * **Result:** The verifier sees the "Certificate of Authenticity" page, displaying the verified on-chain data, status, and a preview of the original document.

### Storage & Data Model Summary

| Data Type | Stored In | Method / Details |
| :--- | :--- | :--- |
| **Landlord Personal Data** | MongoDB (`landlords`) | `name` (updated by Veriff), `email`, `hashedPassword`, `kycStatus`, `veriffData`. |
| **Property Unit Data** | MongoDB (`units`) | `landlordId`, `unitNumber`, `address`, `isVerified`, `status` (`active`/`archived`), `deedData` (verified data). |
| **Title Deed Files** | AWS S3 (Private) | Uploaded by the landlord. Verified by **Gemini AI + Human Confirmation**. Accessed only via secure, temporary presigned URLs. |
| **Pending Rental Contracts** | MongoDB (`pending_contracts`) | Temporary records containing the initial AI-scanned `fingerprint`, `tenantEmail`, and S3 key. |
| **Approved Contract Data (Off-Chain)** | MongoDB (`approved_contracts`) | The permanent record. Stores the **canonical** `docHash` and `fingerprint`, `unitId`, `txHash`, and `status`. |
| **Approved Contract Record (On-Chain)** | Polygon Blockchain | The smart contract stores the **`docHash`** and metadata: `landlordName`, `tenantName`, `unitInfo`, `from`, `to`, and `timestamp`. |

</details>

## ✨ Core Features

* **Secure Onboarding Flow:** A multi-step process including **Email Verification** and professional identity verification with **Veriff**.
* **Human-in-the-Loop AI Verification:** Properties are verified using a hybrid approach. AI extracts data from the **Title Deed**, and the landlord reviews/edits the data before confirmation. This ensures high reliability even if OCR makes minor errors.
* **Intelligent Contract Initiation:** An advanced AI pipeline classifies documents to reject non-contracts and intelligently matches contract details to the correct landlord and property in the system.
* **Canonical Fingerprinting:** Ensures data integrity by creating a clean, "canonical" version of contract details before hashing, ensuring the blockchain record is accurate.
* **Gasless Blockchain Transactions:** The system admin wallet sponsors all Polygon blockchain transactions, providing a seamless Web2 experience for all users.
* **Dual Verification Methods:** A public-facing tool for verification by direct upload, and a sharable URL/QR code for viewing a specific "Certificate of Authenticity."
* **Lifecycle Management:** Landlords can terminate active contracts, archive/restore properties, and share verification links directly from their dashboard.

## 🛠️ Technology Stack

* **Frontend:** React (Vite), Tailwind CSS, Framer Motion, Recharts, React Leaflet
* **Backend:** Node.js, Express.js
* **Database:** MongoDB Atlas
* **File Storage:** AWS S3 (Private)
* **Blockchain:** Solidity, Polygon (Amoy Testnet), Hardhat, Ethers.js
* **AI / ML:** Google Gemini (via Google AI Studio) & Tesseract.js (OCR)
* **Identity Verification (KYC):** Veriff
* **Email Service:** Nodemailer with SendGrid

## 🚀 Getting Started

Follow these instructions to set up and run the project locally.

### Prerequisites

* Node.js (v18 or later)
* MongoDB Atlas account
* AWS S3 Bucket
* Veriff Account (Free Trial)
* Google AI Studio Account (for Gemini API Key)

### Backend Setup
1. Navigate to the `backend` directory.
2. Install dependencies: `npm install`
3. Create a `.env` file and populate it with your keys (use `.env.example` as a template).
4. Run the server: `npm run dev`

### Smart Contract Setup
1. Navigate to the `blockchain` directory.
2. Install dependencies: `npm install`
3. Compile: `npx hardhat compile`
4. Deploy: `npx hardhat run scripts/deploy.js --network amoy`
5. Copy the deployed contract address into your backend `.env` file.

### Frontend Setup
1. Navigate to the `frontend` directory.
2. Install dependencies: `npm install`
3. Create a `.env.local` file and add your `REACT_APP_GOOGLE_CLIENT_ID`.
4. Run the dev server: `npm run dev`