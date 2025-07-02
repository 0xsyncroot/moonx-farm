import { useState, useCallback } from 'react'
import { Token } from './use-tokens'

interface UseShareProps {
  fromToken: Token | null
  toToken: Token | null
  amount: string
  slippage: number
}

export function useShare({ fromToken, toToken, amount, slippage }: UseShareProps) {
  const [shareStatus, setShareStatus] = useState<'idle' | 'copying' | 'copied'>('idle')

  const handleShare = useCallback(async () => {
    if (shareStatus === 'copying') return
    
    setShareStatus('copying')
    
    try {
      // Build URL params inline
      const urlParams: Record<string, string | null> = {}
      
      if (fromToken) {
        urlParams.from = fromToken.address
        urlParams.fromChain = fromToken.chainId.toString()
      }
      
      if (toToken) {
        urlParams.to = toToken.address
        urlParams.toChain = toToken.chainId.toString()
      }
      
      if (amount && amount !== '0') {
        urlParams.amount = amount
        urlParams.exactField = 'input'
      }
      
      if (slippage && slippage !== 0.5) {
        urlParams.slippage = slippage.toString()
      }
      
      const params = new URLSearchParams()
      Object.entries(urlParams).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          params.set(key, value)
        }
      })
      
      // Use window.location for share URL
      const shareUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`
      
      await navigator.clipboard.writeText(shareUrl)
      setShareStatus('copied')
      
      setTimeout(() => setShareStatus('idle'), 2000)
    } catch (error) {
      console.error('Failed to copy swap link:', error)
      setShareStatus('idle')
    }
  }, [fromToken, toToken, amount, slippage, shareStatus])

  return {
    shareStatus,
    handleShare
  }
} 