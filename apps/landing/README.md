# MoonX Farm Landing Page

A professional, standalone landing page for MoonX Farm DEX - showcasing the future of DeFi trading with Account Abstraction and gasless transactions.

## ✨ Features

- **Modern Design**: Jupiter-inspired UI with glass morphism effects
- **Responsive**: Mobile-first responsive design optimized for all devices
- **Performance**: Optimized Next.js 14 with App Router (Ready in <2s)
- **SEO Ready**: Complete meta tags, Open Graph, and Twitter Card setup
- **Production Ready**: Standalone deployment with environment configuration
- **Analytics Ready**: Google Analytics, Mixpanel integration points

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Local Development

1. **Clone and install**:
```bash
cd apps/landing
npm install
```

2. **Setup environment**:
```bash
cp .env.example .env.local
# Edit .env.local with your configuration
```

3. **Start development server**:
```bash
npm run dev
```

The landing page will be available at `http://localhost:3001`

### Production Build

```bash
npm run build
npm start
```

## 🌐 Deployment

### Vercel (Recommended)

1. **Connect repository** to Vercel
2. **Set environment variables** in Vercel dashboard
3. **Deploy** - automatic with git pushes

```bash
# Or using Vercel CLI
npm install -g vercel
vercel --prod
```

### Netlify

1. **Build command**: `npm run build`
2. **Publish directory**: `out`
3. **Environment variables**: Set in Netlify dashboard

### Docker

```bash
docker build -t moonx-landing .
docker run -p 3001:3001 moonx-landing
```

### Static Export

```bash
npm run export
# Upload 'out' folder to any static hosting
```

## ⚙️ Configuration

### Environment Variables

```bash
# Required
NEXT_PUBLIC_MAIN_APP_URL=https://app.moonx.farm
NEXT_PUBLIC_SITE_URL=https://moonx.farm

# Optional
NEXT_PUBLIC_GA_TRACKING_ID=GA-XXXXXXXXX
NEXT_PUBLIC_MIXPANEL_TOKEN=your-mixpanel-token
NEXT_PUBLIC_SHOW_DEMO_VIDEO=true
```

### Features Customization

```typescript
// In src/app/page.tsx
const MAIN_APP_URL = process.env.NEXT_PUBLIC_MAIN_APP_URL || 'https://app.moonx.farm'
const SHOW_DEMO_VIDEO = process.env.NEXT_PUBLIC_SHOW_DEMO_VIDEO === 'true'
```

## 🎨 Design System

### Color Palette
- **Primary**: Orange gradient (`from-orange-500 to-orange-400`)
- **Background**: Dark gradient (`from-gray-900 via-gray-800 to-gray-900`)
- **Accent**: Glass morphism with backdrop blur

### Key Components
- `.btn-jupiter`: Main CTA button with hover effects
- `.text-gradient`: Orange gradient text effect
- `.feature-card`: Feature cards with hover animations
- `.floating-orb`: Animated background elements

### Typography
- **Font**: Inter (Google Fonts)
- **Headings**: 5xl-7xl with bold weight
- **Body**: xl-2xl for readability

## 📱 Responsive Breakpoints

- **Mobile**: `< 768px` - Stack layouts, larger touch targets
- **Tablet**: `768px - 1024px` - Optimized grid layouts
- **Desktop**: `> 1024px` - Full feature layout

## 🔗 Integration Points

### Main App Connection
- **Launch App buttons** → `NEXT_PUBLIC_MAIN_APP_URL`
- **Consistent branding** with main trading app
- **Seamless user flow** from marketing to product

### Analytics Integration
```typescript
// Google Analytics 4
gtag('event', 'click', {
  event_category: 'CTA',
  event_label: 'Launch App'
});

// Mixpanel
mixpanel.track('Landing Page CTA Click', {
  button: 'Launch App',
  location: 'Hero Section'
});
```

## 📊 Performance Metrics

### Core Web Vitals Targets
- **LCP (Largest Contentful Paint)**: < 2.5s ✅
- **FID (First Input Delay)**: < 100ms ✅  
- **CLS (Cumulative Layout Shift)**: < 0.1 ✅

### Current Performance
- **Build Time**: ~30s
- **Page Load**: ~1s (optimized assets)
- **Bundle Size**: ~200KB (gzipped)

## 🎯 Conversion Optimization

### CTA Strategy
1. **Primary CTA**: "Launch App" (consistent across page)
2. **Secondary CTA**: "Watch Demo" (conditional rendering)
3. **Trust Signals**: Stats and social proof throughout
4. **Urgency**: "First 10 trades free" messaging

### User Journey Optimization
- **Hero**: Immediate value proposition
- **Features**: Benefits-focused content
- **How It Works**: Simple 3-step process
- **Social Proof**: Trust indicators and stats
- **Final CTA**: Action-oriented with benefits recap

## 🔒 SEO Optimization

### Meta Tags
- **Title**: "MoonX Farm - The Future of DeFi Trading"
- **Description**: Optimized for search engines
- **Keywords**: DeFi, gasless, Account Abstraction, smart wallets
- **Open Graph**: Social sharing optimization

### Technical SEO
- **Sitemap**: Auto-generated
- **Robots.txt**: Search engine directives
- **Structured Data**: Ready for implementation
- **Fast Loading**: Performance-optimized

## 🛠️ Development

### Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **TypeScript**: Full type safety
- **Build**: Native Next.js optimization

### Code Structure
```
src/
├── app/
│   ├── layout.tsx      # Root layout + SEO
│   ├── page.tsx        # Landing page
│   └── globals.css     # Design system
├── components/
│   └── ui/             # Reusable components
└── lib/
    └── utils.ts        # Utilities
```

### Best Practices
- **Component Architecture**: Reusable, typed components
- **Performance**: Image optimization, code splitting
- **Accessibility**: ARIA labels, keyboard navigation
- **SEO**: Semantic HTML, meta optimization

## 📈 Analytics & Tracking

### Key Metrics
- **Page Views**: Total landing page traffic
- **CTA Click Rate**: Launch App button clicks
- **Scroll Depth**: User engagement measurement
- **Time on Page**: Content engagement
- **Conversion Rate**: Landing → App transition

### Implementation Ready
- Google Analytics 4 integration
- Mixpanel event tracking
- Conversion funnel analysis
- A/B testing framework

## 🚀 Performance Optimizations

### Next.js Features
- **App Router**: Latest Next.js architecture
- **Image Optimization**: Automatic WebP conversion
- **Font Optimization**: Inter font loading
- **Bundle Analysis**: Code splitting

### Custom Optimizations
- **CSS Purging**: Unused styles removed
- **Asset Compression**: Optimized file sizes
- **Caching Strategy**: Static asset caching
- **CDN Ready**: Global content delivery

## 🤝 Contributing

1. **Code Style**: Follow existing patterns
2. **Performance**: Maintain Core Web Vitals
3. **Responsive**: Test across devices
4. **SEO**: Maintain meta tags
5. **Analytics**: Track new features

## 📞 Support

- **Issues**: Create GitHub issue
- **Documentation**: Check README sections
- **Performance**: Use Lighthouse audits
- **SEO**: Use Google Search Console

---

**MoonX Farm** - The Future of DeFi Trading  
🚀 **Ready for production deployment** 