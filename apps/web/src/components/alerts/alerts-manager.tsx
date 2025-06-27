'use client'

import { useState } from 'react'
import { Bell, Trash2, Eye, EyeOff, TrendingUp, TrendingDown, DollarSign, Clock } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'

interface Alert {
  id: string
  type: 'price' | 'wallet' | 'volume'
  token: string
  condition: string
  target: number
  current: number
  isActive: boolean
  createdAt: Date
  lastTriggered?: Date
}

// Mock alerts data
const MOCK_ALERTS: Alert[] = [
  {
    id: '1',
    type: 'price',
    token: 'ETH',
    condition: 'above',
    target: 2500,
    current: 2450.75,
    isActive: true,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
  {
    id: '2',
    type: 'price',
    token: 'BTC',
    condition: 'below',
    target: 40000,
    current: 41250.30,
    isActive: false,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    lastTriggered: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    id: '3',
    type: 'wallet',
    token: 'USDC',
    condition: 'transaction',
    target: 10000,
    current: 8750.50,
    isActive: true,
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
]

export function AlertsManager() {
  const [alerts, setAlerts] = useState<Alert[]>(MOCK_ALERTS)

  const toggleAlert = (id: string) => {
    setAlerts(alerts.map(alert => 
      alert.id === id ? { ...alert, isActive: !alert.isActive } : alert
    ))
  }

  const deleteAlert = (id: string) => {
    setAlerts(alerts.filter(alert => alert.id !== id))
  }

  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'price':
        return <DollarSign className="w-4 h-4" />
      case 'wallet':
        return <Bell className="w-4 h-4" />
      case 'volume':
        return <TrendingUp className="w-4 h-4" />
      default:
        return <Bell className="w-4 h-4" />
    }
  }

  const getConditionIcon = (condition: string) => {
    switch (condition) {
      case 'above':
        return <TrendingUp className="w-3 h-3 text-green-400" />
      case 'below':
        return <TrendingDown className="w-3 h-3 text-red-400" />
      default:
        return <Clock className="w-3 h-3 text-blue-400" />
    }
  }

  const formatTimeAgo = (date: Date) => {
    const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))
    if (days === 0) return 'Today'
    if (days === 1) return '1 day ago'
    return `${days} days ago`
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
            <Bell className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Active Alerts</h3>
            <p className="text-sm text-gray-400">{alerts.filter(a => a.isActive).length} of {alerts.length} active</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button className="px-3 py-1 bg-white/10 text-white rounded-lg text-sm hover:bg-white/20 transition-colors">
            Settings
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {alerts.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Bell className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No alerts created yet</p>
          </div>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className={cn(
                "flex items-center justify-between p-4 rounded-lg border transition-colors",
                alert.isActive 
                  ? "bg-white/5 border-white/10 hover:bg-white/10" 
                  : "bg-gray-800/30 border-gray-700/50"
              )}
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center",
                  alert.isActive ? "bg-[#ff7842]/20 text-[#ff7842]" : "bg-gray-600 text-gray-400"
                )}>
                  {getAlertIcon(alert.type)}
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn(
                      "font-medium",
                      alert.isActive ? "text-white" : "text-gray-400"
                    )}>
                      {alert.token}
                    </span>
                    {getConditionIcon(alert.condition)}
                    <span className={cn(
                      "text-sm",
                      alert.isActive ? "text-gray-300" : "text-gray-500"
                    )}>
                      {alert.condition} {formatCurrency(alert.target)}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>Current: {formatCurrency(alert.current)}</span>
                    <span>•</span>
                    <span>Created {formatTimeAgo(alert.createdAt)}</span>
                    {alert.lastTriggered && (
                      <>
                        <span>•</span>
                        <span className="text-green-400">Last triggered {formatTimeAgo(alert.lastTriggered)}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleAlert(alert.id)}
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    alert.isActive 
                      ? "text-green-400 hover:bg-green-400/10" 
                      : "text-gray-500 hover:bg-gray-500/10"
                  )}
                  title={alert.isActive ? "Disable alert" : "Enable alert"}
                >
                  {alert.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                
                <button
                  onClick={() => deleteAlert(alert.id)}
                  className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                  title="Delete alert"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {alerts.length > 0 && (
        <div className="mt-6 pt-4 border-t border-white/10">
          <div className="flex justify-between text-sm text-gray-400">
            <span>{alerts.filter(a => a.isActive).length} active alerts</span>
            <button className="text-[#ff7842] hover:text-[#ff7842]/80 transition-colors">
              View all history →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default AlertsManager 