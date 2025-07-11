'use client'

import { Skeleton, SkeletonText } from '@/components/ui/loading-spinner'
import { cn } from '@/lib/utils'

interface SwapInterfaceShimmerProps {
  className?: string
  showCrossChainIndicator?: boolean
}

/**
 * Shimmer loading state for swap interface
 * Inspired by Jupiter and Uniswap loading patterns
 */
export function SwapInterfaceShimmer({ 
  className,
  showCrossChainIndicator = false 
}: SwapInterfaceShimmerProps) {
  return (
    <div className={cn("w-full max-w-md mx-auto", className)}>
      {/* Main Swap Card */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-lg">
        
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-16" />
              {showCrossChainIndicator && (
                <Skeleton className="h-4 w-20" variant="rounded" />
              )}
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8" variant="circle" />
              <Skeleton className="h-8 w-8" variant="circle" />
            </div>
          </div>
        </div>

        <div className="p-3 md:p-4 space-y-3 md:space-y-4">
          {/* Cross-Chain Indicator */}
          {showCrossChainIndicator && (
            <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl">
              <Skeleton className="h-4 w-4" variant="circle" />
              <div className="flex-1">
                <Skeleton className="h-4 w-32 mb-1" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          )}

          {/* From Token Input */}
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8" variant="circle" />
                <Skeleton className="h-5 w-12" />
              </div>
              <div className="flex-1 text-right">
                <Skeleton className="h-8 w-24 ml-auto" />
              </div>
            </div>
          </div>

          {/* Swap Arrow */}
          <div className="flex justify-center">
            <Skeleton className="h-10 w-10" variant="circle" />
          </div>

          {/* To Token Input */}
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8" variant="circle" />
                <Skeleton className="h-5 w-12" />
              </div>
              <div className="flex-1 text-right">
                <Skeleton className="h-8 w-32 ml-auto" />
              </div>
            </div>
          </div>

          {/* Quote Display Shimmer */}
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-16" variant="rounded" />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-12" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
              
              <div className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          </div>

          {/* Swap Button */}
          <Skeleton className="h-12 w-full" variant="rounded" />
        </div>
      </div>
    </div>
  )
}

/**
 * Compact shimmer for mobile or small contexts
 */
export function SwapInterfaceShimmerCompact({ className }: { className?: string }) {
  return (
    <div className={cn("w-full max-w-md mx-auto", className)}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-lg">
        <div className="p-4 space-y-4">
          {/* From Token */}
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-6" variant="circle" />
              <Skeleton className="h-4 w-12" />
            </div>
            <Skeleton className="h-6 w-20" />
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <Skeleton className="h-8 w-8" variant="circle" />
          </div>

          {/* To Token */}
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-6" variant="circle" />
              <Skeleton className="h-4 w-12" />
            </div>
            <Skeleton className="h-6 w-24" />
          </div>

          {/* Button */}
          <Skeleton className="h-12 w-full" variant="rounded" />
        </div>
      </div>
    </div>
  )
}

/**
 * Progressive loading shimmer that adapts to loading state
 */
export function SwapInterfaceProgressiveShimmer({ 
  loadingStage = 'initialization',
  className 
}: { 
  loadingStage?: 'initialization' | 'tokens' | 'quote' | 'ready'
  className?: string 
}) {
  const showTokensLoading = ['initialization', 'tokens'].includes(loadingStage)
  const showQuoteLoading = ['initialization', 'tokens', 'quote'].includes(loadingStage)
  
  return (
    <div className={cn("w-full max-w-md mx-auto", className)}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-lg">
        <div className="p-4 space-y-4">
          {/* Progressive content based on loading stage */}
          {showTokensLoading ? (
            <>
              <SwapInterfaceShimmerCompact />
              <div className="flex items-center justify-center gap-2 py-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{animationDelay: '0.2s'}} />
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{animationDelay: '0.4s'}} />
              </div>
            </>
          ) : showQuoteLoading ? (
            <>
              {/* Show actual tokens, shimmer quote */}
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" variant="rounded" />
                <Skeleton className="h-8 w-8 mx-auto" variant="circle" />
                <Skeleton className="h-16 w-full" variant="rounded" />
                <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                  <SkeletonText lines={3} />
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <Skeleton className="h-6 w-32 mx-auto" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 