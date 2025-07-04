'use client'

import { Suspense } from 'react'
import { RedirectHandler } from '@/components/redirect-handler'
import { SwapInterfaceProgressiveShimmer } from '@/components/swap/swap-interface-shimmer'

/**
 * Root page - redirects to /swap
 * 
 * Note: If using middleware, this component won't be reached since 
 * middleware handles the redirect. This is only used when middleware 
 * is disabled (e.g., for static export).
 */
export default function RootPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center min-h-[60vh]">
          {/* Show loading shimmer while redirecting */}
          <SwapInterfaceProgressiveShimmer
            loadingStage="initialization"
            className="animate-pulse"
          />
        </div>
      </div>
      
      {/* Handle client-side redirect */}
      <Suspense fallback={null}>
        <RedirectHandler />
      </Suspense>
    </div>
  )
} 