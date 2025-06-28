# 🔍 Privy Account Abstraction Setup Checklist

## ✅ **BƯỚC 1: Privy Dashboard Configuration**

### **Smart Wallets Settings**
- [ ] **Enable Smart Wallets**: Đăng nhập [Privy Dashboard](https://dashboard.privy.io) → App Settings → Wallets → Smart Wallets → **Enable Smart Wallets**
- [ ] **Choose Implementation**: 
  - ✅ Recommended: **Kernel (ZeroDev)**
  - Alternative: Safe, LightAccount (Alchemy), Biconomy, Thirdweb, Coinbase Smart Wallet
- [ ] **Configure Chains**: Base (8453), Base Sepolia (84532), BSC (56), Polygon (137)
- [ ] **Paymaster URLs**: Thêm bundler và paymaster URLs (ZeroDev, Pimlico, hoặc Alchemy)
- [ ] **Gas Sponsorship**: Enable gas sponsorship policies

### **Embedded Wallets Settings**
- [ ] **Create on Login**: Set to `'all-users'` hoặc `'users-without-wallets'`
- [ ] **Confirmation Modals**: Set to **OFF** (để Smart Wallets hoạt động smoothly)

### **Advanced Settings**
- [ ] **Account Recovery**: Enable email/social recovery
- [ ] **Multi-factor Authentication**: Configure if needed

---

## ✅ **BƯỚC 2: Code Implementation Check**

### **Dependencies**
```bash
npm install @privy-io/react-auth permissionless viem
```

### **Provider Setup** ✅
```tsx
// apps/web/src/components/providers/privy-provider.tsx
import { SmartWalletsProvider } from '@privy-io/react-auth/smart-wallets'

<PrivyProvider appId="your-app-id" config={{...}}>
  <SmartWalletsProvider>
    {children}
  </SmartWalletsProvider>
</PrivyProvider>
```

### **Hook Usage** ✅
```tsx
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'

const { client: smartWalletClient } = useSmartWallets()
```

---

## ✅ **BƯỚC 3: Debug & Troubleshooting**

### **Common Issues**

#### **1. Smart Wallet không tạo được**
- [ ] Check Privy Dashboard → Smart Wallets enabled
- [ ] Check network/chain configuration match
- [ ] Check browser console for errors
- [ ] Verify embedded wallet exists first

#### **2. `useSmartWallets` returns null**
- [ ] Embedded wallet phải tồn tại trước
- [ ] SmartWalletsProvider phải wrap component
- [ ] Check Privy config `defaultChain` và `supportedChains`

#### **3. Gas sponsorship không hoạt động**
- [ ] Paymaster URLs configured correctly
- [ ] Gas policy enabled in dashboard
- [ ] Sufficient funds in paymaster

#### **4. Transaction fails**
- [ ] Smart wallet deployed chưa?
- [ ] RPC endpoints working?
- [ ] Network congestion?

---

## ✅ **BƯỚC 4: Workflow Verification**

### **Expected Flow:**
```
1. User login (social/email) → Privy tạo embedded wallet (EOA)
2. SmartWalletsProvider detects embedded wallet → tự động tạo Smart Wallet
3. Smart Wallet address available qua useSmartWallets().client.account.address
4. First transaction → Smart Wallet auto-deploys on-chain
5. Subsequent transactions → instant with gas sponsorship
```

### **Debug Commands:**
```tsx
// Check embedded wallet
const { wallets } = useWallets()
const embeddedWallet = wallets.find(w => w.walletClientType === 'privy')
console.log('Embedded wallet:', embeddedWallet?.address)

// Check smart wallet
const { client } = useSmartWallets()
console.log('Smart wallet:', client?.account.address)

// Test transaction
await client?.sendTransaction({
  to: '0x...',
  value: 0n,
  data: '0x'
})
```

---

## ✅ **BƯỚC 5: Backend Integration**

### **Wallet Registry API** ✅
```typescript
// Register AA wallet with backend
POST /api/wallet-registry/wallets
{
  "ownerAddress": "0x...embedded-wallet...",
  "ownerType": "privy-social",
  "chainId": 8453
}
```

### **Database Schema** ✅
```sql
-- AA wallets table với ownership tracking
aa_wallets (
  id,
  user_id,           -- Privy user ID
  address,           -- AA wallet address  
  owner_address,     -- Privy embedded wallet (OWNER)
  owner_type,        -- 'privy-social'
  chain_id,
  is_deployed,
  created_at
)
```

---

## 🚨 **NEXT STEPS**

1. **Kiểm tra Privy Dashboard**: Đảm bảo Smart Wallets enabled
2. **Test Debug Component**: Xem console logs trong `PrivyWalletDebug`
3. **Verify Workflow**: Login → Embedded Wallet → Smart Wallet
4. **Backend Integration**: Register AA wallet với wallet-registry service

---

## 📋 **Debug Component Usage**

Component `PrivyWalletDebug` đã được thêm (chỉ hiện trong development):
- ✅ **Status indicators**: Privy Ready, Authenticated, Embedded Wallet, Smart Wallet
- ✅ **Action buttons**: Create wallets, register with backend
- ✅ **Real-time logs**: Track workflow step by step

## 🔗 **Useful Links**

- [Privy Smart Wallets Docs](https://docs.privy.io/wallets/using-wallets/evm-smart-wallets)
- [Smart Wallets Starter Repo](https://github.com/privy-io/smart-wallets-starter)
- [Privy Dashboard](https://dashboard.privy.io)
- [ZeroDev Dashboard](https://dashboard.zerodev.app) (nếu dùng ZeroDev) 