# ZeroDev Session Keys Setup Guide

## Overview
MoonXFarm DEX now uses real ZeroDev session keys for automated trading without manual transaction approval.

## Required Environment Variables

Add these environment variables to your `.env.local` file:

```bash
# ZeroDev Configuration - REQUIRED
NEXT_PUBLIC_ZERODEV_PROJECT_ID=your_zerodev_project_id

# Example for testing:
# NEXT_PUBLIC_ZERODEV_PROJECT_ID=01234567-abcd-efgh-ijkl-mnopqrstuvwx
```

## ZeroDev Setup Steps

### 1. Get ZeroDev Project ID

1. Go to [ZeroDev Dashboard](https://dashboard.zerodev.app/)
2. Create a new project or select existing one
3. Copy your Project ID
4. Add to `.env.local`:

```bash
NEXT_PUBLIC_ZERODEV_PROJECT_ID=your_project_id_here
```

### 2. Configure Supported Chains

Ensure your ZeroDev project supports these chains:
- **Base Mainnet** (Chain ID: 8453)  
- **Base Sepolia** (Chain ID: 84532)

### 3. Enable Required Policies

For Diamond contract integration:
- **Call Policy**: Allow calls to Diamond contract addresses
- **Gas Policy**: Set gas limits and paymaster usage
- **Time Policy**: Configure session key expiration

## Session Key Features

### What Session Keys Enable
- **Gasless Trading**: ZeroDev paymaster covers gas fees
- **Automated Execution**: No manual approval for each trade
- **Granular Permissions**: Specific contracts, methods, amounts, and time limits
- **Security**: Time-bound and revocable keys

### Diamond Contract Operations
Session keys can execute these Diamond contract methods:
- `callLifi` - LI.FI cross-chain swaps
- `callOneInch` - 1inch DEX aggregator swaps  
- `callRelay` - Relay protocol swaps
- `approve` - Token approvals

### Default Limits (Configurable)
- **Max Amount**: 1 ETH per session
- **Duration**: 30 days
- **Gas Limit**: 1M gas per transaction

## Testing

### Test Flow
1. **Connect Wallet**: Connect Privy embedded wallet + AA wallet
2. **Create Session Key**: Generate new session key with Diamond permissions
3. **Test Execution**: Run test swap to verify session key works
4. **Real Trading**: Use session key for automated DEX operations

### Test Commands
```javascript
// Create session key
const sessionKey = await createDiamondSessionKey(
  8453, // Base mainnet
  embeddedWallet,
  smartWalletAddress,
  {
    maxAmountEth: 1,
    durationDays: 30
  }
)

// Execute test transaction
const result = await executeSwapWithSessionKey(sessionKey, {
  chainId: 8453,
  provider: 'lifi',
  fromToken: '0x...', 
  toToken: '0x...',
  amount: parseEther('0.1'),
  callData: '0x...'
})
```

## Production Checklist

- [ ] ZeroDev project created with proper chain support
- [ ] Environment variable `NEXT_PUBLIC_ZERODEV_PROJECT_ID` set
- [ ] Privy embedded wallet configured for private key export
- [ ] Diamond contracts deployed on target chains
- [ ] Paymaster funded for gasless transactions
- [ ] Session key policies tested and verified

## Error Troubleshooting

### "ZeroDev project ID not configured"
- Check `.env.local` has `NEXT_PUBLIC_ZERODEV_PROJECT_ID`
- Restart development server after adding env var

### "Privy embedded wallet not found"
- Connect your Privy embedded wallet first
- Make sure wallet connection is established

### "Privy embedded wallet not authenticated" 
- Unlock/authenticate your Privy wallet
- Ensure wallet has signing permissions

### "Unsupported chain ID"
- Add chain support to ZeroDev project
- Update chain configuration in session key service

### "Paymaster sponsorship failed"
- Fund your ZeroDev paymaster account
- Check gas policy configuration

## Integration Notes

### Backend Compatibility
Frontend session key service follows the same patterns as backend:
- `generateSessionKey()` → creates key pair
- `createSessionKeyApproval()` → owner signs permissions using Privy SDK
- `executeWithSessionKey()` → executes with validation

### Security Best Practices
- **No private key export**: Uses Privy embedded wallet signing directly
- **Session keys expire automatically**: Time-bound security
- **Permissions strictly limited**: Diamond contract only
- **On-chain revocation available**: Immediate termination capability
- **Secure Privy integration**: All signing done through Privy SDK

## Architecture

```
Privy Embedded Wallet (Private Key) 
    ↓ Signs Approval
ZeroDev Session Key (Temporary)
    ↓ Executes Transactions
Diamond Contract (DEX Operations)
    ↓ Processes
Cross-Chain Swaps/Trading
```

Session keys enable the automated trading flow while maintaining security through:
1. **Permission-based access** (only allowed operations)
2. **Time-limited sessions** (automatic expiration)
3. **On-chain revocation** (immediate termination)
4. **Amount limits** (prevents large losses)

## Next Steps

1. Set up ZeroDev project and get Project ID
2. Add environment variable to `.env.local` 
3. Test session key creation in wallet settings
4. Verify test execution works
5. Deploy to production with funded paymaster

For production deployment, ensure paymaster is funded and all environment variables are properly set in your hosting platform. 