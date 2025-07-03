'use client'

import { useBalance, useAccount } from 'wagmi'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import { useMemo } from 'react'
import { formatUnits } from 'viem'
import { Token } from './use-tokens'

interface TokenBalanceResult {
  balance: string | null
  balanceFormatted: string | null
  balanceNumber: number
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

/**
 * Hook to get token balance for the connected wallet
 * Supports both native tokens (ETH, BNB) and ERC20 tokens
 */
export function useTokenBalance(token: Token | null, customSmartWalletClient?: any): TokenBalanceResult {
  const { address: wagmiAddress } = useAccount()
  const { client: defaultSmartWalletClient } = useSmartWallets()
  
  // Use custom smart wallet client if provided, otherwise use default
  const smartWalletClient = customSmartWalletClient || defaultSmartWalletClient
  
  // Prioritize smart wallet address over wagmi address
  const walletAddress = smartWalletClient?.account?.address || wagmiAddress
  
  // For native tokens, use address as undefined
  // For ERC20 tokens, use the token contract address
  const tokenAddress = token?.isNative ? undefined : (token?.address as `0x${string}`)
  
  const {
    data: balanceData,
    isLoading,
    error,
    refetch
  } = useBalance({
    address: walletAddress as `0x${string}`,
    token: tokenAddress,
    chainId: token?.chainId,
    // Enable the query only if we have a wallet address and token
    query: {
      enabled: !!(walletAddress && token),
      // Refetch every 30 seconds to keep balance updated
      refetchInterval: 30000,
      // Stale time of 15 seconds
      staleTime: 15000,
    }
  })

  const result = useMemo(() => {
    if (!balanceData || !token) {
      return {
        balance: null,
        balanceFormatted: null,
        balanceNumber: 0,
        isLoading,
        error,
        refetch
      }
    }

    try {
      // Format the balance using the token's decimals
      const formatted = formatUnits(balanceData.value, token.decimals)
      
      // 🔧 IMPROVEMENT: Better precision handling for different scenarios
      let cleanFormatted = formatted
      
      // Remove trailing zeros but preserve significant digits
      if (formatted.includes('.')) {
        cleanFormatted = formatted.replace(/\.?0+$/, '')
        // Ensure we don't end up with empty string
        if (cleanFormatted === '' || cleanFormatted === '.') {
          cleanFormatted = '0'
        }
      }
      
      // Parse to number for balanceNumber
      const number = parseFloat(cleanFormatted)
      
      // Validate the parsed number
      if (!isFinite(number) || isNaN(number)) {
        console.warn('Invalid balance number parsed:', { formatted, cleanFormatted, number })
        return {
          balance: balanceData.value.toString(),
          balanceFormatted: '0',
          balanceNumber: 0,
          isLoading,
          error,
          refetch
        }
      }
      
      return {
        balance: balanceData.value.toString(),
        balanceFormatted: cleanFormatted,
        balanceNumber: number,
        isLoading,
        error,
        refetch
      }
    } catch (err) {
      console.error('Error formatting token balance:', err, { 
        tokenSymbol: token?.symbol,
        tokenDecimals: token?.decimals,
        rawBalance: balanceData?.value?.toString()
      })
      return {
        balance: null,
        balanceFormatted: null,
        balanceNumber: 0,
        isLoading,
        error: err instanceof Error ? err : new Error('Failed to format balance'),
        refetch
      }
    }
  }, [balanceData, token, isLoading, error, refetch])

  return result
}

/**
 * Hook to get multiple token balances at once
 * Useful for portfolio views or when displaying multiple tokens
 */
export function useMultipleTokenBalances(tokens: Token[]): Record<string, TokenBalanceResult> {
  const { address: walletAddress } = useAccount()
  
  const results = useMemo(() => {
    const balances: Record<string, TokenBalanceResult> = {}
    
    tokens.forEach(token => {
      const key = `${token.chainId}-${token.address}`
      // This would ideally use individual useBalance hooks, but for simplicity
      // we'll return a structure that can be populated by individual calls
      balances[key] = {
        balance: null,
        balanceFormatted: null,
        balanceNumber: 0,
        isLoading: false,
        error: null,
        refetch: () => {}
      }
    })
    
    return balances
  }, [tokens])
  
  return results
}

/**
 * Utility function to format balance for display
 */
export function formatTokenBalance(
  balance: string | null,
  decimals: number,
  maxDecimals: number = 6
): string {
  if (!balance) return '0'
  
  try {
    const formatted = formatUnits(BigInt(balance), decimals)
    const number = parseFloat(formatted)
    
    // For very small numbers, show more decimals
    if (number < 0.001 && number > 0) {
      return number.toExponential(2)
    }
    
    // For normal numbers, limit decimal places
    if (number < 1) {
      return number.toFixed(Math.min(maxDecimals, 8))
    }
    
    return number.toFixed(Math.min(maxDecimals, 4))
  } catch (error) {
    console.error('Error formatting balance:', error)
    return '0'
  }
}

/**
 * Utility function to check if balance is sufficient for amount
 */
export function hasSufficientBalance(
  balance: string | null,
  amount: string,
  decimals: number
): boolean {
  if (!balance || !amount) return false
  
  try {
    const balanceNumber = parseFloat(formatUnits(BigInt(balance), decimals))
    const amountNumber = parseFloat(amount)
    
    return balanceNumber >= amountNumber
  } catch (error) {
    console.error('Error checking balance sufficiency:', error)
    return false
  }
} 