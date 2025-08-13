# Block Lease: A Blockchain-Based Document Authentication System

**Document Version:** 1.0 | **Last Updated:** August 9, 2025

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
    * A new landlord signs up using either Google Sign-In or a traditional email and password.
    * **Backend:** A `landlords` record is created in MongoDB with `kycStatus: 'pending'`.
    * **Result:** The landlord is automatically logged in and redirected to the `/kyc` verification page.

* **2. Identity Verification (KYC)** 🕵️‍♂️
    * On the `/kyc` page, the landlord starts the verification process.
    * **Backend:** Calls the **Veriff** API to create a secure, backend-driven session for personal identity verification.
    * **Frontend:** The landlord is redirected to Veriff's UI to scan their government ID and complete a live selfie check.
    * **Webhook:** Veriff's servers send a secure webhook to the backend with the result.
    * **Backend:** Upon receiving an `approved` status, the server updates the landlord's record, setting `kycStatus: 'approved'` and updating their name to match the official one from their ID.
    * **Outcome:** The user is now a **Trusted Landlord**.

* **3. Adding a Property (Landlord-Led)** 🏡
    * On the dashboard, the approved landlord clicks "+ Add New Property."
    * **Frontend:** They fill out a detailed address form and upload two documents: a **Title Deed** and a recent **Utility Bill**.
    * **Backend (`/api/units`):**
        * Receives the form data and both files.
        * Uses **Gemini AI** to perform a multi-step check:
            1.  `checkDocumentAuthenticity`: Ensures the uploaded files are legitimate scans.
            2.  `extractDeedData` & `extractUtilityBillData`: Reads the names and addresses from both documents.
            3.  **3-Way Match:** Confirms the name from the Deed, the Bill, and the landlord's verified KYC profile are the same.
            4.  `compareAddressesAI`: Confirms the address on the Deed and the Bill match.
        * If there's a minor address mismatch with the form input, the frontend prompts for confirmation.
    * **Outcome:** If all checks pass, the unit is saved to the `units` collection with `isVerified: true`, becoming a **Trusted Property**.

#### Stage 2: The Contract Lifecycle (Tenant-Led)
This is the core flow for handling a new rental agreement.

* **4. Tenant Uploads Contract** 📤
    * A tenant visits the homepage, uploads their signed `rental-contract.pdf`, and enters their email.
    * **Backend (`/api/contracts/initiate`):**
        * **Gemini AI (`extractContractFingerprint`):** Scans the contract to get the initial fingerprint (Landlord Name, Tenant Name, Unit Info, etc.).
        * **Gemini AI (`findBestUnitMatchAI`):** Intelligently compares the `Unit Info` from the contract against the landlord's list of official properties to find the correct unit, even with typos.
    * **Result:** A `pending_contracts` record is created in MongoDB. Niran is notified.

* **5. Landlord Approval & Blockchain Signature** ✍️🔗
    * The landlord sees the pending contract on their dashboard.
    * **Scenario A (Unit is new):** They click "Add Unit & Approve." The backend creates a *placeholder* unit with `isVerified: false`, and the contract remains pending.
    * **Scenario B (Unit exists but is unverified):** The "Approve" button is disabled, prompting the landlord to verify the unit's title deed first.
    * **Scenario C (Unit exists and is verified):** They click "Approve."
        * **Backend (`/api/approve-contract`):** Reconstructs a **Canonical Fingerprint** using the official, verified data from the database.
        * It calculates the SHA-256 hash of this *corrected* fingerprint (`docHash`).
        * It uses the Admin Wallet to call the `addDocument` function on the smart contract, writing the hash and details to the blockchain.
    * **Email Notification:** The tenant immediately receives an email with a sharable link and QR code to the public verification page.

#### Stage 3: Public Verification & Sharing
This stage demonstrates the system's value.

* **6. Sharing the Proof** 📲
    * The landlord (from their dashboard) or the tenant (from their email) can access and share the unique QR code and verification link.

* **7. Public Verification** 🌍
    * A third party (like a bank) opens the link (`https://.../verify/[docHash]`).
    * **Backend (`/api/verify/:docHash`):**
        1.  Queries the **blockchain** to confirm the `docHash` exists and retrieves the on-chain data.
        2.  Queries **MongoDB** to get the S3 key for the original document.
        3.  Generates a **secure, temporary presigned URL** for the document preview.
    * **Result:** The verifier sees an impressive "Certificate of Authenticity" page, displaying the verified on-chain data alongside a preview of the original document.

### Storage & Data Model Summary

| Data Type | Stored In | Method / Details |
| :--- | :--- | :--- |
| **Landlord Personal Data** | MongoDB (`landlords`) | `name` (updated by Veriff), `email`, `hashedPassword`, `kycStatus`, `authProvider` (google/email), and detailed `veriffData`. |
| **Landlord Identity Documents** | Veriff's Secure Vault | **NEVER STORED ON YOUR SYSTEM.** Your app only stores the final verification decision (`approved`/`failed`) from Veriff's secure webhook. |
| **Property Unit Data** | MongoDB (`units`) | `landlordId`, `unitNumber`, `floor`, and a detailed `address` object. Also stores `isVerified` status and data extracted by your AI (`aiExtractedData`). |
| **Title Deed & Utility Bill Files** | AWS S3 (Private) | Uploaded by the landlord for a specific unit. Verified by your custom **Gemini AI**. Accessed only via secure, temporary presigned URLs. |
| **Pending Rental Contracts** | MongoDB (`pending_contracts`) | Temporary records containing the initial AI-scanned `fingerprint`, the `tenantEmail`, the S3 key for the contract file, and the unit matching status. |
| **Approved Contract Data (Off-Chain)** | MongoDB (`approved_contracts`) | The permanent record. Stores the **corrected/canonical** `docHash` and `fingerprint`, `unitId`, `tenantEmail`, `contractS3Key`, and the blockchain transaction hash (`txHash`). |
| **Approved Contract Record (On-Chain)** | Polygon Blockchain | The smart contract stores the **corrected `docHash`** and key metadata: `landlordName`, `tenantName`, `unitInfo`, `from`, `to`, and a `timestamp`. This data is **public and permanent**. |

</details>

## ✨ Core Features

* **Multi-Factor Onboarding:** Secure landlord registration using both professional KYC (**Veriff**) and custom AI analysis (**Google Gemini**) for identity and property documents.
* **Intelligent Contract Initiation:** Tenants can upload contracts, and the system uses AI to parse the content and intelligently match it to the correct landlord and property.
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

1.  Navigate to the `backend` directory:
    ```bash
    cd backend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Create a `.env` file in the `backend` root and populate it with your keys. Use `.env.example` as a template.
4.  Run the backend server:
    ```bash
    npm run dev
    ```

### Smart Contract Setup

1.  Navigate to the `blockchain` directory:
    ```bash
    cd blockchain
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Update the `hardhat.config.js` and `.env` file in this directory with your `ADMIN_PRIVATE_KEY` and Amoy RPC URL.
4.  Compile the contract:
    ```bash
    npx hardhat compile
    ```
5.  Deploy to the Amoy testnet:
    ```bash
    npx hardhat run scripts/deploy.js --network amoy
    ```
6.  Copy the deployed contract address and update your backend `.env` file.

### Frontend Setup

1.  Navigate to the `frontend` directory:
    ```bash
    cd frontend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Create a `.env.local` file in the `frontend` root and add your Google Client ID:
    ```
    REACT_APP_GOOGLE_CLIENT_ID="YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com"
    ```
4.  Run the frontend development server:
    ```bash
    npm run dev
    ```
The application should now be running, typically at `http://localhost:5173`.


