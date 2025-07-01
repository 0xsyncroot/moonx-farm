import { ArrowUpDown, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CrossChainIndicatorProps {
  fromChain: {
    name: string
    color: string
  } | null
  toChain: {
    name: string
    color: string
  } | null
}

export function CrossChainIndicator({ fromChain, toChain }: CrossChainIndicatorProps) {
  if (!fromChain || !toChain) return null

  return (
    <div className="flex items-center justify-center mb-3 md:mb-4">
      <div className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-2.5 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200/50 dark:border-purple-700/50 rounded-full">
        <div className="flex items-center gap-1.5 md:gap-2">
          <div className={cn("w-2 h-2 md:w-2.5 md:h-2.5 rounded-full", fromChain.color)} />
          <span className="text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300">{fromChain.name}</span>
        </div>
        <div className="flex items-center gap-1 px-1.5 md:px-2 py-1 bg-white/50 dark:bg-gray-800/50 rounded-full">
          <ArrowUpDown className="w-2.5 h-2.5 md:w-3 md:h-3 text-purple-500" />
          <Sparkles className="w-2.5 h-2.5 md:w-3 md:h-3 text-purple-500" />
        </div>
        <div className="flex items-center gap-1.5 md:gap-2">
          <div className={cn("w-2 h-2 md:w-2.5 md:h-2.5 rounded-full", toChain.color)} />
          <span className="text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300">{toChain.name}</span>
        </div>
      </div>
    </div>
  )
} 