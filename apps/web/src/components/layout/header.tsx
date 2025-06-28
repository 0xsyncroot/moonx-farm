'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { Moon, Sun, Menu, X, Copy, ExternalLink, ChevronDown, Wallet, LogOut, Settings, User2, Zap } from 'lucide-react'
import { useTheme } from 'next-themes'
import { usePrivy } from '@privy-io/react-auth'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import { useAuth } from '@/hooks/use-auth'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { formatAddress, cn } from '@/lib/utils'
import { toast } from 'react-hot-toast'

const navigation = [
  { name: 'Swap', href: '/' },
  { name: 'Orders', href: '/orders' },
  { name: 'Portfolio', href: '/portfolio' },
  { name: 'Alerts', href: '/alerts' },
]

const CHAIN_INFO = {
  1: { name: 'Ethereum', icon: '⟠', color: 'bg-blue-500', explorer: 'https://etherscan.io' },
  8453: { name: 'Base', icon: '🔵', color: 'bg-blue-600', explorer: 'https://basescan.org' },
  56: { name: 'BSC', icon: '🟡', color: 'bg-yellow-500', explorer: 'https://bscscan.com' },
}

export function Header() {
  const router = useRouter()
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const { user, login, logout } = usePrivy()
  const { client: smartWalletClient } = useSmartWallets()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [walletMenuOpen, setWalletMenuOpen] = useState(false)
  const walletMenuRef = useRef<HTMLDivElement>(null)

  const { walletInfo } = useAuth()

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

  const walletAddress = smartWalletClient?.account?.address
  const chainId = walletInfo?.chainId || 1
  const chainInfo = CHAIN_INFO[chainId as keyof typeof CHAIN_INFO]

  const copyAddress = async () => {
    if (walletAddress) {
      await navigator.clipboard.writeText(walletAddress)
      toast.success('Address copied!')
      setWalletMenuOpen(false)
    }
  }

  const openInExplorer = () => {
    if (walletAddress && chainInfo) {
      window.open(`${chainInfo.explorer}/address/${walletAddress}`, '_blank')
      setWalletMenuOpen(false)
    }
  }

  const handleNavigation = (href: string) => {
    router.push(href)
    setMobileMenuOpen(false)
  }

  const handleDisconnect = () => {
    logout()
    setWalletMenuOpen(false)
    toast.success('Wallet disconnected')
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-gray-900/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <div className="flex items-center">
              <Link href="/" className="flex items-center space-x-3">
                <div className="relative">
                  <div className="w-9 h-9 bg-gradient-to-br from-[#ff7842] to-[#ff4d00] rounded-xl flex items-center justify-center shadow-lg">
                    <span className="text-white font-bold text-lg">M</span>
                  </div>
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
                    pathname === item.href 
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
                    {/* Chain Indicator */}
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", chainInfo?.color || 'bg-gray-500')} />
                      <span className="text-xs text-gray-400 hidden sm:block">{chainInfo?.name || 'Unknown'}</span>
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
                            <div className="flex items-center gap-2">
                              <div className={cn("w-2 h-2 rounded-full", chainInfo?.color || 'bg-gray-500')} />
                              <span className="text-xs text-white">{chainInfo?.name || 'Unknown'}</span>
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
                            setWalletMenuOpen(false)
                            // TODO: Open wallet settings
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
                        <div className="text-xs text-gray-400">
                          {formatAddress(walletAddress)} • {chainInfo?.name}
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