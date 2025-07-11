'use client'

import { useState, useEffect } from 'react'
import { Activity, CheckCircle, HelpCircle, AlertTriangle, XCircle, Database } from 'lucide-react'
import { useStatsSubscription } from '@/contexts/websocket-firebase-context'
import { coreApi } from '@/lib/api-client'

interface BridgeLatencyData {
  _id?: string;
  provider: string;
  fromChain: number;
  toChain: number;
  route: string;
  latency: number;
  status: 'healthy' | 'unhealthy';
  timestamp: number;
  error?: string;
  createdAt?: string;
  updatedAt: string;
  expiresAt?: string;
  __v?: number;
}

interface WebSocketBridgeUpdate {
  id: string;
  type: string;
  timestamp: number;
  data: {
    provider: string;
    stats: BridgeLatencyData;
    source: string;
  };
}

// Shimmer loading component
const BridgeShimmer = () => (
  <div className="space-y-2">
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="flex items-center justify-between p-3 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
          <div>
            <div className="w-20 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-1"></div>
            <div className="w-24 h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          </div>
        </div>
        <div className="text-right">
          <div className="w-12 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-1"></div>
          <div className="w-16 h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        </div>
      </div>
    ))}
  </div>
);

export function BridgeStatusPanel() {
  const { subscribeToRoom, unsubscribeFromRoom, onMessage, isWebSocketConnected } = useStatsSubscription();
  const [bridgeStats, setBridgeStats] = useState<BridgeLatencyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recentlyUpdated, setRecentlyUpdated] = useState<Set<string>>(new Set());

  // Load initial data from Core Service API
  useEffect(() => {
    fetchBridgeStats();
  }, []);

  // Subscribe to WebSocket bridge stats updates when connected
  useEffect(() => {
    if (!isWebSocketConnected) {
      console.log('🔌 [BridgeStatusPanel] WebSocket not connected, skipping subscription');
      return;
    }

    console.log('📡 [BridgeStatusPanel] WebSocket connected, subscribing to bridge_stats room...');
    
    // Subscribe to bridge_stats room
    subscribeToRoom('bridge_stats');
    console.log('📡 [BridgeStatusPanel] Subscription request sent for bridge_stats room');

    // Listen for bridge stats updates from WebSocket
    const unsubscribe = onMessage('bridge_stats_update', (data: WebSocketBridgeUpdate | any) => {
      console.log('🌉 [BridgeStatusPanel] Received bridge stats update:', data);
      
      // Handle different data structures from WebSocket
      let statsData: BridgeLatencyData | null = null;
      
      if (data?.data?.stats) {
        // Standard WebSocket format
        console.log('📊 [BridgeStatusPanel] Processing bridge stats (nested):', data.data.stats);
        statsData = data.data.stats;
      } else if (data?.stats) {
        // Direct stats format from Kafka
        console.log('�� [BridgeStatusPanel] Processing bridge stats (direct):', data.stats);
        statsData = data.stats;
      } else if (data && typeof data === 'object' && data.provider) {
        // Data is the stats object itself
        console.log('📊 [BridgeStatusPanel] Processing bridge stats (object):', data);
        statsData = data;
      } else {
        console.warn('⚠️ [BridgeStatusPanel] No stats data in received message:', data);
      }
      
      if (statsData) {
        updateBridgeStats(statsData);
      }
    });

    // Add debug logging for subscription confirmation
    const unsubscribeDebug = onMessage('subscription-response', (data: any) => {
      console.log('✅ [BridgeStatusPanel] Subscription response received:', data);
    });

    return () => {
      console.log('🧹 [BridgeStatusPanel] Cleaning up subscriptions...');
      unsubscribe();
      unsubscribeDebug();
      unsubscribeFromRoom('bridge_stats');
      console.log('🧹 [BridgeStatusPanel] Unsubscribed from bridge_stats room');
    };
  }, [isWebSocketConnected, subscribeToRoom, unsubscribeFromRoom, onMessage]);

  const updateBridgeStats = (newBridgeData: BridgeLatencyData) => {
    console.log('🔄 [BridgeStatusPanel] updateBridgeStats called with:', newBridgeData);
    
    const bridgeKey = `${newBridgeData.provider}-${newBridgeData.route}`;
    
    setBridgeStats(prevStats => {
      const existingIndex = prevStats.findIndex(bridge => 
        bridge.provider === newBridgeData.provider && 
        bridge.route === newBridgeData.route
      );
      
      if (existingIndex >= 0) {
        // Update existing bridge
        const updatedStats = [...prevStats];
        updatedStats[existingIndex] = { ...updatedStats[existingIndex], ...newBridgeData };
        console.log('📊 [BridgeStatusPanel] Updated existing bridge:', updatedStats[existingIndex]);
        return updatedStats;
      } else {
        // Add new bridge
        console.log('➕ [BridgeStatusPanel] Adding new bridge:', newBridgeData);
        return [...prevStats, newBridgeData];
      }
    });

    // Add visual feedback for real-time update
    setRecentlyUpdated(prev => {
      const newSet = new Set(prev);
      newSet.add(bridgeKey);
      console.log('✨ [BridgeStatusPanel] Marked bridge as recently updated:', bridgeKey);
      return newSet;
    });
    
    // Remove the highlight after animation completes
    setTimeout(() => {
      setRecentlyUpdated(prev => {
        const newSet = new Set(prev);
        newSet.delete(bridgeKey);
        console.log('🔄 [BridgeStatusPanel] Removed recent update highlight:', bridgeKey);
        return newSet;
      });
    }, 1500); // 1.5 seconds highlight duration
  };

  const fetchBridgeStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await coreApi.getBridgeStats({ limit: 10 });
      
      if (result.success && result.data?.bridgeStats) {
        setBridgeStats(result.data.bridgeStats);
        console.log('🌉 [BridgeStatusPanel] Fetched bridge stats:', result.data.bridgeStats);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('❌ [BridgeStatusPanel] Failed to fetch bridge stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch bridge stats');
      setBridgeStats([]);
    } finally {
      setLoading(false);
    }
  };

  const mapStatusToDisplay = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'optimal';
      case 'unhealthy':
        return 'down';
      default:
        return 'degraded';
    }
  };

  const getStatusIcon = (status: string) => {
    const displayStatus = mapStatusToDisplay(status);
    switch (displayStatus) {
      case 'optimal':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'down':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    const displayStatus = mapStatusToDisplay(status);
    switch (displayStatus) {
      case 'optimal':
        return 'bg-green-50 dark:bg-green-900/20';
      case 'degraded':
        return 'bg-yellow-50 dark:bg-yellow-900/20';
      case 'down':
        return 'bg-red-50 dark:bg-red-900/20';
      default:
        return 'bg-gray-50 dark:bg-gray-900/20';
    }
  };

  const getLatencyColor = (status: string) => {
    const displayStatus = mapStatusToDisplay(status);
    switch (displayStatus) {
      case 'optimal':
        return 'text-green-600 dark:text-green-400';
      case 'degraded':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'down':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const formatLatency = (latency: number) => {
    if (latency >= 1000) {
      return `${(latency / 1000).toFixed(1)}s`;
    }
    return `${latency}ms`;
  };

  const getBridgeDescription = (bridge: BridgeLatencyData) => {
    // Parse route like "Ethereum->Arbitrum" or "Base->Base"
    return bridge.route || `Chain ${bridge.fromChain} → Chain ${bridge.toChain}`;
  };

  const getBridgeKey = (bridge: BridgeLatencyData) => {
    return `${bridge.provider}-${bridge.route}`;
  };

  const isRecentlyUpdated = (bridge: BridgeLatencyData) => {
    return recentlyUpdated.has(getBridgeKey(bridge));
  };

  return (
    <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-lg p-4 overflow-hidden w-full max-w-full">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg">
          <Activity className="w-4 h-4 text-white" />
        </div>
        <h4 className="font-semibold text-gray-900 dark:text-white">Bridge Status</h4>
        <div className="group relative">
          <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
          <div className="absolute invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity duration-300 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-lg z-10">
            Real-time bridge performance and latency monitoring
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
        <BridgeShimmer />
      ) : error ? (
        <div className="text-center p-6">
          <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <XCircle className="w-6 h-6 text-red-500" />
          </div>
          <p className="text-sm text-red-600 dark:text-red-400 mb-3">
            {error}
          </p>
          <button
            onClick={fetchBridgeStats}
            className="px-4 py-2 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
          >
            Try Again
          </button>
        </div>
      ) : bridgeStats.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <Database className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            No bridge data available
          </p>
          <button
            onClick={fetchBridgeStats}
            className="px-4 py-2 text-sm bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Refresh
          </button>
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto overflow-x-hidden hover-scrollbar">
          {bridgeStats.map((bridge) => (
            <div 
              key={getBridgeKey(bridge)} 
              className={`
                flex items-center justify-between p-3 rounded-lg transition-all duration-200 cursor-pointer border relative overflow-hidden
                ${isRecentlyUpdated(bridge) 
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 shadow-lg shadow-blue-200/50 dark:shadow-blue-900/30' 
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 border-transparent hover:border-gray-200 dark:hover:border-gray-600'
                }
              `}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 ${getStatusColor(bridge.status)} rounded-full flex items-center justify-center flex-shrink-0`}>
                  {getStatusIcon(bridge.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-900 dark:text-white truncate">{bridge.provider}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{getBridgeDescription(bridge)}</div>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className={`text-sm font-medium ${getLatencyColor(bridge.status)}`}>
                  {formatLatency(bridge.latency || 0)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {bridge.status === 'healthy' ? 'Online' : 'Offline'}
                </div>
              </div>
              {/* Real-time update indicator */}
              {isRecentlyUpdated(bridge) && (
                <div className="ml-2 w-2 h-2 bg-blue-500 rounded-full animate-pulse flex-shrink-0"></div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 