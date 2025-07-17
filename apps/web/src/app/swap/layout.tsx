import type { Metadata } from 'next'
import { generatePageMetadata } from '@/lib/metadata'

export const metadata: Metadata = generatePageMetadata('swap')

export default function SwapLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
} 