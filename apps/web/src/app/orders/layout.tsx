import type { Metadata } from 'next'
import { generatePageMetadata } from '@/lib/metadata'

export const metadata: Metadata = generatePageMetadata('orders')

export default function OrdersLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
} 