'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import { usePrivy } from '@privy-io/react-auth'
import { useSwitchChain } from 'wagmi'
import { toast } from 'react-hot-toast'
import { getChainConfig } from '@/config/chains'
import { Token } from './use-tokens'

interface ChainSwitchState {
  isLoading: boolean
  isSuccess: boolean
  error: string | null
  targetChainId: number | null
  smartWalletClient: any | null
}

/**
 * Hook để tự động switch chain khi fromToken thay đổi chainId
 * Sử dụng Privy smart wallet getClientForChain để tạo client mới cho chain đó
 */
export function useAutoChainSwitch(fromToken: Token | null) {
  const { user, ready: privyReady } = usePrivy()
  const { client: defaultSmartWalletClient, getClientForChain } = useSmartWallets()
  const { switchChain } = useSwitchChain()
  
  const [switchState, setSwitchState] = useState<ChainSwitchState>({
    isLoading: false,
    isSuccess: false,
    error: null,
    targetChainId: null,
    smartWalletClient: null // 🚀 FIXED: Will be set by useEffect
  })

  // Track last processed chainId to prevent infinite loops
  const lastProcessedChainIdRef = useRef<number | null>(null)
  const switchingRef = useRef(false)
  
  // 🚀 FIXED: Track current chain ID stable với useRef
  const currentChainIdRef = useRef<number | null>(defaultSmartWalletClient?.chain?.id || null)
  
  // Update ref when defaultSmartWalletClient changes
  useEffect(() => {
    currentChainIdRef.current = defaultSmartWalletClient?.chain?.id || null
    
    // 🚀 FIXED: Also sync switchState.smartWalletClient if not set
    if (!switchState.smartWalletClient && defaultSmartWalletClient) {
      setSwitchState(prev => ({
        ...prev,
        smartWalletClient: defaultSmartWalletClient
      }))
    }
  }, [defaultSmartWalletClient?.chain?.id, defaultSmartWalletClient, switchState.smartWalletClient])

  // Debug logging để hiểu state
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 useAutoChainSwitch state:', {
        privyReady,
        hasUser: !!user,
        hasDefaultClient: !!defaultSmartWalletClient,
        hasGetClientForChain: !!getClientForChain,
        hasAddress: !!defaultSmartWalletClient?.account?.address,
        fromTokenChain: fromToken?.chainId,
        fromTokenSymbol: fromToken?.symbol,
        currentSmartWalletChain: currentChainIdRef.current,
        lastProcessed: lastProcessedChainIdRef.current,
        isReady: privyReady && !!user && !!getClientForChain
      })
    }
  }, [privyReady, user, fromToken]) // 🚀 FIXED: Remove unstable dependencies

  /**
   * Function để switch sang chain mới
   * 🚀 FIXED: Memoize với stable dependencies
   */
  const switchToChain = useCallback(async (targetChainId: number) => {
    if (!user) {
      console.warn('⚠️ User not connected')
      return
    }

    if (!getClientForChain || !defaultSmartWalletClient) {
      console.warn('⚠️ Smart wallet dependencies not available', {
        hasGetClientForChain: !!getClientForChain,
        hasDefaultClient: !!defaultSmartWalletClient
      })
      return
    }

    // Prevent concurrent switches
    if (switchingRef.current) {
      console.log('🔒 Chain switch already in progress')
      return
    }

    const chainConfig = getChainConfig(targetChainId)
    if (!chainConfig) {
      console.error(`❌ Unsupported chain: ${targetChainId}`)
      setSwitchState(prev => ({
        ...prev,
        error: `Unsupported chain: ${targetChainId}`,
        isLoading: false
      }))
      return
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`🔄 Starting auto chain switch to ${chainConfig?.name || 'Unknown'} (${targetChainId})`)
    }
    
    // Dispatch start event for header
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auto-chain-switch-start', {
        detail: { chainId: targetChainId, chainName: chainConfig?.name || 'Unknown' }
      }))
    }
    
    switchingRef.current = true
    setSwitchState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      targetChainId
    }))

    try {
      // 1. Switch EOA wallet (embedded wallet) first
      if (process.env.NODE_ENV === 'development') {
        console.log(`📱 Switching EOA wallet to ${chainConfig?.name || 'Unknown'}`)
      }
      try {
        await switchChain({ chainId: targetChainId })
        if (process.env.NODE_ENV === 'development') {
          console.log(`✅ EOA wallet switched to ${chainConfig?.name || 'Unknown'}`)
        }
      } catch (eoaError) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`⚠️ EOA switch failed (may not be critical):`, eoaError)
        }
        // Continue with smart wallet switch even if EOA fails
      }

      // 2. Get smart wallet client for target chain
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔧 Creating smart wallet client for ${chainConfig?.name || 'Unknown'}`)
      }
      
      const newSmartWalletClient = await getClientForChain({
        id: targetChainId
      })
      
      if (!newSmartWalletClient) {
        throw new Error(`Failed to create smart wallet client for chain ${targetChainId}`)
      }

      // 🔍 VALIDATION: Verify smart wallet is on correct chain
      const actualChainId = newSmartWalletClient?.chain?.id
      if (actualChainId !== targetChainId && process.env.NODE_ENV === 'development') {
        console.warn(`⚠️ Chain mismatch detected:`, {
          expectedChain: targetChainId,
          actualChain: actualChainId,
          expectedChainName: chainConfig?.name || 'Unknown',
          actualChainName: actualChainId ? getChainConfig(actualChainId)?.name || 'Unknown' : 'No Chain'
        })
      }

      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ Smart wallet client created for ${chainConfig?.name || 'Unknown'}:`, {
          targetChainId,
          actualChainId,
          address: newSmartWalletClient?.account?.address,
          chainMatch: actualChainId === targetChainId
        })
      }

      // 3. Update state with new client
      setSwitchState(prev => ({
        ...prev,
        isLoading: false,
        isSuccess: true,
        smartWalletClient: newSmartWalletClient,
        targetChainId
      }))

      // 4. Dispatch success event for header with smart wallet client
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auto-chain-switch-success', {
          detail: { 
            chainId: targetChainId, 
            chainName: chainConfig?.name || 'Unknown',
            smartWalletClient: newSmartWalletClient,
            chainInfo: chainConfig
          }
        }))
      }

      // 5. Show success notification
      toast.success(
        `Switched to ${chainConfig?.name || 'Unknown'} successfully`,
        { 
          duration: 3000
        }
      )

      if (process.env.NODE_ENV === 'development') {
        console.log(`🎉 Auto chain switch completed successfully`)
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      if (process.env.NODE_ENV === 'development') {
        console.error(`❌ Chain switch failed:`, error)
      }
      
      // Dispatch error event for header
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auto-chain-switch-error', {
          detail: { chainId: targetChainId, chainName: chainConfig?.name || 'Unknown', error: errorMessage }
        }))
      }
      
      setSwitchState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        smartWalletClient: defaultSmartWalletClient // Fallback to default - but will be updated by ref tracking
      }))

      toast.error(
        `Failed to switch to ${chainConfig?.name || 'Unknown'}: ${errorMessage}`,
        { 
          duration: 4000
        }
      )
    } finally {
      switchingRef.current = false
    }
  }, [user, getClientForChain, switchChain]) // 🚀 FIXED: Stable dependencies only

  /**
   * Auto-switch effect khi fromToken thay đổi
   * Enhanced approach với better chain checking
   */
  useEffect(() => {
    // Check if we have all necessary dependencies
    // 🚀 FIXED: Check getClientForChain directly since not in dependencies
    const isReady = privyReady && !!user && !!fromToken && !!getClientForChain && currentChainIdRef.current !== undefined

    if (!isReady) {
      if (process.env.NODE_ENV === 'development') {
        console.log('⏳ Auto-switch waiting for dependencies...', {
          privyReady,
          hasUser: !!user,
          hasFromToken: !!fromToken,
          hasGetClientForChain: !!getClientForChain,
          currentChainId: currentChainIdRef.current
        })
      }
      return
    }

    const targetChainId = fromToken.chainId
    // 🚀 FIXED: Use stable chain ID comparison
    const currentSmartWalletChainId = switchState.smartWalletClient?.chain?.id || currentChainIdRef.current
    const wagmiChainId = currentChainIdRef.current // EOA chain từ wagmi

    // ✅ Enhanced checks để xác định có cần switch không
    const isAlreadyOnTargetChain = targetChainId === currentSmartWalletChainId
    const isEOAOnTargetChain = targetChainId === wagmiChainId  
    const wasRecentlyProcessed = targetChainId === lastProcessedChainIdRef.current
    const isCurrentlySwitching = switchingRef.current
    const isLoadingState = switchState.isLoading

    // ✅ Comprehensive check - chỉ switch khi thực sự cần
    const needsSwitch = !isAlreadyOnTargetChain && 
                       !wasRecentlyProcessed && 
                       !isCurrentlySwitching && 
                       !isLoadingState

    // ✅ Enhanced logging để debug
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Auto-switch analysis:', {
        tokenSymbol: fromToken.symbol,
        targetChainId,
        targetChainName: getChainConfig(targetChainId)?.name,
        currentSmartWalletChainId,
        currentSmartWalletChainName: getChainConfig(currentSmartWalletChainId)?.name,
        wagmiChainId,
        wagmiChainName: wagmiChainId ? getChainConfig(wagmiChainId)?.name : 'Unknown',
        lastProcessed: lastProcessedChainIdRef.current,
        lastProcessedChainName: lastProcessedChainIdRef.current ? getChainConfig(lastProcessedChainIdRef.current)?.name : 'None',
        // Check results
        isAlreadyOnTargetChain,
        isEOAOnTargetChain,
        wasRecentlyProcessed,
        isCurrentlySwitching,
        isLoadingState,
        needsSwitch,
        conclusion: needsSwitch ? '🔄 WILL SWITCH' : '✅ NO SWITCH NEEDED'
      })
    }

    if (needsSwitch) {
      // Mark as processing immediately để prevent double calls
      lastProcessedChainIdRef.current = targetChainId

      // Trigger the switch
      switchToChain(targetChainId)
    } else if (isAlreadyOnTargetChain) {
      // ✅ Nếu đã đúng chain rồi, clear lastProcessed để có thể switch về chain khác sau này
      if (lastProcessedChainIdRef.current !== targetChainId) {
        lastProcessedChainIdRef.current = targetChainId
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ Already on target chain, updating lastProcessed:', targetChainId)
        }
      }
      
      // Clear success state nếu vẫn đang hiển thị success từ lần switch trước
      if (switchState.isSuccess) {
        setSwitchState(prev => ({
          ...prev,
          isSuccess: false,
          error: null
        }))
      }
    }
  }, [
    privyReady,
    user,
    fromToken?.chainId,
    fromToken?.symbol,
    // 🚀 FIXED: Remove unstable dependencies
    // getClientForChain, defaultSmartWalletClient removed - using refs instead
    switchState.smartWalletClient?.chain?.id,
    switchState.isLoading,
    switchState.isSuccess,
    switchToChain
  ])

  /**
   * Reset state khi user disconnects hoặc fromToken clears
   * Enhanced reset logic
   */
  useEffect(() => {
    if (!user || !fromToken) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 Resetting auto-switch state:', {
          hasUser: !!user,
          hasFromToken: !!fromToken,
          resetReason: !user ? 'User disconnected' : 'Token cleared'
        })
      }
      
      setSwitchState(prev => ({
        ...prev,
        isLoading: false,
        isSuccess: false,
        error: null,
        targetChainId: null,
        smartWalletClient: defaultSmartWalletClient
      }))
      
      // ✅ Clear processed chain để có thể switch lại khi user connect lại
      lastProcessedChainIdRef.current = null
      switchingRef.current = false
    }
  }, [user, fromToken]) // 🚀 FIXED: Remove defaultSmartWalletClient dependency

  /**
   * ✅ Reset lastProcessed khi fromToken thay đổi symbol (khác token)
   * Để có thể switch lại cho token mới từ cùng chain
   */
  useEffect(() => {
    if (fromToken) {
      // Reset lastProcessed nếu token thay đổi (không chỉ chainId)
      // Điều này cho phép switch lại khi user chọn token khác từ cùng chain
      setSwitchState(prev => ({
        ...prev,
        error: null // Clear error khi chọn token mới
      }))
    }
  }, [fromToken?.symbol, fromToken?.address])

  return {
    // State
    isLoading: switchState.isLoading,
    isSuccess: switchState.isSuccess,
    error: switchState.error,
    targetChainId: switchState.targetChainId,
    
    // Smart wallet client for the current/target chain
    smartWalletClient: switchState.smartWalletClient || defaultSmartWalletClient,
    
    // Manual switch function
    switchToChain,
    
    // Helper to get current chain info - safely handle undefined chain
    currentChain: switchState.smartWalletClient?.chain || defaultSmartWalletClient?.chain || null,
  }
}

/**
 * Utility hook để lấy smart wallet client cho chain cụ thể
 * Wrapper around useAutoChainSwitch với manual control
 */
export function useSmartWalletForChain(chainId: number | null) {
  const { getClientForChain } = useSmartWallets()
  const [client, setClient] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  const getClientForSpecificChain = useCallback(async (targetChainId: number) => {
    if (!getClientForChain || !targetChainId) return null

    setIsLoading(true)
    try {
      const newClient = await getClientForChain({ id: targetChainId })
      setClient(newClient)
      return newClient
    } catch (error) {
      console.error(`Failed to get client for chain ${targetChainId}:`, error)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [getClientForChain])

  useEffect(() => {
    if (chainId) {
      getClientForSpecificChain(chainId)
    }
  }, [chainId, getClientForSpecificChain])

  return {
    client,
    isLoading,
    getClientForChain: getClientForSpecificChain
  }
} 