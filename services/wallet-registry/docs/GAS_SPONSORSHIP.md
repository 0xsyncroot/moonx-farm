# Gas Sponsorship System

## Overview

The Gas Sponsorship system provides automatic gas fee coverage for Account Abstraction wallet operations. It integrates seamlessly with ZeroDev's paymaster infrastructure to sponsor user transactions based on configurable policies.

## Architecture

### Integration Pattern

```
User Transaction Request
       ↓
ZeroDevClient.createKernelClient()
       ↓
paymaster.getPaymasterData()
       ↓
GasManager.checkSponsorshipEligibility()
       ↓
[Eligible] → ZeroDev Paymaster → Sponsored Transaction
[Not Eligible] → Fallback to Default Paymaster
```

### Components

1. **GasManager**: Core service for policy management and eligibility checking
2. **ZeroDevClientService**: Integrated sponsorship logic in paymaster
3. **WalletController**: API endpoints for policy management
4. **Database**: Policy and usage tracking

## Features

### Automatic Sponsorship
- Transparent gas sponsorship without manual intervention
- Real-time eligibility checking during transaction execution
- Automatic usage tracking and policy limit enforcement

### Policy Management
- **Daily Limits**: Maximum gas cost per day (default: 0.01 ETH)
- **Monthly Limits**: Maximum gas cost per month (default: 0.1 ETH)  
- **Per-Transaction Limits**: Maximum cost per single transaction (default: 0.005 ETH)
- **Contract Restrictions**: Optional whitelist of allowed contract addresses

### Usage Tracking
- Real-time usage monitoring
- Historical transaction records
- Sponsorship savings calculations
- Budget remaining calculations

## Automatic Gas Sponsorship

Gas sponsorship policies are **automatically created** when a new wallet is created. Users don't need to manually create policies.

### Default Limits for New Wallets
- **Daily Limit**: 0.005 ETH (~$12 at $2400 ETH)
- **Monthly Limit**: 0.05 ETH (~$120 at $2400 ETH)  
- **Per Transaction**: 0.002 ETH (~$5 at $2400 ETH)

### First-Time Wallet Deployment
The very first transaction (wallet deployment) is **always sponsored automatically**, regardless of policy limits.

## API Endpoints

### Check Gas Sponsorship Status

```http
GET /wallets/{walletId}/gas-sponsorship
Authorization: Bearer {jwt_token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "hasSponsorship": true,
    "dailyRemaining": "3000000000000000", // Wei (~0.003 ETH)
    "monthlyRemaining": "45000000000000000", // Wei (~0.045 ETH)
    "dailyLimit": "5000000000000000", // Wei (0.005 ETH)
    "monthlyLimit": "50000000000000000", // Wei (0.05 ETH)
    "reason": null
  }
}
```

## Configuration

### Default Limits (Conservative for New Users)

```typescript
const DEFAULT_LIMITS = {
  dailyLimitEth: 0.005,     // 0.005 ETH daily (~$12 at $2400 ETH)
  monthlyLimitEth: 0.05,    // 0.05 ETH monthly (~$120 at $2400 ETH)
  perTransactionLimitEth: 0.002 // 0.002 ETH per transaction (~$5 at $2400 ETH)
};
```

### Environment Variables

```bash
# ZeroDev Configuration
ZERODEV_PROJECT_ID=your_project_id

# Database Configuration
DATABASE_URL=mysql://user:pass@host:port/database

# Chain RPC URLs
ETHEREUM_RPC_URL=https://eth-mainnet.rpc.url
BASE_RPC_URL=https://base-mainnet.rpc.url
SEPOLIA_RPC_URL=https://sepolia.rpc.url
BASE_SEPOLIA_RPC_URL=https://base-sepolia.rpc.url
BSC_RPC_URL=https://bsc-mainnet.rpc.url
BSC_TESTNET_RPC_URL=https://bsc-testnet.rpc.url
```

## Usage Examples

### Client-side Integration

```javascript
// Check sponsorship status (policies auto-created)
const checkSponsorship = async (walletId) => {
  const response = await fetch(`/api/wallets/${walletId}/gas-sponsorship`, {
    headers: {
      'Authorization': `Bearer ${jwt_token}`
    }
  });
  
  return response.json();
};

// Create wallet (sponsorship policy auto-created)
const createWallet = async (chainId) => {
  const response = await fetch('/api/wallets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwt_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ chainId })
  });
  
  const wallet = await response.json();
  console.log('Wallet created with automatic gas sponsorship policy');
  return wallet;
};

// Execute transaction (sponsorship handled automatically)
const executeTransaction = async (transactionData) => {
  // First-time deployment: Always sponsored
  // Regular transactions: Auto-checked against policy limits
  // No manual sponsorship requests needed
  return kernelClient.sendUserOperation(transactionData);
};
```

### Backend Integration

```typescript
// In your service
class WalletService {
  async createWallet(request: CreateWalletRequest) {
    // Create wallet
    const wallet = await this.createAAWallet(request);
    
    // Gas sponsorship policy automatically created
    // with conservative default limits:
    // - Daily: 0.005 ETH
    // - Monthly: 0.05 ETH  
    // - Per Transaction: 0.002 ETH
    
    return wallet; // Sponsorship included automatically
  }
}

// ZeroDevClient automatically handles sponsorship
class ZeroDevClientService {
  async createKernelClient(chainId: number, privateKey: string) {
    // Kernel client with automatic sponsorship:
    // 1. First deployment: Always sponsored
    // 2. Regular transactions: Policy-based sponsorship
    // 3. Fallback: User pays gas if not eligible
    
    return kernelClient;
  }
}
```

## Database Schema

### Gas Sponsorship Policies

```sql
CREATE TABLE gas_sponsorship_policies (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL,
  wallet_id VARCHAR(50) NULL,
  wallet_address VARCHAR(42) NULL,
  daily_limit VARCHAR(100) NOT NULL,
  monthly_limit VARCHAR(100) NOT NULL,
  per_transaction_limit VARCHAR(100) NULL,
  allowed_contracts TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Gas Usage Records

```sql
CREATE TABLE gas_usage (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL,
  wallet_address VARCHAR(42) NOT NULL,
  chain_id INT NOT NULL,
  user_operation_hash VARCHAR(66) NOT NULL,
  gas_cost VARCHAR(100) NOT NULL,
  policy_id VARCHAR(50) NOT NULL,
  sponsored BOOLEAN NOT NULL DEFAULT false,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## Security Considerations

### Policy Limits
- Limits are enforced in real-time before transaction execution
- Multiple policies per user are supported with first-match wins
- Policies can be deactivated without deleting historical data

### Budget Management
- Daily and monthly budgets reset automatically
- Usage tracking includes both sponsored and non-sponsored transactions
- Budget calculations use BigInt for precise wei amounts

### Access Control
- Users can only create policies for their own wallets
- JWT authentication required for all policy operations
- Wallet ownership verified before policy creation

## Monitoring and Analytics

### Usage Metrics
- Total gas costs (sponsored vs non-sponsored)
- Transaction counts by time period
- Average gas costs per transaction
- Sponsorship savings calculations
- Budget utilization rates

### Policy Effectiveness
- Policy hit rates (eligible vs total transactions)
- Limit breach frequencies
- Popular contract interactions
- Cross-chain usage patterns

## Troubleshooting

### Common Issues

1. **Policy Not Found**
   - Ensure policy exists and is active
   - Check wallet ownership
   - Verify user authentication

2. **Sponsorship Denied**
   - Check daily/monthly limits
   - Verify per-transaction limits
   - Review contract whitelist (if configured)

3. **Transaction Failures**
   - Fallback to default paymaster should handle this
   - Check ZeroDev project configuration
   - Verify RPC endpoint connectivity

### Debug Logs

```typescript
// Enable debug logging
logger.setLevel('debug');

// Check sponsorship eligibility manually
const eligibility = await gasManager.checkSponsorshipEligibility({
  userId: 'user123',
  walletAddress: '0x...',
  chainId: 8453,
  estimatedGas: '1000000'
});

console.log('Sponsorship eligibility:', eligibility);
```

## Migration Guide

### From Manual Paymaster to Auto-Sponsorship

1. **Deploy Database Tables**
   ```bash
   mysql -u user -p database < migrations/006_create_gas_sponsorship_tables.sql
   ```

2. **Update Service Configuration**
   ```typescript
   // Initialize with gas manager
   const gasManager = new GasManager(dbManager, projectId);
   const zeroDevClient = new ZeroDevClientService(config, gasManager);
   ```

3. **Create Default Policies**
   ```typescript
   // For existing users
   await gasManager.createSponsorshipPolicy({
     userId: user.id,
     walletAddress: user.walletAddress,
     dailyLimit: parseEther('0.01').toString(),
     monthlyLimit: parseEther('0.1').toString(),
     isActive: true
   });
   ```

## Best Practices

### Policy Design
- Start with conservative limits and adjust based on usage
- Monitor policy effectiveness regularly
- Consider contract-specific policies for high-value interactions
- Use wallet-specific policies for better control

### Performance
- Policy checks are fast (<10ms) but add latency
- Consider caching frequently accessed policies
- Monitor database performance for usage tracking
- Use indexed queries for analytics

### Cost Management
- Set reasonable default limits to prevent abuse
- Monitor total sponsorship costs across all users
- Implement alerts for unusual usage patterns
- Regular audit of sponsored transactions

---

**Note**: This system requires ZeroDev Pro plan for paymaster functionality and proper RPC endpoint configuration for all supported chains. 