import { Header } from '@/components/layout/header'
import { 
  Skeleton, 
  SkeletonText, 
  SkeletonAvatar 
} from '@/components/ui/loading-spinner'

export default function SwapLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <Header />
      <main className="relative z-10">
        {/* Background Pattern */}
        <div 
          className="fixed inset-0 opacity-20"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}
        />
        
        <div className="relative z-10 container mx-auto px-4 py-8">
          {/* Hero Section Skeleton */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center mb-6">
              <Skeleton className="w-16 h-16 rounded-2xl" />
            </div>
            
            <div className="mb-4">
              <Skeleton className="h-12 md:h-16 w-[300px] md:w-[500px] mx-auto mb-2" />
            </div>
            
            <div className="mb-8">
              <SkeletonText lines={2} className="max-w-2xl mx-auto" />
            </div>

            {/* Features Skeleton */}
            <div className="flex flex-wrap justify-center gap-4 mb-8">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton 
                  key={index}
                  className="h-10 w-[120px]" 
                  variant="rounded" 
                />
              ))}
            </div>
          </div>

          {/* Main Content Skeleton */}
          <div className="grid lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
            {/* Swap Interface - Center */}
            <div className="lg:col-start-2 lg:col-span-1">
              <div className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                <div className="space-y-6">
                  {/* Token Input */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-4 w-[60px]" />
                      <Skeleton className="h-4 w-[80px]" />
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <SkeletonAvatar size="sm" />
                          <Skeleton className="h-6 w-[60px]" />
                        </div>
                        <Skeleton className="h-8 w-[100px]" />
                      </div>
                    </div>
                  </div>

                  {/* Swap Button */}
                  <div className="flex justify-center">
                    <Skeleton className="h-10 w-10" variant="circle" />
                  </div>

                  {/* Token Output */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-4 w-[60px]" />
                      <Skeleton className="h-4 w-[80px]" />
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <SkeletonAvatar size="sm" />
                          <Skeleton className="h-6 w-[60px]" />
                        </div>
                        <Skeleton className="h-8 w-[100px]" />
                      </div>
                    </div>
                  </div>

                  {/* Action Button */}
                  <Skeleton className="h-12 w-full" variant="rounded" />
                </div>
              </div>
            </div>

            {/* Price Chart - Left */}
            <div className="lg:col-start-1 lg:row-start-1 order-2 lg:order-1">
              <div className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                <Skeleton className="h-6 w-[120px] mb-4" />
                <Skeleton className="h-[300px] w-full" variant="rounded" />
              </div>
            </div>

            {/* Recent Trades - Right */}
            <div className="lg:col-start-3 lg:row-start-1 order-3">
              <div className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                <Skeleton className="h-6 w-[120px] mb-4" />
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-2">
                        <SkeletonAvatar size="sm" />
                        <div>
                          <Skeleton className="h-4 w-[80px] mb-1" />
                          <Skeleton className="h-3 w-[60px]" />
                        </div>
                      </div>
                      <div className="text-right">
                        <Skeleton className="h-4 w-[60px] mb-1" />
                        <Skeleton className="h-3 w-[40px]" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Supported Chains Skeleton */}
          <div className="mt-16 text-center">
            <Skeleton className="h-6 w-[200px] mx-auto mb-6" />
            <div className="flex flex-wrap justify-center gap-6">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton 
                  key={index}
                  className="h-12 w-[120px]" 
                  variant="rounded" 
                />
              ))}
            </div>
          </div>

          {/* Stats Skeleton */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="text-center p-6 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm">
                <Skeleton className="h-8 w-[80px] mx-auto mb-2" />
                <Skeleton className="h-4 w-[100px] mx-auto mb-2" />
                <Skeleton className="h-3 w-[60px] mx-auto" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
} 