const hre = require("hardhat");

async function main() {
  const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
  const tokenA = await MockERC20.deploy("Token A", "TKA");
  const tokenB = await MockERC20.deploy("Token B", "TKB");

  await tokenA.deployed();
  await tokenB.deployed();

  const DEX = await hre.ethers.getContractFactory("DEX");
  const dex = await DEX.deploy(tokenA.address, tokenB.address);

  await dex.deployed();

  console.log(`Token A deployed to: ${tokenA.address}`);
  console.log(`Token B deployed to: ${tokenB.address}`);
  console.log(`DEX deployed to: ${dex.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});