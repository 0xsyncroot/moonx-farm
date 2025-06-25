# MoonXFarm Router Smart Contracts

Multi-aggregator router smart contracts built with Diamond Proxy pattern (EIP-2535) for optimal gas efficiency and upgradability.

## 🏗️ Architecture

MoonXFarmRouter implements the Diamond Proxy pattern with multiple facets:

- **Core Facets**:
  - `DiamondCutFacet` - Upgrade functionality
  - `DiamondLoupeFacet` - Introspection
  - `OwnershipFacet` - Access control
  - `FeeCollectorFacet` - Fee management

- **Aggregator Facets**:
  - `LifiProxyFacet` - LI.FI integration
  - `OneInchProxyFacet` - 1inch integration  
  - `RelayProxyFacet` - Relay.link integration

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- pnpm

### Installation

```bash
# Install dependencies
pnpm install

# Compile contracts
pnpm build

# Run tests
pnpm test
```

### Deployment

```bash
# Deploy to local network
pnpm deploy:local

# Deploy to Base testnet
pnpm deploy:base-testnet

# Deploy to Base mainnet
pnpm deploy:base-mainnet

# Deploy to BSC testnet
pnpm deploy:bsc-testnet
```

### Environment Variables

Create `.env` file in project root:

```bash
PRIVATE_KEY=your_private_key_here
FEE_RECIPIENT=0x...

# RPC URLs
BASE_TESTNET_RPC=https://sepolia.base.org
BASE_MAINNET_RPC=https://mainnet.base.org
BSC_TESTNET_RPC=https://data-seed-prebsc-1-s1.binance.org:8545
BSC_MAINNET_RPC=https://bsc-dataseed1.binance.org

# API Keys for verification
BASESCAN_API_KEY=your_basescan_api_key
BSCSCAN_API_KEY=your_bscscan_api_key
```

## 📋 Contract Overview

### MoonXFarmRouter (Diamond)

Main router contract that aggregates liquidity from multiple sources.

**Key Features**:
- Diamond Proxy upgradeability
- Multi-aggregator support
- Sophisticated fee collection
- Reentrancy protection
- Multi-chain deployment

### Aggregator Integration

Each aggregator has its own facet that inherits from `AggregatorProxy`:

```solidity
contract LifiProxyFacet is AggregatorProxy {
    function callLifi(
        uint256 fromTokenWithFee,
        uint256 fromAmt, 
        uint256 toTokenWithFee,
        bytes calldata callData
    ) external payable;
}
```

### Fee System

Fees are encoded in token addresses using bit manipulation:

```solidity
uint256 tokenWithFee = (token_address) | (fee_bps << 160);
```

- Supports both input and output fees
- Automatic fee collection to designated recipient
- Fee percentage in basis points (10000 = 100%)

## 🧪 Testing

### Unit Tests

```bash
# Run all tests
pnpm test

# Run with gas reporting
pnpm test:gas

# Run coverage
pnpm coverage
```

### Test Structure

```
test/
├── unit/
│   └── MoonXFarmRouter.test.js
├── integration/
│   └── (future integration tests)
└── fixtures/
    └── (test helpers)
```

## 🛠️ Development

### Adding New Aggregators

1. Create new facet in `src/facets/`:

```solidity
contract NewAggregatorFacet is AggregatorProxy {
    constructor(address _aggregator) AggregatorProxy(_aggregator) {}
    
    function callNewAggregator(
        uint256 fromTokenWithFee,
        uint256 fromAmt,
        uint256 toTokenWithFee, 
        bytes calldata callData
    ) external payable {
        _callAggregator(fromTokenWithFee, fromAmt, toTokenWithFee, callData);
    }
}
```

2. Update `script/deploy.js`:

```javascript
const FACET_CONFIG = {
  aggregator: {
    'NewAggregatorFacet': (addresses) => [addresses.newAggregator]
  }
}
```

3. Add to deployment script and test.

### Upgrading Facets

Use diamond cut functionality:

```bash
# Manage facets
pnpm manage-facets

# Add specific aggregator facets
pnpm add-facets
```

## 🔒 Security

### Audits

- [ ] Initial security review
- [ ] External audit (planned)
- [ ] Bug bounty program (planned)

### Security Features

- **Reentrancy Protection**: Built into `AggregatorProxy`
- **Access Control**: Owner-only functions
- **Input Validation**: Comprehensive checks
- **Safe Token Transfers**: Using OpenZeppelin SafeERC20

## 📚 Resources

- [Diamond Standard (EIP-2535)](https://eips.ethereum.org/EIPS/eip-2535)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)
- [Hardhat Documentation](https://hardhat.org/docs)

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit pull request

## 📄 License

MIT License - see LICENSE file for details.
