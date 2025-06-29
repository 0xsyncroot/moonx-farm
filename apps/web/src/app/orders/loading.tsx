import { Header } from '@/components/layout/header'
import { 
  Skeleton, 
  SkeletonText, 
  SkeletonTable,
  SkeletonCard
} from '@/components/ui/loading-spinner'

export default function OrdersLoading() {
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

          {/* Filter/Search Bar */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <Skeleton className="h-10 flex-1" variant="rounded" />
            <Skeleton className="h-10 w-[120px]" variant="rounded" />
            <Skeleton className="h-10 w-[100px]" variant="rounded" />
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-lg p-4">
                <Skeleton className="h-4 w-[80px] mb-2" />
                <Skeleton className="h-6 w-[100px] mb-1" />
                <Skeleton className="h-3 w-[60px]" />
              </div>
            ))}
          </div>

          {/* Orders Table */}
          <div className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-6 w-[120px]" />
              <Skeleton className="h-8 w-[100px]" variant="rounded" />
            </div>
            <SkeletonTable rows={6} columns={6} />
          </div>
        </div>
      </main>
    </div>
  )
} 