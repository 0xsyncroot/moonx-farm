# RPC Configuration Guide

## 🚨 Avoiding Rate Limiting (429 Errors)

MoonX Farm uses multiple blockchain networks and requires reliable RPC connections. Using default public RPCs can lead to rate limiting (429 errors) especially during high traffic.

## 🔧 Configuration

### 1. Environment Variables

Add these to your `.env` file:

```bash
# Frontend RPC URLs (for Wagmi/Viem)
NEXT_PUBLIC_BASE_RPC=https://your-private-base-rpc.com
NEXT_PUBLIC_BASE_SEPOLIA_RPC=https://your-private-base-sepolia-rpc.com
NEXT_PUBLIC_BSC_RPC=https://your-private-bsc-rpc.com
NEXT_PUBLIC_BSC_TESTNET_RPC=https://your-private-bsc-testnet-rpc.com

# Enable testnet support
NEXT_PUBLIC_ENABLE_TESTNETS=true

# Default to testnet mode for development
NEXT_PUBLIC_DEFAULT_TESTNET_MODE=true

# Privy Authentication
NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id
```

### 2. Recommended RPC Providers

#### 🔸 **Alchemy** (Recommended)
- **Ethereum**: `https://eth-mainnet.g.alchemy.com/v2/YOUR-API-KEY`
- **Base**: `https://base-mainnet.g.alchemy.com/v2/YOUR-API-KEY`
- **Polygon**: `https://polygon-mainnet.g.alchemy.com/v2/YOUR-API-KEY`
- **Free Tier**: 300M requests/month
- **Sign up**: https://alchemy.com

#### 🔸 **Infura**
- **Ethereum**: `https://mainnet.infura.io/v3/YOUR-PROJECT-ID`
- **Polygon**: `https://polygon-mainnet.infura.io/v3/YOUR-PROJECT-ID`
- **Free Tier**: 100k requests/day
- **Sign up**: https://infura.io

#### 🔸 **QuickNode**
- **All Networks**: Custom endpoints
- **Free Tier**: 5M requests/month
- **Sign up**: https://quicknode.com

#### 🔸 **Ankr**
- **Ethereum**: `https://rpc.ankr.com/eth/YOUR-API-KEY`
- **Base**: `https://rpc.ankr.com/base/YOUR-API-KEY`
- **BSC**: `https://rpc.ankr.com/bsc/YOUR-API-KEY`
- **Polygon**: `https://rpc.ankr.com/polygon/YOUR-API-KEY`
- **Free Tier**: 500 requests/second
- **Sign up**: https://ankr.com

### 3. Fallback Configuration

The app automatically uses fallback RPCs if your primary RPC fails:

```typescript
// Automatic fallback order:
1. Your private RPC (NEXT_PUBLIC_*_RPC)
2. Public RPC 1 (llamarpc, publicnode)
3. Public RPC 2 (ankr, blockpi)
4. Public RPC 3 (meowrpc, nodereal)
5. Public RPC 4 (official chain RPCs)
```

## 🛠️ Setup Instructions

### Step 1: Choose a Provider
1. Sign up for **Alchemy** (recommended for beginners)
2. Create a new app for each network you need
3. Copy the RPC URLs

### Step 2: Configure Environment
1. Copy `env.example` to `.env`
2. Add your RPC URLs:
   ```bash
   NEXT_PUBLIC_BASE_RPC=https://base-mainnet.g.alchemy.com/v2/YOUR-API-KEY
   NEXT_PUBLIC_ETHEREUM_RPC=https://eth-mainnet.g.alchemy.com/v2/YOUR-API-KEY
   ```

### Step 3: Restart Application
```bash
pnpm dev
```

## 🔍 Troubleshooting

### Rate Limiting (429 Errors)
- **Cause**: Too many requests to public RPC
- **Solution**: Add private RPC URLs to environment variables
- **Quick fix**: Use different public RPC providers

### Connection Timeouts
- **Cause**: RPC provider is down or slow
- **Solution**: App automatically tries fallback RPCs
- **Manual**: Check RPC provider status page

### Invalid Chain ID
- **Cause**: RPC doesn't match expected chain
- **Solution**: Verify RPC URL is for correct network

## 📊 Monitoring

### Check RPC Status
```javascript
// In browser console:
console.log('Current RPC URLs:', {
  ethereum: process.env.NEXT_PUBLIC_ETHEREUM_RPC,
  base: process.env.NEXT_PUBLIC_BASE_RPC,
  bsc: process.env.NEXT_PUBLIC_BSC_RPC,
  polygon: process.env.NEXT_PUBLIC_POLYGON_RPC
})
```

### Rate Limit Headers
Monitor these headers in Network tab:
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
- `Retry-After`

## 🔐 Security Notes

1. **Never commit** RPC URLs with API keys to git
2. **Use environment variables** for all sensitive data
3. **Rotate API keys** regularly
4. **Monitor usage** to avoid unexpected charges
5. **Use different keys** for development and production

## 💡 Best Practices

1. **Primary + Backup**: Always configure at least 2 RPC providers
2. **Load Balancing**: Some providers offer load-balanced endpoints
3. **Caching**: Enable request batching to reduce RPC calls
4. **Monitoring**: Set up alerts for RPC failures
5. **Cost Optimization**: Monitor usage and optimize request patterns

## 🚀 Production Deployment

For production, ensure:
- [ ] All RPC URLs are configured
- [ ] API keys are in secure environment variables
- [ ] Fallback RPCs are tested
- [ ] Rate limits are monitored
- [ ] Backup providers are configured 