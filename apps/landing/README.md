# MoonX Farm Landing Page

A professional landing page for MoonX Farm DEX - showcasing the future of DeFi trading with Account Abstraction and gasless transactions.

## ✨ Features

- **Modern Design**: Jupiter-inspired UI with glass morphism effects
- **Responsive**: Mobile-first responsive design
- **Performance**: Optimized Next.js 14 with App Router
- **SEO Ready**: Complete meta tags and Open Graph setup
- **Professional**: Conversion-optimized landing page design

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- pnpm (recommended) or npm

### Installation

1. **Install dependencies**:
```bash
cd apps/landing
pnpm install
```

2. **Setup environment**:
```bash
cp .env.example .env.local
```

3. **Start development server**:
```bash
pnpm dev
```

The landing page will be available at `http://localhost:3001`

### Build for Production

```bash
pnpm build
pnpm start
```

## 🎨 Design Features

### Jupiter-Inspired UI
- Glass morphism effects with backdrop blur
- Smooth animations and transitions
- Professional gradient color scheme
- Modern card-based layout

### Key Sections
1. **Hero Section**: Compelling value proposition with CTAs
2. **Features Grid**: 6 key features with icons and descriptions  
3. **How It Works**: 3-step onboarding process
4. **Trust Signals**: Stats and social proof
5. **CTA Section**: Final conversion push
6. **Footer**: Links and company information

### Visual Elements
- Floating orb animations
- Gradient text effects
- Hover animations
- Smooth scroll indicators
- Custom button styles (btn-jupiter)

## 🔧 Configuration

### Environment Variables

```bash
# Main app URL for "Launch App" buttons
NEXT_PUBLIC_MAIN_APP_URL=http://localhost:3000

# Landing page URL
NEXT_PUBLIC_APP_URL=http://localhost:3001

# SEO Configuration
NEXT_PUBLIC_SITE_URL=https://moonx.farm
NEXT_PUBLIC_OG_IMAGE_URL=/og-image.png
```

### Customization

#### Colors
The color scheme uses CSS custom properties defined in `globals.css`:
- Primary: Orange gradient (`from-orange-500 to-orange-400`)
- Background: Dark theme with gradient
- Accent: Glass morphism effects

#### Content
Update content in `src/app/page.tsx`:
- Hero headlines and descriptions
- Feature cards content
- Trust signals and stats
- CTA button text and links

#### Styling
Custom CSS classes in `globals.css`:
- `.btn-jupiter`: Main CTA button style
- `.text-gradient`: Gradient text effect
- `.feature-card`: Feature card styling
- `.floating-orb`: Animated background elements

## 📱 Responsive Design

### Breakpoints
- Mobile: `< 768px`
- Tablet: `768px - 1024px` 
- Desktop: `> 1024px`

### Mobile Optimizations
- Touch-friendly button sizes
- Optimized text sizing
- Simplified layouts
- Fast loading performance

## 🔗 Integration

### Main App Connection
The landing page connects to the main trading app via:
- "Launch App" buttons linking to `NEXT_PUBLIC_MAIN_APP_URL`
- Consistent branding and messaging
- Seamless user flow from marketing to product

### Analytics Ready
Ready for analytics integration:
- Google Analytics setup
- Mixpanel integration points
- Conversion tracking ready
- User journey optimization

## 🚀 Deployment

### Vercel (Recommended)
```bash
vercel --prod
```

### Docker
```bash
docker build -t moonx-landing .
docker run -p 3001:3001 moonx-landing
```

### Manual Build
```bash
pnpm build
# Upload 'out' folder to static hosting
```

## 📊 Performance

### Core Web Vitals
- **LCP**: < 2.5s (optimized images and fonts)
- **FID**: < 100ms (minimal JavaScript)
- **CLS**: < 0.1 (stable layouts)

### Optimizations
- Next.js automatic optimizations
- Image optimization
- Font optimization (Inter)
- CSS purging
- Bundle splitting

## 🎯 Conversion Optimization

### CTA Strategy
- Primary CTA: "Launch App" (consistent across page)
- Secondary CTA: "Watch Demo" (engagement)
- Trust signals throughout
- Urgency indicators ("first 10 trades free")

### User Journey
1. **Attention**: Hero section with value proposition
2. **Interest**: Features and benefits
3. **Desire**: How it works + social proof
4. **Action**: Final CTA with benefits recap

## 🔒 SEO & Meta Tags

### Complete SEO Setup
- Title and description optimization
- Open Graph tags for social sharing
- Twitter Card tags
- Structured data ready
- Sitemap generation
- Robot.txt configuration

### Keywords Targeting
- DeFi trading
- Gasless transactions  
- Account Abstraction
- Smart wallets
- DEX aggregator

## 🛠️ Development

### Tech Stack
- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS with custom design system
- **Icons**: Lucide React
- **Fonts**: Inter (Google Fonts)
- **Animations**: CSS animations + Tailwind utilities

### Code Structure
```
src/
├── app/                 # Next.js App Router
│   ├── layout.tsx      # Root layout with metadata
│   ├── page.tsx        # Main landing page
│   └── globals.css     # Global styles
├── components/
│   └── ui/             # Reusable UI components
│       ├── button.tsx  # Button component
│       └── card.tsx    # Card components
└── lib/
    └── utils.ts        # Utility functions
```

### Component Architecture
- Reusable UI components
- Responsive design patterns
- Accessibility considerations
- Performance optimizations

## 📈 Analytics & Tracking

### Ready for Integration
- Google Analytics 4
- Mixpanel events
- Facebook Pixel
- Custom event tracking
- Conversion funnel analysis

### Key Metrics to Track
- Landing page views
- CTA click rates
- User scroll depth
- Time on page
- Conversion to main app

## 🤝 Contributing

1. Follow the existing code style
2. Update documentation for new features
3. Test responsive design
4. Optimize for performance
5. Maintain accessibility standards

## 📞 Support

For questions or issues:
- Create an issue in the repository
- Check existing documentation
- Review the design system guidelines

---

**MoonX Farm** - The Future of DeFi Trading 