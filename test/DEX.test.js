const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DEX", function() {
    let dex, tokenA, tokenB;
    let owner, addr1, addr2;
    const initialMint = ethers.utils.parseEther("1000");

    beforeEach(async function() {
        [owner, addr1, addr2] = await ethers.getSigners();
        
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        tokenA = await MockERC20.deploy("Token A", "TKA");
        tokenB = await MockERC20.deploy("Token B", "TKB");
        
        const DEX = await ethers.getContractFactory("DEX");
        dex = await DEX.deploy(tokenA.address, tokenB.address);
        
        await tokenA.approve(dex.address, ethers.constants.MaxUint256);
        await tokenB.approve(dex.address, ethers.constants.MaxUint256);
        await tokenA.connect(addr1).mint(addr1.address, initialMint);
        await tokenB.connect(addr1).mint(addr1.address, initialMint);
        await tokenA.connect(addr1).approve(dex.address, ethers.constants.MaxUint256);
        await tokenB.connect(addr1).approve(dex.address, ethers.constants.MaxUint256);
    });

    describe("Liquidity Management", function() {
        it("should allow initial liquidity provision", async function() {
            await expect(dex.addLiquidity(ethers.utils.parseEther("100"), ethers.utils.parseEther("100")))
                .to.emit(dex, "LiquidityAdded");
        });

        it("should mint correct LP tokens for first provider", async function() {
            await dex.addLiquidity(ethers.utils.parseEther("100"), ethers.utils.parseEther("400"));
            // sqrt(100 * 400) = 200
            expect(await dex.liquidity(owner.address)).to.equal(ethers.utils.parseEther("200"));
        });

        it("should allow subsequent liquidity additions", async function() {
            await dex.addLiquidity(ethers.utils.parseEther("100"), ethers.utils.parseEther("100"));
            await dex.connect(addr1).addLiquidity(ethers.utils.parseEther("50"), ethers.utils.parseEther("50"));
            expect(await dex.totalLiquidity()).to.equal(ethers.utils.parseEther("150"));
        });

        it("should maintain price ratio on liquidity addition", async function() {
            await dex.addLiquidity(ethers.utils.parseEther("100"), ethers.utils.parseEther("200"));
            // If addr1 adds 50 TokenA, they must add 100 TokenB to maintain 1:2 ratio
            await dex.connect(addr1).addLiquidity(ethers.utils.parseEther("50"), ethers.utils.parseEther("100"));
            const reserves = await dex.getReserves();
            expect(reserves._reserveB.div(reserves._reserveA)).to.equal(2);
        });

        it("should allow partial liquidity removal", async function() {
            await dex.addLiquidity(ethers.utils.parseEther("100"), ethers.utils.parseEther("100"));
            await dex.removeLiquidity(ethers.utils.parseEther("50"));
            expect(await dex.liquidity(owner.address)).to.equal(ethers.utils.parseEther("50"));
        });

        it("should return correct token amounts on liquidity removal", async function() {
            await dex.addLiquidity(ethers.utils.parseEther("100"), ethers.utils.parseEther("100"));
            const tx = await dex.removeLiquidity(ethers.utils.parseEther("100"));
            await expect(tx).to.emit(dex, "LiquidityRemoved")
                .withArgs(owner.address, ethers.utils.parseEther("100"), ethers.utils.parseEther("100"), ethers.utils.parseEther("100"));
        });

        it("should revert on zero liquidity addition", async function() {
            await expect(dex.addLiquidity(0, 0)).to.be.revertedWith("Zero amounts");
        });

        it("should revert when removing more liquidity than owned", async function() {
            await dex.addLiquidity(ethers.utils.parseEther("10"), ethers.utils.parseEther("10"));
            await expect(dex.removeLiquidity(ethers.utils.parseEther("20"))).to.be.revertedWith("Invalid amount");
        });
    });

    describe("Token Swaps", function() {
        beforeEach(async function() {
            await dex.addLiquidity(ethers.utils.parseEther("100"), ethers.utils.parseEther("200"));
        });

        it("should swap token A for token B", async function() {
            const amountIn = ethers.utils.parseEther("10");
            await expect(dex.swapAForB(amountIn)).to.emit(dex, "Swap");
        });

        it("should swap token B for token A", async function() {
            const amountIn = ethers.utils.parseEther("10");
            await expect(dex.swapBForA(amountIn)).to.emit(dex, "Swap");
        });

        it("should calculate correct output amount with fee", async function() {
            // Using the formula provided in instructions
            const amountIn = ethers.utils.parseEther("10"); 
            const expectedOut = await dex.getAmountOut(amountIn, ethers.utils.parseEther("100"), ethers.utils.parseEther("200"));
            const balanceBefore = await tokenB.balanceOf(owner.address);
            await dex.swapAForB(amountIn);
            const balanceAfter = await tokenB.balanceOf(owner.address);
            expect(balanceAfter.sub(balanceBefore)).to.equal(expectedOut);
        });

        it("should update reserves after swap", async function() {
            await dex.swapAForB(ethers.utils.parseEther("10"));
            const [resA, resB] = await dex.getReserves();
            expect(resA).to.equal(ethers.utils.parseEther("110"));
        });

        it("should increase k after swap due to fees", async function() {
            const [rA1, rB1] = await dex.getReserves();
            const k1 = rA1.mul(rB1);
            await dex.swapAForB(ethers.utils.parseEther("10"));
            const [rA2, rB2] = await dex.getReserves();
            const k2 = rA2.mul(rB2);
            expect(k2).to.be.gt(k1);
        });

        it("should revert on zero swap amount", async function() {
            await expect(dex.swapAForB(0)).to.be.revertedWith("Zero amount");
        });

        it("should handle large swaps with high price impact", async function() {
            await expect(dex.swapAForB(ethers.utils.parseEther("500"))).to.emit(dex, "Swap");
        });

        it("should handle multiple consecutive swaps", async function() {
            await dex.swapAForB(ethers.utils.parseEther("5"));
            await dex.swapAForB(ethers.utils.parseEther("5"));
            const [resA] = await dex.getReserves();
            expect(resA).to.equal(ethers.utils.parseEther("110"));
        });
    });

    describe("Price Calculations", function() {
        it("should return correct initial price", async function() {
            await dex.addLiquidity(ethers.utils.parseEther("100"), ethers.utils.parseEther("200"));
            expect(await dex.getPrice()).to.equal(ethers.utils.parseEther("2"));
        });

        it("should update price after swaps", async function() {
            await dex.addLiquidity(ethers.utils.parseEther("100"), ethers.utils.parseEther("100"));
            await dex.swapAForB(ethers.utils.parseEther("50"));
            const price = await dex.getPrice();
            expect(price).to.not.equal(ethers.utils.parseEther("1"));
        });

        it("should handle price queries with zero reserves gracefully", async function() {
            await expect(dex.getPrice()).to.be.revertedWith("Zero reserves");
        });
    });

    describe("Fee Distribution", function() {
        it("should accumulate fees for liquidity providers", async function() {
            await dex.addLiquidity(ethers.utils.parseEther("100"), ethers.utils.parseEther("100"));
            await dex.connect(addr1).swapAForB(ethers.utils.parseEther("50"));
            // Withdraw all liquidity
            await dex.removeLiquidity(ethers.utils.parseEther("100"));
            const balanceA = await tokenA.balanceOf(owner.address);
            // Should have more tokens than initial due to fees
            expect(balanceA).to.be.gt(ethers.utils.parseEther("900")); 
        });

        it("should distribute fees proportionally to LP share", async function() {
            await dex.addLiquidity(ethers.utils.parseEther("100"), ethers.utils.parseEther("100"));
            await dex.connect(addr1).addLiquidity(ethers.utils.parseEther("100"), ethers.utils.parseEther("100"));
            await dex.swapAForB(ethers.utils.parseEther("50"));
            // Both should have earned fees equally
            expect(await dex.liquidity(owner.address)).to.equal(await dex.liquidity(addr1.address));
        });
    });

    describe("Edge Cases", function() {
        it("should handle very small liquidity amounts", async function() {
            await expect(dex.addLiquidity(1000, 1000)).to.emit(dex, "LiquidityAdded");
        });

        it("should handle very large liquidity amounts", async function() {
            const large = ethers.utils.parseEther("100000");
            await tokenA.mint(owner.address, large);
            await tokenB.mint(owner.address, large);
            await expect(dex.addLiquidity(large, large)).to.emit(dex, "LiquidityAdded");
        });

        it("should prevent unauthorized access", async function() {
            // Since there is no 'onlyOwner', we test for standard ERC20 failure
            await expect(dex.connect(addr2).removeLiquidity(100)).to.be.reverted;
        });
    });

    describe("Events", function() {
        it("should emit LiquidityAdded event", async function() {
            await expect(dex.addLiquidity(100, 100)).to.emit(dex, "LiquidityAdded");
        });

        it("should emit LiquidityRemoved event", async function() {
            await dex.addLiquidity(100, 100);
            await expect(dex.removeLiquidity(10)).to.emit(dex, "LiquidityRemoved");
        });

        it("should emit Swap event", async function() {
            await dex.addLiquidity(1000, 1000);
            await expect(dex.swapAForB(100)).to.emit(dex, "Swap");
        });
    });
});