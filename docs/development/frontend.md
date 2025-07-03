# Frontend Development - MoonXFarm DEX

**Framework**: Next.js 14+ (App Router)  
**Status**: ✅ Production Ready  
**Last Updated**: January 2025

## 🎯 Overview

MoonXFarm frontend is a modern Next.js application with Account Abstraction integration, providing gasless trading experience through ZeroDev and Privy.

## 🛠️ Tech Stack

- **Next.js 14+**: App Router, TypeScript, Server Components
- **UI**: shadcn/ui + TailwindCSS
- **Account Abstraction**: ZeroDev SDK v5.4+ + Privy
- **Blockchain**: wagmi + viem for Web3 interactions
- **State**: React Query + Context API
- **Styling**: TailwindCSS with glass morphism effects

## 🏗️ Project Structure

```
apps/web/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── page.tsx             # Home page with swap
│   │   ├── wallet-settings/     # Wallet management
│   │   ├── swap/                # Trading interface
│   │   ├── orders/              # Limit orders & DCA
│   │   └── portfolio/           # P&L tracking
│   ├── components/
│   │   ├── ui/                  # shadcn/ui components
│   │   ├── wallet/              # Wallet Settings (48KB)
│   │   ├── swap/                # Trading interfaces
│   │   ├── orders/              # Order management
│   │   └── providers/           # React providers
│   ├── lib/
│   │   ├── session-keys.ts      # Session Key Service (21KB)
│   │   ├── contracts.ts         # Smart contract integration
│   │   ├── api-client.ts        # Backend API client
│   │   └── utils.ts             # Utility functions
│   ├── config/
│   │   └── chains.ts            # Multi-chain config (205 lines)
│   └── types/
│       └── index.ts             # TypeScript definitions
```

## 🔑 Key Features

### ✅ Account Abstraction Integration

**ZeroDev SDK v5.4+ Implementation**
```typescript
// Session Key Management
import { PrivySessionKeyService } from '@/lib/session-keys';

const sessionKeyService = new PrivySessionKeyService();
const sessionKey = await sessionKeyService.createTradingSessionKey({
  duration: 30 * 24 * 60 * 60, // 30 days
  permissions: {
    contracts: [DIAMOND_CONTRACT_ADDRESS],
    methods: ['callLifi', 'callOneInch', 'approve'],
    maxAmount: parseEther('1')
  }
});
```

**Wallet Settings UI (48KB)**
```typescript
// Comprehensive wallet management interface
- Overview Tab: Smart + Embedded wallet balances
- Security Tab: Wallet addresses & security features
- Session Keys Tab: Key lifecycle management
- Advanced Tab: ZeroDev integration details
```

### ✅ Multi-Chain Support

**Chain Configuration (205 lines)**
```typescript
// apps/web/src/config/chains.ts
export const SUPPORTED_CHAINS = {
  base: { id: 8453, name: 'Base', rpc: process.env.BASE_MAINNET_RPC },
  bsc: { id: 56, name: 'BSC', rpc: process.env.BSC_MAINNET_RPC },
  baseTestnet: { id: 84532, name: 'Base Sepolia' },
  bscTestnet: { id: 97, name: 'BSC Testnet' }
};
```

### ✅ Smart Contract Integration

**Environment-based Contract Addresses**
```typescript
// apps/web/src/lib/contracts.ts (15KB)
export const DIAMOND_ADDRESSES: Record<number, Address> = {
  8453: process.env.NEXT_PUBLIC_DIAMOND_CONTRACT_BASE,
  56: process.env.NEXT_PUBLIC_DIAMOND_CONTRACT_BSC,
};
```

## 🚀 Development

### Start Development Server
```bash
cd apps/web
npm run dev
```

### Key Development Commands
```bash
# Development
npm run dev              # Start dev server
npm run build            # Production build
npm run start            # Start production server

# Code Quality
npm run lint             # ESLint
npm run type-check       # TypeScript check
npm run format           # Prettier format

# Testing
npm run test             # Run tests
npm run test:watch       # Watch mode
```

### Development URLs
- **Frontend**: http://localhost:3000
- **Storybook**: http://localhost:6006 (if configured)

## 🔧 Configuration

### Environment Variables
```bash
# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Authentication
NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id

# ZeroDev Account Abstraction  
NEXT_PUBLIC_ZERODEV_PROJECT_ID=your-project-id
NEXT_PUBLIC_ZERODEV_BUNDLER_RPC=your-bundler-url
NEXT_PUBLIC_ZERODEV_PAYMASTER_RPC=your-paymaster-url

# Backend APIs
NEXT_PUBLIC_AUTH_API_URL=http://localhost:3001
NEXT_PUBLIC_CORE_API_URL=http://localhost:3007
NEXT_PUBLIC_AGGREGATOR_API_URL=http://localhost:3003

# Smart Contracts
NEXT_PUBLIC_DIAMOND_CONTRACT_BASE=0x...
NEXT_PUBLIC_DIAMOND_CONTRACT_BSC=0x...

# Blockchain RPCs
NEXT_PUBLIC_BASE_MAINNET_RPC=https://mainnet.base.org
NEXT_PUBLIC_BSC_MAINNET_RPC=https://bsc-dataseed.binance.org
```

## 🎨 UI Development

### Design System
- **Base**: shadcn/ui components
- **Styling**: TailwindCSS with custom theme
- **Effects**: Glass morphism, smooth animations
- **Responsive**: Mobile-first design

### Key Components
```typescript
// Trading Interface
- SwapInterface: Token selection, amount input, price display
- TokenSelector: Token search and selection
- PriceChart: Real-time price visualization
- SwapSettings: Slippage, gas preferences

// Wallet Management
- WalletSettings: Complete 48KB interface
- SessionKeyManager: Key lifecycle UI
- WalletOverview: Balance display
- SecuritySettings: Wallet security features

// Order Management  
- LimitInterface: Target price setting
- DCAInterface: Frequency configuration
- OrderHistory: Order status tracking
```

### Component Development
```typescript
// Example component structure
import { Button } from '@/components/ui/button';
import { useSessionKeys } from '@/hooks/useSessionKeys';

export function SwapInterface() {
  const { sessionKeys, generateSessionKey } = useSessionKeys();
  
  return (
    <div className="glass-card p-6">
      {/* Component implementation */}
    </div>
  );
}
```

## 🔗 API Integration

### API Client (19KB)
```typescript
// apps/web/src/lib/api-client.ts
export class APIClient {
  async getQuote(params: QuoteParams): Promise<Quote>
  async createOrder(order: CreateOrderParams): Promise<Order>
  async getPortfolio(): Promise<Portfolio>
  async getUserOrders(): Promise<Order[]>
}
```

### React Query Integration
```typescript
// Data fetching with React Query
import { useQuery } from '@tanstack/react-query';

export function usePortfolio() {
  return useQuery({
    queryKey: ['portfolio'],
    queryFn: () => apiClient.getPortfolio(),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
```

## 🧪 Testing

### Testing Strategy
- **Unit Tests**: Component testing with React Testing Library
- **Integration Tests**: User flow testing
- **E2E Tests**: Playwright for critical user journeys

### Test Examples
```typescript
// Component test
import { render, screen } from '@testing-library/react';
import { SwapInterface } from './swap-interface';

test('renders swap interface', () => {
  render(<SwapInterface />);
  expect(screen.getByText('Swap')).toBeInTheDocument();
});

// Integration test
test('user can create limit order', async () => {
  // Test implementation
});
```

## 📱 Responsive Design

### Breakpoints
```typescript
// TailwindCSS breakpoints
sm: '640px'   // Mobile landscape
md: '768px'   // Tablet
lg: '1024px'  // Desktop
xl: '1280px'  // Large desktop
```

### Mobile Optimization
- Collapsible navigation
- Touch-friendly interfaces
- Optimized for mobile trading
- Progressive Web App features

## 🚀 Production Deployment

### Build Optimization
```bash
# Production build
npm run build

# Analyze bundle
npm run analyze

# Docker build
docker build -t moonx-farm-frontend .
```

### Performance Targets
- **Lighthouse Score**: >90
- **First Contentful Paint**: <2s
- **Time to Interactive**: <3s
- **Bundle Size**: <500KB gzipped

---

**Modern frontend with Account Abstraction, ready for production deployment.** 