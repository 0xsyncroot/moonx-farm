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
import { Header } from '@/components/layout/header'
// import { PrivyWalletDebug } from '@/components/debug/privy-wallet-debug'
import { Toaster } from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { layoutMetadata, structuredData } from '@/lib/metadata'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-sans',
})

export const metadata: Metadata = layoutMetadata

interface RootLayoutProps {
  children: React.ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
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
                    <Header />
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