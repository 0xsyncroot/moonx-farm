# Auto Chain Switch Implementation

## Tổng quan

Tính năng Auto Chain Switch tự động chuyển đổi network khi user chọn token từ chain khác so với chain hiện tại. Việc này đảm bảo smart wallet luôn ở đúng chain để thực hiện swap, approve token và các transaction khác.

## Cách hoạt động

### 1. Hook `useAutoChainSwitch`

Hook này monitor sự thay đổi của `fromToken` và tự động switch sang chain phù hợp:

```typescript
const {
  isLoading: isChainSwitching,
  isSuccess: chainSwitchSuccess,
  error: chainSwitchError,
  smartWalletClient,
  switchToChain,
  currentChain
} = useAutoChainSwitch(fromToken)
```

**Tính năng chính:**
- Tự động detect khi `fromToken.chainId` khác với current chain
- Sử dụng Privy `getClientForChain()` để tạo smart wallet client mới
- Switch EOA wallet (embedded wallet) trước
- Tạo smart wallet client cho target chain
- Provide loading states và error handling

### 2. Luồng Chain Switching

Khi user chọn token từ chain khác:

1. **Detection**: Hook detect `fromToken.chainId !== currentChainId`
2. **EOA Switch**: Gọi `switchChain()` để switch embedded wallet
3. **Smart Wallet Switch**: Gọi `getClientForChain()` để tạo client mới
4. **Update State**: Cập nhật smart wallet client trong state
5. **UI Feedback**: Hiển thị loading/success/error states

### 3. Integration với Swap Logic

Smart wallet client từ auto chain switch được pass through toàn bộ hệ thống:

```typescript
// SwapInterface
const { smartWalletClient } = useAutoChainSwitch(fromToken)

// Pass to child components
<SwapButton smartWalletClient={smartWalletClient} />

// Pass to hooks
const fromTokenBalance = useTokenBalance(fromToken, smartWalletClient)
```

### 4. UI Indicators

Hiển thị các trạng thái khác nhau:

- **Loading**: "Switching network..." với spinner
- **Success**: "Network switched successfully" với checkmark  
- **Error**: "Failed to switch network" với retry button

## Supported Features

### ✅ Đã implement

- [x] Auto-detect chain mismatch
- [x] Switch EOA wallet via wagmi
- [x] Create smart wallet client cho target chain
- [x] Update token balances với correct chain
- [x] Update quote API với correct smart wallet address
- [x] Update swap execution với correct smart wallet client
- [x] UI loading/success/error states
- [x] Prevent concurrent switches
- [x] Error handling và retry mechanism
- [x] Reset state khi user disconnects

### 🔄 Có thể enhance

- [ ] Manual chain switch confirmation
- [ ] Persistent chain preference
- [ ] Better error messages cho specific chains
- [ ] Animation transitions cho UI states
- [ ] Analytics tracking cho chain switches

## Cách sử dụng

### Automatic Mode (Default)

Tính năng hoạt động tự động. Khi user:

1. Load trang với URL có token khác chain
2. Chọn token trong token selector khác chain hiện tại
3. Import/paste token address từ chain khác

→ System sẽ tự động switch chain

### Manual Control

Có thể trigger manual switch:

```typescript
const { switchToChain } = useAutoChainSwitch(fromToken)

// Manual switch
await switchToChain(targetChainId)
```

## Troubleshooting

### Lỗi thường gặp

1. **"getClientForChain not available"**
   - User chưa connect wallet
   - Privy smart wallet chưa được initialize

2. **"Unsupported chain"**
   - Chain ID không có trong config
   - Chain chưa được add vào Privy configuration

3. **"Failed to create smart wallet client"**
   - RPC endpoint issues
   - Network connectivity problems
   - Smart wallet deployment issues trên target chain

### Debug Information

Hook cung cấp debug logs:

```typescript
console.log('🎯 Auto-switching detected:', {
  fromTokenChain: targetChainId,
  currentSmartWalletChain: currentSmartWalletChainId,
  needsSwitch
})
```

## Technical Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Token Select  │───▶│ useAutoChainSwitch│───▶│  Smart Wallet   │
│                 │    │                  │    │    Client       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                               │                         │
                               ▼                         ▼
                    ┌──────────────────┐    ┌─────────────────┐
                    │  Chain Detection │    │  Token Balance  │
                    │   & UI Updates   │    │   & Swap Exec   │
                    └──────────────────┘    └─────────────────┘
```

## References

- [Privy Smart Wallets Documentation](https://docs.privy.io/wallets/using-wallets/evm-smart-wallets/usage)
- [getClientForChain API](https://docs.privy.io/wallets/using-wallets/evm-smart-wallets/usage#switch-chains) 