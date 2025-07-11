import { Header } from '@/components/layout/header'
import { 
  Skeleton, 
  SkeletonText,
  SkeletonAvatar,
  SkeletonList
} from '@/components/ui/loading-spinner'

export default function PortfolioLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <Header />
      <main className="relative z-10">
        <div className="container mx-auto px-4 py-8">
          {/* Portfolio Header */}
          <div className="mb-8">
            <Skeleton className="h-8 w-[200px] mb-2" />
            <SkeletonText lines={1} className="max-w-md" />
          </div>

          {/* Portfolio Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-lg p-6">
              <Skeleton className="h-4 w-[100px] mb-2" />
              <Skeleton className="h-8 w-[120px] mb-2" />
              <Skeleton className="h-3 w-[80px]" />
            </div>
            <div className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-lg p-6">
              <Skeleton className="h-4 w-[100px] mb-2" />
              <Skeleton className="h-8 w-[120px] mb-2" />
              <Skeleton className="h-3 w-[80px]" />
            </div>
            <div className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-lg p-6">
              <Skeleton className="h-4 w-[100px] mb-2" />
              <Skeleton className="h-8 w-[120px] mb-2" />
              <Skeleton className="h-3 w-[80px]" />
            </div>
          </div>

          {/* Portfolio Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Assets List */}
            <div className="lg:col-span-2">
              <div className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <Skeleton className="h-6 w-[120px]" />
                  <Skeleton className="h-8 w-[100px]" variant="rounded" />
                </div>
                
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="flex items-center justify-between py-3 border-b border-white/5 last:border-b-0">
                      <div className="flex items-center gap-3">
                        <SkeletonAvatar size="sm" />
                        <div>
                          <Skeleton className="h-4 w-[80px] mb-1" />
                          <Skeleton className="h-3 w-[60px]" />
                        </div>
                      </div>
                      <div className="text-right">
                        <Skeleton className="h-4 w-[80px] mb-1" />
                        <Skeleton className="h-3 w-[60px]" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Portfolio Chart & Stats */}
            <div className="space-y-6">
              {/* Chart */}
              <div className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-lg p-6">
                <Skeleton className="h-6 w-[120px] mb-4" />
                <Skeleton className="h-[200px] w-full" variant="rounded" />
              </div>

              {/* Recent Transactions */}
              <div className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-lg p-6">
                <Skeleton className="h-6 w-[150px] mb-4" />
                <SkeletonList items={4} showAvatar={true} />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
} 