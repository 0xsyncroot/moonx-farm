import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
  animate?: boolean
}

export function Skeleton({ className, animate = true }: SkeletonProps) {
  return (
    <div
      className={cn(
        'rounded-md bg-gradient-to-r from-muted/20 via-muted/40 to-muted/20 bg-[length:200%_100%]',
        animate && 'animate-shimmer',
        className
      )}
    />
  )
}

// Portfolio Overview Shimmer
export function PortfolioOverviewSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-6 w-6 rounded-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}

// Token Holdings Shimmer
export function TokenHoldingsSkeleton() {
  return (
    <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="text-right space-y-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
      
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center justify-between p-4 bg-muted/10 border border-border/30 rounded-lg">
            <div className="flex items-center space-x-3">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <div className="text-right space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="text-right space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// P&L Chart Shimmer
export function PnLChartSkeleton() {
  return (
    <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-20" />
          <div className="text-right space-y-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
      </div>
      
      {/* Chart Area */}
      <div className="h-64 bg-muted/10 border border-border/30 rounded-lg mb-4 flex items-center justify-center">
        <div className="text-center space-y-2">
          <Skeleton className="h-8 w-8 mx-auto" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="text-center p-3 bg-muted/10 border border-border/30 rounded-lg space-y-2">
            <Skeleton className="h-3 w-16 mx-auto" />
            <Skeleton className="h-5 w-20 mx-auto" />
          </div>
        ))}
      </div>
      
      {/* Additional Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="text-center p-3 bg-muted/10 border border-border/30 rounded-lg space-y-2">
            <Skeleton className="h-3 w-20 mx-auto" />
            <Skeleton className="h-5 w-24 mx-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}

// Trade History Shimmer
export function TradeHistorySkeleton() {
  return (
    <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-2">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-8 w-16" />
      </div>
      
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-muted/10 border border-border/30 rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-16" />
              </div>
              <div className="text-right space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-28" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Portfolio Page Shimmer (Combined)
export function PortfolioPageSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto mobile-padding py-8">
        <div className="space-y-8">
          {/* Page Header */}
          <div className="text-center space-y-4">
            <Skeleton className="h-8 w-32 mx-auto" />
            <Skeleton className="h-5 w-96 mx-auto" />
          </div>

          {/* Portfolio Overview */}
          <PortfolioOverviewSkeleton />

          {/* Portfolio Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Token Holdings */}
            <div className="lg:col-span-1">
              <TokenHoldingsSkeleton />
            </div>

            {/* PnL Chart */}
            <div className="lg:col-span-2">
              <PnLChartSkeleton />
            </div>
          </div>

          {/* Trade History */}
          <TradeHistorySkeleton />
        </div>
      </div>
    </div>
  )
}

// Mini Skeletons for specific elements
export function MiniCardSkeleton() {
  return (
    <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-6 w-6 rounded-full" />
      </div>
      <Skeleton className="h-6 w-20" />
      <Skeleton className="h-3 w-16" />
    </div>
  )
}

export function TokenRowSkeleton() {
  return (
    <div className="flex items-center justify-between p-3 bg-muted/10 border border-border/30 rounded-lg">
      <div className="flex items-center space-x-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="text-right space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  )
}

export function ChartSkeleton({ height = 'h-64' }: { height?: string }) {
  return (
    <div className={cn('bg-muted/10 border border-border/30 rounded-lg flex items-center justify-center', height)}>
      <div className="text-center space-y-2">
        <Skeleton className="h-8 w-8 mx-auto" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  )
} 