# RelayProxyFacet Remove and Redeploy Guide

Hướng dẫn cụ thể để remove và redeploy RelayProxyFacet với địa chỉ Relay aggregator mới.

## 🚀 Cách sử dụng nhanh

### Method 1: Script chuyên dụng (Recommended)

```bash
# Set diamond address
export DIAMOND_ADDRESS=0x...

# Remove và redeploy RelayProxyFacet
./contracts/script/removeAndRedeployRelay.sh <network> <relay_aggregator_address>
```

**Examples:**
```bash
# Localhost với test relay address
./contracts/script/removeAndRedeployRelay.sh localhost 0x1234567890123456789012345678901234567890

# Sepolia với Uniswap V2 Router
./contracts/script/removeAndRedeployRelay.sh sepolia 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D

# Mainnet với Uniswap V3 Router
./contracts/script/removeAndRedeployRelay.sh mainnet 0xE592427A0AEce92De3Edee1F18E0157C05861564
```

### Method 2: Script tổng quát

```bash
# Set environment variables
export DIAMOND_ADDRESS=0x...
export FACET_NAME="RelayProxyFacet"
export CONSTRUCTOR_ARGS='["0x1234567890123456789012345678901234567890"]'

# Run script
cd contracts
./script/removeAndRedeployFacet.sh localhost RelayProxyFacet '["0x1234567890123456789012345678901234567890"]'
```

## 📋 Relay Aggregator Addresses

### Testnet Addresses
- **Sepolia Uniswap V2 Router**: `0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D`
- **Sepolia Uniswap V3 Router**: `0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E`
- **Goerli Uniswap V2 Router**: `0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D`

### Mainnet Addresses
- **Ethereum Uniswap V2 Router**: `0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D`
- **Ethereum Uniswap V3 Router**: `0xE592427A0AEce92De3Edee1F18E0157C05861564`
- **Polygon Uniswap V3 Router**: `0xE592427A0AEce92De3Edee1F18E0157C05861564`

## 🔍 Kiểm tra trước khi thực hiện

### 1. Kiểm tra trạng thái diamond hiện tại:
```bash
export DIAMOND_ADDRESS=0x...
npx hardhat run contracts/script/checkDiamondState.js --network localhost
```

### 2. Kiểm tra RelayProxyFacet cụ thể:
```bash
export DIAMOND_ADDRESS=0x...
export FACET_NAME="RelayProxyFacet"
npx hardhat run contracts/script/checkDiamondState.js --network localhost
```

## ⚠️ Lưu ý quan trọng

1. **Relay Aggregator Validation**: 
   - Địa chỉ phải là contract hợp lệ
   - Contract phải có code (không phải EOA)
   - Contract phải có ít nhất 100 bytes code

2. **Constructor Arguments**:
   - RelayProxyFacet cần 1 constructor argument: địa chỉ Relay aggregator
   - Format: `["0x1234567890123456789012345678901234567890"]`

3. **Function Selectors**:
   - `callRelay(uint256,uint256,uint256,bytes)` - Main function để gọi Relay

## 🧪 Testing sau khi deploy

### Test basic functionality:
```bash
# Test RelayProxyFacet
export FACET_NAME="RelayProxyFacet"
npx hardhat run contracts/script/checkDiamondState.js --network localhost
```

### Expected output:
```
🔍 Checking specific facet: RelayProxyFacet
✅ RelayProxyFacet is available on diamond
   Basic functionality test passed
```

## 🐛 Troubleshooting

### Error: "InvalidAggregator"
- Relay aggregator address không hợp lệ
- Contract không có code hoặc code quá ngắn
- Kiểm tra địa chỉ contract trên block explorer

### Error: "FunctionDoesNotExist"
- RelayProxyFacet chưa được add vào diamond
- Kiểm tra tên facet có đúng không

### Error: "Invalid relay aggregator address format"
- Địa chỉ không đúng format (0x + 40 hex characters)
- Kiểm tra địa chỉ có bị copy-paste sai không

## 📊 Complete Example

```bash
# 1. Set diamond address
export DIAMOND_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3

# 2. Check current state
npx hardhat run contracts/script/checkDiamondState.js --network localhost

# 3. Remove và redeploy RelayProxyFacet
./contracts/script/removeAndRedeployRelay.sh localhost 0x1234567890123456789012345678901234567890

# 4. Verify deployment
export FACET_NAME="RelayProxyFacet"
npx hardhat run contracts/script/checkDiamondState.js --network localhost
```

## 🔗 Related Files

- `removeAndRedeployRelay.sh` - Script chuyên dụng cho RelayProxyFacet
- `removeAndRedeployFacet.js` - Script tổng quát
- `checkDiamondState.js` - Utility để kiểm tra trạng thái
- `RelayProxyFacet.sol` - Contract implementation 