'use client'

import { useState, useEffect } from 'react'
import { Activity, CheckCircle, HelpCircle, Loader2, AlertTriangle, XCircle, Database } from 'lucide-react'
import { useStatsSubscription } from '@/contexts/websocket-firebase-context'
import { coreApi } from '@/lib/api-client'

interface BridgeLatencyData {
  _id: string;
  provider: string;
  fromChain: number;
  toChain: number;
  route: string;
  latency: number;
  status: 'healthy' | 'unhealthy';
  timestamp: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  __v: number;
}

export function BridgeStatusPanel() {
  const { subscribeToRoom, unsubscribeFromRoom, onMessage, isWebSocketConnected } = useStatsSubscription();
  const [bridgeStats, setBridgeStats] = useState<BridgeLatencyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Load initial data from Core Service API
  useEffect(() => {
    fetchBridgeStats();
  }, []);

  // Subscribe to WebSocket bridge stats updates when connected
  useEffect(() => {
    if (!isWebSocketConnected) return;

    console.log('📡 [BridgeStatusPanel] Subscribing to bridge_stats room...');
    
    // Subscribe to bridge_stats room
    subscribeToRoom('bridge_stats');

    // Listen for bridge stats updates from WebSocket
    const unsubscribe = onMessage('bridge_stats_update', (data: any) => {
      console.log('🌉 [BridgeStatusPanel] Received bridge stats update:', data);
      
      // Refresh data when WebSocket update received
      fetchBridgeStats();
      setLastUpdated(new Date());
    });

    return () => {
      unsubscribe();
      unsubscribeFromRoom('bridge_stats');
      console.log('🧹 [BridgeStatusPanel] Unsubscribed from bridge_stats room');
    };
  }, [isWebSocketConnected, subscribeToRoom, unsubscribeFromRoom, onMessage]);

  const fetchBridgeStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await coreApi.getBridgeStats({ limit: 10 });
      
      if (result.success && result.data?.bridgeStats) {
        setBridgeStats(result.data.bridgeStats);
        setLastUpdated(new Date());
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

  return (
    <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-4 h-4 text-green-500" />
        <h4 className="font-semibold text-gray-900 dark:text-white">Bridge Status</h4>
        <div className="group relative">
          <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
          <div className="absolute invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity duration-300 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-lg z-10">
            Real-time status and performance metrics of cross-chain bridge aggregators
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
          <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">Loading bridge stats...</span>
        </div>
      ) : error ? (
        <div className="text-center p-4">
          <p className="text-sm text-red-600 dark:text-red-400 mb-2">
            {error}
          </p>
          <button
            onClick={fetchBridgeStats}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Retry
          </button>
        </div>
      ) : bridgeStats.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <Database className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            No bridge status data available
          </p>
          <button
            onClick={fetchBridgeStats}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Refresh
          </button>
        </div>
      ) : (
        <div className="space-y-3 max-h-80 overflow-y-auto hover-scrollbar">
          {bridgeStats.map((bridge) => (
            <div key={bridge._id} className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-all duration-200 cursor-pointer">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 ${getStatusColor(bridge.status)} rounded-full flex items-center justify-center`}>
                  {getStatusIcon(bridge.status)}
                </div>
                <div>
                  <div className="font-medium text-sm text-gray-900 dark:text-white">{bridge.provider || 'Unknown Bridge'}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{getBridgeDescription(bridge)}</div>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-sm font-medium ${getLatencyColor(bridge.status)}`}>
                  {formatLatency(bridge.latency || 0)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {bridge.status === 'healthy' ? 'Online' : 'Offline'}
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