import type { Metadata } from 'next'

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.moonx.farm'
const siteName = 'MoonXFarm'
const defaultImage = '/images/social-cards/og-home.png'
const fallbackImage = '/icons/android-chrome-512x512.png' // Fallback if custom cards not available

// Common keywords across all pages
const commonKeywords = [
  'MoonXFarm',
  'DEX',
  'DeFi',
  'Cross-chain',
  'Account Abstraction',
  'Gasless transactions',
  'ZeroDev',
  'Smart Wallet',
  'Multi-chain',
  'Base',
  'BSC',
  'Ethereum',
  'Polygon',
  'Arbitrum',
  'Optimism'
]

// Base metadata configuration
const baseMetadata: Partial<Metadata> = {
  metadataBase: new URL(baseUrl),
  authors: [{ name: 'MoonXFarm Team' }],
  creator: 'MoonXFarm Team',
  publisher: 'MoonXFarm',
  category: 'Finance',
  classification: 'DeFi Application',
  icons: [
    { rel: 'icon', type: 'image/x-icon', url: '/icons/favicon.ico' },
    { rel: 'icon', type: 'image/png', sizes: '16x16', url: '/icons/logo-16x16.png' },
    { rel: 'icon', type: 'image/png', sizes: '32x32', url: '/icons/logo-32x32.png' },
    { rel: 'apple-touch-icon', sizes: '180x180', url: '/icons/apple-touch-icon.png' },
    { rel: 'shortcut icon', url: '/icons/favicon.ico' },
  ],
  manifest: '/manifest.json',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION,
  },
}

// Page-specific metadata
export const pageMetadata = {
  // Home Page - Main Swap Interface
  home: {
    title: 'MoonXFarm - Cross-Chain DEX Aggregator | Gasless Crypto Trading',
    description: 'Trade cryptocurrencies across multiple chains with zero gas fees. Get best prices from 50+ DEXs with intelligent routing, limit orders, and Account Abstraction technology.',
    keywords: [
      ...commonKeywords,
      'Swap',
      'Crypto trading',
      'Best prices',
      'Liquidity aggregator',
      'Token swap',
      'DeFi trading',
      'Slippage protection',
      'MEV protection',
      'Trading interface',
      'Real-time quotes'
    ],
         openGraph: {
       title: 'MoonXFarm - Cross-Chain DEX Aggregator | Gasless Crypto Trading',
       description: 'Trade cryptocurrencies across multiple chains with zero gas fees. Get best prices from 50+ DEXs with intelligent routing and Account Abstraction.',
       url: baseUrl,
       siteName,
       images: [
         {
           url: '/images/social-cards/og-home.png',
           width: 1200,
           height: 630,
           alt: 'MoonXFarm - Cross-Chain DEX Aggregator with Gasless Trading and Account Abstraction',
         },
       ],
       locale: 'en_US',
       type: 'website',
     },
         twitter: {
       card: 'summary_large_image',
       title: 'MoonXFarm - Cross-Chain DEX Aggregator',
       description: 'Trade crypto with zero gas fees across multiple chains. Best prices from 50+ DEXs.',
       images: ['/images/social-cards/og-home.png'],
       creator: '@moonxfarm',
     },
  },

  // Swap Page
  swap: {
    title: 'Crypto Swap | MoonXFarm Cross-Chain DEX Aggregator',
    description: 'Swap tokens across 6+ blockchains with zero gas fees. Compare prices from 50+ DEXs including Uniswap, PancakeSwap, SushiSwap. Get best rates with intelligent routing.',
    keywords: [
      ...commonKeywords,
      'Token swap',
      'Crypto exchange',
      'Uniswap',
      'PancakeSwap',
      'SushiSwap',
      '1inch',
      'Paraswap',
      'Best rates',
      'Price comparison',
      'Cross-chain bridge',
      'Token bridge',
      'DeFi protocols'
    ],
         openGraph: {
       title: 'Crypto Swap | MoonXFarm Cross-Chain DEX Aggregator',
       description: 'Swap tokens across 6+ blockchains with zero gas fees. Compare prices from 50+ DEXs for best rates.',
       url: `${baseUrl}/swap`,
       siteName,
       images: [
         {
           url: '/images/social-cards/og-swap.png',
           width: 1200,
           height: 630,
           alt: 'MoonXFarm Crypto Swap - Compare 50+ DEXs with Gasless Trading',
         },
       ],
       locale: 'en_US',
       type: 'website',
     },
     twitter: {
       card: 'summary_large_image',
       title: 'Crypto Swap | MoonXFarm DEX',
       description: 'Swap tokens across chains with zero gas fees. Best rates from 50+ DEXs.',
       images: ['/images/social-cards/og-swap.png'],
     },
  },

  // Orders Page - Limit Orders & DCA
  orders: {
    title: 'Limit Orders & DCA | Advanced Trading on MoonXFarm DEX',
    description: 'Set limit orders and Dollar Cost Averaging (DCA) strategies with Account Abstraction. Automate your crypto trading across multiple chains without gas fees.',
    keywords: [
      ...commonKeywords,
      'Limit orders',
      'DCA',
      'Dollar Cost Averaging',
      'Automated trading',
      'Trading strategies',
      'Order management',
      'Stop loss',
      'Take profit',
      'Advanced trading',
      'Trading automation',
      'Smart orders',
      'Conditional orders'
    ],
         openGraph: {
       title: 'Limit Orders & DCA | Advanced Trading on MoonXFarm DEX',
       description: 'Set limit orders and DCA strategies with Account Abstraction. Automate trading across chains without gas fees.',
       url: `${baseUrl}/orders`,
       siteName,
       images: [
         {
           url: '/images/social-cards/og-orders.png',
           width: 1200,
           height: 630,
           alt: 'MoonXFarm Advanced Trading - Limit Orders & DCA Automation with Zero Gas Fees',
         },
       ],
       locale: 'en_US',
       type: 'website',
     },
     twitter: {
       card: 'summary_large_image',
       title: 'Limit Orders & DCA | MoonXFarm DEX',
       description: 'Automate your crypto trading with limit orders and DCA strategies. Zero gas fees.',
       images: ['/images/social-cards/og-orders.png'],
     },
  },

  // Portfolio Page - P&L Tracking
  portfolio: {
    title: 'Portfolio Tracker | P&L Analytics on MoonXFarm DEX',
    description: 'Track your crypto portfolio across 6+ chains with real-time P&L analytics. Monitor trading history, performance metrics, and token holdings in one dashboard.',
    keywords: [
      ...commonKeywords,
      'Portfolio tracker',
      'P&L analytics',
      'Profit and loss',
      'Trading history',
      'Performance metrics',
      'Token holdings',
      'Portfolio analysis',
      'Asset tracking',
      'Investment dashboard',
      'DeFi portfolio',
      'Multi-chain portfolio',
      'Trading statistics'
    ],
         openGraph: {
       title: 'Portfolio Tracker | P&L Analytics on MoonXFarm DEX',
       description: 'Track your crypto portfolio across 6+ chains with real-time P&L analytics and performance metrics.',
       url: `${baseUrl}/portfolio`,
       siteName,
       images: [
         {
           url: '/images/social-cards/og-portfolio.png',
           width: 1200,
           height: 630,
           alt: 'MoonXFarm Portfolio Tracker - Real-time P&L Analytics Across 6+ Chains',
         },
       ],
       locale: 'en_US',
       type: 'website',
     },
     twitter: {
       card: 'summary_large_image',
       title: 'Portfolio Tracker | MoonXFarm DEX',
       description: 'Track your crypto portfolio with real-time P&L analytics across multiple chains.',
       images: ['/images/social-cards/og-portfolio.png'],
     },
  },

  // Wallet Settings Page
  walletSettings: {
    title: 'Smart Wallet Settings | Account Abstraction on MoonXFarm',
    description: 'Manage your smart wallet with Account Abstraction technology. Set up session keys, gasless transactions, and security settings for seamless DeFi trading.',
    keywords: [
      ...commonKeywords,
      'Smart wallet',
      'Wallet management',
      'Session keys',
      'Wallet security',
      'Gasless setup',
      'Account settings',
      'Wallet configuration',
      'ZeroDev wallet',
      'ERC-4337',
      'Smart contract wallet',
      'Wallet permissions',
      'Security settings'
    ],
         openGraph: {
       title: 'Smart Wallet Settings | Account Abstraction on MoonXFarm',
       description: 'Manage your smart wallet with Account Abstraction. Set up session keys and gasless transactions.',
       url: `${baseUrl}/wallet-settings`,
       siteName,
       images: [
         {
           url: '/images/social-cards/og-wallet.png',
           width: 1200,
           height: 630,
           alt: 'MoonXFarm Smart Wallet - Account Abstraction with Session Keys and Enterprise Security',
         },
       ],
       locale: 'en_US',
       type: 'website',
     },
     twitter: {
       card: 'summary_large_image',
       title: 'Smart Wallet Settings | MoonXFarm',
       description: 'Manage your smart wallet with Account Abstraction technology. Session keys & gasless setup.',
       images: ['/images/social-cards/og-wallet.png'],
     },
  },

  // Alerts Page - Smart Alerts & Copy Trading
  alerts: {
    title: 'Smart Alerts & Copy Trading | MoonXFarm DEX Notifications',
    description: 'Set up smart price alerts and copy successful traders automatically. Get real-time notifications for market movements and trading opportunities across all chains.',
    keywords: [
      ...commonKeywords,
      'Smart alerts',
      'Price alerts',
      'Copy trading',
      'Trading signals',
      'Market notifications',
      'Automated alerts',
      'Trading notifications',
      'Price monitoring',
      'Social trading',
      'Follow traders',
      'Trading alerts',
      'Market analysis'
    ],
         openGraph: {
       title: 'Smart Alerts & Copy Trading | MoonXFarm DEX Notifications',
       description: 'Set up smart price alerts and copy successful traders. Real-time notifications for market movements.',
       url: `${baseUrl}/alerts`,
       siteName,
       images: [
         {
           url: '/images/social-cards/og-alerts.png',
           width: 1200,
           height: 630,
           alt: 'MoonXFarm Smart Alerts & Copy Trading - Never Miss Trading Opportunities',
         },
       ],
       locale: 'en_US',
       type: 'website',
     },
     twitter: {
       card: 'summary_large_image',
       title: 'Smart Alerts & Copy Trading | MoonXFarm',
       description: 'Smart price alerts and copy trading. Real-time notifications for trading opportunities.',
       images: ['/images/social-cards/og-alerts.png'],
     },
  },
}

// Helper function to generate complete metadata for a page
export function generatePageMetadata(
  pageKey: keyof typeof pageMetadata,
  customData?: Partial<Metadata>
): Metadata {
  const pageData = pageMetadata[pageKey]
  const pageKeywords = Array.isArray(pageData.keywords) ? pageData.keywords : []
  const customKeywords = Array.isArray(customData?.keywords) ? customData.keywords : []
  
  return {
    ...baseMetadata,
    ...pageData,
    ...customData,
    keywords: Array.from(new Set([...pageKeywords, ...customKeywords])),
  }
}

// Export base metadata for layout
export const layoutMetadata: Metadata = {
  ...baseMetadata,
  ...pageMetadata.home,
}

// Structured data for SEO
export const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'MoonXFarm',
  url: baseUrl,
  description: 'Cross-chain DEX aggregator with gasless transactions and Account Abstraction technology',
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Web Browser',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    description: 'Free cross-chain cryptocurrency trading with zero gas fees',
  },
  featureList: [
    'Cross-chain token swapping',
    'Gasless transactions',
    'Limit orders',
    'Dollar Cost Averaging (DCA)',
    'Portfolio tracking',
    'Price alerts',
    'Copy trading',
    'Account Abstraction',
  ],
  sameAs: [
    'https://twitter.com/moonxfarm',
    'https://github.com/moonx-farm',
    'https://discord.gg/moonxfarm',
  ],
} 