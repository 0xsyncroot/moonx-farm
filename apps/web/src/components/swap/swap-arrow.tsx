import { ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SwapArrowProps {
  onSwap: () => void
  disabled?: boolean
}

export function SwapArrow({ onSwap, disabled = false }: SwapArrowProps) {
  return (
    <div className="flex justify-center relative -my-1">
      <button 
        onClick={onSwap}
        disabled={disabled}
        className={cn(
          "p-2.5 md:p-3 bg-white dark:bg-gray-800 rounded-lg md:rounded-xl shadow-lg border border-gray-200 dark:border-gray-700",
          "transition-all duration-300 hover:scale-110 hover:shadow-xl hover:shadow-gray-900/10 dark:hover:shadow-black/20",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
          "relative overflow-hidden group z-10"
        )}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-purple-500/0 group-hover:from-blue-500/10 group-hover:to-purple-500/10 transition-all duration-300 rounded-lg md:rounded-xl" />
        <ArrowUpDown className="w-4 h-4 md:w-5 md:h-5 text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white transition-colors relative z-10" />
      </button>
    </div>
  )
} 