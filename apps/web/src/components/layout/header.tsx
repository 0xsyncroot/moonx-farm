'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, usePathname } from 'next/navigation'
import { Moon, Sun, Menu, X, Copy, ExternalLink, ChevronDown, Wallet, LogOut, Settings, User2, Zap } from 'lucide-react'
import { useTheme } from 'next-themes'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import { useAuth } from '@/hooks/use-auth'
import { useAccount, useChainId } from 'wagmi'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { formatAddress, cn } from '@/lib/utils'
import { toast } from 'react-hot-toast'

import { 
  getChainConfig, 
  getDefaultChain
} from '@/config/chains'
import { TestnetToggle } from '@/components/ui/testnet-toggle'
import { ChainIcon } from '@/components/ui/chain-icon'
import { useTestnet } from '@/hooks/use-testnet'

const navigation = [
  { name: 'Swap', href: '/swap' },
  { name: 'Orders', href: '/orders' },
  { name: 'Portfolio', href: '/portfolio' },
  { name: 'Alerts', href: '/alerts' },
]

export function Header() {
  const router = useRouter()
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const { user, login } = usePrivy()
  const { wallets } = useWallets()
  const { client: smartWalletClient } = useSmartWallets()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [walletMenuOpen, setWalletMenuOpen] = useState(false)
  const walletMenuRef = useRef<HTMLDivElement>(null)

  const { walletInfo, logout: authLogout } = useAuth()
  const { address: wagmiAddress } = useAccount()
  const wagmiChainId = useChainId()
  
  // 🚀 NEW: Use unified testnet hook
  const { isTestnetSwitching } = useTestnet({
    skipIfAutoSwitching: true // Prevent conflict with cross-chain swap logic
  })

  // Get embedded wallet (EOA) từ Privy
  const embeddedWallet = wallets.find(w => w.walletClientType === 'privy')

  // State để track smart wallet client từ auto chain switch
  const [autoSwitchedSmartWalletClient, setAutoSwitchedSmartWalletClient] = useState<typeof smartWalletClient | null>(null)

  // Smart wallet client priority: auto-switched > default
  const activeSmartWalletClient = autoSwitchedSmartWalletClient || smartWalletClient

  // Close wallet menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (walletMenuRef.current && !walletMenuRef.current.contains(event.target as Node)) {
        setWalletMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const walletAddress = activeSmartWalletClient?.account?.address || wagmiAddress

  // Track chain switch status for UI feedback
  const [chainSwitchStatus, setChainSwitchStatus] = useState<{
    isLoading: boolean
    isSuccess: boolean
    chainName?: string
  }>({
    isLoading: false,
    isSuccess: false
  })

  // Listen for testnet chain switch events
  useEffect(() => {
    const handleTestnetChainSwitchSuccess = (event: Event) => {
      const customEvent = event as CustomEvent
      const { chainName } = customEvent.detail
      
      console.log('✅ Testnet chain switch success:', customEvent.detail)
      
      // Show success notification
      toast.success(
        `Switched to ${chainName} successfully`,
        { duration: 3000 }
      )
    }

    const handleTestnetChainSwitchError = (event: Event) => {
      const customEvent = event as CustomEvent
      console.error('❌ Testnet chain switch error:', customEvent.detail)
      // Error toast is already shown by the hook
    }

    window.addEventListener('testnet-chain-switch-success', handleTestnetChainSwitchSuccess)
    window.addEventListener('testnet-chain-switch-error', handleTestnetChainSwitchError)
    
    return () => {
      window.removeEventListener('testnet-chain-switch-success', handleTestnetChainSwitchSuccess)
      window.removeEventListener('testnet-chain-switch-error', handleTestnetChainSwitchError)
    }
  }, [])

  // Listen for auto chain switch events from swap interface
  useEffect(() => {
    const handleChainSwitchStart = (event: Event) => {
      const customEvent = event as CustomEvent
      const { chainName } = customEvent.detail
      
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 Header: Auto chain switch started:', customEvent.detail)
      }
      
      // Reset auto-switched smart wallet client khi bắt đầu switch mới
      setAutoSwitchedSmartWalletClient(null)
      
      setChainSwitchStatus({
        isLoading: true,
        isSuccess: false,
        chainName
      })
    }

    const handleChainSwitchSuccess = (event: Event) => {
      const customEvent = event as CustomEvent
      const { chainName, smartWalletClient: newSmartWalletClient } = customEvent.detail
      
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Header: Auto chain switch completed:', customEvent.detail)
      }
      
      // Update auto-switched smart wallet client
      if (newSmartWalletClient) {
        setAutoSwitchedSmartWalletClient(newSmartWalletClient)
      }
      
      setChainSwitchStatus({
        isLoading: false,
        isSuccess: true,
        chainName
      })

      // Auto-clear success status after 3 seconds
      setTimeout(() => {
        setChainSwitchStatus(prev => ({
          ...prev,
          isSuccess: false
        }))
      }, 3000)
    }

    const handleChainSwitchError = (event: Event) => {
      const customEvent = event as CustomEvent
      
      if (process.env.NODE_ENV === 'development') {
        console.log('❌ Header: Auto chain switch failed:', customEvent.detail)
      }
      
      setChainSwitchStatus({
        isLoading: false,
        isSuccess: false
      })
    }

    // Listen for auto chain switch events
    window.addEventListener('auto-chain-switch-start', handleChainSwitchStart)
    window.addEventListener('auto-chain-switch-success', handleChainSwitchSuccess)
    window.addEventListener('auto-chain-switch-error', handleChainSwitchError)
    
    return () => {
      window.removeEventListener('auto-chain-switch-start', handleChainSwitchStart)
      window.removeEventListener('auto-chain-switch-success', handleChainSwitchSuccess)
      window.removeEventListener('auto-chain-switch-error', handleChainSwitchError)
    }
  }, [])
  
  // Memoized chain detection to prevent re-render loops
  const chainDetection = useMemo(() => {
    // Enhanced chain detection with priority order
    // 1. Smart wallet chain (from auto chain switch)
    // 2. Wagmi chain (EOA wallet)
    // 3. Wallet info chain
    // 4. Default chain for mode (fallback)
    const detectedChainId = activeSmartWalletClient?.chain?.id || wagmiChainId || walletInfo?.chainId
    const defaultChainForMode = getDefaultChain(false) // Use false for isTestnet since it's not used
    
    // Use actual detected chain if available, otherwise fallback to default
    const currentChainId = detectedChainId || defaultChainForMode.id
    
    // Get chain config from centralized config
    const chainConfig = getChainConfig(currentChainId)
    const chainInfo = chainConfig || {
      name: `Chain ${currentChainId}`,
      icon: '🔗',
      color: 'bg-gray-500',
      explorer: '#'
    }

    return {
      smartWalletChainId: activeSmartWalletClient?.chain?.id,
      wagmiChainId,
      walletInfoChainId: walletInfo?.chainId,
      defaultChainId: defaultChainForMode.id,
      chainConfig,
      chainInfo
    }
  }, [
    activeSmartWalletClient?.chain?.id,
    wagmiChainId,
    walletInfo?.chainId
  ])

  // Extract values from memoized object
  const { chainConfig, chainInfo } = chainDetection

  // Debug info for troubleshooting (development only) - memoized để tránh spam logs
  const debugInfoRef = useRef<string>('')
  const currentDebugInfo = JSON.stringify(chainDetection)
  
  if (process.env.NODE_ENV === 'development' && currentDebugInfo !== debugInfoRef.current) {
    console.log('🔍 Header Chain Detection (changed):', chainDetection)
    debugInfoRef.current = currentDebugInfo
  }



  const copyAddress = async () => {
    const addressToCopy = activeSmartWalletClient?.account?.address
    if (addressToCopy) {
      await navigator.clipboard.writeText(addressToCopy)
      toast.success('Smart wallet address copied!')
      setWalletMenuOpen(false)
    }
  }

  const openInExplorer = () => {
    const addressToOpen = activeSmartWalletClient?.account?.address
    if (addressToOpen && chainInfo.explorer !== '#') {
      window.open(`${chainInfo.explorer}/address/${addressToOpen}`, '_blank')
      setWalletMenuOpen(false)
    }
  }

  const handleNavigation = (href: string) => {
    router.push(href)
    setMobileMenuOpen(false)
  }

  const handleDisconnect = async () => {
    try {
      await authLogout()
      setWalletMenuOpen(false)
      // Reset auto-switched smart wallet client khi disconnect
      setAutoSwitchedSmartWalletClient(null)
      toast.success('Wallet disconnected')
    } catch (error) {
      console.error('Disconnect failed:', error)
      toast.error('Failed to disconnect wallet')
    }
  }

  // Reset auto-switched smart wallet client khi user thay đổi
  useEffect(() => {
    if (!user) {
      setAutoSwitchedSmartWalletClient(null)
    }
  }, [user])

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-gray-900/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <div className="flex items-center">
              <Link href="/swap" className="flex items-center space-x-3">
                <div className="relative">
                  <Image 
                    src="/icons/logo.png" 
                    alt="MoonXFarm Logo" 
                    width={36}
                    height={36}
                    className="rounded-xl shadow-lg object-contain"
                  />
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-gray-900"></div>
                </div>
                <div className="hidden sm:block">
                  <span className="text-xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                    MoonX
                  </span>
                  <div className="text-xs text-gray-400 -mt-1">Farm</div>
                </div>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-1">
              {navigation.map((item) => (
                <button
                  key={item.name}
                  onClick={() => handleNavigation(item.href)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                    (pathname === item.href || (item.href === '/swap' && (pathname === '/' || pathname === '/swap')))
                      ? 'text-white bg-white/10 border border-white/20' 
                      : 'text-gray-300 hover:text-white hover:bg-white/5'
                  )}
                >
                  {item.name}
                </button>
              ))}
            </nav>

            {/* Right Side */}
            <div className="flex items-center space-x-3">
              {/* Testnet Toggle */}
              <TestnetToggle />

              {/* Theme Toggle */}
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </button>

              {/* Wallet Connection */}
              {!user ? (
                <button
                  onClick={login}
                  className="flex items-center gap-2 px-4 py-2 bg-[#ff7842] hover:bg-[#ff7842]/90 
                           text-white rounded-lg font-medium transition-colors shadow-lg"
                >
                  <Wallet className="w-4 h-4" />
                  Connect Wallet
                </button>
              ) : !walletAddress ? (
                <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border border-yellow-500/20 
                              text-yellow-400 rounded-lg">
                  <LoadingSpinner size="sm" />
                  <span className="text-sm">Creating wallet...</span>
                </div>
              ) : (
                <div className="relative" ref={walletMenuRef}>
                  <button
                    onClick={() => setWalletMenuOpen(!walletMenuOpen)}
                    className="flex items-center gap-3 px-3 py-2 bg-white/5 hover:bg-white/10 
                             border border-white/10 hover:border-white/20 rounded-lg transition-all duration-200"
                  >
                    {/* Chain Indicator with Switch Status */}
                    <div className="flex items-center gap-1.5">
                      <div className="relative">
                        {chainConfig?.icon ? (
                          <div className="w-3 h-3 flex items-center justify-center">
                            <ChainIcon icon={chainConfig.icon} size="xs" />
                          </div>
                        ) : (
                          <div className={cn("w-2 h-2 rounded-full", chainInfo.color)} />
                        )}
                        
                        {/* Chain Switch Status Indicator */}
                        {(chainSwitchStatus.isLoading || isTestnetSwitching) && (
                          <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-500 rounded-full animate-ping" />
                        )}
                        {chainSwitchStatus.isSuccess && (
                          <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        )}
                      </div>
                      
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-400 hidden sm:block leading-none">
                          {(chainSwitchStatus.isLoading || isTestnetSwitching)
                            ? (isTestnetSwitching ? 'Switching network...' : `Switching to ${chainSwitchStatus.chainName}...`)
                            : chainInfo.name
                          }
                        </span>
                        {chainSwitchStatus.isSuccess && (
                          <span className="text-xs text-green-400 hidden sm:block leading-none">
                            ✓ Switched
                          </span>
                        )}
                      </div>
                    </div>

                    {/* AA Wallet Badge */}
                    <div className="flex items-center gap-2 px-2 py-1 bg-gradient-to-r from-purple-500/20 to-blue-500/20 
                                  border border-purple-500/30 rounded-md">
                      <Zap className="w-3 h-3 text-purple-400" />
                      <span className="text-xs text-purple-300 font-medium">AA</span>
                    </div>

                    {/* Address */}
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-gradient-to-br from-[#ff7842] to-[#ff4d00] rounded-full 
                                    flex items-center justify-center">
                        <User2 className="w-3 h-3 text-white" />
                      </div>
                      <span className="text-sm text-white font-medium hidden sm:block">
                        {formatAddress(walletAddress)}
                      </span>
                    </div>

                    <ChevronDown className={cn(
                      "w-4 h-4 text-gray-400 transition-transform duration-200",
                      walletMenuOpen && "rotate-180"
                    )} />
                  </button>

                  {/* Wallet Menu Dropdown */}
                  {walletMenuOpen && (
                    <div className="absolute right-0 mt-2 w-80 bg-gray-900/95 backdrop-blur-xl border border-white/10 
                                  rounded-xl shadow-2xl py-2 z-50">
                      {/* Wallet Info Header */}
                      <div className="px-4 py-3 border-b border-white/10">
                                                  <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-gradient-to-br from-[#ff7842] to-[#ff4d00] rounded-full 
                                            flex items-center justify-center">
                                <User2 className="w-4 h-4 text-white" />
                              </div>
                              <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-white">Smart Wallet</span>
                                <div className="flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-purple-500/20 to-blue-500/20 
                                              border border-purple-500/30 rounded-full">
                                  <Zap className="w-2.5 h-2.5 text-purple-400" />
                                  <span className="text-xs text-purple-300">Account Abstraction</span>
                                </div>
                              </div>
                              <div className="text-xs text-gray-400">
                                Gas sponsored • Session keys enabled
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Chain & Address Info */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400">Network</span>
                            <div className="flex items-center gap-1.5">
                              {chainConfig?.icon ? (
                                <div className="w-3 h-3 flex items-center justify-center">
                                  <ChainIcon icon={chainConfig.icon} size="xs" />
                                </div>
                              ) : (
                                <div className={cn("w-2 h-2 rounded-full", chainInfo.color)} />
                              )}
                              <span className="text-xs text-white leading-none">{chainInfo.name}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400">Address</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-white font-mono">
                                {formatAddress(walletAddress, 6)}
                              </span>
                              <button
                                onClick={copyAddress}
                                className="p-1 hover:bg-white/10 rounded transition-colors"
                                title="Copy address"
                              >
                                <Copy className="w-3 h-3 text-gray-400" />
                              </button>
                              <button
                                onClick={openInExplorer}
                                className="p-1 hover:bg-white/10 rounded transition-colors"
                                title="View in explorer"
                              >
                                <ExternalLink className="w-3 h-3 text-gray-400" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Wallet Addresses */}
                        <div className="mt-3 pt-3 border-t border-white/10">
                          <div className="space-y-2">
                            {/* Smart Wallet Address */}
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-400">Smart Wallet</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-white font-mono">
                                  {formatAddress(activeSmartWalletClient?.account?.address || '', 6)}
                                </span>
                                <button
                                  onClick={() => {
                                    if (activeSmartWalletClient?.account?.address) {
                                      navigator.clipboard.writeText(activeSmartWalletClient.account.address)
                                      toast.success('Smart wallet address copied!')
                                    }
                                  }}
                                  className="p-1 hover:bg-white/10 rounded transition-colors"
                                  title="Copy smart wallet address"
                                >
                                  <Copy className="w-3 h-3 text-gray-400" />
                                </button>
                              </div>
                            </div>
                            
                            {/* EOA Address (embedded wallet từ Privy) */}
                            {embeddedWallet?.address && embeddedWallet.address !== activeSmartWalletClient?.account?.address && (
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-400">EOA Wallet</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-white font-mono">
                                    {formatAddress(embeddedWallet.address, 6)}
                                  </span>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(embeddedWallet.address)
                                      toast.success('EOA address copied!')
                                    }}
                                    className="p-1 hover:bg-white/10 rounded transition-colors"
                                    title="Copy EOA address"
                                  >
                                    <Copy className="w-3 h-3 text-gray-400" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* User Info */}
                        {user.email?.address && (
                          <div className="mt-3 pt-3 border-t border-white/10">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-400">Logged in as</span>
                              <span className="text-xs text-white">{user.email.address}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Menu Actions */}
                      <div className="py-1">
                        <button
                          onClick={() => {
                            handleNavigation('/portfolio')
                            setWalletMenuOpen(false)
                          }}
                          className="flex items-center w-full px-4 py-2 text-sm text-white hover:bg-white/5 transition-colors"
                        >
                          <User2 className="w-4 h-4 mr-3 text-gray-400" />
                          Portfolio
                        </button>
                        
                        <button
                          onClick={() => {
                            handleNavigation('/wallet-settings')
                            setWalletMenuOpen(false)
                          }}
                          className="flex items-center w-full px-4 py-2 text-sm text-white hover:bg-white/5 transition-colors"
                        >
                          <Settings className="w-4 h-4 mr-3 text-gray-400" />
                          Wallet Settings
                        </button>
                        
                        <div className="border-t border-white/10 my-1" />
                        
                        <button
                          onClick={handleDisconnect}
                          className="flex items-center w-full px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <LogOut className="w-4 h-4 mr-3" />
                          Disconnect
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Toggle mobile menu"
              >
                {mobileMenuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-white/10 py-4">
              <nav className="flex flex-col space-y-1">
                {navigation.map((item) => (
                  <button
                    key={item.name}
                    onClick={() => handleNavigation(item.href)}
                    className={cn(
                      "text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      pathname === item.href 
                        ? 'text-white bg-white/10 border border-white/20' 
                        : 'text-gray-300 hover:text-white hover:bg-white/5'
                    )}
                  >
                    {item.name}
                  </button>
                ))}
              </nav>

              {/* Mobile Wallet Info */}
              {walletAddress && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="px-3 py-2">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-[#ff7842] to-[#ff4d00] rounded-full 
                                    flex items-center justify-center">
                        <User2 className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">Smart Wallet</span>
                          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-purple-500/20 rounded-full">
                            <Zap className="w-2 h-2 text-purple-400" />
                            <span className="text-xs text-purple-300">AA</span>
                          </div>
                        </div>
                        <div className="text-xs text-gray-400 space-y-1">
                          <div className="flex items-center gap-1">
                            <span>Smart: {formatAddress(activeSmartWalletClient?.account?.address || walletAddress)}</span>
                            <span>•</span>
                            {chainConfig?.icon ? (
                              <div className="flex items-center gap-1">
                                <div className="relative w-3 h-3 flex items-center justify-center">
                                  <ChainIcon icon={chainConfig.icon} size="xs" />
                                  {/* Mobile Chain Switch Status Indicator */}
                                  {(chainSwitchStatus.isLoading || isTestnetSwitching) && (
                                    <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping" />
                                  )}
                                  {chainSwitchStatus.isSuccess && (
                                    <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                  )}
                                </div>
                                <span>
                                  {(chainSwitchStatus.isLoading || isTestnetSwitching)
                                    ? (isTestnetSwitching ? 'Switching network...' : `Switching to ${chainSwitchStatus.chainName}...`)
                                    : chainInfo.name
                                  }
                                  {chainSwitchStatus.isSuccess && ' ✓'}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <div className={cn("w-2 h-2 rounded-full relative", chainInfo.color)}>
                                  {/* Mobile Chain Switch Status Indicator */}
                                  {(chainSwitchStatus.isLoading || isTestnetSwitching) && (
                                    <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping" />
                                  )}
                                  {chainSwitchStatus.isSuccess && (
                                    <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                  )}
                                </div>
                                <span>
                                  {(chainSwitchStatus.isLoading || isTestnetSwitching)
                                    ? (isTestnetSwitching ? 'Switching network...' : `Switching to ${chainSwitchStatus.chainName}...`)
                                    : chainInfo.name
                                  }
                                  {chainSwitchStatus.isSuccess && ' ✓'}
                                </span>
                              </div>
                            )}
                          </div>
                          {embeddedWallet?.address && embeddedWallet.address !== activeSmartWalletClient?.account?.address && (
                            <div className="flex items-center gap-1">
                              <span>EOA: {formatAddress(embeddedWallet.address)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={copyAddress}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white/5 
                                 text-white rounded-lg text-sm hover:bg-white/10 transition-colors"
                      >
                        <Copy className="w-3 h-3" />
                        Copy
                      </button>
                      <button
                        onClick={openInExplorer}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white/5 
                                 text-white rounded-lg text-sm hover:bg-white/10 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Explorer
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Click outside to close menus */}
        {mobileMenuOpen && (
          <div 
            className="fixed inset-0 z-30" 
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
      </header>
    )
} 