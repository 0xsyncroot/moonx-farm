import type { Metadata } from 'next'
import { generatePageMetadata } from '@/lib/metadata'

export const metadata: Metadata = generatePageMetadata('portfolio')

export default function PortfolioLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
} 