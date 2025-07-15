'use client'

import { useState, useMemo, useEffect } from 'react'
import { usePortfolioOverview } from '@/hooks/usePortfolioOverview'
import { useTokenHoldings } from '@/hooks/useTokenHoldings'
import { usePnLChart } from '@/hooks/usePnLChart'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import { useAccount } from 'wagmi'
import { RefreshCw, TrendingUp, TrendingDown, Wallet, Eye, X, ArrowUpCircle, ArrowDownCircle, PieChart, DollarSign, Activity, Award, Copy, Check, QrCode, Search, ExternalLink } from 'lucide-react'
import { getChainConfig } from '@/config/chains'
import { parseEther, parseUnits, isAddress } from 'viem'
import { toast } from 'react-hot-toast'
import { coreApi } from '@/lib/api-client'
import { TokenHoldings } from './token-holdings'

// ERC20 ABI for transfer function
const ERC20_ABI = [
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  }
] as const

export function PortfolioOverview() {
  const { overview, isLoading, refresh, refreshing } = usePortfolioOverview()
  const { holdings } = useTokenHoldings()
  const { pnlData } = usePnLChart()
  const { client: smartWalletClient, getClientForChain } = useSmartWallets()
  const { address: wagmiAddress } = useAccount()
  
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [showTokenHoldingsModal, setShowTokenHoldingsModal] = useState(false)
  const [selectedWithdrawToken, setSelectedWithdrawToken] = useState<any>(null)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [recipientAddress, setRecipientAddress] = useState('')
  const [copiedAddress, setCopiedAddress] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [isNetworkSwitching, setIsNetworkSwitching] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoadingMoreTokens, setIsLoadingMoreTokens] = useState(false)

  // Get real smart wallet address
  const walletAddress = smartWalletClient?.account?.address || wagmiAddress

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
      const hasValue = holding.valueUSD > 0 && holding.balanceFormatted > 0
      const matchesSearch = !searchTerm || 
        holding.tokenSymbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (holding.tokenName && holding.tokenName.toLowerCase().includes(searchTerm.toLowerCase()))
      return hasValue && matchesSearch
    })
  }, [holdingsData, searchTerm])

  // Pagination logic
  const tokensPerPage = 10
  const totalPages = Math.ceil(filteredHoldings.length / tokensPerPage)
  const paginatedHoldings = filteredHoldings.slice(
    (currentPage - 1) * tokensPerPage,
    currentPage * tokensPerPage
  )

  // Debug log (only when data changes)
  useEffect(() => {
    console.log('🔍 Portfolio Overview Debug:', {
      holdingsData,
      holdingsCount: holdingsData.length,
      isLoading,
      refreshing
    })
  }, [holdingsData, isLoading, refreshing])

  // Helper functions
  const formatCurrency = (value: number) => {
    if (value === 0) return '$0.00'
    if (Math.abs(value) < 0.01) return value >= 0 ? '<$0.01' : '>-$0.01'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  const formatBalance = (balanceFormatted: number) => {
    if (isNaN(balanceFormatted) || balanceFormatted === 0) return '0'
    if (balanceFormatted < 0.0001) return balanceFormatted.toExponential(2)
    if (balanceFormatted < 1) return balanceFormatted.toFixed(6)
    if (balanceFormatted < 1000) return balanceFormatted.toFixed(4)
    if (balanceFormatted < 1000000) return `${(balanceFormatted / 1000).toFixed(1)}K`
    return `${(balanceFormatted / 1000000).toFixed(1)}M`
  }

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedAddress(true)
    setTimeout(() => setCopiedAddress(false), 2000)
  }

  const generateQRCode = (address: string) => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(address)}`
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
        refresh()
      }, 3000) // Wait 3s for core service to sync from blockchain
    } catch (refreshError) {
      console.error(`❌ Failed to trigger portfolio refresh after ${action}:`, refreshError)
      // Still refresh local data as fallback
      setTimeout(() => {
        refresh()
      }, 2000)
    }
  }

  // Network switching for withdraw - following AUTO_CHAIN_SWITCH pattern
  const switchToTokenNetwork = async (token: any) => {
    if (!token.chainId || !getClientForChain) return null

    try {
      setIsNetworkSwitching(true)
      
      // Use getClientForChain to get smart wallet client for token's chain
      // This automatically handles chain switching without UI changes
      const newSmartWalletClient = await getClientForChain({ id: token.chainId })
      
      if (!newSmartWalletClient) {
        throw new Error('Failed to create smart wallet client for target chain')
      }

      console.log('✅ Smart wallet client created for chain:', {
        chainId: token.chainId,
        address: newSmartWalletClient.account?.address,
        actualChain: newSmartWalletClient.chain?.id
      })

      return newSmartWalletClient
    } catch (error) {
      console.error('❌ Network switch failed:', error)
      return null
    } finally {
      setIsNetworkSwitching(false)
    }
  }

  const handleTokenSelect = async (token: any) => {
    setSelectedWithdrawToken(token)
    setWithdrawAmount('')
    setRecipientAddress('')
  }

  const handleWithdraw = async () => {
    if (!selectedWithdrawToken || !withdrawAmount || !recipientAddress) return

    // Debug token data structure
    console.log('🔍 Debug token data:', {
      selectedToken: selectedWithdrawToken,
      tokenSymbol: selectedWithdrawToken.tokenSymbol,
      tokenAddress: selectedWithdrawToken.tokenAddress,
      chainId: selectedWithdrawToken.chainId,
      allTokenFields: Object.keys(selectedWithdrawToken)
    })

    // Determine if token is native by checking if tokenAddress is zero address or specific native tokens
    const isNative = selectedWithdrawToken.tokenAddress === '0x0000000000000000000000000000000000000000' || 
                     selectedWithdrawToken.tokenSymbol === 'ETH' ||
                     selectedWithdrawToken.tokenSymbol === 'BNB' ||
                     selectedWithdrawToken.tokenSymbol === 'MATIC'

    // Validation
    if (!isAddress(recipientAddress)) {
      toast.error('Invalid recipient address')
      return
    }

    const amount = parseFloat(withdrawAmount)
    if (amount <= 0 || amount > selectedWithdrawToken.balanceFormatted) {
      toast.error('Invalid withdrawal amount')
      return
    }

    try {
      setIsNetworkSwitching(true)
      toast.loading('Processing withdrawal...', { id: 'withdraw' })

      // Get smart wallet client for token's chain
      const targetSmartWalletClient = await switchToTokenNetwork(selectedWithdrawToken)
      
      if (!targetSmartWalletClient) {
        throw new Error('Failed to switch to token network')
      }

      // Real transaction implementation
      const tokenAddress = selectedWithdrawToken.tokenAddress
      const chainId = selectedWithdrawToken.chainId
      const isNativeToken = isNative
      
      console.log('🚀 Executing withdraw transaction:', {
        token: selectedWithdrawToken.tokenSymbol,
        amount: withdrawAmount,
        recipient: recipientAddress,
        chainId,
        tokenAddress,
        isNativeToken,
        walletAddress: targetSmartWalletClient.account?.address
      })

      let txHash: string

      if (isNativeToken) {
        // Native token transfer (ETH, BNB, etc.)
        console.log('🔄 Executing native token transfer...')
        
        const tx = await targetSmartWalletClient.sendTransaction({
          to: recipientAddress as `0x${string}`,
          value: parseEther(withdrawAmount),
        })
        
        txHash = tx
        console.log('✅ Native transfer transaction:', txHash)
        
      } else {
        // ERC20 token transfer (USDC, USDT, etc.)
        console.log('🔄 Executing ERC20 token transfer...', {
          tokenAddress,
          amount: withdrawAmount,
          decimals: selectedWithdrawToken.tokenDecimals
        })
        
        if (!tokenAddress) {
          throw new Error('Token address is required for ERC20 transfer')
        }
        
        const transferAmount = parseUnits(
          withdrawAmount, 
          selectedWithdrawToken.tokenDecimals || 18
        )
        
        console.log('📊 Transfer details:', {
          rawAmount: withdrawAmount,
          parsedAmount: transferAmount.toString(),
          decimals: selectedWithdrawToken.tokenDecimals || 18
        })
        
        const tx = await targetSmartWalletClient.writeContract({
          address: tokenAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [recipientAddress as `0x${string}`, transferAmount]
        })
        
        txHash = tx
        console.log('✅ ERC20 transfer transaction:', txHash)
      }

      // Success feedback
      toast.success('Withdrawal successful!', { id: 'withdraw' })
      
      // Show transaction hash
      const chainConfig = getChainConfig(chainId)
      if (chainConfig?.explorer && txHash) {
        toast.success(
          <div className="flex items-center gap-2">
            <span>Transaction completed!</span>
            <a 
              href={`${chainConfig.explorer}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              View
            </a>
          </div>,
          { duration: 5000 }
        )
      }
      
      // Close modal on success
      setShowWithdrawModal(false)
      setSelectedWithdrawToken(null)
      setWithdrawAmount('')
      setRecipientAddress('')
      
      // Force refresh portfolio from blockchain
      await refreshPortfolioAfterTransaction('withdrawal')
      
    } catch (error) {
      console.error('❌ Withdrawal failed:', error)
      
      // User-friendly error messages
      let errorMessage = 'Unknown error occurred'
      
      if (error instanceof Error) {
        if (error.message.includes('User rejected')) {
          errorMessage = 'Transaction was cancelled'
        } else if (error.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient funds for transaction'
        } else if (error.message.includes('gas')) {
          errorMessage = 'Gas estimation failed. Please try again.'
        } else {
          errorMessage = error.message
        }
      }
      
      toast.error(`Withdrawal failed: ${errorMessage}`, { id: 'withdraw' })
      
    } finally {
      setIsNetworkSwitching(false)
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

  // Shimmer loading overlay component (memoized)
  const ShimmerOverlay = useMemo(() => {
    return () => (
      <div className="absolute inset-0 bg-card/50 backdrop-blur-sm rounded-xl overflow-hidden">
        <div className="h-full w-full bg-gradient-to-r from-transparent via-primary/20 to-transparent animate-shimmer bg-[length:200%_100%]" />
      </div>
    )
  }, [])

  return (
    <div className="bg-card/30 backdrop-blur-xl border border-border/30 rounded-xl p-6 space-y-6 relative">
      {(isLoading || refreshing) && <ShimmerOverlay />}
      
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
            onClick={() => refresh()}
            disabled={refreshing || isLoading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing || isLoading ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Portfolio Stats */}
        <div className="space-y-4">
          {/* Total Value */}
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
                <Activity className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">Unrealized P&L</span>
              </div>
              <div className={`text-lg font-bold ${data.unrealizedPnL >= 0 ? 'text-success' : 'text-error'}`}>
                {formatCurrency(data.unrealizedPnL)}
              </div>
            </div>
            <div className="bg-card/60 backdrop-blur-sm border border-border/40 rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Award className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">Win Rate</span>
              </div>
              <div className="text-lg font-bold text-foreground">
                {(pnlMetrics.winRate || 0).toFixed(1)}%
              </div>
            </div>
            <div className="bg-card/60 backdrop-blur-sm border border-border/40 rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-success" />
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

          {/* Trading Statistics */}
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

        {/* Right: Token Holdings Component */}
        <div className="space-y-4">
          {/* Token Holdings Header with Action */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium text-foreground">Token Holdings</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground bg-card/60 backdrop-blur-sm border border-border/30 px-2 py-1 rounded">
                {holdingsData.length} tokens
              </span>
              {holdingsData.length > 0 && (
                <button
                  onClick={() => setShowTokenHoldingsModal(true)}
                  className="text-xs text-primary hover:text-primary/80 hover:bg-primary/10 px-2 py-1 rounded transition-colors flex items-center gap-1"
                >
                  <Eye className="h-3 w-3" />
                  View All
                </button>
              )}
            </div>
          </div>
          
          {/* Token Holdings Component */}
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
                <div className="text-xl font-bold text-success">
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
                    onClick={() => copyToClipboard(walletAddress)}
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
                        src={generateQRCode(walletAddress)} 
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
                          onClick={() => copyToClipboard(walletAddress)}
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
                      💡 Note: After successful deposit, call refreshPortfolioAfterTransaction('deposit') to update balances
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
                                      {holding.tokenAddress === '0x0000000000000000000000000000000000000000' ||
                                       holding.tokenSymbol === 'ETH' ||
                                       holding.tokenSymbol === 'BNB' ||
                                       holding.tokenSymbol === 'MATIC'
                                        ? 'Native' 
                                        : 'ERC20'
                                      }
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
                                <div className="text-sm font-medium">{formatCurrency(holding.valueUSD)}</div>
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
                                {selectedWithdrawToken.tokenAddress === '0x0000000000000000000000000000000000000000' ||
                                 selectedWithdrawToken.tokenSymbol === 'ETH' ||
                                 selectedWithdrawToken.tokenSymbol === 'BNB' ||
                                 selectedWithdrawToken.tokenSymbol === 'MATIC'
                                  ? 'Native Token' 
                                  : `ERC20 • ${selectedWithdrawToken.tokenAddress?.slice(0, 6)}...${selectedWithdrawToken.tokenAddress?.slice(-4)}`
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
                          <input
                            type="number"
                            placeholder="Enter amount"
                            value={withdrawAmount}
                            onChange={(e) => setWithdrawAmount(e.target.value)}
                            max={selectedWithdrawToken.balanceFormatted}
                            className="w-full px-3 py-2 bg-muted/20 border border-border/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                          />
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Available: {formatBalance(selectedWithdrawToken.balanceFormatted)}</span>
                            <button
                              onClick={() => setWithdrawAmount(selectedWithdrawToken.balanceFormatted.toString())}
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
                          disabled={!selectedWithdrawToken || !withdrawAmount || !recipientAddress || isNetworkSwitching}
                          className="w-full px-4 py-2 bg-error hover:bg-error/90 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {isNetworkSwitching ? (
                            <>
                              <RefreshCw className="h-4 w-4 animate-spin" />
                              Processing...
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

      {/* Token Holdings Modal - Full Screen */}
      {showTokenHoldingsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border/50 rounded-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-border/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-primary to-primary/60 rounded-full flex items-center justify-center">
                  <PieChart className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">Token Holdings</h3>
                  <p className="text-sm text-muted-foreground">
                    {holdingsData.length} tokens • Total value: {formatCurrency(holdingsData.reduce((sum, holding) => sum + holding.valueUSD, 0))}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTokenHoldingsModal(false)}
                className="text-muted-foreground hover:text-foreground p-2 rounded-lg hover:bg-muted/20 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              <TokenHoldings />
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 