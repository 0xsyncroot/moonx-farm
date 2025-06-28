import { toast } from 'react-hot-toast'

interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

export interface TokenSearchParams {
  q: string
  chainId?: number
  limit?: number
}

export interface TokenListResponse {
  tokens: Token[]
  total: number
  page?: number
  limit?: number
  updatedAt: string
  metadata?: Record<string, any>
}

export interface QuoteRequest {
  fromChainId: number
  toChainId: number
  fromToken: string
  toToken: string
  amount: string
  userAddress?: string
  slippage?: number
}

export interface Quote {
  id: string
  provider: string
  fromAmount: number
  toAmount: number
  toAmountMin: number
  price: number
  priceImpact: number
  slippageTolerance: number
  callData: string
  to: string
  value: string
  fromToken: Token
  toToken: Token
  gasEstimate: GasEstimate
  route: Route
  createdAt: string
  expiresAt: string
  metadata?: Record<string, any>
}

export interface GasEstimate {
  gasLimit: number
  gasPrice: number
  gasFee: number
  gasFeeUSD: number
}

export interface Route {
  steps: RouteStep[]
  totalFee: number
  gasEstimate: GasEstimate
}

export interface RouteStep {
  type: string
  protocol: string
  fromToken: Token
  toToken: Token
  fromAmount: number
  toAmount: number
  fee: number
  priceImpact: number
  poolAddress: string
  gasEstimate: GasEstimate
}

export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  chainId: number;
  logoURI?: string;
  priceUSD?: number;
  change24h?: number;
  volume24h?: number;
  marketCap?: number;
  isNative?: boolean;
  verified?: boolean;
  popular?: boolean;
  tags?: string[];
  source?: string;
  lastUpdated?: string;
  metadata?: Record<string, any>;
}

class ApiClient {
  private baseUrl: string
  private authBaseUrl: string
  private aggregatorBaseUrl: string
  private coreBaseUrl: string
  private accessToken: string | null = null

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000/api'
    this.authBaseUrl = process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://localhost:3001/api/v1'
    this.aggregatorBaseUrl = process.env.NEXT_PUBLIC_AGGREGATOR_API_URL || 'http://localhost:3003/api/v1'
    this.coreBaseUrl = process.env.NEXT_PUBLIC_CORE_API_URL || 'http://localhost:3007/api/v1'
    
    // Load token from localStorage on client
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('accessToken')
    }
  }

  private async request<T>(
    url: string, 
    options: RequestInit = {},
    requireAuth = false
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>,
    }

    // Add auth header if token exists and auth required
    if (requireAuth && this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`
      console.log('🔑 Adding auth header for:', url)
    } else if (requireAuth && !this.accessToken) {
      console.warn('⚠️ Auth required but no token available for:', url)
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      })

      // Handle 401 - Token expired
      if (response.status === 401 && requireAuth) {
        await this.handleTokenRefresh()
        // Retry with new token
        if (this.accessToken) {
          headers['Authorization'] = `Bearer ${this.accessToken}`
          const retryResponse = await fetch(url, { ...options, headers })
          if (!retryResponse.ok) {
            throw new Error(`API Error: ${retryResponse.status}`)
          }
          return await retryResponse.json()
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `API Error: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('API Request failed:', error)
      throw error
    }
  }

  private async handleTokenRefresh(): Promise<void> {
    try {
      const refreshToken = localStorage.getItem('refreshToken')
      if (!refreshToken) {
        this.clearTokens()
        return
      }

      const response = await fetch(`${this.authBaseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })

      if (response.ok) {
        const data = await response.json()
        this.setTokens(data.accessToken, data.refreshToken)
      } else {
        this.clearTokens()
      }
    } catch (error) {
      console.error('Token refresh failed:', error)
      this.clearTokens()
    }
  }

  public setTokens(accessToken: string, refreshToken?: string): void {
    this.accessToken = accessToken
    localStorage.setItem('accessToken', accessToken)
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken)
    }
  }

  public clearTokens(): void {
    this.accessToken = null
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
  }

  // ============ AUTH SERVICE METHODS ============

  public async login(privyToken: string): Promise<any> {
    console.log('📡 API Client: Starting login request...')
    const response = await this.request<ApiResponse>(
      `${this.authBaseUrl}/auth/login`,
      {
        method: 'POST',
        body: JSON.stringify({ privyToken }),
      }
    )

    if (response.success && response.data) {
      console.log('✅ API Client: Login successful, setting tokens...')
      this.setTokens(response.data.accessToken, response.data.refreshToken)
      toast.success('Login successful!')
    } else {
      console.error('❌ API Client: Login failed - no tokens in response')
    }

    return response
  }

  public async logout(): Promise<void> {
    try {
      await this.request(
        `${this.authBaseUrl}/auth/logout`,
        { method: 'POST' },
        true
      )
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      this.clearTokens()
      toast.success('Logged out successfully')
    }
  }

  public async getCurrentUser(): Promise<any> {
    console.log('🔍 API Client: getCurrentUser called, checking token state...')
    
    // Ensure token is loaded from localStorage if not in memory
    if (!this.accessToken && typeof window !== 'undefined') {
      const storedToken = localStorage.getItem('accessToken')
      console.log('💾 Loading token from localStorage:', storedToken ? `${storedToken.substring(0, 20)}...` : 'null')
      this.accessToken = storedToken
    }
    
    if (!this.accessToken) {
      console.warn('⚠️ API Client: getCurrentUser called without access token')
      throw new Error('No access token available')
    }
    
    console.log('📡 API Client: Verifying token...', this.accessToken.substring(0, 20) + '...')
    console.log('🎯 Making verify request to:', `${this.authBaseUrl}/auth/verify`)
    
    return this.request<ApiResponse>(
      `${this.authBaseUrl}/auth/verify`,
      { method: 'GET' },
      true
    )
  }

  public async refreshToken(): Promise<any> {
    const refreshToken = localStorage.getItem('refreshToken')
    if (!refreshToken) {
      throw new Error('No refresh token available')
    }

    return this.request<ApiResponse>(
      `${this.authBaseUrl}/auth/refresh`,
      {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      }
    )
  }

  // ============ AGGREGATOR SERVICE METHODS ============

  public async searchTokens(params: TokenSearchParams): Promise<TokenListResponse> {
    const searchParams = new URLSearchParams()
    searchParams.append('q', params.q)
    if (params.chainId) {
      searchParams.append('chainId', params.chainId.toString())
    }
    if (params.limit) {
      searchParams.append('limit', params.limit.toString())
    }

    const response = await fetch(
      `${this.aggregatorBaseUrl}/tokens/search?${searchParams}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Token search failed: ${response.statusText}`)
    }

    return response.json()
  }

  public async getQuote(params: QuoteRequest): Promise<Quote> {
    const searchParams = new URLSearchParams()
    searchParams.append('fromChainId', params.fromChainId.toString())
    searchParams.append('toChainId', params.toChainId.toString())
    searchParams.append('fromToken', params.fromToken)
    searchParams.append('toToken', params.toToken)
    searchParams.append('amount', params.amount)
    if (params.userAddress) {
      searchParams.append('userAddress', params.userAddress)
    }
    if (params.slippage) {
      searchParams.append('slippage', params.slippage.toString())
    }

    const response = await fetch(
      `${this.aggregatorBaseUrl}/quote?${searchParams}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Quote request failed: ${response.statusText}`)
    }

    return response.json()
  }

  public async getPopularTokens(chainId?: number): Promise<TokenListResponse> {
    // Use the dedicated popular tokens endpoint
    const response = await fetch(
      `${this.aggregatorBaseUrl}/tokens/popular`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Popular tokens request failed: ${response.statusText}`)
    }

    const data = await response.json()
    
    // Filter by chainId if specified
    if (chainId && data.tokens) {
      data.tokens = data.tokens.filter((token: Token) => token.chainId === chainId)
      data.total = data.tokens.length
    }

    return data
  }

  // ============ HEALTH CHECKS ============

  public async checkAuthHealth(): Promise<any> {
    return this.request<any>(`${this.authBaseUrl}/health`, { method: 'GET' })
  }

  public async checkAggregatorHealth(): Promise<any> {
    return this.request<any>(`${this.aggregatorBaseUrl}/health`, { method: 'GET' })
  }

  // ============ USER PROFILE METHODS ============

  public async getUserProfile(): Promise<any> {
    return this.request<ApiResponse>(
      `${this.authBaseUrl}/user/profile`,
      { method: 'GET' },
      true
    )
  }

  public async updateUserProfile(profileData: any): Promise<any> {
    return this.request<ApiResponse>(
      `${this.authBaseUrl}/user/profile`,
      {
        method: 'PATCH',
        body: JSON.stringify(profileData),
      },
      true
    )
  }

  public async getUserSessions(): Promise<any> {
    return this.request<ApiResponse>(
      `${this.authBaseUrl}/session/list`,
      { method: 'GET' },
      true
    )
  }

  // ============ CORE SERVICE METHODS ============

  // Portfolio Management
  public async getPortfolio(params?: { chainIds?: string; includeSpam?: boolean; minValueUSD?: number }): Promise<any> {
    const searchParams = new URLSearchParams()
    if (params?.chainIds) searchParams.append('chainIds', params.chainIds)
    if (params?.includeSpam !== undefined) searchParams.append('includeSpam', params.includeSpam.toString())
    if (params?.minValueUSD) searchParams.append('minValueUSD', params.minValueUSD.toString())
    
    const url = `${this.coreBaseUrl}/portfolio${searchParams.toString() ? '?' + searchParams.toString() : ''}`
    return this.request<ApiResponse>(url, { method: 'GET' }, true)
  }

  public async getQuickPortfolio(): Promise<any> {
    return this.request<ApiResponse>(
      `${this.coreBaseUrl}/portfolio/quick`,
      { method: 'GET' },
      true
    )
  }

  public async refreshPortfolio(): Promise<any> {
    return this.request<ApiResponse>(
      `${this.coreBaseUrl}/portfolio/refresh`,
      { method: 'POST' },
      true
    )
  }

  public async getPortfolioSyncStatus(): Promise<any> {
    return this.request<ApiResponse>(
      `${this.coreBaseUrl}/portfolio/sync-status`,
      { method: 'GET' },
      true
    )
  }

  // P&L Analytics
  public async getPortfolioPnL(params?: { timeframe?: string; walletAddress?: string }): Promise<any> {
    const searchParams = new URLSearchParams()
    if (params?.timeframe) searchParams.append('timeframe', params.timeframe)
    if (params?.walletAddress) searchParams.append('walletAddress', params.walletAddress)
    
    const url = `${this.coreBaseUrl}/portfolio/pnl${searchParams.toString() ? '?' + searchParams.toString() : ''}`
    return this.request<ApiResponse>(url, { method: 'GET' }, true)
  }

  public async getPortfolioAnalytics(params?: { timeframe?: string; breakdown?: string }): Promise<any> {
    const searchParams = new URLSearchParams()
    if (params?.timeframe) searchParams.append('timeframe', params.timeframe)
    if (params?.breakdown) searchParams.append('breakdown', params.breakdown)
    
    const url = `${this.coreBaseUrl}/portfolio/analytics${searchParams.toString() ? '?' + searchParams.toString() : ''}`
    return this.request<ApiResponse>(url, { method: 'GET' }, true)
  }

  public async getPortfolioHistory(params?: { timeframe?: string; interval?: string }): Promise<any> {
    const searchParams = new URLSearchParams()
    if (params?.timeframe) searchParams.append('timeframe', params.timeframe)
    if (params?.interval) searchParams.append('interval', params.interval)
    
    const url = `${this.coreBaseUrl}/portfolio/history${searchParams.toString() ? '?' + searchParams.toString() : ''}`
    return this.request<ApiResponse>(url, { method: 'GET' }, true)
  }

  // Trading History
  public async getRecentTrades(params?: { limit?: number; days?: number; chainIds?: string }): Promise<any> {
    const searchParams = new URLSearchParams()
    if (params?.limit) searchParams.append('limit', params.limit.toString())
    if (params?.days) searchParams.append('days', params.days.toString())
    if (params?.chainIds) searchParams.append('chainIds', params.chainIds)
    
    const url = `${this.coreBaseUrl}/portfolio/trades${searchParams.toString() ? '?' + searchParams.toString() : ''}`
    return this.request<ApiResponse>(url, { method: 'GET' }, true)
  }

  // Order Management
  public async createOrder(orderData: any): Promise<any> {
    return this.request<ApiResponse>(
      `${this.coreBaseUrl}/orders`,
      {
        method: 'POST',
        body: JSON.stringify(orderData),
      },
      true
    )
  }

  public async getOrders(params?: { limit?: number; offset?: number; status?: string; type?: string }): Promise<any> {
    const searchParams = new URLSearchParams()
    if (params?.limit) searchParams.append('limit', params.limit.toString())
    if (params?.offset) searchParams.append('offset', params.offset.toString())
    if (params?.status) searchParams.append('status', params.status)
    if (params?.type) searchParams.append('type', params.type)
    
    const url = `${this.coreBaseUrl}/orders${searchParams.toString() ? '?' + searchParams.toString() : ''}`
    return this.request<ApiResponse>(url, { method: 'GET' }, true)
  }

  public async getActiveOrders(): Promise<any> {
    return this.request<ApiResponse>(
      `${this.coreBaseUrl}/orders/active`,
      { method: 'GET' },
      true
    )
  }

  public async getOrderById(orderId: string): Promise<any> {
    return this.request<ApiResponse>(
      `${this.coreBaseUrl}/orders/${orderId}`,
      { method: 'GET' },
      true
    )
  }

  public async updateOrder(orderId: string, updateData: any): Promise<any> {
    return this.request<ApiResponse>(
      `${this.coreBaseUrl}/orders/${orderId}`,
      {
        method: 'PUT',
        body: JSON.stringify(updateData),
      },
      true
    )
  }

  public async cancelOrder(orderId: string): Promise<any> {
    return this.request<ApiResponse>(
      `${this.coreBaseUrl}/orders/${orderId}`,
      { method: 'DELETE' },
      true
    )
  }

  public async recordOrderExecution(orderId: string, executionData: any): Promise<any> {
    return this.request<ApiResponse>(
      `${this.coreBaseUrl}/orders/${orderId}/executions`,
      {
        method: 'POST',
        body: JSON.stringify(executionData),
      },
      true
    )
  }

  public async getOrderStats(): Promise<any> {
    return this.request<ApiResponse>(
      `${this.coreBaseUrl}/orders/stats`,
      { method: 'GET' },
      true
    )
  }

  // Health Check
  public async checkCoreHealth(): Promise<any> {
    return this.request<any>(`${this.coreBaseUrl}/health`, { method: 'GET' })
  }
}

// Singleton instance
export const apiClient = new ApiClient()

// Helper functions for easier usage
export const authApi = {
  login: (privyToken: string) => apiClient.login(privyToken),
  logout: () => apiClient.logout(),
  getCurrentUser: () => apiClient.getCurrentUser(),
  getUserProfile: () => apiClient.getUserProfile(),
  updateProfile: (data: any) => apiClient.updateUserProfile(data),
  getSessions: () => apiClient.getUserSessions(),
  checkAuthHealth: () => apiClient.checkAuthHealth(),
}

export const aggregatorApi = {
  searchTokens: (params: TokenSearchParams) => apiClient.searchTokens(params),
  getQuote: (params: QuoteRequest) => apiClient.getQuote(params),
  getPopularTokens: (chainId?: number) => apiClient.getPopularTokens(chainId),
  checkAggregatorHealth: () => apiClient.checkAggregatorHealth(),
}

export const coreApi = {
  // Portfolio Management
  getPortfolio: (params?: { chainIds?: string; includeSpam?: boolean; minValueUSD?: number }) => 
    apiClient.getPortfolio(params),
  getQuickPortfolio: () => apiClient.getQuickPortfolio(),
  refreshPortfolio: () => apiClient.refreshPortfolio(),
  getPortfolioSyncStatus: () => apiClient.getPortfolioSyncStatus(),
  
  // P&L Analytics
  getPortfolioPnL: (params?: { timeframe?: string; walletAddress?: string }) => 
    apiClient.getPortfolioPnL(params),
  getPortfolioAnalytics: (params?: { timeframe?: string; breakdown?: string }) => 
    apiClient.getPortfolioAnalytics(params),
  getPortfolioHistory: (params?: { timeframe?: string; interval?: string }) => 
    apiClient.getPortfolioHistory(params),
    
  // Trading History
  getRecentTrades: (params?: { limit?: number; days?: number; chainIds?: string }) => 
    apiClient.getRecentTrades(params),
    
  // Order Management
  createOrder: (orderData: any) => apiClient.createOrder(orderData),
  getOrders: (params?: { limit?: number; offset?: number; status?: string; type?: string }) => 
    apiClient.getOrders(params),
  getActiveOrders: () => apiClient.getActiveOrders(),
  getOrderById: (orderId: string) => apiClient.getOrderById(orderId),
  updateOrder: (orderId: string, updateData: any) => apiClient.updateOrder(orderId, updateData),
  cancelOrder: (orderId: string) => apiClient.cancelOrder(orderId),
  recordOrderExecution: (orderId: string, executionData: any) => 
    apiClient.recordOrderExecution(orderId, executionData),
  getOrderStats: () => apiClient.getOrderStats(),
  
  // Health Check
  checkHealth: () => apiClient.checkCoreHealth(),
}

export default apiClient 