import { 
  Skeleton, 
  SkeletonText,
  SkeletonList
} from '@/components/ui/loading-spinner'

export default function AlertsLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <main className="relative z-10">
        <div className="container mx-auto px-4 py-8">
          {/* Page Header */}
          <div className="mb-8">
            <Skeleton className="h-8 w-[200px] mb-2" />
            <SkeletonText lines={1} className="max-w-md" />
          </div>

          {/* Alert Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-lg p-6">
              <Skeleton className="h-4 w-[100px] mb-2" />
              <Skeleton className="h-8 w-[60px] mb-1" />
              <Skeleton className="h-3 w-[80px]" />
            </div>
            <div className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-lg p-6">
              <Skeleton className="h-4 w-[100px] mb-2" />
              <Skeleton className="h-8 w-[60px] mb-1" />
              <Skeleton className="h-3 w-[80px]" />
            </div>
            <div className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-lg p-6">
              <Skeleton className="h-4 w-[100px] mb-2" />
              <Skeleton className="h-8 w-[60px] mb-1" />
              <Skeleton className="h-3 w-[80px]" />
            </div>
          </div>

          {/* Alerts Content */}
          <div className="space-y-6">
            <div className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-lg p-6">
              <Skeleton className="h-6 w-[150px] mb-4" />
              <SkeletonList items={5} />
            </div>

            <div className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-lg p-6">
              <Skeleton className="h-6 w-[200px] mb-4" />
              <SkeletonList items={3} />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
} 