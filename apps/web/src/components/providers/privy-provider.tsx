"use client"

import { PrivyProvider as PrivyProviderBase } from '@privy-io/react-auth'
import { SmartWalletsProvider } from '@privy-io/react-auth/smart-wallets'
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
        // Smart wallet configuration
        defaultChain: base, // Set Base as default chain
        supportedChains: [mainnet, base, bsc, polygon],
      }}
    >
      <SmartWalletsProvider
        config={{
          // Optional: Configure paymaster context for gasless transactions
          // paymasterContext: {
          //   token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
          // },
        }}
      >
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        </WagmiProvider>
      </SmartWalletsProvider>
    </PrivyProviderBase>
  )
} 