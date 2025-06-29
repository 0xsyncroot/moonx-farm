import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'MoonX Farm - Cross-Chain DEX Swap',
  description: 'Swap tokens across multiple chains with Account Abstraction wallets and sponsored gas fees. Trade with gasless transactions and intelligent routing.',
  keywords: ['DEX', 'Cross-chain', 'Swap', 'Account Abstraction', 'Gasless', 'DeFi'],
  openGraph: {
    title: 'MoonX Farm - Cross-Chain DEX Swap',
    description: 'Swap tokens across multiple chains with Account Abstraction wallets and sponsored gas fees',
    url: '/swap',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MoonX Farm - Cross-Chain DEX Swap',
    description: 'Swap tokens across multiple chains with Account Abstraction wallets and sponsored gas fees',
  },
}

interface SwapLayoutProps {
  children: React.ReactNode
}

export default function SwapLayout({ children }: SwapLayoutProps) {
  return <>{children}</>
} 