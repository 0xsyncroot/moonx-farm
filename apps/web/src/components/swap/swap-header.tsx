import { ArrowUpDown, Settings, RefreshCw, Share2, Check, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SwapHeaderProps {
  isCrossChain: boolean
  onSettingsClick: () => void
  shareStatus: 'idle' | 'copying' | 'copied'
  onShareClick: () => void
  hasTokens: boolean
}

export function SwapHeader({ 
  isCrossChain, 
  onSettingsClick, 
  shareStatus, 
  onShareClick, 
  hasTokens 
}: SwapHeaderProps) {
  return (
    <div className="flex items-center justify-between p-3 md:p-4 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3 md:gap-4">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="p-1.5 md:p-2 bg-gradient-to-br from-[#ff7842] to-[#ff4d00] rounded-lg md:rounded-xl shadow-lg">
            <ArrowUpDown className="w-4 h-4 md:w-5 md:h-5 text-white" />
          </div>
          <div>
            <h2 className="text-base md:text-lg font-bold text-gray-900 dark:text-white">Swap</h2>
            {isCrossChain && (
              <div className="flex items-center gap-1 mt-0.5">
                <Zap className="w-2.5 h-2.5 md:w-3 md:h-3 text-purple-500" />
                <span className="text-xs font-medium text-purple-600 dark:text-purple-400">Cross-Chain</span>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-1.5 md:gap-2">
        <button
          onClick={onSettingsClick}
          className="p-2 md:p-2.5 rounded-lg md:rounded-xl transition-all duration-200 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
          title="Settings"
        >
          <Settings className="w-3.5 h-3.5 md:w-4 md:h-4 text-gray-600 dark:text-gray-400" />
        </button>
        
        <button
          onClick={onShareClick}
          disabled={!hasTokens}
          className={cn(
            "p-2 md:p-2.5 rounded-lg md:rounded-xl transition-all duration-200 border",
            shareStatus === 'copied' 
              ? "bg-green-50 border-green-200 text-green-600 dark:bg-green-900/20 dark:border-green-700 dark:text-green-400"
              : "bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
          title={shareStatus === 'copied' ? 'Link copied!' : 'Share swap'}
        >
          {shareStatus === 'copying' ? (
            <RefreshCw className="w-3.5 h-3.5 md:w-4 md:h-4 animate-spin" />
          ) : shareStatus === 'copied' ? (
            <Check className="w-3.5 h-3.5 md:w-4 md:h-4" />
          ) : (
            <Share2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
          )}
        </button>
      </div>
    </div>
  )
} 