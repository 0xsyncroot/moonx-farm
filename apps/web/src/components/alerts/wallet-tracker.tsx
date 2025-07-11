'use client'

import { useState } from 'react'
import { Wallet, TrendingUp, TrendingDown, ExternalLink, Plus, Eye } from 'lucide-react'
import { formatCurrency, formatNumber, formatAddress } from '@/lib/utils'

interface TrackedWallet {
  id: string
  address: string
  label: string
  balance: number
  change24h: number
  lastActivity: Date
  isActive: boolean
}

interface Transaction {
  id: string
  type: 'buy' | 'sell' | 'transfer'
  token: string
  amount: number
  value: number
  timestamp: Date
}

// Mock data
const MOCK_WALLETS: TrackedWallet[] = [
  {
    id: '1',
    address: '0x1234567890123456789012345678901234567890',
    label: 'Whale Wallet #1',
    balance: 2450750.50,
    change24h: 12.5,
    lastActivity: new Date(Date.now() - 30 * 60 * 1000),
    isActive: true
  },
  {
    id: '2',
    address: '0x9876543210987654321098765432109876543210',
    label: 'Smart Money',
    balance: 825600.25,
    change24h: -5.2,
    lastActivity: new Date(Date.now() - 2 * 60 * 60 * 1000),
    isActive: true
  }
]

const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: '1',
    type: 'buy',
    token: 'ETH',
    amount: 150.5,
    value: 368725,
    timestamp: new Date(Date.now() - 30 * 60 * 1000)
  },
  {
    id: '2',
    type: 'sell',
    token: 'BTC',
    amount: 5.2,
    value: 214600,
    timestamp: new Date(Date.now() - 45 * 60 * 1000)
  }
]

export function WalletTracker() {
  const [trackedWallets, setTrackedWallets] = useState<TrackedWallet[]>(MOCK_WALLETS)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newWalletAddress, setNewWalletAddress] = useState('')
  const [newWalletLabel, setNewWalletLabel] = useState('')

  const formatTimeAgo = (date: Date) => {
    const minutes = Math.floor((Date.now() - date.getTime()) / (1000 * 60))
    if (minutes < 1) return 'now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  const addWallet = () => {
    if (!newWalletAddress) return

    const newWallet: TrackedWallet = {
      id: Date.now().toString(),
      address: newWalletAddress,
      label: newWalletLabel || `Wallet ${trackedWallets.length + 1}`,
      balance: 0,
      change24h: 0,
      lastActivity: new Date(),
      isActive: true
    }

    setTrackedWallets([...trackedWallets, newWallet])
    setNewWalletAddress('')
    setNewWalletLabel('')
    setShowAddForm(false)
  }

  const removeWallet = (id: string) => {
    setTrackedWallets(trackedWallets.filter(w => w.id !== id))
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Wallet Tracker</h3>
            <p className="text-sm text-gray-400">Monitor whale wallets and smart money</p>
          </div>
        </div>
        
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-3 py-2 bg-[#ff7842] hover:bg-[#ff7842]/90 text-white rounded-lg text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Track Wallet
        </button>
      </div>

      {/* Add Wallet Form */}
      {showAddForm && (
        <div className="mb-6 p-4 bg-white/5 border border-white/10 rounded-lg">
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Wallet address (0x...)"
              value={newWalletAddress}
              onChange={(e) => setNewWalletAddress(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#ff7842] focus:outline-none"
            />
            <input
              type="text"
              placeholder="Label (optional)"
              value={newWalletLabel}
              onChange={(e) => setNewWalletLabel(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#ff7842] focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={addWallet}
                className="px-4 py-2 bg-[#ff7842] text-white rounded-lg text-sm hover:bg-[#ff7842]/90 transition-colors"
              >
                Add Wallet
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 bg-white/10 text-white rounded-lg text-sm hover:bg-white/20 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tracked Wallets */}
      <div className="space-y-4">
        {trackedWallets.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Wallet className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No wallets tracked yet</p>
            <p className="text-xs">Add whale wallets to monitor their activities</p>
          </div>
        ) : (
          trackedWallets.map((wallet) => (
            <div
              key={wallet.id}
              className="p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center">
                    <Eye className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{wallet.label}</span>
                      <button
                        onClick={() => window.open(`https://etherscan.io/address/${wallet.address}`, '_blank')}
                        className="text-gray-400 hover:text-white transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="text-xs text-gray-400 font-mono">
                      {formatAddress(wallet.address, 8)}
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={() => removeWallet(wallet.id)}
                  className="text-red-400 hover:text-red-300 text-xs transition-colors"
                >
                  Remove
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-gray-400 text-xs mb-1">Balance</div>
                  <div className="text-white font-medium">
                    {formatCurrency(wallet.balance)}
                  </div>
                </div>
                
                <div>
                  <div className="text-gray-400 text-xs mb-1">24h Change</div>
                  <div className={`font-medium flex items-center gap-1 ${
                    wallet.change24h >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {wallet.change24h >= 0 ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {wallet.change24h > 0 ? '+' : ''}{wallet.change24h.toFixed(1)}%
                  </div>
                </div>
                
                <div>
                  <div className="text-gray-400 text-xs mb-1">Last Activity</div>
                  <div className="text-white">
                    {formatTimeAgo(wallet.lastActivity)}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Recent Transactions */}
      {MOCK_TRANSACTIONS.length > 0 && (
        <div className="mt-6 pt-4 border-t border-white/10">
          <h4 className="text-sm font-medium text-white mb-3">Recent Transactions</h4>
          <div className="space-y-2">
            {MOCK_TRANSACTIONS.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    tx.type === 'buy' ? 'bg-green-400' : 'bg-red-400'
                  }`} />
                  <div>
                    <div className="text-sm text-white">
                      {tx.type.toUpperCase()} {formatNumber(tx.amount)} {tx.token}
                    </div>
                    <div className="text-xs text-gray-400">
                      {formatTimeAgo(tx.timestamp)}
                    </div>
                  </div>
                </div>
                <div className="text-sm text-white font-medium">
                  {formatCurrency(tx.value)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default WalletTracker 