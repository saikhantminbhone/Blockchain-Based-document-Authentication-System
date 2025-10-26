const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const registry = await hre.ethers.deployContract("DocumentRegistry");
  await registry.waitForDeployment();

  console.log(`DocumentRegistry deployed to: ${registry.target}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});