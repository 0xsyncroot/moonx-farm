import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import { PrivyProvider } from '@/components/providers/privy-provider'
import { QueryProvider } from '@/components/providers/query-provider'
import { ChatProvider } from '@/components/ai/chat-provider'
import { ChatWidget } from '@/components/ai/chat-widget'
import { LiliScreenWalker } from '@/components/ai/lili-screen-walker'
import { WebSocketProviderWrapper } from '@/components/providers/websocket-provider'
// import { PrivyWalletDebug } from '@/components/debug/privy-wallet-debug'
import { Toaster } from 'react-hot-toast'
import { cn } from '@/lib/utils'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: 'MoonXFarm - Cross-Chain DEX Aggregator',
  description: 'Trade across chains with gasless transactions, limit orders, and intelligent routing.',
  keywords: ['DEX', 'DeFi', 'Cross-chain', 'Trading', 'Gasless', 'Account Abstraction'],
  authors: [{ name: 'MoonXFarm Team' }],
  icons: {
    icon: '/icons/favicon.ico',
    shortcut: '/icons/favicon.ico',
    apple: '/icons/logo.png',
  },
  openGraph: {
    title: 'MoonXFarm - Cross-Chain DEX Aggregator',
    description: 'Trade across chains with gasless transactions, limit orders, and intelligent routing.',
    url: process.env.NEXT_PUBLIC_APP_URL,
    siteName: 'MoonXFarm',
    images: [
      {
        url: '/icons/logo.png',
        width: 1200,
        height: 630,
        alt: 'MoonXFarm DEX',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MoonXFarm - Cross-Chain DEX Aggregator',
    description: 'Trade across chains with gasless transactions, limit orders, and intelligent routing.',
    images: ['/icons/logo.png'],
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
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
}

interface RootLayoutProps {
  children: React.ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          'min-h-screen bg-background font-sans antialiased',
          inter.variable
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <PrivyProvider>
            <QueryProvider>
              <WebSocketProviderWrapper>
                <ChatProvider>
                  <div className="relative flex min-h-screen flex-col">
                    <div className="flex-1">{children}</div>
                  </div>
                  <Toaster
                    position="top-right"
                    toastOptions={{
                      duration: 4000,
                      className: 'glass glass-dark',
                      style: {
                        background: 'rgba(255, 255, 255, 0.1)',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: 'var(--foreground)',
                      },
                    }}
                  />
                  {/* AI Chat Widget - Always available */}
                  <ChatWidget />
                  {/* Lili Screen Walker - Interactive pet assistant */}
                  <LiliScreenWalker />
                  {/* Debug component - only in development */}
                  {/* {process.env.NODE_ENV === 'development' && <PrivyWalletDebug />} */}
                </ChatProvider>
              </WebSocketProviderWrapper>
            </QueryProvider>
          </PrivyProvider>
        </ThemeProvider>
      </body>
    </html>
  )
} 