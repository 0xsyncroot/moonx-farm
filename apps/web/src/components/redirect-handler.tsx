'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

/**
 * Client-side redirect handler for static export
 * Replaces middleware functionality when using output: 'export'
 */
export function RedirectHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Only redirect if we're on the root path - immediate redirect, no delay
    if (window.location.pathname === '/') {
      const params = searchParams.toString()
      const swapUrl = params ? `/swap?${params}` : '/swap'
      
      // Use replace to avoid adding to history - immediate execution
      router.replace(swapUrl)
    }
  }, [router, searchParams])

  return null // This component doesn't render anything
} 