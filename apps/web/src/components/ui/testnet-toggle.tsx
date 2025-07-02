'use client'

import { useState, useEffect } from 'react'
import { Beaker, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TestnetToggleProps {
  className?: string
}

export function TestnetToggle({ className }: TestnetToggleProps) {
  // Get default from environment variable
  const defaultTestnetMode = process.env.NEXT_PUBLIC_DEFAULT_TESTNET_MODE === 'true'
  const [isTestnet, setIsTestnet] = useState(defaultTestnetMode)

  // Load testnet preference from localStorage or use env default
  useEffect(() => {
    const saved = localStorage.getItem('moonx-testnet-mode')
    if (saved !== null) {
      setIsTestnet(saved === 'true')
    } else {
      // Use environment default if no saved preference
      setIsTestnet(defaultTestnetMode)
    }
  }, [defaultTestnetMode])

  // Save testnet preference to localStorage
  const toggleTestnet = () => {
    const newValue = !isTestnet
    console.log('🔄 TestnetToggle: Switching to', newValue ? 'TESTNET' : 'MAINNET')
    setIsTestnet(newValue)
    localStorage.setItem('moonx-testnet-mode', newValue.toString())
    
    // Dispatch custom event for other components
    window.dispatchEvent(new CustomEvent('testnet-mode-changed', { 
      detail: { isTestnet: newValue } 
    }))
  }

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
export function useTestnetMode() {
  const defaultTestnetMode = process.env.NEXT_PUBLIC_DEFAULT_TESTNET_MODE === 'true'
  const [isTestnet, setIsTestnet] = useState(defaultTestnetMode)

  useEffect(() => {
    // Initial load
    const saved = localStorage.getItem('moonx-testnet-mode')
    if (saved !== null) {
      setIsTestnet(saved === 'true')
    } else {
      // Use environment default if no saved preference
      setIsTestnet(defaultTestnetMode)
    }

    // Listen for changes
    const handleTestnetChange = (event: CustomEvent) => {
      setIsTestnet(event.detail.isTestnet)
    }

    window.addEventListener('testnet-mode-changed', handleTestnetChange as EventListener)
    
    return () => {
      window.removeEventListener('testnet-mode-changed', handleTestnetChange as EventListener)
    }
  }, [defaultTestnetMode])

  return isTestnet
} 