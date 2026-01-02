# DEX AMM Project

## Overview
A simplified Decentralized Exchange (DEX) using the Automated Market Maker (AMM) model, similar to Uniswap V2. This exchange allows users to trade tokens directly without an order book, using a liquidity pool governed by the constant product formula.

## Features
* **Initial and subsequent liquidity provision**: Users can bootstrap the pool or add more tokens to existing reserves.
* **Liquidity removal**: LPs can burn their internal share to receive a proportional amount of the pool's assets.
* **Token swaps**: Exchange Token A for Token B (or vice versa) using the constant product formula.
* **0.3% trading fee**: A fee is taken from every trade and distributed to liquidity providers.
* **LP tracking**: Internal accounting manages LP shares through minting and burning logic.

## Architecture
The project is built around a single core contract:
* **DEX.sol**: Manages internal LP accounting via `totalLiquidity` and `liquidity[address]` mapping, tracks reserves, and executes swap math.
* **MockERC20.sol**: A standard ERC-20 token used to facilitate testing of the trading pairs.



## Mathematical Implementation

### Constant Product Formula
The DEX maintains the invariant $x \times y = k$. 
* $x$ = reserve of Token A
* $y$ = reserve of Token B
* $k$ = constant (increases slightly over time due to fees)

### Swap and Fee Calculation
A **0.3% fee** is deducted from the input before the swap.
* `amountInWithFee` = $amountIn \times 997$
* `amountOut` = $\frac{amountInWithFee \times reserveOut}{(reserveIn \times 1000) + amountInWithFee}$

### LP Token Minting
* **Initial Provision**: $liquidityMinted = \sqrt{amountA \times amountB}$.
* **Subsequent Provision**: $liquidityMinted = \frac{amountA \times totalLiquidity}{reserveA}$.

## Setup Instructions

### Prerequisites
* Docker and Docker Compose
* Git

### Installation
1. Clone the repository and navigate to `dex-amm`.
2. Start the Docker environment:
   ```bash
   docker-compose up -d

```

3. Compile the contracts:
```bash
docker-compose exec app npm run compile

```


4. Run the comprehensive test suite:
```bash
docker-compose exec app npm test

```



## Test Results

The project includes a suite of 25+ tests covering liquidity management, swaps, price calculations, fee distribution, and edge cases.

## Code Coverage

The test suite is designed to achieve ≥ 80% code coverage as per project requirements.

## Security Considerations

* **Solidity 0.8+**: Built-in overflow and underflow protection.
* **Input Validation**: All functions verify non-zero amounts and sufficient balances.
* **Reentrancy Safety**: State updates are performed before external token transfers.

## Known Limitations

* Supports only a single trading pair per DEX instance.
* No built-in slippage protection or deadline parameters.
* LP tokens use internal accounting and are not transferable ERC-20 tokens.

## 📸 Screenshots

### Test Results
<p align="center">
  <img src="screenshots/test.png" width="800" />
</p>

### Test Coverage
<p align="center">
  <img src="screenshots/coverage.png" width="800" />
</p>
