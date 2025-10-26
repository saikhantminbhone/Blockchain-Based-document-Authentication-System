# DocuChain: AI-Powered Authentication with MongoDB

This is the definitive, runnable full-stack dApp for document verification, now powered by a persistent **MongoDB database**. It uses AI for content fingerprinting and the Base Sepolia blockchain for immutable record-keeping.

## Key Architecture

* **Frontend:** React, TypeScript, Tailwind CSS
* **Backend:** Node.js, Express
* **Database:** MongoDB (via MongoDB Atlas)
* **Blockchain:** Solidity on Base Sepolia

## 🚀 Setup & Installation

**Prerequisites:**
* Node.js (v18+) & npm
* A **MongoDB Atlas** account with a free cluster.
* An account on **Infura** or **Alchemy** for a Base Sepolia RPC URL.

### Step 1: Get Your MongoDB Connection URI

1.  Create a free cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2.  In your cluster, go to `Database Access` and create a database user with a username and password.
3.  Go to `Network Access` and add your current IP address to the access list.
4.  Go to `Databases`, click `Connect`, choose `Drivers`, and copy the **Connection String (URI)**. Replace `<username>` and `<password>` with the credentials you created.

### Step 2: Configure the Backend Environment

In the `/backend` directory, create a `.env` file from the example:
```bash
cp .env.example .env

# Install Blockchain dependencies
cd blockchain
npm install

# Install Backend dependencies
cd ../backend
npm install

# Install Frontend dependencies
cd ../frontend
npm install


step - 4 deploy smart contracts
# From the /blockchain directory
npx hardhat compile
npx hardhat run scripts/deploy.js --network amoy


Step 5: Run the Application
# From the /backend directory
node server.js