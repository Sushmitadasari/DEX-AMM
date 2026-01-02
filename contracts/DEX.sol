// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

contract DEX is ReentrancyGuard {
    address public tokenA;
    address public tokenB;
    uint256 public reserveA;
    uint256 public reserveB;
    uint256 public totalLiquidity;
    mapping(address => uint256) public liquidity;

    event LiquidityAdded(address indexed provider, uint256 amountA, uint256 amountB, uint256 liquidityMinted);
    event LiquidityRemoved(address indexed provider, uint256 amountA, uint256 amountB, uint256 liquidityBurned);
    event Swap(address indexed trader, address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut);

    constructor(address _tokenA, address _tokenB) {
        tokenA = _tokenA;
        tokenB = _tokenB;
    }

    function addLiquidity(uint256 amountA, uint256 amountB) external nonReentrant returns (uint256 liquidityMinted) {
        require(amountA > 0 && amountB > 0, "Zero amounts");
        if (totalLiquidity == 0) {
            liquidityMinted = Math.sqrt(amountA * amountB);
        } else {
            liquidityMinted = Math.min((amountA * totalLiquidity) / reserveA, (amountB * totalLiquidity) / reserveB);
        }
        require(liquidityMinted > 0, "Insufficient liquidity");
        IERC20(tokenA).transferFrom(msg.sender, address(this), amountA);
        IERC20(tokenB).transferFrom(msg.sender, address(this), amountB);
        reserveA += amountA;
        reserveB += amountB;
        totalLiquidity += liquidityMinted;
        liquidity[msg.sender] += liquidityMinted;
        emit LiquidityAdded(msg.sender, amountA, amountB, liquidityMinted);
    }

    function removeLiquidity(uint256 liquidityAmount) external nonReentrant returns (uint256 amountA, uint256 amountB) {
        require(liquidityAmount > 0 && liquidity[msg.sender] >= liquidityAmount, "Invalid amount");
        amountA = (liquidityAmount * reserveA) / totalLiquidity;
        amountB = (liquidityAmount * reserveB) / totalLiquidity;
        liquidity[msg.sender] -= liquidityAmount;
        totalLiquidity -= liquidityAmount;
        reserveA -= amountA;
        reserveB -= amountB;
        IERC20(tokenA).transfer(msg.sender, amountA);
        IERC20(tokenB).transfer(msg.sender, amountB);
        emit LiquidityRemoved(msg.sender, amountA, amountB, liquidityAmount);
    }

    function swapAForB(uint256 amountAIn) external nonReentrant returns (uint256 amountBOut) {
        require(amountAIn > 0, "Zero amount");
        amountBOut = getAmountOut(amountAIn, reserveA, reserveB);
        IERC20(tokenA).transferFrom(msg.sender, address(this), amountAIn);
        IERC20(tokenB).transfer(msg.sender, amountBOut);
        reserveA += amountAIn;
        reserveB -= amountBOut;
        emit Swap(msg.sender, tokenA, tokenB, amountAIn, amountBOut);
    }

    function swapBForA(uint256 amountBIn) external nonReentrant returns (uint256 amountAOut) {
        require(amountBIn > 0, "Zero amount");
        amountAOut = getAmountOut(amountBIn, reserveB, reserveA);
        IERC20(tokenB).transferFrom(msg.sender, address(this), amountBIn);
        IERC20(tokenA).transfer(msg.sender, amountAOut);
        reserveB += amountBIn;
        reserveA -= amountAOut;
        emit Swap(msg.sender, tokenB, tokenA, amountBIn, amountAOut);
    }

    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) public pure returns (uint256 amountOut) {
        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 1000) + amountInWithFee;
        return numerator / denominator;
    }

    function getPrice() external view returns (uint256 price) {
        require(reserveA > 0, "Zero reserves");
        return (reserveB * 1e18) / reserveA;
    }

    function getReserves() external view returns (uint256 _reserveA, uint256 _reserveB) {
        return (reserveA, reserveB);
    }
}