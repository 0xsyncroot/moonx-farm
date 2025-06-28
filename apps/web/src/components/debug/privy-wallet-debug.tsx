'use client'

import { useState, useEffect } from 'react'
import { usePrivy, useWallets, useCreateWallet } from '@privy-io/react-auth'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import { useAuth } from '@/hooks/use-auth'

export function PrivyWalletDebug() {
  const { user, ready: privyReady, authenticated: privyAuthenticated } = usePrivy()
  const { wallets } = useWallets()
  const { createWallet } = useCreateWallet()
  const { client: smartWalletClient } = useSmartWallets()
  const { backendUser, walletInfo } = useAuth()
  
  const [debugLogs, setDebugLogs] = useState<string[]>([])
  const [isCreatingWallet, setIsCreatingWallet] = useState(false)
  const [isCreatingSmartWallet, setIsCreatingSmartWallet] = useState(false)

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setDebugLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 19)])
  }

  useEffect(() => {
    addLog('🔄 Debug component mounted')
  }, [])

  useEffect(() => {
    addLog(`📱 Privy state: ready=${privyReady}, auth=${privyAuthenticated}, user=${!!user}`)
  }, [privyReady, privyAuthenticated, user])

  useEffect(() => {
    addLog(`👤 Backend user: ${backendUser ? 'loaded' : 'null'}`)
  }, [backendUser])

  useEffect(() => {
    addLog(`💼 Wallets count: ${wallets.length}`)
    wallets.forEach((wallet, i) => {
      addLog(`  Wallet ${i}: ${wallet.walletClientType} - ${wallet.address}`)
    })
  }, [wallets])

  useEffect(() => {
    addLog(`🔮 Smart Wallet Client: ${smartWalletClient ? 'available' : 'null'}`)
    if (smartWalletClient?.account) {
      addLog(`  Smart Wallet Address: ${smartWalletClient.account.address}`)
    }
  }, [smartWalletClient])

  const handleCreateEmbeddedWallet = async () => {
    try {
      setIsCreatingWallet(true)
      addLog('🚀 Creating embedded wallet...')
      const wallet = await createWallet()
      addLog(`✅ Embedded wallet created: ${wallet?.address}`)
    } catch (error) {
      addLog(`❌ Embedded wallet creation failed: ${error}`)
    } finally {
      setIsCreatingWallet(false)
    }
  }

  const handleCreateSmartWallet = async () => {
    try {
      setIsCreatingSmartWallet(true)
      addLog('🚀 Attempting to create Smart Wallet...')
      
      // This will trigger Smart Wallet creation if not already created
      if (smartWalletClient) {
        addLog(`✅ Smart Wallet already exists: ${smartWalletClient.account.address}`)
      } else {
        addLog('⏳ Waiting for Smart Wallet creation...')
        // In Privy native implementation, Smart Wallets are created automatically
        // when embedded wallet exists and SmartWalletsProvider is configured
      }
    } catch (error) {
      addLog(`❌ Smart Wallet creation failed: ${error}`)
    } finally {
      setIsCreatingSmartWallet(false)
    }
  }

  const handleRegisterWithBackend = async () => {
    try {
      addLog('🚀 Registering AA wallet with backend...')
      
      const embeddedWallet = wallets.find(w => w.walletClientType === 'privy')
      if (!embeddedWallet) {
        addLog('❌ No embedded wallet found')
        return
      }

      if (!smartWalletClient?.account) {
        addLog('❌ No smart wallet found')
        return
      }

      // Call wallet registry API
      const response = await fetch('/api/wallet-registry/wallets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({
          ownerAddress: embeddedWallet.address,
          ownerType: 'privy-social',
          chainId: 8453, // Base
        })
      })

      const result = await response.json()
      if (result.success) {
        addLog(`✅ Backend registration successful: ${result.data.wallet.address}`)
      } else {
        addLog(`❌ Backend registration failed: ${result.message}`)
      }
    } catch (error) {
      addLog(`❌ Backend registration error: ${error}`)
    }
  }

  const embeddedWallet = wallets.find(w => w.walletClientType === 'privy')

  return (
    <div className="fixed bottom-4 left-4 w-96 max-h-96 bg-black/95 text-white p-4 rounded-lg text-xs font-mono border border-gray-700 z-50 overflow-hidden flex flex-col">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold text-sm">🔍 Privy Wallet Debug</h3>
        <button 
          onClick={() => setDebugLogs([])}
          className="text-xs px-2 py-1 bg-gray-700 rounded hover:bg-gray-600"
        >
          Clear
        </button>
      </div>
      
      {/* Status Summary */}
      <div className="mb-3 space-y-1 text-xs">
        <div className={`flex items-center gap-2 ${privyReady ? 'text-green-400' : 'text-red-400'}`}>
          <span>{privyReady ? '✅' : '❌'}</span>
          <span>Privy Ready</span>
        </div>
        <div className={`flex items-center gap-2 ${privyAuthenticated ? 'text-green-400' : 'text-red-400'}`}>
          <span>{privyAuthenticated ? '✅' : '❌'}</span>
          <span>Authenticated</span>
        </div>
        <div className={`flex items-center gap-2 ${embeddedWallet ? 'text-green-400' : 'text-red-400'}`}>
          <span>{embeddedWallet ? '✅' : '❌'}</span>
          <span>Embedded Wallet</span>
        </div>
        <div className={`flex items-center gap-2 ${smartWalletClient ? 'text-green-400' : 'text-red-400'}`}>
          <span>{smartWalletClient ? '✅' : '❌'}</span>
          <span>Smart Wallet</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mb-3 space-y-2">
        {!embeddedWallet && (
          <button
            onClick={handleCreateEmbeddedWallet}
            disabled={isCreatingWallet || !privyAuthenticated}
            className="w-full px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-xs"
          >
            {isCreatingWallet ? 'Creating...' : 'Create Embedded Wallet'}
          </button>
        )}
        
        {embeddedWallet && !smartWalletClient && (
          <button
            onClick={handleCreateSmartWallet}
            disabled={isCreatingSmartWallet}
            className="w-full px-2 py-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded text-xs"
          >
            {isCreatingSmartWallet ? 'Creating...' : 'Create Smart Wallet'}
          </button>
        )}

        {smartWalletClient && (
          <button
            onClick={handleRegisterWithBackend}
            className="w-full px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs"
          >
            Register with Backend
          </button>
        )}
      </div>

      {/* Debug Logs */}
      <div className="flex-1 overflow-y-auto space-y-1 bg-gray-900 p-2 rounded text-xs">
        {debugLogs.length === 0 ? (
          <div className="text-gray-500">No logs yet...</div>
        ) : (
          debugLogs.map((log, i) => (
            <div key={i} className="break-words">{log}</div>
          ))
        )}
      </div>
    </div>
  )
} 