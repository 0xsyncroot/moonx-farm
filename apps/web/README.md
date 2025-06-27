# MoonX Farm - Jupiter-Style DEX Interface

Modern, responsive web application for decentralized token swapping with Jupiter-inspired UI/UX, built with Next.js 14, Privy authentication, and Account Abstraction wallets.

## 🚀 Features

### Core Trading Features
- **Instant Swap**: Real-time token swapping with multi-DEX price aggregation
- **Limit Orders**: Set target prices for automatic execution
- **DCA (Dollar-Cost Averaging)**: Automated recurring purchases
- **Smart Alerts**: Price alerts and copy trading notifications

### User Experience
- **Jupiter-Inspired Design**: Modern glass morphism UI with smooth animations
- **Social Login**: Email, Google, Twitter, GitHub, Telegram, Farcaster via Privy
- **Account Abstraction**: Gasless transactions and session keys
- **Mobile-First**: Responsive design optimized for all devices
- **Dark/Light Theme**: Automatic theme switching with system preference

### Technical Features
- **Real-Time Quotes**: Sub-second price updates from multiple sources
- **Cross-Chain Support**: Ethereum, Base, BSC networks
- **Smart Token Search**: Intelligent search with favorites and rankings
- **Portfolio Tracking**: P&L analysis and transaction history

## 🏗️ Architecture

### Frontend Stack
- **Next.js 14**: App Router with server components
- **TypeScript**: Full type safety and IntelliSense
- **TailwindCSS**: Utility-first styling with custom Jupiter theme
- **shadcn/ui**: High-quality React components
- **React Query**: Data fetching and caching
- **Next Themes**: Dark/light mode support

### Authentication & Wallets
- **Privy**: Social login and Account Abstraction wallets
- **Session Keys**: Gasless transaction management
- **Multi-Device**: Seamless experience across devices

### Backend Integration
- **Auth Service**: JWT-based authentication with Privy integration
- **Aggregator Service**: Multi-DEX price aggregation (LiFi, 1inch, Relay)
- **RESTful APIs**: Clean API design with automatic error handling

## 🛠️ Setup & Installation

### Prerequisites
- Node.js 18+ 
- pnpm (recommended) or npm
- Backend services running (auth-service, aggregator-service)

### 1. Install Dependencies
```bash
cd apps/web
pnpm install
```

### 2. Environment Configuration
```bash
cp .env.example .env.local
```

Configure your environment variables:
```env
# Privy Configuration
NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id
PRIVY_APP_SECRET=your-privy-app-secret

# API URLs
NEXT_PUBLIC_AUTH_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_AGGREGATOR_API_URL=http://localhost:3003/api/v1

# Blockchain Configuration  
NEXT_PUBLIC_DEFAULT_CHAIN_ID=1
NEXT_PUBLIC_SUPPORTED_CHAINS=1,8453,56
```

### 3. Start Development Server
```bash
pnpm dev
```

Visit `http://localhost:3000` to see the application.

## 🎨 Design System

### Brand Colors
- **Primary**: `rgba(255,120,66,.6)` - Jupiter orange with transparency
- **Gradient**: Dynamic gradients for buttons and accents
- **Glass Morphism**: Frosted glass effects throughout UI

### Component Structure
```
src/
├── components/           # Reusable UI components
│   ├── ui/              # Base shadcn/ui components
│   ├── layout/          # Header, navigation, layout
│   ├── swap/            # Trading interface components
│   ├── orders/          # Limit orders and DCA
│   └── providers/       # Context providers
├── hooks/               # Custom React hooks
│   ├── use-auth.ts      # Authentication logic
│   ├── use-tokens.ts    # Token search and management
│   ├── use-quote.ts     # Price quotes and swapping
│   └── use-debounce.ts  # Search optimization
├── lib/                 # Utilities and configurations
│   ├── api-client.ts    # Backend API integration
│   ├── utils.ts         # Helper functions
│   └── constants.ts     # App constants
└── app/                 # Next.js App Router pages
    ├── layout.tsx       # Root layout with providers
    ├── page.tsx         # Home page (swap interface)
    ├── orders/          # Orders management
    ├── portfolio/       # Portfolio and history
    └── alerts/          # Alerts and copy trading
```

## 🔗 API Integration

### Authentication Flow
1. User connects via Privy social login
2. Privy token sent to auth service for backend authentication
3. JWT tokens returned for API authorization
4. Auto-refresh on token expiry

### Token Search
```typescript
// Search tokens with intelligent ranking
const { tokens, isLoading } = useTokens({
  chainId: 1,
  searchQuery: 'USDC',
  enabled: true
})
```

### Quote Management
```typescript
// Get real-time quotes
const { quote, isLoading, refetch } = useQuote()

// Update quote parameters
setFromToken(token)
setToToken(token)
setAmount('100')
setSlippage(1.0)
```

## 🎯 Key Components

### SwapInterface
Main trading widget with:
- Token selection with intelligent search
- Amount input with USD value display
- Real-time quote updates
- Price impact warnings
- Gas fee estimates

### TokenSelector
Jupiter-style token picker:
- Search with debounced queries
- Popular tokens section
- Favorites management
- Verified token badges
- Real-time price data

### SwapButton
Smart swap execution:
- Connection state management
- Wallet creation handling
- Quote validation
- Error handling
- Price impact warnings

## 🔧 Development

### Code Quality
- **ESLint**: Configured for Next.js and TypeScript
- **TypeScript**: Strict mode with comprehensive types
- **Prettier**: Consistent code formatting

### Performance Optimizations
- **React Query**: Intelligent caching and background updates
- **Debounced Search**: Optimized API calls
- **Image Optimization**: Next.js automatic image optimization
- **Code Splitting**: Automatic route-based splitting

### Testing Strategy
```bash
# Type checking
pnpm type-check

# Linting
pnpm lint

# Build verification
pnpm build
```

## 🚀 Deployment

### Production Build
```bash
pnpm build
pnpm start
```

### Environment Setup
Ensure production environment variables:
- Privy production app credentials
- Production API endpoints
- Analytics tokens (optional)

### Performance Monitoring
- Lighthouse scores optimization
- Core Web Vitals tracking
- Error boundary implementations

## 🔒 Security

### Authentication Security
- JWT token management with automatic refresh
- Secure token storage in httpOnly cookies (production)
- CSRF protection via SameSite cookies

### Web3 Security
- Account Abstraction for enhanced security
- Session key management for gasless transactions
- Smart contract interaction safety

## 📱 Mobile Optimization

### Responsive Design
- Mobile-first approach
- Touch-optimized interactions
- Optimized for iOS Safari and Android Chrome

### Performance
- Lazy loading for heavy components
- Efficient re-renders with React.memo
- Optimized bundle size

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Make changes with proper TypeScript types
4. Test thoroughly on mobile and desktop
5. Submit pull request with detailed description

### Code Standards
- Follow existing component patterns
- Add TypeScript types for all props
- Include error handling
- Write self-documenting code
- Add comments for complex logic

## 📄 License

This project is part of the MoonX Farm DEX ecosystem. See the main repository for license information.

## 🆘 Support

### Common Issues
1. **Privy Connection Failed**: Check app ID and network configuration
2. **API Errors**: Ensure backend services are running
3. **Token Search Empty**: Verify aggregator service connection
4. **Quote Loading Forever**: Check network and API endpoints

### Getting Help
- Check backend service logs
- Verify environment variables
- Test API endpoints directly
- Review browser console for errors

---

Built with ❤️ for the DeFi community 