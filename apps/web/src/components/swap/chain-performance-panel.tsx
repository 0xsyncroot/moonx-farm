'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { BarChart3, TrendingUp, TrendingDown, HelpCircle, Database, XCircle, Link, LineChart } from 'lucide-react'
import { useStatsSubscription } from '@/contexts/websocket-firebase-context'
import { coreApi } from '@/lib/api-client'
import { 
  formatChainDisplayName, 
  getChainAvatarFallback, 
  getChainStatusStyle,
  type ChainStatus 
} from '@/utils/chain-utils'

interface ChainPerformanceData {
  _id?: string;
  chainId: number;
  chainName: string;
  chainSlug: string;
  logoUrl: string;
  defiLlamaSlug?: string;
  blockTime: {
    current: number;
    change: string;
    changePercent: number;
    timestamp: number;
  };
  status: ChainStatus;
  volume24h: string;
  volumeUSD: number;
  rpcUrl?: string;
  createdAt?: string;
  updatedAt: string;
  expiresAt?: string;
  __v?: number;
}

interface WebSocketChainUpdate {
  id: string;
  type: string;
  timestamp: number;
  data: {
    chainId: number;
    chainName: string;
    stats: ChainPerformanceData;
    source: string;
  };
}

// Shimmer loading component
const ChainShimmer = () => (
  <div className="space-y-2">
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="flex items-center justify-between p-3 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
          </div>
          <div className="flex-1">
            <div className="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-1"></div>
            <div className="w-20 h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          </div>
        </div>
        <div className="text-right">
          <div className="w-12 h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-1"></div>
          <div className="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        </div>
      </div>
    ))}
  </div>
);

// Chain Performance Empty State Component
const ChainEmptyState = ({ onRefresh }: { onRefresh: () => void }) => (
  <div className="flex flex-col items-center justify-center p-6 text-center">
    <div className="relative mb-3">
      <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl flex items-center justify-center">
        <Link className="w-6 h-6 text-blue-600 dark:text-blue-400" />
      </div>
      <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/20 dark:to-emerald-900/20 rounded-full flex items-center justify-center">
        <LineChart className="w-2 h-2 text-green-600 dark:text-green-400" />
      </div>
    </div>
    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
      No Chain Data
    </h3>
    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 max-w-40 leading-relaxed">
      Networks unavailable
    </p>
    <button
      onClick={onRefresh}
      className="px-3 py-1.5 text-xs bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 text-blue-700 dark:text-blue-300 rounded-lg hover:from-blue-100 hover:to-purple-100 dark:hover:from-blue-900/30 dark:hover:to-purple-900/30 transition-all duration-200 border border-blue-200/50 dark:border-blue-700/50 font-medium"
    >
      Refresh
    </button>
  </div>
);

export function ChainPerformancePanel() {
  const { subscribeToRoom, unsubscribeFromRoom, onMessage, isWebSocketConnected } = useStatsSubscription();
  const [chainStats, setChainStats] = useState<ChainPerformanceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recentlyUpdated, setRecentlyUpdated] = useState<Set<number>>(new Set());

  // 🚀 OPTIMIZED: Use ref to prevent multiple API calls and store stable functions
  const hasFetchedRef = useRef(false);
  const isMountedRef = useRef(true);
  const componentInstanceId = useRef(Math.random().toString(36).substr(2, 9));
  const statsSubscriptionRef = useRef({
    subscribeToRoom,
    unsubscribeFromRoom,
    onMessage
  });

  // 🚀 DEBUG: Log component lifecycle
  console.log(`🔍 [ChainPerformancePanel-${componentInstanceId.current}] Component render`, {
    hasFetched: hasFetchedRef.current,
    isWebSocketConnected,
    loading,
    chainStatsCount: chainStats.length
  });

  // 🚀 OPTIMIZED: Update refs when functions change (but don't trigger re-renders)
  useEffect(() => {
    statsSubscriptionRef.current = {
      subscribeToRoom,
      unsubscribeFromRoom,
      onMessage
    };
  }, [subscribeToRoom, unsubscribeFromRoom, onMessage]);

  // 🚀 OPTIMIZED: Memoize fetchChainStats to prevent recreation
  const fetchChainStats = useCallback(async () => {
    // Prevent multiple calls
    if (hasFetchedRef.current) {
      console.log(`📊 [ChainPerformancePanel-${componentInstanceId.current}] Already fetched, skipping duplicate call`);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      hasFetchedRef.current = true;
      
      console.log(`📊 [ChainPerformancePanel-${componentInstanceId.current}] Starting API call...`);
      const result = await coreApi.getChainStats({ limit: 10 });
      
      if (result.success && result.data?.chainStats) {
        if (isMountedRef.current) {
          setChainStats(result.data.chainStats);
          console.log(`📊 [ChainPerformancePanel-${componentInstanceId.current}] Fetched chain stats:`, result.data.chainStats.length, 'items');
        }
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error(`❌ [ChainPerformancePanel-${componentInstanceId.current}] Failed to fetch chain stats:`, err);
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch chain stats');
        setChainStats([]);
      }
      // Reset ref on error so user can retry
      hasFetchedRef.current = false;
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []); // Empty dependency array - stable function

  // 🚀 OPTIMIZED: Memoize updateChainStats to prevent recreation
  const updateChainStats = useCallback((newChainData: ChainPerformanceData) => {
    if (!isMountedRef.current) return;
    
    console.log('🔄 [ChainPerformancePanel] updateChainStats called with:', newChainData);
    
    setChainStats(prevStats => {
      const existingIndex = prevStats.findIndex(chain => chain.chainId === newChainData.chainId);
      
      if (existingIndex >= 0) {
        // Update existing chain
        const updatedStats = [...prevStats];
        updatedStats[existingIndex] = { ...updatedStats[existingIndex], ...newChainData };
        console.log('📊 [ChainPerformancePanel] Updated existing chain:', updatedStats[existingIndex]);
        return updatedStats;
      } else {
        // Add new chain
        console.log('➕ [ChainPerformancePanel] Adding new chain:', newChainData);
        return [...prevStats, newChainData];
      }
    });

    // Add visual feedback for real-time update
    setRecentlyUpdated(prev => {
      const newSet = new Set(prev);
      newSet.add(newChainData.chainId);
      console.log('✨ [ChainPerformancePanel] Marked chain as recently updated:', newChainData.chainId);
      return newSet;
    });
    
    // Remove the highlight after animation completes
    setTimeout(() => {
      if (isMountedRef.current) {
        setRecentlyUpdated(prev => {
          const newSet = new Set(prev);
          newSet.delete(newChainData.chainId);
          console.log('🔄 [ChainPerformancePanel] Removed recent update highlight:', newChainData.chainId);
          return newSet;
        });
      }
    }, 1500); // 1.5 seconds highlight duration
  }, []);

  // 🚀 OPTIMIZED: Track component mount/unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 🚀 OPTIMIZED: Single useEffect for initial fetch - ONLY runs once
  useEffect(() => {
    fetchChainStats();
  }, []); // No dependencies - only run once on mount

  // 🚀 OPTIMIZED: Separate WebSocket subscription useEffect with stable dependencies
  useEffect(() => {
    if (!isWebSocketConnected || !isMountedRef.current) {
      console.log('🔌 [ChainPerformancePanel] WebSocket not connected, skipping subscription');
      return;
    }

    console.log('📡 [ChainPerformancePanel] WebSocket connected, subscribing to chain_stats room...');
    
    // Use refs to get stable functions
    const { subscribeToRoom: subscribe, unsubscribeFromRoom: unsubscribe, onMessage: onMsg } = statsSubscriptionRef.current;
    
    // Subscribe to chain_stats room
    subscribe('chain_stats');
    console.log('📡 [ChainPerformancePanel] Subscription request sent for chain_stats room');

    // Listen for chain stats updates from WebSocket
    const unsubscribeUpdate = onMsg('chain_stats_update', (data: WebSocketChainUpdate | any) => {
      if (!isMountedRef.current) return;
      
      console.log('⛓️ [ChainPerformancePanel] Received chain stats update:', data);
      
      // Handle different data structures from WebSocket
      let statsData: ChainPerformanceData | null = null;
      
      if (data?.data?.stats) {
        // Standard WebSocket format
        console.log('📊 [ChainPerformancePanel] Processing chain stats (nested):', data.data.stats);
        statsData = data.data.stats;
      } else if (data?.stats) {
        // Direct stats format from Kafka
        console.log('📊 [ChainPerformancePanel] Processing chain stats (direct):', data.stats);
        statsData = data.stats;
      } else if (data && typeof data === 'object' && data.chainId) {
        // Data is the stats object itself
        console.log('📊 [ChainPerformancePanel] Processing chain stats (object):', data);
        statsData = data;
      } else {
        console.warn('⚠️ [ChainPerformancePanel] No stats data in received message:', data);
      }
      
      if (statsData) {
        updateChainStats(statsData);
      }
    });

    // Add debug logging for subscription confirmation
    const unsubscribeDebug = onMsg('subscription-response', (data: any) => {
      console.log('✅ [ChainPerformancePanel] Subscription response received:', data);
    });

    return () => {
      console.log('🧹 [ChainPerformancePanel] Cleaning up subscriptions...');
      unsubscribeUpdate();
      unsubscribeDebug();
      unsubscribe('chain_stats');
      console.log('🧹 [ChainPerformancePanel] Unsubscribed from chain_stats room');
    };
  }, [isWebSocketConnected, updateChainStats]); // Only isWebSocketConnected and updateChainStats as dependencies

  // 🚀 OPTIMIZED: Add manual refresh function for error state
  const handleRefresh = useCallback(() => {
    hasFetchedRef.current = false;
    fetchChainStats();
  }, [fetchChainStats]);

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

  const getTrendIcon = (changePercent: number) => {
    if (changePercent > 0) {
      return <TrendingUp className="w-3 h-3" />;
    } else if (changePercent < 0) {
      return <TrendingDown className="w-3 h-3" />;
    }
    return null;
  };

  const getTrendColor = (changePercent: number) => {
    if (changePercent > 0) {
      return 'text-green-600 dark:text-green-400';
    } else if (changePercent < 0) {
      return 'text-red-600 dark:text-red-400';
    }
    return 'text-gray-600 dark:text-gray-400';
  };

  const isRecentlyUpdated = (chain: ChainPerformanceData) => {
    return recentlyUpdated.has(chain.chainId);
  };

  return (
    <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-lg p-4 overflow-hidden w-full max-w-full">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
          <BarChart3 className="w-4 h-4 text-white" />
        </div>
        <h4 className="text-base font-semibold text-gray-900 dark:text-white">Chain Performance</h4>
        <div className="group relative">
          <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
          <div className="absolute invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity duration-300 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-lg z-10">
            Live blockchain performance and trading metrics
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
        <ChainShimmer />
      ) : error ? (
        <div className="text-center p-6">
          <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <XCircle className="w-6 h-6 text-red-500" />
          </div>
          <p className="text-sm text-red-600 dark:text-red-400 mb-3">
            {error}
          </p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
          >
            Try Again
          </button>
        </div>
      ) : chainStats.length === 0 ? (
        <ChainEmptyState onRefresh={handleRefresh} />
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto overflow-x-hidden hover-scrollbar">
          {chainStats.map((chain) => (
            <div 
              key={chain.chainId} 
              className={`
                group flex items-center justify-between p-3 rounded-lg transition-all duration-200 cursor-pointer border relative overflow-hidden
                ${isRecentlyUpdated(chain) 
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 shadow-lg shadow-blue-200/50 dark:shadow-blue-900/30' 
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 border-transparent hover:border-gray-200 dark:hover:border-gray-600'
                }
              `}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className={`w-8 h-8 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-full flex items-center justify-center transition-all duration-200 ${isRecentlyUpdated(chain) ? 'shadow-md shadow-blue-300/50 dark:shadow-blue-700/50' : 'group-hover:brightness-110'} overflow-hidden`}>
                    {chain.logoUrl ? (
                      <img 
                        src={chain.logoUrl} 
                        alt={chain.chainName}
                        className="w-6 h-6 object-contain rounded-full"
                        onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const fallback = target.parentElement?.querySelector('.logo-fallback') as HTMLElement;
                          if (fallback) fallback.style.display = 'block';
                        }}
                      />
                    ) : null}
                    <span className={`logo-fallback text-xs font-bold text-gray-700 dark:text-gray-300 ${chain.logoUrl ? 'hidden' : 'block'}`}>
                      {getChainAvatarFallback(chain)}
                    </span>
                  </div>
                  <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full ${getStatusIndicator(chain.status)} border-2 border-white dark:border-gray-800`}></div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 dark:text-white text-sm truncate">
                    {formatChainDisplayName(chain)}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    Block time: {safeToFixed(chain.blockTime?.current, 1)}s
                  </div>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  {formatVolume(chain.volume24h)}
                </div>
                <div className={`text-sm font-medium flex items-center gap-1 justify-end ${getTrendColor(chain.blockTime?.changePercent || 0)}`}>
                  {getTrendIcon(chain.blockTime?.changePercent || 0)}
                  <span>
                    {(chain.blockTime?.changePercent || 0) >= 0 ? '+' : ''}
                    {safeToFixed(chain.blockTime?.changePercent, 1)}%
                  </span>
                </div>
              </div>
              {/* Real-time update indicator */}
              {isRecentlyUpdated(chain) && (
                <div className="ml-2 w-2 h-2 bg-blue-500 rounded-full animate-pulse flex-shrink-0"></div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 