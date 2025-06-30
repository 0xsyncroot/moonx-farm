# Facet Remove and Redeploy Script

Script này giúp bạn remove facet đã deploy sai và triển khai lại facet đó một cách an toàn và dễ dàng.

## 🚀 Tính năng

- ✅ Remove facet cũ (sai) khỏi diamond
- ✅ Deploy facet mới (đúng) 
- ✅ Add facet mới vào diamond
- ✅ Verify contract trên Etherscan (optional)
- ✅ Test functionality sau khi deploy
- ✅ Comprehensive error handling và logging
- ✅ Support constructor arguments
- ✅ Colored output với progress tracking

## 📋 Yêu cầu

1. **Environment Variables:**
   ```bash
   export DIAMOND_ADDRESS=0x...  # Địa chỉ diamond contract
   ```

2. **Dependencies:**
   - Node.js và npm
   - Hardhat
   - jq (cho shell script validation)

## 🛠️ Cách sử dụng

### Method 1: Shell Script (Recommended)

```bash
# Basic usage
./script/removeAndRedeployFacet.sh <network> <facet_name>

# With constructor arguments
./script/removeAndRedeployFacet.sh <network> <facet_name> '["arg1", "arg2"]'

# With verification
./script/removeAndRedeployFacet.sh <network> <facet_name> '[]' true
```

**Examples:**
```bash
# Remove và redeploy Test1Facet trên localhost
./script/removeAndRedeployFacet.sh localhost Test1Facet

# Remove và redeploy FeeCollectorFacet với constructor args
./script/removeAndRedeployFacet.sh sepolia FeeCollectorFacet '["0x1234567890123456789012345678901234567890"]'

# Remove và redeploy DiamondLoupeFacet với verification
./script/removeAndRedeployFacet.sh mainnet DiamondLoupeFacet '[]' true
```

### Method 2: Direct Node.js

```bash
# Set environment variables
export FACET_NAME="Test1Facet"
export CONSTRUCTOR_ARGS='[]'
export VERIFY_CONTRACT="false"

# Run script
npx hardhat run script/removeAndRedeployFacet.js --network <network>
```

## 📝 Available Facets

Dựa trên cấu trúc dự án, các facets có sẵn:

- `DiamondCutFacet` - Diamond cut functionality
- `DiamondLoupeFacet` - Diamond inspection functionality  
- `OwnershipFacet` - Ownership management
- `FeeCollectorFacet` - Fee collection
- `LifiProxyFacet` - LiFi integration
- `OneInchProxyFacet` - 1inch integration
- `RelayProxyFacet` - Relay integration
- `Test1Facet` - Test functionality
- `Test2Facet` - Test functionality

## 🔧 Constructor Arguments

Một số facets cần constructor arguments:

### FeeCollectorFacet
```bash
# Fee collector với fee recipient address
./script/removeAndRedeployFacet.sh sepolia FeeCollectorFacet '["0x1234567890123456789012345678901234567890"]'
```

### Test Facets
```bash
# Test facets thường không cần constructor args
./script/removeAndRedeployFacet.sh localhost Test1Facet '[]'
```

## 🔍 Verification

Để verify contract trên Etherscan:

1. **Set ETHERSCAN_API_KEY:**
   ```bash
   export ETHERSCAN_API_KEY="your_api_key_here"
   ```

2. **Run với verification:**
   ```bash
   ./script/removeAndRedeployFacet.sh sepolia Test1Facet '[]' true
   ```

## 🧪 Testing

Script tự động test functionality sau khi deploy:

- **DiamondLoupeFacet:** Kiểm tra số lượng facets
- **OwnershipFacet:** Kiểm tra owner address
- **Other Facets:** Basic deployment verification

## ⚠️ Lưu ý quan trọng

1. **Backup:** Luôn backup diamond state trước khi thực hiện
2. **Testing:** Test trên testnet trước khi deploy mainnet
3. **Gas:** Đảm bảo có đủ gas cho cả remove và add operations
4. **Permissions:** Chỉ owner của diamond mới có thể thực hiện diamondCut

## 🐛 Troubleshooting

### Error: "FunctionDoesNotExist"
- Facet chưa được add vào diamond
- Kiểm tra tên facet có đúng không

### Error: "No function selectors found"
- Facet contract không có public/external functions
- Kiểm tra facet implementation

### Error: "Invalid CONSTRUCTOR_ARGS"
- Constructor args không phải JSON array format
- Kiểm tra syntax: `'["arg1", "arg2"]'`

### Error: "DIAMOND_ADDRESS not set"
- Set environment variable: `export DIAMOND_ADDRESS=0x...`

## 📊 Output Example

```
🚀 Starting facet remove and redeploy process...

📋 Configuration:
   Diamond Address: 0x1234567890123456789012345678901234567890
   Facet Name: Test1Facet
   Constructor Args: []
   Owner: 0xabcdefabcdefabcdefabcdefabcdefabcdefabcd

🗑️  Removing Test1Facet from diamond...
📋 Found 2 function selectors for Test1Facet
✅ Successfully removed Test1Facet from diamond
Transaction hash: 0x...

🔨 Deploying Test1Facet...
Constructor args: None
✅ Test1Facet deployed at: 0x9876543210987654321098765432109876543210

➕ Adding Test1Facet to diamond...
✅ Successfully added Test1Facet to diamond
Transaction hash: 0x...

🧪 Testing Test1Facet functionality...
✅ Test1Facet deployed successfully

🎉 Successfully completed remove and redeploy process!
📊 Summary:
   - Removed old Test1Facet
   - Deployed new Test1Facet at: 0x9876543210987654321098765432109876543210
   - Added new Test1Facet to diamond

✅ Script completed successfully
```

## 🔗 Related Scripts

- `manageFacets.js` - Basic facet management
- `deploy.js` - Initial diamond deployment
- `test-deployed.js` - Test deployed contracts 