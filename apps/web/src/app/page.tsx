'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    // Fallback client-side redirect in case middleware doesn't work
    // Preserve all current query parameters
    const timer = setTimeout(() => {
      const currentSearch = window.location.search
      router.replace(`/swap${currentSearch}`)
    }, 100)

    return () => clearTimeout(timer)
  }, [router])

  // Minimal loading skeleton while middleware redirects
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Skeleton that matches swap page structure */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-6">
            <LoadingSpinner size="lg" />
          </div>
        </div>
      </div>
    </div>
  )
} 