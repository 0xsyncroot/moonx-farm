'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import { usePrivy } from '@privy-io/react-auth'
import { useSwitchChain } from 'wagmi'
import { toast } from 'react-hot-toast'
import { getDefaultChain, getChainConfig, getCorrespondingChain, CHAIN_PAIRS } from '@/config/chains'

interface TestnetOptions {
  /**
   * Skip switching if auto chain switch is in progress
   * This prevents conflicts with cross-chain swap logic
   */
  skipIfAutoSwitching?: boolean
}

/**
 * 🚀 MAIN TESTNET HOOK - Use this for all testnet functionality
 * 
 * Provides:
 * - Immediate testnet mode state (optimistic loading)
 * - Automatic chain switching when testnet mode changes
 * - Conflict prevention with cross-chain logic
 * - Beautiful loading states
 * 
 * @example
 * ```typescript
 * import { useTestnet } from '@/hooks/use-testnet'
 * 
 * function MyComponent() {
 *   const { 
 *     isTestnet, 
 *     isHydrated, 
 *     isTestnetSwitching,
 *     toggleTestnet 
 *   } = useTestnet()
 * 
 *   return (
 *     <div>
 *       Mode: {isTestnet ? 'Testnet' : 'Mainnet'}
 *       {isTestnetSwitching && <span>Switching...</span>}
 *     </div>
 *   )
 * }
 * ```
 */
export function useTestnet(options: TestnetOptions = {}) {
  // 🚀 Optimistic testnet mode state
  const getInitialTestnetMode = useMemo(() => {
    const defaultTestnetMode = process.env.NEXT_PUBLIC_DEFAULT_TESTNET_MODE === 'true'
    
    // Try to read from localStorage immediately (SSR-safe)
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('moonx-testnet-mode')
        if (saved !== null) {
          return saved === 'true'
        }
      } catch (error) {
        console.warn('Failed to read testnet mode from localStorage:', error)
      }
    }
    
    return defaultTestnetMode
  }, [])

  const [isTestnet, setIsTestnet] = useState(getInitialTestnetMode)
  const [isHydrated, setIsHydrated] = useState(false)
  const [isTestnetSwitching, setIsTestnetSwitching] = useState(false)

  // Dependencies for chain switching
  const { user } = usePrivy()
  const { client: smartWalletClient } = useSmartWallets()
  const { switchChain } = useSwitchChain()

  // 🚀 Hydration effect (only runs client-side)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('moonx-testnet-mode')
      const defaultTestnetMode = process.env.NEXT_PUBLIC_DEFAULT_TESTNET_MODE === 'true'
      const correctValue = saved !== null ? saved === 'true' : defaultTestnetMode
      
      if (correctValue !== isTestnet) {
        setIsTestnet(correctValue)
      }
    } catch (error) {
      console.warn('Failed to hydrate testnet mode:', error)
    }
    
    setIsHydrated(true)
  }, [])

  // 🚀 Chain switching logic when testnet mode changes
  useEffect(() => {
    const handleTestnetModeChange = async (event: Event) => {
      const customEvent = event as CustomEvent
      const newIsTestnet = customEvent.detail.isTestnet
      
      console.log('🔍 Testnet mode changed:', {
        newIsTestnet,
        hasSmartWallet: !!smartWalletClient,
        hasUser: !!user,
        skipIfAutoSwitching: options.skipIfAutoSwitching
      })

      // Skip if auto switching is in progress and we're configured to avoid conflicts
      if (options.skipIfAutoSwitching) {
        const isAutoSwitching = window.localStorage.getItem('auto-chain-switching') === 'true'
        if (isAutoSwitching) {
          console.log('⏸️ Skipping testnet chain switch - auto chain switch in progress')
          return
        }
      }

      // Only switch if we have smart wallet
      if (!smartWalletClient || !user) {
        console.log('⏸️ Skipping testnet chain switch - no smart wallet or user')
        return
      }

      try {
        setIsTestnetSwitching(true)
        
        const currentChainId = smartWalletClient.chain?.id
        if (!currentChainId) {
          console.warn('⚠️ No current chain detected')
          return
        }

        // Find corresponding chain for the new testnet mode
        const targetChain = getCorrespondingChain(currentChainId)
        if (!targetChain) {
          console.warn('⚠️ No corresponding chain found for:', {
            currentChainId,
            newIsTestnet
          })
          return
        }

        // Verify the target chain matches the desired testnet mode
        if (targetChain.isTestnet !== newIsTestnet) {
          console.warn('⚠️ Target chain testnet mode mismatch:', {
            targetChainTestnet: targetChain.isTestnet,
            desiredTestnet: newIsTestnet,
            targetChain: targetChain.name
          })
          return
        }

        // Skip if already on target chain
        if (currentChainId === targetChain.id) {
          console.log('✅ Already on target chain:', targetChain.name)
          
          // Dispatch success event
          window.dispatchEvent(new CustomEvent('testnet-chain-switch-success', {
            detail: {
              chainId: targetChain.id,
              chainName: targetChain.name,
              isTestnet: newIsTestnet
            }
          }))
          return
        }

        console.log('🔄 Switching chain for testnet mode:', {
          from: getChainConfig(currentChainId)?.name,
          to: targetChain.name,
          fromChainId: currentChainId,
          toChainId: targetChain.id
        })

        // Switch chain using smart wallet
        await switchChain({ chainId: targetChain.id })

        console.log('✅ Chain switched successfully:', targetChain.name)

        // Dispatch success event
        window.dispatchEvent(new CustomEvent('testnet-chain-switch-success', {
          detail: {
            chainId: targetChain.id,
            chainName: targetChain.name,
            isTestnet: newIsTestnet
          }
        }))

      } catch (error) {
        console.error('❌ Failed to switch chain for testnet mode:', error)
        
        // Show error toast
        toast.error(
          `Failed to switch to ${newIsTestnet ? 'testnet' : 'mainnet'} network`,
          { duration: 4000 }
        )

        // Dispatch error event
        window.dispatchEvent(new CustomEvent('testnet-chain-switch-error', {
          detail: {
            error: error instanceof Error ? error.message : 'Unknown error',
            isTestnet: newIsTestnet
          }
        }))
      } finally {
        setIsTestnetSwitching(false)
      }
    }

    window.addEventListener('testnet-mode-changed', handleTestnetModeChange)
    
    return () => {
      window.removeEventListener('testnet-mode-changed', handleTestnetModeChange)
    }
  }, [smartWalletClient, user, switchChain, options.skipIfAutoSwitching])

  // 🚀 Listen for external changes
  useEffect(() => {
    const handleTestnetChange = (event: CustomEvent) => {
      setIsTestnet(event.detail.isTestnet)
    }

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'moonx-testnet-mode' && event.newValue !== null) {
        setIsTestnet(event.newValue === 'true')
      }
    }

    window.addEventListener('testnet-mode-changed', handleTestnetChange as EventListener)
    window.addEventListener('storage', handleStorageChange)
    
    return () => {
      window.removeEventListener('testnet-mode-changed', handleTestnetChange as EventListener)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  // 🚀 Toggle function
  const toggleTestnet = useCallback(() => {
    const newValue = !isTestnet
    console.log('🔄 Toggling testnet mode:', newValue ? 'TESTNET' : 'MAINNET')
    
    setIsTestnet(newValue)
    
    try {
      localStorage.setItem('moonx-testnet-mode', newValue.toString())
    } catch (error) {
      console.warn('Failed to save testnet mode:', error)
    }
    
    // Dispatch event for other components
    window.dispatchEvent(new CustomEvent('testnet-mode-changed', { 
      detail: { isTestnet: newValue } 
    }))
  }, [isTestnet])

  return {
    // State
    isTestnet,                    // Current testnet mode
    isHydrated,                   // Whether client-side hydration completed
    isTestnetSwitching,           // Whether currently switching chains
    isReady: true,                // Always ready (optimistic loading)
    
    // Actions
    toggleTestnet,                // Function to toggle testnet mode
    
    // Legacy compatibility
    isTestnetReady: true,         // @deprecated - always true now
  }
}

/**
 * 🎯 OPTIMIZED MODE-ONLY HOOK
 * Use when you only need testnet mode state without chain switching
 */
export function useTestnetMode() {
  const { isTestnet } = useTestnet()
  return isTestnet
}

/**
 * 🎯 CHAIN SWITCHING HOOK
 * Use when you need chain switching with custom options
 */
export function useTestnetChainSwitch(options: TestnetOptions = {}) {
  const { isTestnetSwitching } = useTestnet(options)
  return { isTestnetSwitching }
} 