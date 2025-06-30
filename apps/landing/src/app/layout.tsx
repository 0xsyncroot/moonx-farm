import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'MoonX Farm - The Future of DeFi Trading',
  description: 'Trade gasless with smart wallets. The first multi-aggregator DEX with Account Abstraction, social login, and MEV protection.',
  keywords: ['DeFi', 'DEX', 'Trading', 'Gasless', 'Account Abstraction', 'Smart Wallets', 'Social Login'],
  authors: [{ name: 'MoonX Farm Team' }],
  creator: 'MoonX Farm',
  publisher: 'MoonX Farm',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://moonx.farm',
    title: 'MoonX Farm - The Future of DeFi Trading',
    description: 'Trade gasless with smart wallets. Get the best prices across all DEXs with zero gas fees.',
    siteName: 'MoonX Farm',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'MoonX Farm - DeFi Trading Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MoonX Farm - The Future of DeFi Trading',
    description: 'Trade gasless with smart wallets. Get the best prices across all DEXs with zero gas fees.',
    images: ['/og-image.png'],
    creator: '@moonxfarm',
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
    google: 'your-google-verification-code',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  )
} 