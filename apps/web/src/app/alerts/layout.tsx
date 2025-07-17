import type { Metadata } from 'next'
import { generatePageMetadata } from '@/lib/metadata'

export const metadata: Metadata = generatePageMetadata('alerts')

export default function AlertsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
} 