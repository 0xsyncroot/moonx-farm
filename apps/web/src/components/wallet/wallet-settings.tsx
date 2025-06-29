'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, 
  Wallet, 
  Shield, 
  Zap, 
  Download, 
  Upload, 
  Copy, 
  ExternalLink, 
  Settings, 
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Check,
  RefreshCw,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  User2,
  Network,
  Clock,
  DollarSign,
  TrendingUp,
  Activity,
  Info
} from 'lucide-react'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { useAuth } from '@/hooks/use-auth'
import { useAccount, useChainId, useBalance } from 'wagmi'
import { formatAddress, formatCurrency, cn } from '@/lib/utils'
import { toast } from 'react-hot-toast'
import { getChainConfig } from '@/config/chains'
import { ChainIcon } from '@/components/ui/chain-icon'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { DIAMOND_ADDRESSES } from '@/lib/contracts'
import { parseEther, formatEther } from 'viem'
import { privySessionKeyService, createDiamondSessionKey, type SessionKey } from '@/lib/session-keys'

export function WalletSettings() {
  const router = useRouter()
  const { user } = usePrivy()
  const { wallets } = useWallets()
  const { client: smartWalletClient } = useSmartWallets()
  const { walletInfo, backendUser, isAuthenticated } = useAuth()
  const chainId = useChainId()
  const { address: wagmiAddress } = useAccount()

  const [activeTab, setActiveTab] = useState('overview')
  const [isLoading, setIsLoading] = useState(false)
  const [depositAmount, setDepositAmount] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawAddress, setWithdrawAddress] = useState('')
  const [isDepositing, setIsDepositing] = useState(false)
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  const [sessionKeys, setSessionKeys] = useState<SessionKey[]>([])
  const [isGeneratingSessionKey, setIsGeneratingSessionKey] = useState(false)
  const [configStatus, setConfigStatus] = useState<{ isConfigured: boolean; message: string } | null>(null)

  const embeddedWallet = wallets.find(w => w.walletClientType === 'privy')
  const walletAddress = smartWalletClient?.account?.address || wagmiAddress
  const chainConfig = getChainConfig(chainId || 8453)
  
  // Get Diamond contract address for current chain
  const diamondAddress = DIAMOND_ADDRESSES[chainId || 8453]

  // Check ZeroDev configuration on component mount
  useEffect(() => {
    const status = privySessionKeyService.checkConfiguration()
    setConfigStatus(status)
  }, [])

  // Get wallet balance from wagmi
  const { data: balanceData, refetch: refetchBalance } = useBalance({
    address: walletAddress as `0x${string}`,
    chainId: chainId || 8453,
  })

  // Get embedded wallet balance (EOA)
  const { data: embeddedBalanceData } = useBalance({
    address: embeddedWallet?.address as `0x${string}`,
    chainId: chainId || 8453,
    query: {
      enabled: !!embeddedWallet?.address,
    },
  })

  const handleDeposit = async () => {
    if (!depositAmount || !embeddedWallet || !smartWalletClient) {
      toast.error('Please enter deposit amount and ensure wallet is connected')
      return
    }

    try {
      setIsDepositing(true)
      
      // Send ETH from embedded wallet to AA wallet via smart wallet client
      const txHash = await smartWalletClient.sendTransaction({
        to: walletAddress as `0x${string}`,
        value: parseEther(depositAmount),
        data: '0x',
      })

      toast.success(`Deposit transaction sent! Hash: ${txHash}`)
      setDepositAmount('')
      
      // Refresh balance after some delay
      setTimeout(() => {
        refetchBalance()
      }, 5000)
      
    } catch (error) {
      console.error('Deposit failed:', error)
      if (error instanceof Error) {
        if (error.message.includes('cancelled') || error.message.includes('rejected')) {
          toast.error('Transaction cancelled by user')
        } else {
          toast.error(`Deposit failed: ${error.message}`)
        }
      } else {
        toast.error('Deposit failed')
      }
    } finally {
      setIsDepositing(false)
    }
  }

  const handleWithdraw = async () => {
    if (!withdrawAmount || !withdrawAddress || !smartWalletClient) {
      toast.error('Please enter withdrawal amount and address')
      return
    }

    try {
      setIsWithdrawing(true)
      
      // Send ETH from AA wallet to specified address
      const txHash = await smartWalletClient.sendTransaction({
        to: withdrawAddress as `0x${string}`,
        value: parseEther(withdrawAmount),
        data: '0x',
      })

      toast.success(`Withdrawal transaction sent! Hash: ${txHash}`)
      setWithdrawAmount('')
      setWithdrawAddress('')
      
      // Refresh balance after some delay
      setTimeout(() => {
        refetchBalance()
      }, 5000)
      
    } catch (error) {
      console.error('Withdrawal failed:', error)
      if (error instanceof Error) {
        if (error.message.includes('cancelled') || error.message.includes('rejected')) {
          toast.error('Transaction cancelled by user')
        } else {
          toast.error(`Withdrawal failed: ${error.message}`)
        }
      } else {
        toast.error('Withdrawal failed')
      }
    } finally {
      setIsWithdrawing(false)
    }
  }

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address)
    toast.success('Address copied!')
  }

  const openInExplorer = (address: string) => {
    if (chainConfig?.explorer) {
      window.open(`${chainConfig.explorer}/address/${address}`, '_blank')
    }
  }

  const generateSessionKey = async () => {
    if (!walletAddress || !diamondAddress || !smartWalletClient || !embeddedWallet) {
      toast.error('Wallet not connected or Diamond contract not available')
      return
    }

    try {
      setIsGeneratingSessionKey(true)
      
      // Create real session key with ZeroDev integration
      const sessionKey = await createDiamondSessionKey(
        chainId || 8453,
        embeddedWallet,
        walletAddress,
        {
          maxAmountEth: 1,     // 1 ETH limit
          durationDays: 30,    // 30 days expiration
        }
      )

      setSessionKeys(prev => [...prev, sessionKey])
      toast.success('🔑 Session key created with ZeroDev integration!')
      
    } catch (error) {
      console.error('Failed to generate session key:', error)
      if (error instanceof Error) {
        if (error.message.includes('Privy embedded wallet not found')) {
          toast.error('Privy embedded wallet not connected. Please connect your Privy wallet first.')
        } else if (error.message.includes('Privy embedded wallet not authenticated')) {
          toast.error('Privy embedded wallet not authenticated. Please unlock your wallet.')
        } else if (error.message.includes('NEXT_PUBLIC_ZERODEV_PROJECT_ID')) {
          toast.error('ZeroDev project ID not configured. Please set NEXT_PUBLIC_ZERODEV_PROJECT_ID environment variable.')
        } else {
          toast.error(`Failed to create session key: ${error.message}`)
        }
      } else {
        toast.error('Failed to generate session key')
      }
    } finally {
      setIsGeneratingSessionKey(false)
    }
  }

  const revokeSessionKey = async (sessionKeyId: string) => {
    try {
      // Find the session key to revoke
      const sessionKey = sessionKeys.find(key => key.id === sessionKeyId)
      if (!sessionKey) {
        toast.error('Session key not found')
        return
      }

      toast('🔄 Revoking session key on-chain...', { duration: 2000 })

      // Revoke using real ZeroDev service
      const revokeResult = await privySessionKeyService.revokeSessionKey(sessionKey)
      
      if (revokeResult.success) {
        // Remove from local state
        setSessionKeys(prev => prev.filter(key => key.id !== sessionKeyId))
        
        if (revokeResult.txHash) {
          toast.success(`🗑️ Session key revoked on-chain! Tx: ${revokeResult.txHash.substring(0, 10)}...`)
        } else {
          toast.success('🗑️ Session key revoked locally!')
        }
      } else {
        toast.error('Failed to revoke session key on-chain, but marked as inactive locally')
        // Still remove from UI since it's marked inactive
        setSessionKeys(prev => prev.filter(key => key.id !== sessionKeyId))
      }
    } catch (error) {
      console.error('Failed to revoke session key:', error)
      toast.error('Failed to revoke session key')
    }
  }

  const testSessionKeyExecution = async (sessionKey: SessionKey) => {
    try {
      toast('🧪 Testing session key execution...', { duration: 2000 })

      // Create a test transaction (dummy call to Diamond contract)
      const testTx = privySessionKeyService.prepareSwapTransaction(
        chainId || 8453,
        'lifi',
        '0xA0b86a33E6441b8db96e6C33C9bF8E3c2C6e2B7e', // Mock token address
        '0x4200000000000000000000000000000000000006', // WETH on Base
        parseEther('0.001'),
        '0x' // Empty calldata for test
      )

      const result = await privySessionKeyService.executeWithSessionKey(sessionKey, [testTx])

      toast.success(`🧪 Session key test successful! UserOp: ${result.userOpHash.substring(0, 10)}...`)
      
    } catch (error) {
      console.error('Failed to test session key:', error)
      if (error instanceof Error) {
        toast.error(`🧪 Session key test failed: ${error.message}`)
      } else {
        toast.error('🧪 Session key test failed')
      }
    }
  }

  const validateSessionKeyDemo = (sessionKey: SessionKey) => {
    try {
      const isValid = privySessionKeyService.validateSessionKey(sessionKey)
      if (isValid) {
        toast.success('✅ Session key is valid and active!')
      }
    } catch (error) {
      if (error instanceof Error) {
        toast.error(`❌ Session key validation failed: ${error.message}`)
      } else {
        toast.error('❌ Session key validation failed')
      }
    }
  }

  const tabs = [
    { id: 'overview', name: 'Overview', icon: Wallet },
    { id: 'deposit', name: 'Deposit', icon: Download },
    { id: 'withdraw', name: 'Withdraw', icon: Upload },
    { id: 'sessions', name: 'Session Keys', icon: Shield },
    { id: 'security', name: 'Security', icon: Settings },
    { id: 'advanced', name: 'Advanced', icon: Info },
  ]

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <Wallet className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Connect Wallet Required</h2>
          <p className="text-gray-400 mb-6">Please connect your wallet to access settings</p>
          <button
            onClick={() => router.push('/swap')}
            className="px-6 py-3 bg-[#ff7842] hover:bg-[#ff7842]/90 text-white rounded-lg font-medium transition-colors"
          >
            Go to Swap
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <div className="border-b border-white/10 bg-gray-900/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-white">Wallet Settings</h1>
                <p className="text-sm text-gray-400">Manage your Account Abstraction wallet</p>
              </div>
            </div>
            
            {/* Wallet Info Badge */}
            {walletAddress && (
              <div className="flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 rounded-md">
                    <Zap className="w-3 h-3 text-purple-400" />
                    <span className="text-xs text-purple-300 font-medium">AA</span>
                  </div>
                  <span className="text-sm text-white font-medium">
                    {formatAddress(walletAddress)}
                  </span>
                </div>
                <button
                  onClick={() => copyAddress(walletAddress)}
                  className="p-1 text-gray-400 hover:text-white transition-colors"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <nav className="space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors",
                      activeTab === tab.id
                        ? "bg-[#ff7842] text-white"
                        : "text-gray-300 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{tab.name}</span>
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* AA Wallet Balance */}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-white">Smart Wallet Balance</h3>
                      <button
                        onClick={() => refetchBalance()}
                        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <div className="text-3xl font-bold text-white mb-1">
                          {formatCurrency(parseFloat(balanceData?.formatted || '0') * 3000)} {/* Mock ETH price */}
                        </div>
                        <div className="text-lg text-gray-300">
                          {balanceData?.formatted || '0'} {balanceData?.symbol || 'ETH'}
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setActiveTab('deposit')}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#ff7842] hover:bg-[#ff7842]/90 text-white rounded-lg font-medium transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          Deposit
                        </button>
                        <button
                          onClick={() => setActiveTab('withdraw')}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors"
                        >
                          <Upload className="w-4 h-4" />
                          Withdraw
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Embedded Wallet Balance */}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Embedded Wallet</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Balance</span>
                        <div className="text-right">
                          <div className="text-white font-medium">
                            {embeddedBalanceData?.formatted || '0'} {embeddedBalanceData?.symbol || 'ETH'}
                          </div>
                          <div className="text-sm text-gray-400">
                            {formatCurrency(parseFloat(embeddedBalanceData?.formatted || '0') * 3000)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Type</span>
                        <span className="text-white text-sm">EOA (Owner)</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Address</span>
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-mono">
                            {embeddedWallet?.address ? formatAddress(embeddedWallet.address) : 'N/A'}
                          </span>
                          {embeddedWallet?.address && (
                            <button
                              onClick={() => copyAddress(embeddedWallet.address)}
                              className="p-1 text-gray-400 hover:text-white transition-colors"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Wallet Info */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Wallet Details</h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Network</span>
                        <div className="flex items-center gap-2">
                          {chainConfig?.icon && (
                            <ChainIcon icon={chainConfig.icon} size="sm" />
                          )}
                          <span className="text-white text-sm">{chainConfig?.name}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Type</span>
                        <div className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 rounded-md">
                          <Zap className="w-3 h-3 text-purple-400" />
                          <span className="text-xs text-purple-300 font-medium">Account Abstraction</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Standard</span>
                        <span className="text-white text-sm">ERC-4337</span>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Status</span>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                          <span className="text-green-400 text-sm">Active</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Chain ID</span>
                        <span className="text-white text-sm">{chainId || 8453}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Provider</span>
                        <span className="text-white text-sm">Privy</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
                  <div className="text-center py-8 text-gray-400">
                    <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No recent transactions</p>
                    <p className="text-sm">Your wallet activity will appear here</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'deposit' && (
              <div className="space-y-6">
                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Deposit Funds</h3>
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                      <div className="flex items-start gap-3">
                        <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-300">
                          <p className="font-medium mb-1">Gas-Free Deposits</p>
                          <p>Deposits to your AA wallet are sponsored through Privy. You only pay the source transaction fee.</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Amount to Deposit
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(e.target.value)}
                          placeholder="0.0"
                          step="0.001"
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#ff7842] focus:outline-none pr-16"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                          {balanceData?.symbol || 'ETH'}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {['0.01', '0.1', '0.5', '1.0'].map((amount) => (
                        <button
                          key={amount}
                          onClick={() => setDepositAmount(amount)}
                          className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors"
                        >
                          {amount}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={handleDeposit}
                      disabled={!depositAmount || isDepositing || !embeddedWallet}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#ff7842] hover:bg-[#ff7842]/90 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                    >
                      {isDepositing ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      {isDepositing ? 'Depositing...' : 'Deposit'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'withdraw' && (
              <div className="space-y-6">
                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Withdraw Funds</h3>
                  <div className="space-y-4">
                    <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-yellow-300">
                          <p className="font-medium mb-1">Gas Required</p>
                          <p>Withdrawals require gas fees. Ensure your wallet has sufficient ETH balance.</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Withdrawal Address
                      </label>
                      <input
                        type="text"
                        value={withdrawAddress}
                        onChange={(e) => setWithdrawAddress(e.target.value)}
                        placeholder="0x..."
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#ff7842] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Amount to Withdraw
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={withdrawAmount}
                          onChange={(e) => setWithdrawAmount(e.target.value)}
                          placeholder="0.0"
                          step="0.001"
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#ff7842] focus:outline-none pr-20"
                        />
                        <button
                          onClick={() => setWithdrawAmount(balanceData?.formatted || '0')}
                          className="absolute right-12 top-1/2 -translate-y-1/2 text-xs text-[#ff7842] hover:text-[#ff7842]/80 transition-colors"
                        >
                          MAX
                        </button>
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                          {balanceData?.symbol || 'ETH'}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={handleWithdraw}
                      disabled={!withdrawAmount || !withdrawAddress || isWithdrawing}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                    >
                      {isWithdrawing ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      {isWithdrawing ? 'Withdrawing...' : 'Withdraw'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'sessions' && (
              <div className="space-y-6">
                {/* Session Keys Info */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Diamond Contract Info</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Diamond Contract</span>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-mono">
                          {diamondAddress ? formatAddress(diamondAddress) : 'Not deployed'}
                        </span>
                        {diamondAddress && (
                          <button
                            onClick={() => copyAddress(diamondAddress)}
                            className="p-1 text-gray-400 hover:text-white transition-colors"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Network</span>
                      <span className="text-white">{chainConfig?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Supported Operations</span>
                      <span className="text-white">Swap + Approve</span>
                    </div>
                  </div>
                </div>

                {/* Current Session Keys */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">Active Session Keys</h3>
                    <button
                      onClick={generateSessionKey}
                      disabled={isGeneratingSessionKey || !diamondAddress}
                      className="flex items-center gap-2 px-3 py-2 bg-[#ff7842] hover:bg-[#ff7842]/90 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      {isGeneratingSessionKey ? (
                        <>
                          <LoadingSpinner size="sm" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          Create Key
                        </>
                      )}
                    </button>
                  </div>
                  
                  {sessionKeys.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No session keys created</p>
                      <p className="text-sm">Create session keys for automated swap operations</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {sessionKeys.map((key) => (
                        <div key={key.id} className="p-4 bg-white/5 border border-white/10 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-white font-medium">{formatAddress(key.address)}</span>
                              <div className={cn(
                                "px-2 py-1 rounded-full text-xs font-medium",
                                key.isActive ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                              )}>
                                {key.isActive ? 'Active' : 'Inactive'}
                              </div>
                            </div>
                            <button
                              onClick={() => revokeSessionKey(key.id)}
                              className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="text-sm text-gray-400">
                            <p>Permissions: {key.permissions.allowedMethods.join(', ')}</p>
                            <p>Max Amount: {formatEther(BigInt(key.permissions.maxAmount))} ETH</p>
                            <p>Expires: {key.expiresAt.toLocaleDateString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Session Key Usage Info */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">What are Session Keys?</h3>
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                      <div className="flex items-start gap-3">
                        <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-300">
                          <p className="font-medium mb-1">Automated Trading</p>
                          <p>Session keys allow automated execution of swap and approve operations without manual approval for each transaction.</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <div className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-green-300">
                          <p className="font-medium mb-1">Limited Permissions</p>
                          <p>Each session key has restricted permissions: specific contracts, amount limits, and expiration time.</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                      <div className="flex items-start gap-3">
                        <Zap className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-purple-300">
                          <p className="font-medium mb-1">Gas Efficient</p>
                          <p>Session keys reduce gas costs by eliminating the need for multiple approvals during trading sessions.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-6">
                {/* Wallet Addresses */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Wallet Addresses</h3>
                  <div className="space-y-4">
                    {/* Smart Wallet */}
                    <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-300">Smart Wallet (AA)</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => copyAddress(walletAddress || '')}
                            className="p-1 text-gray-400 hover:text-white transition-colors"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openInExplorer(walletAddress || '')}
                            className="p-1 text-gray-400 hover:text-white transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="text-white font-mono text-sm break-all">
                        {walletAddress}
                      </div>
                    </div>

                    {/* EOA Wallet */}
                    {embeddedWallet?.address && (
                      <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-300">EOA Wallet (Owner)</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => copyAddress(embeddedWallet.address)}
                              className="p-1 text-gray-400 hover:text-white transition-colors"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openInExplorer(embeddedWallet.address)}
                              className="p-1 text-gray-400 hover:text-white transition-colors"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="text-white font-mono text-sm break-all">
                          {embeddedWallet.address}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Security Features */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Security Features</h3>
                  <div className="space-y-4">
                    <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <div className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-green-300">
                          <p className="font-medium mb-1">Account Abstraction</p>
                          <p>Your wallet uses ERC-4337 standard for enhanced security and gas sponsorship.</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <div className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-green-300">
                          <p className="font-medium mb-1">Social Login</p>
                          <p>Secured by Privy's social authentication with embedded wallet generation.</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <div className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-green-300">
                          <p className="font-medium mb-1">Gas Sponsorship</p>
                          <p>Many transactions are sponsored, reducing the need to hold ETH for gas.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'advanced' && (
              <div className="space-y-6">
                {/* Privy Integration Info */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Privy Integration</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Provider</span>
                      <span className="text-white">Privy</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">User ID</span>
                      <span className="text-white font-mono">{user?.id ? formatAddress(user.id) : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Auth Method</span>
                      <span className="text-white">{user?.google?.email ? 'Google' : user?.twitter?.username ? 'Twitter' : 'Other'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Wallet Type</span>
                      <span className="text-white">Embedded Wallet + AA</span>
                    </div>
                  </div>
                </div>

                {/* Developer Info */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Developer Information</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Wallet Standard</span>
                      <span className="text-white">ERC-4337</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Chain ID</span>
                      <span className="text-white">{chainId || 8453}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Network</span>
                      <span className="text-white">{chainConfig?.name || 'Base'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">RPC URL</span>
                      <span className="text-white font-mono">Via Privy</span>
                    </div>
                  </div>
                </div>

                {/* Session Key Demo */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                                      <h3 className="text-lg font-semibold text-white mb-4">Session Key Management</h3>
                    <div className="space-y-4">
                      {/* Configuration Status */}
                      {configStatus && (
                        <div className={`p-4 border rounded-lg ${
                          configStatus.isConfigured 
                            ? 'bg-green-500/10 border-green-500/20' 
                            : 'bg-yellow-500/10 border-yellow-500/20'
                        }`}>
                          <div className="flex items-start gap-3">
                            {configStatus.isConfigured ? (
                              <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                            ) : (
                              <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                            )}
                            <div className={`text-sm ${
                              configStatus.isConfigured ? 'text-green-300' : 'text-yellow-300'
                            }`}>
                              <p className="font-medium mb-1">
                                {configStatus.isConfigured ? 'ZeroDev Ready' : 'Configuration Required'}
                              </p>
                              <p>{configStatus.message}</p>
                              {!configStatus.isConfigured && (
                                <p className="mt-2 text-xs">
                                  Please set <code className="bg-black/20 px-1 rounded">NEXT_PUBLIC_ZERODEV_PROJECT_ID</code> in your environment variables.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    
                    {sessionKeys.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-sm font-medium text-white">Test Session Key Execution</h4>
                        {sessionKeys.slice(0, 1).map((key) => (
                          <div key={key.id} className="p-3 bg-white/5 border border-white/10 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm text-gray-300">Session Key: {formatAddress(key.address)}</span>
                              <div className="flex items-center gap-2">
                                <div className={cn(
                                  "px-2 py-1 rounded-full text-xs font-medium",
                                  key.isActive ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                                )}>
                                  {key.isActive ? 'Active' : 'Inactive'}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => testSessionKeyExecution(key)}
                                className="flex-1 px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg text-sm font-medium transition-colors"
                              >
                                Test Execution
                              </button>
                              <button
                                onClick={() => validateSessionKeyDemo(key)}
                                className="flex-1 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg text-sm font-medium transition-colors"
                              >
                                Validate Key
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Export/Backup Info */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Backup & Recovery</h3>
                  <div className="space-y-4">
                    <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-yellow-300">
                          <p className="font-medium mb-1">Social Recovery</p>
                          <p>Your wallet is recoverable through your social login provider. Make sure to keep access to your {user?.google?.email ? 'Google' : user?.twitter?.username ? 'Twitter' : 'social'} account.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 