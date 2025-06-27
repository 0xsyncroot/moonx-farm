'use client'

import { useState } from 'react'

interface Order {
  id: string
  type: 'limit' | 'dca' | 'market'
  status: 'pending' | 'completed' | 'cancelled' | 'failed'
  tokenFrom: string
  tokenTo: string
  amountFrom: number
  amountTo: number
  price: number
  timestamp: number
  txHash?: string
}

const mockOrders: Order[] = [
  {
    id: '1',
    type: 'limit',
    status: 'completed',
    tokenFrom: 'USDT',
    tokenTo: 'ETH',
    amountFrom: 1000,
    amountTo: 0.5,
    price: 2000,
    timestamp: Date.now() - 86400000,
    txHash: '0x1234...5678'
  },
  {
    id: '2',
    type: 'dca',
    status: 'pending',
    tokenFrom: 'USDC',
    tokenTo: 'BTC',
    amountFrom: 500,
    amountTo: 0.01,
    price: 50000,
    timestamp: Date.now() - 43200000,
  }
]

export function OrderHistory() {
  const [orders] = useState<Order[]>(mockOrders)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'completed': return 'bg-green-500/10 text-green-600 border-green-500/20'
      case 'pending': return 'bg-orange-500/10 text-orange-600 border-orange-500/20'
      case 'cancelled': return 'bg-gray-500/10 text-gray-600 border-gray-500/20'
      case 'failed': return 'bg-red-500/10 text-red-600 border-red-500/20'
      default: return 'bg-gray-500/10 text-gray-600 border-gray-500/20'
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString() + ' ' + 
           new Date(timestamp).toLocaleTimeString()
  }

  return (
    <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold">Order History</h3>
          <p className="text-sm text-muted-foreground">
            Track all your trading orders and their execution status
          </p>
        </div>
        <button className="flex items-center gap-2 px-3 py-1 text-sm border border-border/50 rounded-lg hover:bg-muted/20">
          📅 Export
        </button>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search orders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-background border border-border/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">🔍</span>
        </div>
        
        <select 
          value={statusFilter} 
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-background border border-border/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        >
          <option value="all">All Status</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
          <option value="cancelled">Cancelled</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      <div className="space-y-4">
        {orders.map((order) => (
          <div key={order.id} className="bg-muted/20 border border-border/50 rounded-lg p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-mono text-sm text-muted-foreground">#{order.id}</div>
                <div className="font-medium">{order.tokenFrom} → {order.tokenTo}</div>
              </div>
              <span className={`px-2 py-1 text-xs rounded-full border ${getStatusColor(order.status)}`}>
                {order.status}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <div className="text-sm text-muted-foreground">Amount</div>
                <div className="font-medium">{order.amountFrom.toLocaleString()} {order.tokenFrom}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Price</div>
                <div className="font-medium">${order.price.toLocaleString()}</div>
              </div>
            </div>
            
            <div className="text-sm text-muted-foreground">
              {formatDate(order.timestamp)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
} 