import { Header } from '@/components/layout/header'
import { 
  Skeleton, 
  SkeletonText, 
  SkeletonCard,
  SkeletonList
} from '@/components/ui/loading-spinner'

export default function AlertsLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <Header />
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Create Alert Form */}
            <div className="lg:col-span-1">
              <div className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-lg p-6">
                <Skeleton className="h-6 w-[120px] mb-6" />
                
                <div className="space-y-4">
                  <div>
                    <Skeleton className="h-4 w-[60px] mb-2" />
                    <Skeleton className="h-10 w-full" variant="rounded" />
                  </div>
                  <div>
                    <Skeleton className="h-4 w-[80px] mb-2" />
                    <Skeleton className="h-10 w-full" variant="rounded" />
                  </div>
                  <div>
                    <Skeleton className="h-4 w-[70px] mb-2" />
                    <Skeleton className="h-10 w-full" variant="rounded" />
                  </div>
                  <div>
                    <Skeleton className="h-4 w-[90px] mb-2" />
                    <Skeleton className="h-10 w-full" variant="rounded" />
                  </div>
                  <Skeleton className="h-10 w-full mt-6" variant="rounded" />
                </div>
              </div>
            </div>

            {/* Active Alerts */}
            <div className="lg:col-span-2">
              <div className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <Skeleton className="h-6 w-[120px]" />
                  <Skeleton className="h-8 w-[100px]" variant="rounded" />
                </div>

                {/* Alert Cards */}
                <div className="space-y-4">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="border border-white/10 rounded-lg p-4 bg-white/5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <Skeleton className="h-5 w-[150px] mb-2" />
                          <Skeleton className="h-3 w-[200px]" />
                        </div>
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-6 w-[60px]" variant="rounded" />
                          <Skeleton className="h-6 w-6" variant="circle" />
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Skeleton className="h-4 w-[100px]" />
                          <Skeleton className="h-4 w-[80px]" />
                        </div>
                        <Skeleton className="h-3 w-[60px]" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Recent Triggered Alerts */}
          <div className="mt-8">
            <div className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-lg p-6">
              <Skeleton className="h-6 w-[180px] mb-6" />
              <SkeletonList items={5} showAvatar={false} />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
} 