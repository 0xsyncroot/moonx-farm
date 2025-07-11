'use client'

import { useState } from 'react'
import { Plus, Bell, DollarSign, TrendingUp, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'

type AlertType = 'price' | 'wallet' | 'volume'
type PriceCondition = 'above' | 'below'

interface AlertForm {
  type: AlertType
  token: string
  condition: PriceCondition | string
  target: string
  walletAddress?: string
}

const ALERT_TYPES = [
  {
    id: 'price' as AlertType,
    name: 'Price Alert',
    description: 'Get notified when token reaches target price',
    icon: <DollarSign className="w-5 h-5" />,
    color: 'from-green-500 to-emerald-600'
  },
  {
    id: 'wallet' as AlertType,
    name: 'Wallet Tracker',
    description: 'Monitor wallet transactions and balances',
    icon: <Wallet className="w-5 h-5" />,
    color: 'from-blue-500 to-cyan-600'
  },
  {
    id: 'volume' as AlertType,
    name: 'Volume Alert',
    description: 'Track unusual trading volume',
    icon: <TrendingUp className="w-5 h-5" />,
    color: 'from-purple-500 to-pink-600'
  }
]

const POPULAR_TOKENS = ['ETH', 'BTC', 'USDC', 'USDT', 'BNB', 'SOL', 'ADA', 'DOT']

export function CreateAlert() {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<AlertForm>({
    type: 'price',
    token: '',
    condition: 'above',
    target: '',
    walletAddress: ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Reset form and close
    setForm({
      type: 'price',
      token: '',
      condition: 'above',
      target: '',
      walletAddress: ''
    })
    setShowForm(false)
  }

  if (!showForm) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-[#ff7842] to-[#ff4d00] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Plus className="w-8 h-8 text-white" />
          </div>
          
          <h3 className="text-xl font-semibold text-white mb-2">Create Smart Alert</h3>
          <p className="text-gray-400 mb-6">Stay informed about market movements and wallet activities</p>
          
          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-3 bg-[#ff7842] hover:bg-[#ff7842]/90 text-white rounded-lg font-medium transition-colors"
          >
            Create New Alert
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-[#ff7842] to-[#ff4d00] rounded-xl flex items-center justify-center">
            <Bell className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Create Alert</h3>
            <p className="text-sm text-gray-400">Set up your smart alert</p>
          </div>
        </div>
        
        <button
          onClick={() => setShowForm(false)}
          className="text-gray-400 hover:text-white transition-colors"
        >
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Alert Type Selection */}
        <div>
          <label className="text-sm font-medium text-gray-300 mb-3 block">
            Alert Type
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {ALERT_TYPES.map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => setForm({ ...form, type: type.id })}
                className={cn(
                  "p-4 rounded-lg border transition-all text-left",
                  form.type === type.id 
                    ? "border-[#ff7842] bg-[#ff7842]/10" 
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center mb-3 bg-gradient-to-br",
                  type.color
                )}>
                  {type.icon}
                </div>
                <div className="text-sm font-medium text-white mb-1">{type.name}</div>
                <div className="text-xs text-gray-400">{type.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Token Selection */}
        {(form.type === 'price' || form.type === 'volume') && (
          <div>
            <label className="text-sm font-medium text-gray-300 mb-3 block">
              Token
            </label>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Enter token symbol (e.g., ETH, BTC)"
                value={form.token}
                onChange={(e) => setForm({ ...form, token: e.target.value.toUpperCase() })}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#ff7842] focus:outline-none"
              />
              
              <div className="flex flex-wrap gap-2">
                {POPULAR_TOKENS.map((token) => (
                  <button
                    key={token}
                    type="button"
                    onClick={() => setForm({ ...form, token })}
                    className={cn(
                      "px-3 py-1 rounded-lg text-sm transition-colors",
                      form.token === token 
                        ? "bg-[#ff7842] text-white" 
                        : "bg-white/10 text-gray-300 hover:bg-white/20"
                    )}
                  >
                    {token}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Price Alert Conditions */}
        {form.type === 'price' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-300 mb-3 block">
                Condition
              </label>
              <select
                value={form.condition}
                onChange={(e) => setForm({ ...form, condition: e.target.value as PriceCondition })}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#ff7842] focus:outline-none"
              >
                <option value="above">Price goes above</option>
                <option value="below">Price goes below</option>
              </select>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-300 mb-3 block">
                Target Price ($)
              </label>
              <input
                type="number"
                placeholder="0.00"
                step="0.01"
                value={form.target}
                onChange={(e) => setForm({ ...form, target: e.target.value })}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#ff7842] focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Wallet Tracker */}
        {form.type === 'wallet' && (
          <div>
            <label className="text-sm font-medium text-gray-300 mb-3 block">
              Wallet Address
            </label>
            <input
              type="text"
              placeholder="0x..."
              value={form.walletAddress}
              onChange={(e) => setForm({ ...form, walletAddress: e.target.value })}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#ff7842] focus:outline-none"
            />
          </div>
        )}

        {/* Volume Alert */}
        {form.type === 'volume' && (
          <div>
            <label className="text-sm font-medium text-gray-300 mb-3 block">
              Volume Threshold
            </label>
            <input
              type="number"
              placeholder="1000000"
              value={form.target}
              onChange={(e) => setForm({ ...form, target: e.target.value })}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#ff7842] focus:outline-none"
            />
          </div>
        )}

        {/* Submit Button */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setShowForm(false)}
            className="flex-1 px-4 py-3 bg-white/10 text-white rounded-lg font-medium hover:bg-white/20 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-3 bg-[#ff7842] hover:bg-[#ff7842]/90 text-white rounded-lg font-medium transition-colors"
          >
            Create Alert
          </button>
        </div>
      </form>
    </div>
  )
}

export default CreateAlert 