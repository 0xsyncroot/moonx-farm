'use client'

import { useState, useEffect } from 'react'
import { BarChart3, TrendingUp, TrendingDown, HelpCircle, Loader2, Database } from 'lucide-react'
import { useStatsSubscription } from '@/contexts/websocket-firebase-context'
import { coreApi } from '@/lib/api-client'
import { 
  formatChainDisplayName, 
  getChainAvatarFallback, 
  getChainStatusStyle,
  type ChainStatus 
} from '@/utils/chain-utils'

interface ChainPerformanceData {
  _id: string;
  chainId: number;
  chainName: string;
  chainSlug: string;
  logoUrl: string;
  defiLlamaSlug: string;
  blockTime: {
    current: number;
    change: string;
    changePercent: number;
    timestamp: number;
  };
  status: ChainStatus;
  volume24h: string;
  volumeUSD: number;
  rpcUrl: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  __v: number;
}

export function ChainPerformancePanel() {
  const { subscribeToRoom, unsubscribeFromRoom, onMessage, isWebSocketConnected } = useStatsSubscription();
  const [chainStats, setChainStats] = useState<ChainPerformanceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Fetch initial chain stats from Core Service API
  useEffect(() => {
    fetchChainStats();
  }, []);

  // Subscribe to WebSocket chain stats updates when connected
  useEffect(() => {
    if (!isWebSocketConnected) return;

    console.log('📡 [ChainPerformancePanel] Subscribing to chain_stats room...');
    
    // Subscribe to chain_stats room
    subscribeToRoom('chain_stats');

    // Listen for chain stats updates from WebSocket
    const unsubscribe = onMessage('chain_stats_update', (data: any) => {
      console.log('⛓️ [ChainPerformancePanel] Received chain stats update:', data);
      
      // Refresh data when WebSocket update received
      fetchChainStats();
      setLastUpdated(new Date());
    });

    return () => {
      unsubscribe();
      unsubscribeFromRoom('chain_stats');
      console.log('🧹 [ChainPerformancePanel] Unsubscribed from chain_stats room');
    };
  }, [isWebSocketConnected, subscribeToRoom, unsubscribeFromRoom, onMessage]);

  const fetchChainStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await coreApi.getChainStats({ limit: 10 });
      
      if (result.success && result.data?.chainStats) {
        setChainStats(result.data.chainStats);
        setLastUpdated(new Date());
        console.log('📊 [ChainPerformancePanel] Fetched chain stats:', result.data.chainStats);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('❌ [ChainPerformancePanel] Failed to fetch chain stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch chain stats');
      setChainStats([]);
    } finally {
      setLoading(false);
    }
  };

  const formatVolume = (volumeStr: string) => {
    // API already returns formatted volume like "$964.8M"
    return volumeStr || '$0';
  };

  const getStatusColor = (status: ChainStatus) => {
    return getChainStatusStyle(status).color;
  };

  const getStatusIndicator = (status: ChainStatus) => {
    return getChainStatusStyle(status).bgColor;
  };

  const safeToFixed = (value: number | undefined | null, digits: number) => {
    return value != null && !isNaN(value) ? value.toFixed(digits) : '0.0';
  };

  return (
    <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-lg">
          <BarChart3 className="w-4 h-4 text-white" />
        </div>
        <h4 className="text-base font-semibold text-gray-900 dark:text-white">Chain Performance</h4>
        <div className="group relative">
          <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
          <div className="absolute invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity duration-300 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-lg z-10">
            Live performance metrics including transaction times, volumes, and trend analysis
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
          </div>
        </div>
        {/* WebSocket connection indicator */}
        {isWebSocketConnected && (
          <div className="flex items-center gap-1 ml-auto">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-green-600 dark:text-green-400">Live</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">Loading chain stats...</span>
        </div>
      ) : error ? (
        <div className="text-center p-4">
          <p className="text-sm text-red-600 dark:text-red-400 mb-2">
            {error}
          </p>
          <button
            onClick={fetchChainStats}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Retry
          </button>
        </div>
      ) : chainStats.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <Database className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            No chain performance data available
          </p>
          <button
            onClick={fetchChainStats}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Refresh
          </button>
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto hover-scrollbar">
          {chainStats.map((chain) => (
            <div key={chain._id} className="group flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 p-2.5 rounded-lg transition-all duration-200 cursor-pointer">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-full flex items-center justify-center group-hover:scale-105 transition-transform duration-200 overflow-hidden">
                  {chain.logoUrl ? (
                    <img 
                      src={chain.logoUrl} 
                      alt={chain.chainName}
                      className="object-contain rounded-full"
                      onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                        // Fallback to first letter if logo fails to load
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const fallback = target.parentElement?.querySelector('.logo-fallback') as HTMLElement;
                        if (fallback) fallback.style.display = 'block';
                      }}
                    />
                  ) : null}
                  <span className={`logo-fallback text-sm font-bold text-gray-700 dark:text-gray-300 ${chain.logoUrl ? 'hidden' : 'block'}`}>
                    {getChainAvatarFallback(chain)}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <div className="font-medium text-gray-900 dark:text-white text-sm">{formatChainDisplayName(chain)}</div>
                    <div className={`w-2 h-2 rounded-full ${getStatusIndicator(chain.status)}`}></div>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Block: {safeToFixed(chain.blockTime?.current, 1)}s</div>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-sm font-medium flex items-center gap-1 ${
                  (chain.blockTime?.changePercent || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {(chain.blockTime?.changePercent || 0) >= 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {(chain.blockTime?.changePercent || 0) >= 0 ? '+' : ''}{safeToFixed(chain.blockTime?.changePercent, 1)}%
                </div>
                <div className="flex items-center justify-end gap-1.5">
                  <div className="text-xs text-gray-500 dark:text-gray-400">{formatVolume(chain.volume24h)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Last updated indicator */}
      {lastUpdated && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Last updated: {lastUpdated.toLocaleTimeString()}
            {isWebSocketConnected && ' • Live updates enabled'}
          </p>
        </div>
      )}
    </div>
  )
} 