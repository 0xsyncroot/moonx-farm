import { useMemo } from 'react'
import { Token } from './use-tokens'
import { getChainConfig } from '@/config/chains'

// Chain configurations for cross-chain support with extended colors
const CHAIN_DISPLAY_CONFIG = {
  1: { bgColor: 'bg-blue-50', textColor: 'text-blue-600' },
  8453: { bgColor: 'bg-blue-50', textColor: 'text-blue-600' },
  56: { bgColor: 'bg-yellow-50', textColor: 'text-yellow-600' },
  84532: { bgColor: 'bg-orange-50', textColor: 'text-orange-600' },
  97: { bgColor: 'bg-orange-50', textColor: 'text-orange-600' },
}

export function useChainInfo(fromToken: Token | null, toToken: Token | null) {
  return useMemo(() => {
    const fromChainConfig = fromToken ? getChainConfig(fromToken.chainId) : null
    const toChainConfig = toToken ? getChainConfig(toToken.chainId) : null
    const fromChainDisplay = fromToken ? CHAIN_DISPLAY_CONFIG[fromToken.chainId as keyof typeof CHAIN_DISPLAY_CONFIG] : null
    const toChainDisplay = toToken ? CHAIN_DISPLAY_CONFIG[toToken.chainId as keyof typeof CHAIN_DISPLAY_CONFIG] : null
    
    return {
      isCrossChain: fromToken && toToken && fromToken.chainId !== toToken.chainId,
      fromChain: fromChainConfig && fromChainDisplay ? { ...fromChainConfig, ...fromChainDisplay } : null,
      toChain: toChainConfig && toChainDisplay ? { ...toChainConfig, ...toChainDisplay } : null,
    }
  }, [fromToken, toToken])
} 