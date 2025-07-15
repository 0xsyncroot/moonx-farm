'use client'

import React, { useEffect } from 'react'
import { SwapInterfaceWrapper } from '@/components/swap/swap-interface-wrapper'
import { SwapPageHeader } from '@/components/swap/swap-page-header'
import { SmartRoutingPanel } from '@/components/swap/smart-routing-panel'
import { BridgeStatusPanel } from '@/components/swap/bridge-status-panel'
import { AIRecommendationsPanel } from '@/components/swap/ai-recommendations-panel'
import { ChainPerformancePanel } from '@/components/swap/chain-performance-panel'
import { CrossChainFeaturesStrip } from '@/components/swap/cross-chain-features-strip'
import { useWebSocketFirebaseContext } from '@/contexts/websocket-firebase-context'

export default function SwapPage() {
  const { connectionStatus, isWebSocketConnected, error } = useWebSocketFirebaseContext();

  // Monitor WebSocket connection status
  useEffect(() => {
    console.log('🔗 [SwapPage] WebSocket status:', {
      connected: isWebSocketConnected,
      websocket: connectionStatus.websocket,
      firebase: connectionStatus.firebase,
      online: connectionStatus.online,
      error
    });
  }, [isWebSocketConnected, connectionStatus, error]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* WebSocket Connection Status Indicator (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed top-4 right-4 z-50">
          <div className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2 ${
            isWebSocketConnected 
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : connectionStatus.websocket === 'connecting'
              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              isWebSocketConnected ? 'bg-green-500' :
              connectionStatus.websocket === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
            }`} />
            {isWebSocketConnected ? 'Live' : 
             connectionStatus.websocket === 'connecting' ? 'Connecting...' : 'Offline'}
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 py-4 max-w-7xl">
        {/* Compact Hero Section */}
        <SwapPageHeader />

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-12 gap-4 md:gap-6">
          {/* Left Sidebar - Cross-Chain Intelligence */}
          <div className="lg:col-span-3 order-2 lg:order-1 space-y-4 md:space-y-6 hidden lg:block">
            <SmartRoutingPanel />
            <BridgeStatusPanel />
          </div>

          {/* Center - Swap Interface */}
          <div className="lg:col-span-6 order-1 lg:order-2">
            <SwapInterfaceWrapper />
          </div>

          {/* Right Sidebar - AI Recommendations */}
          <div className="lg:col-span-3 order-3 space-y-4 md:space-y-6 hidden lg:block">
            <AIRecommendationsPanel />
            <ChainPerformancePanel />
          </div>
        </div>

        {/* Bottom Cross-Chain Features Strip */}
        <CrossChainFeaturesStrip />
      </main>

      {/* Styles */}
      <style jsx>{`
        .glass {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .glass-dark {
          background: rgba(0, 0, 0, 0.2);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </div>
  )
} 