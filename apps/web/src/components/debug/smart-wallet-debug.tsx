'use client'

import { usePrivy } from '@privy-io/react-auth'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import { useAuth } from '@/hooks/use-auth'

export function SmartWalletDebug() {
  const { user, ready: privyReady, authenticated: privyAuthenticated } = usePrivy()
  const { client: smartWalletClient } = useSmartWallets()
  const { walletInfo } = useAuth()

  return (
    <div className="fixed bottom-4 right-4 bg-black/90 text-white p-4 rounded-lg text-xs max-w-md z-50">
      <h3 className="font-bold mb-2">🔍 Smart Wallet Debug</h3>
      
      <div className="space-y-1">
        <div>
          <strong>Privy Status:</strong>
          <div className="ml-2">
            Ready: {privyReady ? '✅' : '❌'}<br/>
            Authenticated: {privyAuthenticated ? '✅' : '❌'}<br/>
            User ID: {user?.id || 'N/A'}<br/>
            Email: {user?.email?.address || 'N/A'}
          </div>
        </div>

        <div>
          <strong>Smart Wallet Status:</strong>
          <div className="ml-2">
            Client Available: {smartWalletClient ? '✅' : '❌'}<br/>
            Account Address: {smartWalletClient?.account?.address || 'N/A'}<br/>
            Chain ID: {walletInfo?.chainId || 'N/A'}
          </div>
        </div>

        <div>
          <strong>Environment:</strong>
          <div className="ml-2">
            App ID: {process.env.NEXT_PUBLIC_PRIVY_APP_ID ? '✅' : '❌'}<br/>
            Node Env: {process.env.NODE_ENV}
          </div>
        </div>

        {smartWalletClient && (
          <div>
            <strong>Smart Wallet Details:</strong>
            <div className="ml-2">
              Type: {smartWalletClient.account?.type || 'N/A'}<br/>
              Entry Point: {smartWalletClient.account?.entryPoint?.address || 'N/A'}
            </div>
          </div>
        )}

        {!smartWalletClient && privyAuthenticated && (
          <div className="text-red-400">
            ⚠️ Smart wallet client not available despite authentication
          </div>
        )}

        <div className="text-yellow-400 text-xs mt-2">
          💡 Tip: Check Privy Dashboard Smart Wallets settings
        </div>
      </div>
    </div>
  )
} 