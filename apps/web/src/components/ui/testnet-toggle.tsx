'use client'

import { Beaker, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTestnet } from '@/hooks/use-testnet'

interface TestnetToggleProps {
  className?: string
}

export function TestnetToggle({ className }: TestnetToggleProps) {
  // 🚀 NEW: Use unified testnet hook
  const { isTestnet, toggleTestnet } = useTestnet()

  return (
    <div className={cn("flex items-center", className)}>
      <button
        onClick={toggleTestnet}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
          "border border-white/10 hover:border-white/20",
          isTestnet 
            ? "bg-orange-500/10 text-orange-400 hover:bg-orange-500/20" 
            : "bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white"
        )}
        title={isTestnet ? "Switch to Mainnet" : "Switch to Testnet"}
      >
        {isTestnet ? (
          <>
            <Beaker className="w-4 h-4" />
            <span className="hidden sm:inline">Testnet</span>
          </>
        ) : (
          <>
            <Globe className="w-4 h-4" />
            <span className="hidden sm:inline">Mainnet</span>
          </>
        )}
      </button>
    </div>
  )
}

// Hook to use testnet mode in other components
// 🚀 NEW: Now a lightweight wrapper around useTestnet
export function useTestnetMode() {
  const { isTestnet } = useTestnet()
  return isTestnet
} 

// 🚀 NEW: Export unified testnet hook (recommended)
export { useTestnet, useTestnetMode as useTestnetModeOptimized } from '@/hooks/use-testnet' 