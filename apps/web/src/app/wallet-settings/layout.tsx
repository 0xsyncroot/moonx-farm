import type { Metadata } from 'next'
import { generatePageMetadata } from '@/lib/metadata'

export const metadata: Metadata = generatePageMetadata('walletSettings')

export default function WalletSettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
} 