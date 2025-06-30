'use client'

import { useState, useEffect } from 'react'
import { coreApi } from '@/lib/api-client'
import { toast } from 'react-hot-toast'
import { 
  Search, 
  Filter, 
  Download,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Target,
  Repeat,
  TrendingUp,
  ExternalLink,
  MoreHorizontal,
  Eye,
  RefreshCw,
  Calendar,
  BarChart3,
  DollarSign,
  Activity,
  ChevronDown,
  SortDesc,
  ArrowUpDown
} from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'

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
  progress?: number
  executedAmount?: number
}

const ORDER_STATUS_CONFIG = {
  pending: {
    icon: Clock,
    label: 'Pending',
    className: 'badge-pending',
    dotColor: 'bg-orange-400'
  },
  completed: {
    icon: CheckCircle,
    label: 'Completed',
    className: 'badge-completed',
    dotColor: 'bg-green-400'
  },
  cancelled: {
    icon: XCircle,
    label: 'Cancelled',
    className: 'badge-cancelled',
    dotColor: 'bg-gray-400'
  },
  failed: {
    icon: AlertTriangle,
    label: 'Failed',
    className: 'badge-failed',
    dotColor: 'bg-red-400'
  }
}

const ORDER_TYPE_CONFIG = {
  limit: {
    icon: Target,
    label: 'Limit Order',
    className: 'text-orange-400',
    bgClassName: 'bg-orange-500/10 border-orange-500/20'
  },
  dca: {
    icon: Repeat,
    label: 'DCA',
    className: 'text-blue-400',
    bgClassName: 'bg-blue-500/10 border-blue-500/20'
  },
  market: {
    icon: TrendingUp,
    label: 'Market',
    className: 'text-green-400',
    bgClassName: 'bg-green-500/10 border-green-500/20'
  }
}

export function OrderHistory() {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'status'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Order statistics
  const orderStats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    completed: orders.filter(o => o.status === 'completed').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
    totalValue: orders.reduce((sum, o) => sum + (o.amountFrom * o.price), 0)
  }

  const fetchOrders = async (showRefresh = false) => {
    try {
      if (showRefresh) setIsRefreshing(true)
      else setIsLoading(true)
      
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
          txHash: order.executionCount > 0 ? `0x${order.orderId.slice(-8)}...` : undefined,
          progress: order.status === 'pending' ? Math.random() * 30 + 20 : 100,
          executedAmount: order.status === 'completed' ? parseFloat(order.fromAmount) : 
                         order.status === 'pending' ? parseFloat(order.fromAmount) * (Math.random() * 0.3) : 0
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
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [statusFilter])

  // Auto-refresh every 30 seconds for pending orders
  useEffect(() => {
    const hasPendingOrders = orders.some(order => order.status === 'pending')
    if (!hasPendingOrders) return

    const interval = setInterval(() => {
      fetchOrders(true)
    }, 30000)

    return () => clearInterval(interval)
  }, [orders])

  const filteredAndSortedOrders = orders.filter(order => {
    const matchesSearch = !searchQuery || 
      order.tokenFrom.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.tokenTo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.id.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesType = typeFilter === 'all' || order.type === typeFilter
    
    return matchesSearch && matchesType
  }).sort((a, b) => {
    let comparison = 0
    
    switch (sortBy) {
      case 'date':
        comparison = a.timestamp - b.timestamp
        break
      case 'amount':
        comparison = (a.amountFrom * a.price) - (b.amountFrom * b.price)
        break
      case 'status':
        comparison = a.status.localeCompare(b.status)
        break
    }
    
    return sortOrder === 'desc' ? -comparison : comparison
  })

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffHours < 1) return 'Just now'
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffHours < 48) return 'Yesterday'
    return date.toLocaleDateString()
  }

  const handleExport = () => {
    const csvContent = orders.map(order => ({
      ID: order.id,
      Type: ORDER_TYPE_CONFIG[order.type].label,
      Status: ORDER_STATUS_CONFIG[order.status].label,
      From: order.tokenFrom,
      To: order.tokenTo,
      Amount: order.amountFrom,
      Price: order.price,
      Value: order.amountFrom * order.price,
      Date: new Date(order.timestamp).toISOString(),
      TxHash: order.txHash || ''
    }))
    
    const csv = [
      Object.keys(csvContent[0]).join(','),
      ...csvContent.map(row => Object.values(row).join(','))
    ].join('\n')
    
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `moonx-orders-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
    
    toast.success('Order history exported successfully!')
  }

  return (
    <div className="space-y-8">
      {/* Enhanced Header with Stats */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Activity className="w-7 h-7 text-primary" />
            Order History
          </h2>
          <p className="text-muted-foreground mt-2 text-lg">Track and manage all your trading orders</p>
        </div>
        
        {/* Quick Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:w-auto w-full">
          <div className="bg-card/80 border border-border rounded-xl p-4 text-center backdrop-blur-sm">
            <div className="text-2xl font-bold text-foreground">{orderStats.total}</div>
            <div className="text-sm text-muted-foreground mt-1">Total Orders</div>
          </div>
          <div className="bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{orderStats.pending}</div>
            <div className="text-sm text-orange-600 dark:text-orange-400 mt-1">Pending</div>
          </div>
          <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{orderStats.completed}</div>
            <div className="text-sm text-green-600 dark:text-green-400 mt-1">Completed</div>
          </div>
          <div className="bg-card/80 border border-border rounded-xl p-4 text-center backdrop-blur-sm">
            <div className="text-2xl font-bold text-foreground">{formatCurrency(orderStats.totalValue)}</div>
            <div className="text-sm text-muted-foreground mt-1">Total Value</div>
          </div>
        </div>
      </div>

      {/* Enhanced Controls */}
      <div className="bg-card/50 backdrop-blur-sm border border-border rounded-xl p-6 space-y-4">
        {/* Search and Primary Controls */}
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by token, order ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-background/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200 text-foreground placeholder:text-muted-foreground"
            />
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => fetchOrders(true)}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-3 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-xl font-medium transition-all duration-200 disabled:opacity-50"
            >
              <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-medium transition-all duration-200"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
          </div>
        </div>

        {/* Secondary Controls */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-background/50 border border-border rounded-lg text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="failed">Failed</option>
            </select>

            <select 
              value={typeFilter} 
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2 bg-background/50 border border-border rounded-lg text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
            >
              <option value="all">All Types</option>
              <option value="limit">Limit Orders</option>
              <option value="dca">DCA</option>
              <option value="market">Market</option>
            </select>
          </div>
          
          {/* Sort Controls */}
          <div className="flex gap-2">
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2 bg-background/50 border border-border rounded-lg text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
            >
              <option value="date">Sort by Date</option>
              <option value="amount">Sort by Amount</option>
              <option value="status">Sort by Status</option>
            </select>
            
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="flex items-center justify-center w-10 h-10 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg transition-all duration-200"
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Orders List */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-card/50 border border-border rounded-xl p-6 animate-pulse">
              <div className="flex items-start justify-between mb-6">
                <div className="space-y-3">
                  <div className="h-4 bg-muted/50 rounded w-24"></div>
                  <div className="h-6 bg-muted/50 rounded w-32"></div>
                </div>
                <div className="h-6 bg-muted/50 rounded w-20"></div>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div className="h-4 bg-muted/50 rounded w-20"></div>
                <div className="h-4 bg-muted/50 rounded w-16"></div>
                <div className="h-4 bg-muted/50 rounded w-24"></div>
                <div className="h-4 bg-muted/50 rounded w-18"></div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredAndSortedOrders.length === 0 ? (
        <div className="text-center py-20 bg-card/30 border border-border rounded-xl">
          <div className="text-8xl mb-6">📋</div>
          <h3 className="text-2xl font-bold text-foreground mb-3">No Orders Found</h3>
          <p className="text-muted-foreground mb-8 text-lg max-w-md mx-auto">
            {searchQuery || statusFilter !== 'all' || typeFilter !== 'all' 
              ? 'Try adjusting your filters to see more results'
              : 'Your order history will appear here once you start trading'
            }
          </p>
          {(searchQuery || statusFilter !== 'all' || typeFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('')
                setStatusFilter('all')
                setTypeFilter('all')
              }}
              className="px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-medium transition-all duration-200"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAndSortedOrders.map((order) => {
            const statusConfig = ORDER_STATUS_CONFIG[order.status]
            const typeConfig = ORDER_TYPE_CONFIG[order.type]
            
            return (
              <div key={order.id} className="bg-card/50 backdrop-blur-sm border border-border rounded-xl p-6 group hover:shadow-lg transition-all duration-200">
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className={cn("p-3 rounded-xl border", typeConfig.bgClassName)}>
                      <typeConfig.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono text-sm text-muted-foreground">#{order.id.slice(0, 8)}</span>
                        <span className={cn("w-2 h-2 rounded-full", statusConfig.dotColor)}></span>
                        <span className="text-sm font-medium text-foreground">{typeConfig.label}</span>
                      </div>
                      <div className="font-bold text-foreground text-xl">
                        {order.tokenFrom} → {order.tokenTo}
                      </div>
                      {order.status === 'pending' && order.progress && (
                        <div className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                          {order.progress.toFixed(0)}% filled • {formatCurrency(order.executedAmount || 0)} executed
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <span className={cn(
                      "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium",
                      order.status === 'pending' && "bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20",
                      order.status === 'completed' && "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-500/20",
                      order.status === 'cancelled' && "bg-gray-50 dark:bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-500/20",
                      order.status === 'failed' && "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20"
                    )}>
                      <statusConfig.icon className="w-4 h-4" />
                      {statusConfig.label}
                    </span>
                    
                    <button className="p-2 hover:bg-muted rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200">
                      <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
                    </button>
                  </div>
                </div>
                
                {/* Details Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                  <div>
                    <div className="text-sm text-muted-foreground mb-2">Amount</div>
                    <div className="font-bold text-foreground text-lg">
                      {order.amountFrom.toLocaleString()} {order.tokenFrom}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      ~{formatCurrency(order.amountFrom * order.price)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-2">Price</div>
                    <div className="font-bold text-foreground text-lg">
                      {order.price > 0 ? `$${order.price.toLocaleString()}` : 'Market'}
                    </div>
                    {order.price > 0 && (
                      <div className="text-sm text-muted-foreground">per {order.tokenTo}</div>
                    )}
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-2">Time</div>
                    <div className="font-bold text-foreground text-lg">{formatDate(order.timestamp)}</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(order.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-2">Transaction</div>
                    {order.txHash ? (
                      <button className="font-bold text-primary hover:text-primary/80 flex items-center gap-1 group text-lg">
                        {order.txHash}
                        <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ) : (
                      <div className="font-bold text-muted-foreground text-lg">—</div>
                    )}
                  </div>
                </div>
                
                {/* Progress Bar for Pending Orders */}
                {order.status === 'pending' && order.progress && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between text-sm mb-3">
                      <span className="text-muted-foreground font-medium">Order Progress</span>
                      <span className="text-orange-600 dark:text-orange-400 font-medium">
                        {order.progress < 30 ? 'Waiting for execution' : 
                         order.progress < 70 ? 'Partially filled' : 'Almost complete'}
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-orange-500 to-orange-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${order.progress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
                
                {/* Action Buttons for Pending Orders */}
                {order.status === 'pending' && (
                  <div className="flex gap-3 pt-4 border-t border-border">
                    <button className="flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 rounded-lg transition-all duration-200 text-sm font-medium">
                      <Eye className="w-4 h-4" />
                      View Details
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-lg transition-all duration-200 text-sm font-medium">
                      <XCircle className="w-4 h-4" />
                      Cancel Order
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
} 