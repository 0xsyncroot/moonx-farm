import { 
  Skeleton, 
  SkeletonText, 
  SkeletonAvatar 
} from '@/components/ui/loading-spinner'

export default function SwapLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
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
          <div className="grid lg:grid-cols-12 gap-6">
            {/* Left Sidebar */}
            <div className="lg:col-span-3 space-y-6">
              <div className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-lg p-6">
                <Skeleton className="h-6 w-[120px] mb-4" />
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-[80%]" />
                  <Skeleton className="h-4 w-[60%]" />
                </div>
              </div>

              <div className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-lg p-6">
                <Skeleton className="h-6 w-[100px] mb-4" />
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-[90%]" />
                </div>
              </div>
            </div>

            {/* Center - Swap Interface */}
            <div className="lg:col-span-6">
              <div className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-lg p-6">
                <Skeleton className="h-6 w-[80px] mb-6" />
                
                {/* From Token */}
                <div className="mb-4">
                  <Skeleton className="h-4 w-[60px] mb-2" />
                  <div className="flex items-center gap-3 p-4 bg-white/5 rounded-lg">
                    <SkeletonAvatar size="sm" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-[80px] mb-1" />
                      <Skeleton className="h-3 w-[60px]" />
                    </div>
                    <div className="text-right">
                      <Skeleton className="h-5 w-[100px] mb-1" />
                      <Skeleton className="h-3 w-[60px]" />
                    </div>
                  </div>
                </div>

                {/* Swap Arrow */}
                <div className="flex justify-center mb-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                </div>

                {/* To Token */}
                <div className="mb-6">
                  <Skeleton className="h-4 w-[40px] mb-2" />
                  <div className="flex items-center gap-3 p-4 bg-white/5 rounded-lg">
                    <SkeletonAvatar size="sm" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-[80px] mb-1" />
                      <Skeleton className="h-3 w-[60px]" />
                    </div>
                    <div className="text-right">
                      <Skeleton className="h-5 w-[100px] mb-1" />
                      <Skeleton className="h-3 w-[60px]" />
                    </div>
                  </div>
                </div>

                {/* Swap Button */}
                <Skeleton className="h-12 w-full" variant="rounded" />
              </div>
            </div>

            {/* Right Sidebar */}
            <div className="lg:col-span-3 space-y-6">
              <div className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-lg p-6">
                <Skeleton className="h-6 w-[140px] mb-4" />
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-[70%]" />
                  <Skeleton className="h-4 w-[85%]" />
                </div>
              </div>

              <div className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-lg p-6">
                <Skeleton className="h-6 w-[120px] mb-4" />
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-[65%]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
} 