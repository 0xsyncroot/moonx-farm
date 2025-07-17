'use client'

import { useState, useMemo, useEffect } from 'react'
import { usePortfolioOverview } from '@/hooks/usePortfolioOverview'
import { useTokenHoldings } from '@/hooks/useTokenHoldings'
import { usePnLChart } from '@/hooks/usePnLChart'
import { usePrivyTransaction } from '@/hooks/usePrivyTransaction'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import { useAccount } from 'wagmi'
import { RefreshCw, TrendingUp, TrendingDown, Wallet, Eye, X, ArrowUpCircle, ArrowDownCircle, PieChart, DollarSign, Activity, Award, Copy, Check, QrCode, Search, ExternalLink } from 'lucide-react'
import { getChainConfig } from '@/config/chains'
import { isAddress } from 'viem'
import { toast } from 'react-hot-toast'
import { coreApi } from '@/lib/api-client'
import { TokenHoldings } from './token-holdings'
import { formatCurrency, formatBalance, formatPercentage, generateQRCodeUrl, truncateAddress, isNativeToken, copyToClipboard as copyToClipboardUtil } from '@/utils/formatting'
import { NumericFormat } from 'react-number-format'

// ERC20 ABI now handled by usePrivyTransaction hook

export function PortfolioOverview() {
  const { overview, isLoading, refresh, refreshing } = usePortfolioOverview()
  const { holdings, refresh: refreshHoldings, refreshing: holdingsRefreshing } = useTokenHoldings()
  const { pnlData } = usePnLChart()
  const { executeTransaction, state: txState, isReady: isTxReady } = usePrivyTransaction({
    showToasts: false, // Disable automatic toasts to prevent duplicates
    onSuccess: (result) => {
      // Custom success handling
      const chainConfig = getChainConfig(result.chainId)
      if (chainConfig?.explorer) {
        toast.success(
          `Withdrawal successful! View transaction: ${chainConfig.explorer}/tx/${result.hash}`,
          { duration: 5000 }
        )
      } else {
        toast.success('Withdrawal successful!')
      }
    },
    onError: (error) => {
      // Custom error handling - more specific to withdrawal context
      toast.error(`Withdrawal failed: ${error.message}`)
    }
  })
  const { client: smartWalletClient, getClientForChain } = useSmartWallets()
  const { address: wagmiAddress } = useAccount()
  
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [selectedWithdrawToken, setSelectedWithdrawToken] = useState<any>(null)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [recipientAddress, setRecipientAddress] = useState('')
  const [copiedAddress, setCopiedAddress] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  // Remove this - now handled by usePrivyTransaction hook
  // const [isNetworkSwitching, setIsNetworkSwitching] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoadingMoreTokens, setIsLoadingMoreTokens] = useState(false)

  // Get real smart wallet address
  const walletAddress = smartWalletClient?.account?.address || wagmiAddress

  // FIXED: Platform-safe number parsing utility to prevent Mac/Windows differences
  const safeParse = (value: string | number): number => {
    if (!value) return 0
    
    // Convert to string for processing
    const stringValue = value.toString()
    if (stringValue.trim() === '') return 0
    
    // Step 1: Normalize the string by removing all characters except digits, dots, and minus
    // This handles cases where different locales might inject different characters
    let normalized = stringValue.replace(/[^\d.-]/g, '')
    
    // Step 2: Handle multiple dots - keep only the last one as decimal separator
    const dotIndex = normalized.lastIndexOf('.')
    if (dotIndex !== -1) {
      // Remove all dots except the last one
      normalized = normalized.substring(0, dotIndex).replace(/\./g, '') + normalized.substring(dotIndex)
    }
    
    // Step 3: Parse using standard parseFloat
    const parsed = parseFloat(normalized)
    
    // Step 4: Validate result
    if (isNaN(parsed) || !isFinite(parsed)) {
      console.warn('safeParse: Invalid number parsed:', { 
        original: value, 
        normalized, 
        parsed,
        platform: navigator.platform,
        locale: navigator.language 
      })
      return 0
    }
    
    // FIXED: Debug logging for platform differences (only in development)
    if (process.env.NODE_ENV === 'development' && normalized !== stringValue) {
      console.log('safeParse: Number normalized:', { 
        original: value, 
        stringValue,
        normalized, 
        parsed,
        platform: navigator.platform 
      })
    }
    
    return parsed
  }

  // Default to zero values if no data
  const data = overview || {
    totalValue: 0,
    totalChange: 0,
    totalChangePercent: 0,
    totalInvested: 0,
    unrealizedPnL: 0,
    realizedPnL: 0,
  }

  // Get win rate from PnL data
  const pnlMetrics = pnlData['30d'] || { winRate: 0, profitableTrades: 0, totalTrades: 0 }
  
  // Process holdings data (simplified - now using TokenHoldings component)
  const holdingsData = useMemo(() => holdings || [], [holdings])

  // Filter and paginate holdings for withdraw (only tokens with value > 0)
  const filteredHoldings = useMemo(() => {
    return holdingsData.filter(holding => {
      // FIXED: Add more robust validation to prevent edge cases
      const valueUSD = holding.valueUSD || 0
      const balanceFormatted = holding.balanceFormatted || 0
      const hasValue = valueUSD > 0 && balanceFormatted > 0 && !isNaN(balanceFormatted)
      
      const matchesSearch = !searchTerm || 
        (holding.tokenSymbol && holding.tokenSymbol.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (holding.tokenName && holding.tokenName.toLowerCase().includes(searchTerm.toLowerCase()))
      return hasValue && matchesSearch
    })
  }, [holdingsData, searchTerm])

  // Pagination logic
  const tokensPerPage = 10
  const totalPages = filteredHoldings.length > 0 ? Math.ceil(filteredHoldings.length / tokensPerPage) : 1
  const paginatedHoldings = filteredHoldings.slice(
    (currentPage - 1) * tokensPerPage,
    currentPage * tokensPerPage
  )

  // Combined refresh function
  const refreshAllData = async () => {
    try {
      console.log('🔄 Refreshing all portfolio data...')
      
      // Execute refreshes in parallel for better performance
      const refreshPromises = [
        refresh(), // Portfolio overview refresh
        refreshHoldings() // Token holdings refresh
      ]
      
      // Wait for all refreshes to complete
      const results = await Promise.allSettled(refreshPromises)
      
      // Log results for debugging
      results.forEach((result, index) => {
        const name = index === 0 ? 'portfolio overview' : 'token holdings'
        if (result.status === 'fulfilled') {
          console.log(`✅ ${name} refresh completed successfully`)
        } else {
          console.error(`❌ ${name} refresh failed:`, result.reason)
        }
      })
      
      console.log('✅ All portfolio data refresh operations completed')
    } catch (error) {
      console.error('❌ Failed to refresh portfolio data:', error)
    }
  }

  // Debug log (only when data changes)
  useEffect(() => {
    console.log('🔍 Portfolio Overview Debug:', {
      holdingsData,
      holdingsCount: holdingsData.length,
      isLoading,
      refreshing,
      holdingsRefreshing
    })
  }, [holdingsData, isLoading, refreshing, holdingsRefreshing])

  // Helper functions
  const handleCopyToClipboard = async (text: string) => {
    const success = await copyToClipboardUtil(text)
    if (success) {
      setCopiedAddress(true)
      toast.success('Address copied to clipboard')
      setTimeout(() => setCopiedAddress(false), 2000)
    } else {
      toast.error('Failed to copy to clipboard')
    }
  }

  // Helper function to refresh portfolio after transactions
  const refreshPortfolioAfterTransaction = async (action: string) => {
    try {
      console.log(`🔄 Triggering portfolio refresh after ${action}...`)
      await coreApi.refreshPortfolio()
      console.log('✅ Portfolio refresh triggered successfully')
      
      // Show user feedback
      toast.success('Portfolio refresh initiated. Data will update shortly.', { 
        duration: 3000 
      })
      
      // Refresh local data after blockchain sync
      setTimeout(() => {
        refreshAllData()
      }, 3000) // Wait 3s for core service to sync from blockchain
    } catch (refreshError) {
      console.error(`❌ Failed to trigger portfolio refresh after ${action}:`, refreshError)
      // Still refresh local data as fallback
      setTimeout(() => {
        refreshAllData()
      }, 2000)
    }
  }

  // REMOVED: Network switching logic now handled by usePrivyTransaction hook

  const handleTokenSelect = async (token: any) => {
    setSelectedWithdrawToken(token)
    setWithdrawAmount('')
    setRecipientAddress('')
  }

  const handleWithdraw = async () => {
    if (!selectedWithdrawToken || !withdrawAmount || !recipientAddress) return

    // FIXED: Add comprehensive validation for selectedWithdrawToken
    if (!selectedWithdrawToken.tokenSymbol || !selectedWithdrawToken.chainId) {
      toast.error('Invalid token data. Please refresh and try again.')
      return
    }

    // Debug token data structure
    console.log('🔍 Debug token data:', {
      selectedToken: selectedWithdrawToken,
      tokenSymbol: selectedWithdrawToken.tokenSymbol,
      tokenAddress: selectedWithdrawToken.tokenAddress,
      chainId: selectedWithdrawToken.chainId,
      balanceFormatted: selectedWithdrawToken.balanceFormatted,
      allTokenFields: Object.keys(selectedWithdrawToken)
    })

    // Determine if token is native by checking if tokenAddress is zero address or specific native tokens
    const isNative = isNativeToken(selectedWithdrawToken)

    // Validation
    if (!isAddress(recipientAddress)) {
      toast.error('Invalid recipient address')
      return
    }

    // FIXED: Use platform-safe parsing to prevent Mac/Windows differences
    const amount = safeParse(withdrawAmount)
    
    // FIXED: Add better validation for edge cases
    if (amount <= 0) {
      toast.error('Invalid withdrawal amount')
      return
    }
    
    // For transaction execution, ensure clean format (no commas, dots only as decimal)
    const cleanWithdrawAmount = amount.toString()
    
    const maxBalance = selectedWithdrawToken.balanceFormatted || 0
    if (amount > maxBalance) {
      toast.error(`Amount exceeds available balance of ${formatBalance(maxBalance)}`)
      return
    }

    try {
      toast.loading('Processing withdrawal...', { id: 'withdraw' })

      // Prepare transaction parameters for the hook
      let txParams;
      
      if (isNative) {
        // Native token transfer (ETH, BNB, etc.)
        txParams = {
          type: 'native' as const,
          to: recipientAddress as `0x${string}`,
          amount: cleanWithdrawAmount,
          chainId: selectedWithdrawToken.chainId
        }
      } else {
        // ERC20 token transfer (USDC, USDT, etc.)
        const tokenAddress = selectedWithdrawToken.tokenAddress
        const tokenDecimals = selectedWithdrawToken.tokenDecimals ?? 18
        
        if (!tokenAddress) {
          throw new Error('Token address is required for ERC20 transfer')
        }
        
        txParams = {
          type: 'erc20' as const,
          to: recipientAddress as `0x${string}`,
          amount: cleanWithdrawAmount,
          tokenAddress: tokenAddress as `0x${string}`,
          tokenDecimals,
          chainId: selectedWithdrawToken.chainId
        }
      }

      console.log('🚀 Executing withdraw transaction:', {
        token: selectedWithdrawToken.tokenSymbol,
        amount: cleanWithdrawAmount,
        originalAmount: withdrawAmount,
        parsedAmount: amount,
        recipient: recipientAddress,
        chainId: selectedWithdrawToken.chainId,
        tokenAddress: selectedWithdrawToken.tokenAddress,
        isNativeToken: isNative,
        // FIXED: Platform debugging info
        platform: {
          userAgent: navigator.userAgent,
          language: navigator.language,
          languages: navigator.languages,
          platform: navigator.platform
        }
      })

      // Execute transaction using the new hook
      const result = await executeTransaction(txParams)
      
      console.log('✅ Transaction completed:', result)

      // Success feedback handled by hook's onSuccess callback
      toast.success('Processing completed!', { id: 'withdraw' })
      
      // Close modal on success
      setShowWithdrawModal(false)
      setSelectedWithdrawToken(null)
      setWithdrawAmount('')
      setRecipientAddress('')
      
      // Force refresh portfolio from blockchain
      await refreshPortfolioAfterTransaction('withdrawal')
      
    } catch (error) {
      console.error('❌ Withdrawal failed:', error)
      
      // Error already handled by hook's onError callback, just dismiss loading toast
      toast.dismiss('withdraw')
      
    }
  }

  const loadMoreTokens = () => {
    if (currentPage < totalPages) {
      setIsLoadingMoreTokens(true)
      // Simulate loading
      setTimeout(() => {
        setCurrentPage(prev => prev + 1)
        setIsLoadingMoreTokens(false)
      }, 500)
    }
  }

  // Check if any data is refreshing
  const isRefreshing = refreshing || holdingsRefreshing

  // Debug refresh states
  useEffect(() => {
    if (refreshing || holdingsRefreshing) {
      console.log('🔄 Refresh states:', { 
        overviewRefreshing: refreshing, 
        holdingsRefreshing: holdingsRefreshing,
        combinedRefreshing: isRefreshing 
      })
    }
  }, [refreshing, holdingsRefreshing, isRefreshing])

  // Shimmer loading overlay component (memoized)
  const ShimmerOverlay = useMemo(() => {
    return () => (
      <div className="absolute inset-0 bg-card/50 backdrop-blur-sm rounded-xl overflow-hidden z-10">
        <div className="h-full w-full bg-gradient-to-r from-transparent via-primary/20 to-transparent animate-shimmer bg-[length:200%_100%]" />
      </div>
    )
  }, [])

  return (
    <div className="bg-card/30 backdrop-blur-xl border border-border/30 rounded-xl p-6 space-y-6 relative">
      {(isLoading || isRefreshing) && <ShimmerOverlay />}
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-r from-primary to-primary/60 rounded-full flex items-center justify-center">
            <Wallet className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Smart Portfolio</h2>
            <p className="text-sm text-muted-foreground">Professional Trading Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDetailsModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-card/60 hover:bg-card/80 border border-border/40 rounded-lg transition-colors"
          >
            <Eye className="h-4 w-4" />
            Details
          </button>
          <button
            onClick={() => refreshAllData()}
            disabled={isRefreshing || isLoading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing || isLoading ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Main Content Grid - Giữ nguyên layout 2 cột */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Portfolio Stats - Tập trung vào performance & actions */}
        <div className="space-y-4">
          {/* Total Value - Bỏ thông tin trùng lặp, chỉ hiển thị total value */}
          <div className="bg-card/60 backdrop-blur-sm border border-border/40 rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium text-muted-foreground">Total Portfolio Value</span>
              </div>
              <div className="flex items-center gap-1">
                {data.totalChange >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-success" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-error" />
                )}
                <span className={`text-sm font-medium ${data.totalChange >= 0 ? 'text-success' : 'text-error'}`}>
                  {formatPercentage(data.totalChangePercent)}
                </span>
              </div>
            </div>
            <div className="text-3xl font-bold text-foreground">{formatCurrency(data.totalValue)}</div>
            <div className="text-sm text-muted-foreground mt-1">
              {data.totalChange >= 0 ? 'Gained' : 'Lost'} {formatCurrency(Math.abs(data.totalChange))} today
            </div>
          </div>

          {/* Portfolio Performance Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card/60 backdrop-blur-sm border border-border/40 rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                {data.unrealizedPnL >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-success" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-error" />
                )}
                <span className="text-xs text-muted-foreground">Unrealized P&L</span>
              </div>
              <div className={`text-lg font-bold ${data.unrealizedPnL >= 0 ? 'text-success' : 'text-error'}`}>
                {formatCurrency(data.unrealizedPnL)}
              </div>
            </div>
            <div className="bg-card/60 backdrop-blur-sm border border-border/40 rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                {(pnlMetrics.winRate || 0) >= 50 ? (
                  <Award className="h-4 w-4 text-success" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-error" />
                )}
                <span className="text-xs text-muted-foreground">Win Rate</span>
              </div>
              <div className={`text-lg font-bold ${(pnlMetrics.winRate || 0) >= 50 ? 'text-success' : 'text-error'}`}>
                {(pnlMetrics.winRate || 0).toFixed(1)}%
              </div>
            </div>
            <div className="bg-card/60 backdrop-blur-sm border border-border/40 rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                {data.realizedPnL >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-success" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-error" />
                )}
                <span className="text-xs text-muted-foreground">Realized P&L</span>
              </div>
              <div className={`text-lg font-bold ${data.realizedPnL >= 0 ? 'text-success' : 'text-error'}`}>
                {formatCurrency(data.realizedPnL)}
              </div>
            </div>
            <div className="bg-card/60 backdrop-blur-sm border border-border/40 rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">Total Invested</span>
              </div>
              <div className="text-lg font-bold text-foreground">
                {formatCurrency(data.totalInvested)}
              </div>
            </div>
          </div>

          {/* Trading Statistics - Compact hơn */}
          <div className="bg-card/60 backdrop-blur-sm border border-border/40 rounded-lg p-3 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-4 bg-primary rounded-full"></div>
              <span className="text-sm font-medium text-foreground">Trading Statistics</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-lg font-bold text-foreground">{pnlMetrics.totalTrades || 0}</div>
                <div className="text-xs text-muted-foreground">Total Trades</div>
              </div>
              <div>
                <div className="text-lg font-bold text-success">{pnlMetrics.profitableTrades || 0}</div>
                <div className="text-xs text-muted-foreground">Wins</div>
              </div>
              <div>
                <div className="text-lg font-bold text-error">{(pnlMetrics.totalTrades || 0) - (pnlMetrics.profitableTrades || 0)}</div>
                <div className="text-xs text-muted-foreground">Losses</div>
              </div>
            </div>
          </div>

          {/* Wallet Actions */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-4 bg-primary rounded-full"></div>
              <span className="text-sm font-medium text-foreground">Wallet Actions</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowDepositModal(true)}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-card/60 backdrop-blur-sm border border-success/40 rounded-lg hover:bg-success/10 transition-all group shadow-sm"
              >
                <ArrowDownCircle className="h-4 w-4 text-success group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium text-success">Deposit</span>
              </button>
              <button
                onClick={() => setShowWithdrawModal(true)}
                disabled={filteredHoldings.length === 0}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-card/60 backdrop-blur-sm border border-error/40 rounded-lg hover:bg-error/10 transition-all group disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                <ArrowUpCircle className="h-4 w-4 text-error group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium text-error">Withdraw</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right: Token Holdings Component - Loại bỏ thông tin trùng lặp */}
        <div>
          <TokenHoldings />
        </div>
      </div>

      {/* Details Modal */}
      {showDetailsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border/50 rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Portfolio Details</h3>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted/10 rounded-lg">
                <div className="text-sm text-muted-foreground">Total Invested</div>
                <div className="text-xl font-bold">{formatCurrency(data.totalInvested)}</div>
              </div>
              <div className="p-4 bg-muted/10 rounded-lg">
                <div className="text-sm text-muted-foreground">Realized P&L</div>
                <div className={`text-xl font-bold ${data.realizedPnL >= 0 ? 'text-success' : 'text-error'}`}>
                  {formatCurrency(data.realizedPnL)}
                </div>
              </div>
              <div className="p-4 bg-muted/10 rounded-lg">
                <div className="text-sm text-muted-foreground">Unrealized P&L</div>
                <div className={`text-xl font-bold ${data.unrealizedPnL >= 0 ? 'text-success' : 'text-error'}`}>
                  {formatCurrency(data.unrealizedPnL)}
                </div>
              </div>
              <div className="p-4 bg-muted/10 rounded-lg">
                <div className="text-sm text-muted-foreground">Win Rate</div>
                <div className={`text-xl font-bold ${(pnlMetrics.winRate || 0) >= 50 ? 'text-success' : 'text-error'}`}>
                  {(pnlMetrics.winRate || 0).toFixed(1)}%
                </div>
              </div>
            </div>

            <div className="p-4 bg-muted/10 rounded-lg">
              <div className="text-sm text-muted-foreground mb-2">Smart Wallet Address</div>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono bg-muted/20 px-2 py-1 rounded flex-1">
                  {walletAddress || 'Not connected'}
                </code>
                {walletAddress && (
                  <button
                    onClick={() => handleCopyToClipboard(walletAddress)}
                    className="p-1 hover:bg-muted/20 rounded"
                  >
                    {copiedAddress ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </button>
                )}
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              Trading Statistics: {pnlMetrics.profitableTrades || 0} wins out of {pnlMetrics.totalTrades || 0} total trades
            </div>
          </div>
        </div>
      )}

      {/* Deposit Modal */}
      {showDepositModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border/50 rounded-xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Deposit Funds</h3>
              <button
                onClick={() => setShowDepositModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="text-center p-4 bg-success/10 border border-success/20 rounded-lg">
                <ArrowDownCircle className="h-8 w-8 text-success mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Send funds to your smart wallet address
                </p>
              </div>
              
              {walletAddress ? (
                <>
                  {/* QR Code */}
                  <div className="text-center p-4 bg-muted/10 border border-border/30 rounded-lg">
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <QrCode className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Smart Wallet Address</span>
                    </div>
                    <div className="bg-white p-3 rounded-lg mb-3">
                      <img 
                        src={generateQRCodeUrl(walletAddress)} 
                        alt="Wallet QR Code" 
                        className="w-40 h-40 mx-auto"
                      />
                    </div>
                    
                    {/* Copy Address */}
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">Smart Wallet Address:</div>
                      <div className="flex items-center gap-2 p-2 bg-muted/20 rounded border">
                        <div className="text-xs font-mono flex-1 truncate">{walletAddress}</div>
                        <button
                          onClick={() => handleCopyToClipboard(walletAddress)}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-primary/20 hover:bg-primary/30 text-primary rounded transition-colors"
                        >
                          {copiedAddress ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          {copiedAddress ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground text-center">
                    <p>• Send ETH, USDC, or other tokens to this address</p>
                    <p>• Funds will appear in your portfolio after confirmation</p>
                    <p>• Only send tokens on supported networks</p>
                    <p className="text-xs text-primary/70 mt-2">
                      💡 Note: Only BNB and Base networks are supported for now. More networks will be supported in the future. Please deposit on the correct network.
                    </p>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">
                    Please connect your wallet to see deposit address
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border/50 rounded-xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Withdraw Funds</h3>
              <button
                onClick={() => setShowWithdrawModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="text-center p-4 bg-error/10 border border-error/20 rounded-lg">
                <ArrowUpCircle className="h-8 w-8 text-error mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Withdraw your tokens to external wallet
                </p>
              </div>
              
              {filteredHoldings.length > 0 ? (
                <div className="space-y-4">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search tokens..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value)
                        setCurrentPage(1) // Reset pagination when searching
                      }}
                      className="w-full pl-10 pr-4 py-2 bg-muted/20 border border-border/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  {/* Token Selection */}
                  {!selectedWithdrawToken ? (
                    <div>
                      <label className="text-sm font-medium text-foreground mb-2 block">
                        Select Token ({filteredHoldings.length} available)
                      </label>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {paginatedHoldings.map((holding, index) => {
                          const chainConfig = getChainConfig(holding.chainId || 8453)
                          return (
                            <button
                              key={`${holding.tokenSymbol}-${holding.chainId}-${index}`}
                              onClick={() => handleTokenSelect(holding)}
                              className="w-full flex items-center justify-between p-3 bg-muted/10 border border-border/30 hover:bg-muted/20 rounded-lg transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-primary/30 to-primary/20 flex items-center justify-center text-sm font-bold">
                                  {holding.tokenSymbol.charAt(0)}
                                </div>
                                <div className="text-left">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm">{holding.tokenSymbol}</span>
                                    <span className="text-xs bg-muted/30 px-1.5 py-0.5 rounded">
                                      {chainConfig?.name || `Chain ${holding.chainId}`}
                                    </span>
                                    <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                                      {isNativeToken(holding) ? 'Native' : 'ERC20'}
                                    </span>
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {formatBalance(holding.balanceFormatted)} available
                                    {holding.tokenAddress && holding.tokenAddress !== '0x0000000000000000000000000000000000000000' && (
                                      <span className="ml-2">• {holding.tokenAddress.slice(0, 6)}...{holding.tokenAddress.slice(-4)}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-medium">{formatCurrency(holding.valueUSD || 0)}</div>
                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                  <ExternalLink className="h-3 w-3" />
                                  Switch to {chainConfig?.name}
                                </div>
                              </div>
                            </button>
                          )
                        })}
                      </div>

                      {/* Pagination */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between pt-2">
                          <div className="text-xs text-muted-foreground">
                            Page {currentPage} of {totalPages}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                              disabled={currentPage === 1}
                              className="px-2 py-1 text-xs bg-muted/20 hover:bg-muted/30 rounded disabled:opacity-50"
                            >
                              Previous
                            </button>
                            <button
                              onClick={loadMoreTokens}
                              disabled={currentPage === totalPages || isLoadingMoreTokens}
                              className="px-2 py-1 text-xs bg-muted/20 hover:bg-muted/30 rounded disabled:opacity-50"
                            >
                              {isLoadingMoreTokens ? 'Loading...' : 'Next'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Selected Token Form */
                    <div className="space-y-4">
                      {/* Selected token info */}
                      <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-primary/30 to-primary/20 flex items-center justify-center text-sm font-bold">
                              {selectedWithdrawToken.tokenSymbol.charAt(0)}
                            </div>
                            <div>
                              <div className="font-medium">{selectedWithdrawToken.tokenSymbol}</div>
                              <div className="text-xs text-muted-foreground">
                                {getChainConfig(selectedWithdrawToken.chainId)?.name || `Chain ${selectedWithdrawToken.chainId}`}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {isNativeToken(selectedWithdrawToken) 
                                  ? 'Native Token' 
                                  : `ERC20 • ${truncateAddress(selectedWithdrawToken.tokenAddress)}`
                                }
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => setSelectedWithdrawToken(null)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Amount Input */}
                      <div>
                        <label className="text-sm font-medium text-foreground">Amount</label>
                        <div className="mt-1 space-y-2">
                          <NumericFormat
                            value={withdrawAmount}
                            onValueChange={(values) => {
                              setWithdrawAmount(values.value || '')
                            }}
                            placeholder="Enter amount"
                            thousandSeparator=","
                            decimalSeparator="."
                            decimalScale={8}
                            allowNegative={false}
                            fixedDecimalScale={false}
                            // FIXED: Ensure consistent formatting across platforms
                            allowLeadingZeros={false}
                            className="w-full px-3 py-2 bg-muted/20 border border-border/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                          />
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Available: {formatBalance(selectedWithdrawToken.balanceFormatted)}</span>
                            <button
                              onClick={() => {
                                // FIXED: Ensure Max button works correctly with NumericFormat and platform differences
                                const maxAmount = selectedWithdrawToken.balanceFormatted || 0
                                // Use safeParse to ensure consistent number handling
                                const safeMaxAmount = safeParse(maxAmount.toString())
                                setWithdrawAmount(safeMaxAmount.toString())
                              }}
                              className="text-primary hover:text-primary/80"
                            >
                              Max
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Recipient Address */}
                      <div>
                        <label className="text-sm font-medium text-foreground">Recipient Address</label>
                        <input
                          type="text"
                          placeholder="Enter recipient wallet address"
                          value={recipientAddress}
                          onChange={(e) => setRecipientAddress(e.target.value)}
                          className="w-full mt-1 px-3 py-2 bg-muted/20 border border-border/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                      
                        <button 
                          onClick={handleWithdraw}
                          disabled={!selectedWithdrawToken || !withdrawAmount || !recipientAddress || txState.isLoading || txState.isNetworkSwitching || !isTxReady}
                          className="w-full px-4 py-2 bg-error hover:bg-error/90 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {(txState.isLoading || txState.isNetworkSwitching) ? (
                            <>
                              <RefreshCw className="h-4 w-4 animate-spin" />
                              {txState.isNetworkSwitching ? 'Switching Network...' : 'Processing...'}
                            </>
                          ) : (
                            `Withdraw ${selectedWithdrawToken.tokenSymbol}`
                          )}
                        </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">No tokens available for withdrawal</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 