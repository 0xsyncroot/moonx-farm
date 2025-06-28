# Wallet Ownership Flow: Privy Social Login → AA Wallet

## 🔗 Complete Ownership Chain

### **1. Privy Social Login (Frontend)**
```typescript
// User logs in via Privy social providers (Google, Twitter, etc.)
const privyUser = await privy.login();

// Privy generates an embedded wallet for the user
const privyWallet = {
  id: "privy-user-123",
  walletAddress: "0x1234...abcd", // EOA wallet (owner)
  email: "user@example.com",
  provider: "google"
};
```

### **2. AA Wallet Creation (Backend)**
```typescript
// Frontend calls wallet-registry service with COMPLETE ownership info
const aaWalletRequest = {
  userId: privyUser.id,              // ✅ Privy user ID
  ownerAddress: privyUser.walletAddress, // ✅ Privy EOA wallet (OWNER)
  ownerType: 'privy-social',         // ✅ Owner type
  chainId: 8453                      // ✅ Target chain
};

const aaWallet = await walletService.createWallet(aaWalletRequest);
```

### **3. Database Schema**
```sql
CREATE TABLE aa_wallets (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,       -- Privy user ID
  address VARCHAR(42) NOT NULL,        -- AA wallet address
  owner_address VARCHAR(42) NOT NULL,  -- Privy EOA wallet (OWNER)
  owner_type VARCHAR(20) NOT NULL,     -- 'privy-social' | 'privy-wallet' | 'external'
  chain_id INTEGER NOT NULL,
  -- ... other fields
);
```

## 🔍 Ownership Verification Flow

### **Real-World Example:**
```typescript
// 1. User logs in with Google via Privy
const privyUser = {
  id: "did:privy:clp123abc",
  walletAddress: "0xA1B2C3...XYZ", // This is the OWNER
  email: "john@gmail.com"
};

// 2. Create AA wallet owned by Privy wallet
const aaWallet = await walletService.createWallet({
  userId: "did:privy:clp123abc",
  ownerAddress: "0xA1B2C3...XYZ",    // 🔑 OWNER = Privy EOA
  ownerType: 'privy-social',
  chainId: 8453
});

// 3. Result: AA wallet with clear ownership
const result = {
  id: "aa-wallet-456",
  userId: "did:privy:clp123abc",      // Privy user
  address: "0xF1E2D3...ABC",          // AA wallet address
  ownerAddress: "0xA1B2C3...XYZ",     // 🔑 OWNER = Privy EOA
  ownerType: 'privy-social',
  chainId: 8453,
  // ... smart contract deployment info
};
```

## 🛡️ Security & Access Control

### **Ownership Verification:**
```typescript
// When user wants to use AA wallet
async function verifyWalletAccess(walletId: string, privyUser: any) {
  const aaWallet = await db.getWallet(walletId);
  
  // Verify ownership chain
  if (aaWallet.userId !== privyUser.id) {
    throw new Error('User mismatch');
  }
  
  if (aaWallet.ownerAddress !== privyUser.walletAddress) {
    throw new Error('Owner wallet mismatch');
  }
  
  // ✅ Access granted
  return true;
}
```

### **Smart Contract Level:**
```solidity
// AA wallet smart contract
contract KernelAccount {
  address public owner; // 0xA1B2C3...XYZ (Privy EOA)
  
  modifier onlyOwner() {
    require(msg.sender == owner, "Not owner");
    _;
  }
  
  function execute(bytes calldata data) external onlyOwner {
    // Only Privy EOA can execute transactions
  }
}
```

## 📊 Ownership Types

| Owner Type | Description | Use Case |
|------------|-------------|-----------|
| `privy-social` | Privy embedded wallet from social login | Default for social users |
| `privy-wallet` | Privy connected external wallet | User connects MetaMask to Privy |
| `external` | Direct external wallet connection | Advanced users, non-Privy |

## 🔄 Migration Support

### **Transferring Ownership:**
```typescript
// Future: Transfer AA wallet to new owner
async function transferOwnership(
  walletId: string,
  newOwnerAddress: string,
  newOwnerType: 'privy-social' | 'privy-wallet' | 'external'
) {
  // 1. Update smart contract owner
  await aaWallet.transferOwnership(newOwnerAddress);
  
  // 2. Update database
  await db.updateWallet(walletId, {
    ownerAddress: newOwnerAddress,
    ownerType: newOwnerType,
    updatedAt: new Date()
  });
}
```

## 🚀 Benefits of Clear Ownership

1. **Transparency**: Always know who owns what
2. **Security**: Proper access control at all levels
3. **Auditability**: Clear ownership trail
4. **Flexibility**: Support multiple wallet types
5. **Migration**: Easy ownership transfers
6. **Debugging**: Easy to trace ownership issues

## ❌ Before (BROKEN FLOW)
```typescript
// ❌ MISSING LINK
const aaWallet = {
  userId: "privy-user-123",
  address: "0xAAWallet...",
  // ❌ NO OWNER INFO - Who actually controls this?
};
```

## ✅ After (COMPLETE FLOW)
```typescript
// ✅ COMPLETE OWNERSHIP CHAIN
const aaWallet = {
  userId: "privy-user-123",           // Privy user ID
  address: "0xAAWallet...",           // AA wallet address
  ownerAddress: "0xPrivyEOA...",      // 🔑 ACTUAL OWNER
  ownerType: 'privy-social',          // Owner type
};
```

This establishes the complete ownership chain from Privy social login → Privy EOA wallet → AA smart contract wallet. 