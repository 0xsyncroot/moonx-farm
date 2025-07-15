import { 
  Skeleton, 
  SkeletonText,
  SkeletonAvatar,
  SkeletonList
} from '@/components/ui/loading-spinner'

export default function PortfolioLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Charts */}
            <div className="space-y-6">
              <div className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-lg p-6">
                <Skeleton className="h-6 w-[120px] mb-4" />
                <Skeleton className="h-64 w-full" />
              </div>

              <div className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-lg p-6">
                <Skeleton className="h-6 w-[150px] mb-4" />
                <Skeleton className="h-48 w-full" />
              </div>
            </div>

            {/* Holdings & Trades */}
            <div className="space-y-6">
              <div className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-lg p-6">
                <Skeleton className="h-6 w-[100px] mb-4" />
                <SkeletonList items={5} showAvatar={true} />
              </div>

              <div className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-lg p-6">
                <Skeleton className="h-6 w-[120px] mb-4" />
                <SkeletonList items={6} showAvatar={false} />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
} 