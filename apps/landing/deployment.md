# MoonX Farm Landing Page - Deployment Guide

This guide covers deploying the MoonX Farm landing page as a standalone application.

## 🌐 Deployment Options

### 1. Vercel (Recommended) ⭐

**Why Vercel:**
- Optimized for Next.js
- Automatic deployments
- Edge network (fast loading)
- Easy environment management

**Setup:**
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd apps/landing
vercel

# Production deployment
vercel --prod
```

**Environment Variables in Vercel:**
```
NEXT_PUBLIC_MAIN_APP_URL=https://app.moonx.farm
NEXT_PUBLIC_SITE_URL=https://moonx.farm
NEXT_PUBLIC_GA_TRACKING_ID=GA-XXXXXXXXX
```

### 2. Netlify

**Build Settings:**
- **Build command**: `npm run build && npm run export`
- **Publish directory**: `out`
- **Node version**: 18.x

**Deploy:**
```bash
# Build for static export
npm run build
npm run export

# Upload 'out' folder to Netlify
```

### 3. AWS S3 + CloudFront

**For static hosting:**
```bash
# Build static version
npm run build
npm run export

# Upload to S3
aws s3 sync out/ s3://your-bucket-name --delete

# CloudFront distribution for global CDN
```

### 4. Docker Deployment

**Build Image:**
```bash
cd apps/landing
docker build -t moonx-landing .
```

**Run Container:**
```bash
docker run -p 3001:3001 \
  -e NEXT_PUBLIC_MAIN_APP_URL=https://app.moonx.farm \
  -e NEXT_PUBLIC_SITE_URL=https://moonx.farm \
  moonx-landing
```

**Docker Compose:**
```yaml
version: '3.8'
services:
  landing:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NEXT_PUBLIC_MAIN_APP_URL=https://app.moonx.farm
      - NEXT_PUBLIC_SITE_URL=https://moonx.farm
      - NODE_ENV=production
```

## ⚙️ Environment Configuration

### Production Environment Variables

```bash
# Core Configuration
NEXT_PUBLIC_MAIN_APP_URL=https://app.moonx.farm
NEXT_PUBLIC_SITE_URL=https://moonx.farm
NEXT_PUBLIC_APP_URL=https://moonx.farm

# SEO & Social
NEXT_PUBLIC_OG_IMAGE_URL=/og-image.png
NEXT_PUBLIC_TWITTER_URL=https://twitter.com/moonxfarm
NEXT_PUBLIC_DISCORD_URL=https://discord.gg/moonxfarm

# Analytics
NEXT_PUBLIC_GA_TRACKING_ID=GA-XXXXXXXXX
NEXT_PUBLIC_MIXPANEL_TOKEN=your-mixpanel-token
NEXT_PUBLIC_HOTJAR_ID=your-hotjar-id

# Feature Flags
NEXT_PUBLIC_SHOW_DEMO_VIDEO=true
NEXT_PUBLIC_MAINTENANCE_MODE=false

# Contact
NEXT_PUBLIC_SUPPORT_EMAIL=support@moonx.farm
NEXT_PUBLIC_BUSINESS_EMAIL=hello@moonx.farm
```

### Environment-Specific Configs

**Development (.env.local):**
```bash
NEXT_PUBLIC_MAIN_APP_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3001
NEXT_PUBLIC_SHOW_DEMO_VIDEO=true
```

**Staging (.env.staging):**
```bash
NEXT_PUBLIC_MAIN_APP_URL=https://staging-app.moonx.farm
NEXT_PUBLIC_SITE_URL=https://staging.moonx.farm
NEXT_PUBLIC_GA_TRACKING_ID=GA-STAGING-ID
```

**Production (.env.production):**
```bash
NEXT_PUBLIC_MAIN_APP_URL=https://app.moonx.farm
NEXT_PUBLIC_SITE_URL=https://moonx.farm
NEXT_PUBLIC_GA_TRACKING_ID=GA-PRODUCTION-ID
```

## 🚀 CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy-landing.yml
name: Deploy Landing Page

on:
  push:
    branches: [main]
    paths: ['apps/landing/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        working-directory: apps/landing
        run: npm ci
        
      - name: Build
        working-directory: apps/landing
        run: npm run build
        env:
          NEXT_PUBLIC_MAIN_APP_URL: ${{ secrets.MAIN_APP_URL }}
          NEXT_PUBLIC_SITE_URL: ${{ secrets.SITE_URL }}
          
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: apps/landing
```

### Auto-Deployment Features

**Vercel Integration:**
- **Git Integration**: Auto-deploy on push to main
- **Preview Deployments**: PR previews
- **Environment Branches**: Staging/production environments

**Branch Strategy:**
- `main` → Production deployment
- `staging` → Staging environment  
- Feature branches → Preview deployments

## 📊 Performance Optimization

### Build Optimizations

```javascript
// next.config.js optimizations
module.exports = {
  output: 'standalone',
  compress: true,
  poweredByHeader: false,
  
  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 31536000, // 1 year
  },
  
  // Performance headers
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        {
          key: 'X-Frame-Options',
          value: 'DENY',
        },
      ],
    },
  ],
}
```

### CDN Configuration

**CloudFront Cache Settings:**
- **HTML files**: Cache for 1 hour
- **Static assets**: Cache for 1 year
- **Images**: Cache for 1 month with compression

**Vercel Edge Network:**
- Automatic global distribution
- Intelligent caching
- Edge functions for dynamic content

## 🔒 Security & Monitoring

### Security Headers

```javascript
// Security headers in next.config.js
const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'Referrer-Policy',
    value: 'origin-when-cross-origin'
  }
]
```

### Monitoring Setup

**Vercel Analytics:**
- Core Web Vitals monitoring
- Real user metrics
- Performance insights

**Third-party Monitoring:**
```javascript
// Google Analytics 4
gtag('config', 'GA_TRACKING_ID', {
  page_title: 'MoonX Farm Landing',
  page_location: window.location.href
});

// Performance monitoring
new PerformanceObserver((list) => {
  list.getEntries().forEach((entry) => {
    if (entry.entryType === 'largest-contentful-paint') {
      gtag('event', 'LCP', {
        value: Math.round(entry.startTime)
      });
    }
  });
}).observe({entryTypes: ['largest-contentful-paint']});
```

## 🔄 Maintenance & Updates

### Update Process

1. **Development**: Test changes locally
2. **Staging**: Deploy to staging environment
3. **Testing**: Verify functionality and performance
4. **Production**: Deploy to production

### Rollback Strategy

**Vercel Rollback:**
```bash
# List deployments
vercel ls

# Rollback to previous deployment
vercel rollback [deployment-url]
```

**Manual Rollback:**
```bash
# Keep previous build artifacts
mv out out-backup
git checkout HEAD~1
npm run build
```

### Performance Monitoring

**Key Metrics:**
- **Core Web Vitals**: LCP, FID, CLS
- **Page Load Time**: < 2 seconds target
- **Bundle Size**: Monitor build output
- **Conversion Rate**: Track CTA clicks

**Monitoring Tools:**
- Vercel Analytics
- Google PageSpeed Insights
- GTmetrix
- Lighthouse CI

## 📋 Deployment Checklist

### Pre-Deployment
- [ ] Environment variables configured
- [ ] Build passes locally
- [ ] Performance tests pass
- [ ] SEO meta tags verified
- [ ] Analytics tracking works

### Post-Deployment  
- [ ] Landing page loads correctly
- [ ] "Launch App" buttons work
- [ ] Mobile responsiveness verified
- [ ] Core Web Vitals meet targets
- [ ] Analytics events firing

### Production Readiness
- [ ] SSL certificate configured
- [ ] CDN/Edge network setup
- [ ] Security headers implemented
- [ ] Monitoring alerts configured
- [ ] Backup/rollback plan tested

---

**Deployment Status**: ✅ Production Ready  
**Performance**: ✅ Optimized for Core Web Vitals  
**SEO**: ✅ Search Engine Optimized  
**Security**: ✅ Security Best Practices Applied 