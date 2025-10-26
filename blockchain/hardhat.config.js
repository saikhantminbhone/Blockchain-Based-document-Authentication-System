require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: '../backend/.env' });

const { BASE_SMOY_RPC_URL, ADMIN_PRIVATE_KEY } = process.env;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",
  networks: {
    amoy: {
      url: BASE_SMOY_RPC_URL || "",
      accounts: ADMIN_PRIVATE_KEY ? [ADMIN_PRIVATE_KEY] : [],
    },
  },
};