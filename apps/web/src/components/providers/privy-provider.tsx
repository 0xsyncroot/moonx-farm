"use client"

import { PrivyProvider as PrivyProviderBase } from '@privy-io/react-auth'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { base, bsc, mainnet, polygon } from 'wagmi/chains'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Create wagmi config for v2
const config = createConfig({
  chains: [mainnet, base, bsc, polygon],
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
    [bsc.id]: http(),
    [polygon.id]: http(),
  },
})

// Create a client for react-query
const queryClient = new QueryClient()

interface PrivyProviderProps {
  children: React.ReactNode
}

export function PrivyProvider({ children }: PrivyProviderProps) {
  return (
    <PrivyProviderBase
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ''}
      config={{
        loginMethods: ['google', 'twitter', 'farcaster', 'github',],
        appearance: {
          theme: 'light',
          accentColor: '#ff7842',
          logo: '/logo.png',
          showWalletLoginFirst: false,
        },
        embeddedWallets: {
          createOnLogin: 'users-without-wallets', // Create AA wallet automatically
          noPromptOnSignature: true, // Seamless UX
        },
        mfa: {
          noPromptOnMfaRequired: false,
        },
      }}
    >
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </WagmiProvider>
    </PrivyProviderBase>
  )
} 