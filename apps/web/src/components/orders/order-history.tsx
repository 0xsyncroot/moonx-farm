'use client'

import { useState, useEffect } from 'react'
import { coreApi } from '@/lib/api-client'
import { toast } from 'react-hot-toast'

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

export function OrderHistory() {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    async function fetchOrders() {
      try {
        setIsLoading(true)
        const response = await coreApi.getOrders({ 
          limit: 50,
          offset: 0,
          ...(statusFilter !== 'all' && { status: statusFilter.toUpperCase() })
        })
        
        if (response.success) {
          // Transform Core Service order data to match our interface
          const transformedOrders = response.data.orders.map((order: any) => ({
            id: order.orderId,
            type: order.type.toLowerCase(),
            status: order.status.toLowerCase(),
            tokenFrom: order.fromToken,
            tokenTo: order.toToken,
            amountFrom: parseFloat(order.fromAmount),
            amountTo: parseFloat(order.toAmount || '0'),
            price: parseFloat(order.targetPrice || '0'),
            timestamp: new Date(order.createdAt).getTime(),
            txHash: order.executionCount > 0 ? `0x${order.orderId.slice(-8)}...` : undefined
          }))
          
          setOrders(transformedOrders)
        } else {
          throw new Error('Failed to fetch orders')
        }
      } catch (error) {
        console.error('Order history fetch error:', error)
        toast.error('Failed to load order history')
        setOrders([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchOrders()
  }, [statusFilter])

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

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-muted/20 border border-border/50 rounded-lg p-4 animate-pulse">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="h-4 bg-muted/40 rounded w-16 mb-1"></div>
                  <div className="h-6 bg-muted/40 rounded w-32"></div>
                </div>
                <div className="h-6 bg-muted/40 rounded w-20"></div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div className="h-4 bg-muted/40 rounded w-24"></div>
                <div className="h-4 bg-muted/40 rounded w-20"></div>
              </div>
              <div className="h-4 bg-muted/40 rounded w-32"></div>
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-4xl mb-2">📋</div>
          <div className="text-muted-foreground">No orders found</div>
          <div className="text-sm text-muted-foreground mt-1">
            Your order history will appear here
          </div>
        </div>
      ) : (
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
      )}
    </div>
  )
} 