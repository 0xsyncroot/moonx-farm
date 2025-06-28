# Session Key Workflow Example

## Understanding ZeroDev Session Key Architecture

Trong ZeroDev architecture, session key workflow có 3 bước:

### 1. Generate Session Key (Agent/Client Side)
```typescript
// Agent generates session key pair
const sessionPrivateKey = generatePrivateKey();
const sessionKeyAccount = privateKeyToAccount(sessionPrivateKey);
const sessionKeySigner = await toECDSASigner({ signer: sessionKeyAccount });

// Send sessionKeySigner.account.address to wallet owner for approval
```

### 2. Create Approval (Wallet Owner Side)  
```typescript
// Wallet owner creates approval using their private key
const approval = await zeroDevClient.createSessionKeyApproval(
  chainId,
  walletPrivateKey, // Main wallet owner's private key
  sessionKeySigner.account.address, // Session key public address
  permissions
);

// Send approval string back to agent/client
```

### 3. Use Session Key (Agent/Client Side)
```typescript
// Agent uses approval + their session key signer to execute transactions
const sessionKeyClient = await zeroDevClient.createSessionKeyClient(
  chainId,
  approval, // From step 2
  sessionKeySigner // From step 1
);

// Execute transactions...
```

### 4. Revoke Session Key (Simplified)
```typescript
// Revoke session key - approval is automatically retrieved from database
const result = await sessionKeyManager.revokeSessionKey(
  sessionKeyId,
  true // onChainRevoke: true for on-chain revocation, false for database-only
);
```

## Key Points:

1. **walletPrivateKey** chỉ cần trong step 2 (createSessionKeyApproval)
2. **approval string** được lưu encrypted trong database, client không cần biết
3. **revokeSessionKey** tự động lấy approval từ database
4. **Client chỉ cần sessionKeyId** để execute transactions và revoke

## 🚀 **Execute Transactions with Session Keys**

### **Method 1: Direct ZeroDev Client Usage**

```typescript
// Step 1: Get session key from database
const sessionKey = await sessionKeyManager.getSessionKeyById(sessionKeyId);

// Step 2: Decrypt session key private key
const sessionKeyPrivateKey = decryptPrivateKey(sessionKey.encryptedPrivateKey);

// Step 3: Execute transactions
const result = await zeroDevClient.executeWithSessionKey(
  chainId,
  approval, // From session key creation
  sessionKeyPrivateKey,
  [
    {
      to: "0xContractAddress",
      value: parseEther("0.01"), // Optional ETH value
      data: encodeFunctionData({
        abi: contractABI,
        functionName: "transfer",
        args: ["0xRecipient", parseEther("100")]
      })
    }
  ]
);

console.log('User Operation Hash:', result.userOpHash);
console.log('Wallet Address:', result.walletAddress);

// Step 4: Wait for confirmation (optional)
const receipt = await zeroDevClient.waitForSessionKeyTransaction(
  chainId,
  approval,
  sessionKeyPrivateKey,
  result.userOpHash,
  60000 // 60 second timeout
);

console.log('Transaction Hash:', receipt.txHash);
console.log('Block Number:', receipt.blockNumber);
console.log('Status:', receipt.status);
```

### **Method 2: High-Level SessionKeyManager Usage**

```typescript
// Execute without waiting for confirmation
// Note: approval is automatically retrieved from database
const result = await sessionKeyManager.executeTransactions(
  sessionKeyId,
  [
    {
      to: "0xUSDCContract",
      value: BigInt(0),
      data: encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "transfer",
        args: ["0xRecipient", parseUnits("100", 6)] // 100 USDC
      })
    }
  ]
);

// Execute and wait for confirmation
// Note: approval is automatically retrieved from database
const confirmedResult = await sessionKeyManager.executeAndWaitForTransactions(
  sessionKeyId,
  [
    {
      to: "0x1inchRouter",
      value: parseEther("0.1"), // Send 0.1 ETH
      data: swapCalldata // Encoded swap function call
    }
  ],
  120000 // 2 minute timeout
);
```

### **Method 3: API Usage**

```bash
# Execute transactions via REST API
# Note: approval is automatically retrieved from database
POST /api/session-keys/execute
{
  "sessionKeyId": "session-uuid",
  "transactions": [
    {
      "to": "0xContractAddress",
      "value": "1000000000000000000", // 1 ETH in wei
      "data": "0xa9059cbb..." // Encoded function call
    }
  ],
  "waitForConfirmation": true,
  "timeout": 60000
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userOpHash": "0x1234567890abcdef...",
    "txHash": "0xfedcba0987654321...",
    "blockNumber": "18500000",
    "status": "success",
    "walletAddress": "0xAAWalletAddress",
    "sessionKeyAddress": "0xSessionKeyAddress"
  }
}
```

## 🔥 **Real-World Use Cases**

### **1. DeFi Auto-Trading Bot**

```typescript
// Create session key for trading bot
const tradingSessionKey = await sessionKeyManager.createSessionKey({
  walletId: "user-wallet-id",
  userId: "user-123",
  permissions: {
    contractAddresses: ["0x1inchRouter", "0xUniswapRouter"],
    maxAmount: "100000000000000000", // Max 0.1 ETH per trade
    maxGasLimit: "500000",
    allowedMethods: ["swap", "swapExactETHForTokens"],
    timeframe: {
      validAfter: Math.floor(Date.now() / 1000),
      validUntil: Math.floor(Date.now() / 1000) + 604800 // 7 days
    }
  },
  expirationDays: 7
});

// Bot executes trades automatically
// Note: approval is stored securely in database, no need to pass it
const swapResult = await sessionKeyManager.executeTransactions(
  tradingSessionKey.sessionKey.id,
  [
    {
      to: "0x1inchRouter",
      value: parseEther("0.05"), // Swap 0.05 ETH
      data: encodeFunctionData({
        abi: ROUTER_ABI,
        functionName: "swap",
        args: [
          "0xETH", // From token
          "0xUSDC", // To token  
          parseEther("0.05"), // Amount
          "95000000", // Min output (95 USDC with 5% slippage)
          ["0xETH", "0xUSDC"] // Path
        ]
      })
    }
  ]
);
```

### **2. GameFi NFT Automation**

```typescript
// Create session key for game operations
const gameSessionKey = await sessionKeyManager.createSessionKey({
  walletId: "player-wallet-id",
  userId: "player-456",
  permissions: {
    contractAddresses: ["0xGameItemsNFT", "0xGameMarketplace"],
    maxAmount: "0", // No ETH transfers, only NFT operations
    maxGasLimit: "300000",
    allowedMethods: ["mint", "transfer", "burn", "listItem"],
    timeframe: {
      validAfter: Math.floor(Date.now() / 1000),
      validUntil: Math.floor(Date.now() / 1000) + 86400 // 24 hours
    }
  },
  expirationDays: 1
});

// Game auto-mints rewards for player
// Note: approval is stored securely in database, no need to pass it
const mintResult = await sessionKeyManager.executeAndWaitForTransactions(
  gameSessionKey.sessionKey.id,
  [
    {
      to: "0xGameItemsNFT",
      value: BigInt(0),
      data: encodeFunctionData({
        abi: NFT_ABI,
        functionName: "mint",
        args: ["0xPlayerAddress", 1001] // Mint NFT #1001
      })
    }
  ],
  30000 // 30 second timeout
);
```

### **3. Subscription Payment Automation**

```typescript
// Create session key for monthly subscription
const subscriptionSessionKey = await sessionKeyManager.createSessionKey({
  walletId: "subscriber-wallet-id",
  userId: "subscriber-789",
  permissions: {
    contractAddresses: ["0xUSDCToken"],
    maxAmount: "10000000", // Max 10 USDC per payment
    maxGasLimit: "200000",
    allowedMethods: ["transfer"],
    timeframe: {
      validAfter: Math.floor(Date.now() / 1000),
      validUntil: Math.floor(Date.now() / 1000) + 31536000 // 1 year
    }
  },
  expirationDays: 365
});

// Auto-charge monthly subscription
// Note: approval is stored securely in database, no need to pass it
const paymentResult = await sessionKeyManager.executeTransactions(
  subscriptionSessionKey.sessionKey.id,
  [
    {
      to: "0xUSDCToken",
      value: BigInt(0),
      data: encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "transfer",
        args: ["0xServiceProviderWallet", parseUnits("9.99", 6)] // $9.99 USDC
      })
    }
  ]
);
```

## Gas Sponsorship Integration:

```typescript
// Session key operations can be sponsored automatically
const kernelClient = createKernelAccountClient({
  account: sessionKeyAccount,
  paymaster: {
    getPaymasterData: async (userOperation) => {
      // Auto-sponsor session key management operations
      if (isSessionKeyOperation(userOperation)) {
        return paymasterClient.sponsorUserOperation({ userOperation });
      }
      
      // Check user's gas sponsorship policy for regular transactions
      const eligibility = await gasManager.checkSponsorshipEligibility(...);
      if (eligibility.eligible) {
        return paymasterClient.sponsorUserOperation({ userOperation });
      }
      
      // Fallback to user pays gas
      return paymasterClient.sponsorUserOperation({ userOperation });
    }
  }
});
```

## 🔧 **Advanced Patterns**

### **Batch Operations**

```typescript
// Execute multiple operations in one transaction
// Note: approval is automatically retrieved from database
const batchResult = await sessionKeyManager.executeTransactions(
  sessionKeyId,
  [
    // Approve token spending
    {
      to: "0xUSDCToken",
      value: BigInt(0),
      data: encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "approve",
        args: ["0xDEXRouter", parseUnits("100", 6)]
      })
    },
    // Execute swap
    {
      to: "0xDEXRouter",
      value: BigInt(0),
      data: encodeFunctionData({
        abi: DEX_ABI,
        functionName: "swapExactTokensForETH",
        args: [
          parseUnits("100", 6), // 100 USDC
          parseEther("0.09"), // Min 0.09 ETH output
          ["0xUSDC", "0xETH"], // Path
          "0xRecipient",
          Math.floor(Date.now() / 1000) + 300 // 5 min deadline
        ]
      })
    }
  ]
);
```

### **Error Handling**

```typescript
try {
  // Note: approval is automatically retrieved from database
  const result = await sessionKeyManager.executeTransactions(
    sessionKeyId,
    transactions
  );
  
  console.log('✅ Transactions executed:', result.userOpHash);
} catch (error) {
  if (error.code === 'SESSION_KEY_INVALID') {
    // Session key expired or revoked
    console.log('❌ Session key is no longer valid');
    await createNewSessionKey();
  } else if (error.code === 'SESSION_EXECUTION_FAILED') {
    // Transaction failed (insufficient gas, reverted, etc.)
    console.log('❌ Transaction execution failed:', error.message);
  } else {
    // Other errors
    console.log('❌ Unknown error:', error.message);
  }
}
```

## Best Practices:

1. **Store approval string** trong database sau khi tạo session key
2. **Auto-expire** session keys thay vì manual revoke mỗi lần
3. **Sponsor session management** operations (create/revoke) automatically
4. **Conservative permissions** cho session keys (time limits, contract restrictions)
5. **Graceful fallback** nếu on-chain revoke fails (database revoke only)
6. **Validate transactions** trước khi execute để đảm bảo không vượt quá permissions
7. **Monitor gas usage** và auto-adjust gas limits dựa trên historical data
8. **Implement retry logic** cho failed transactions với exponential backoff 