'use client'

import React, { ReactNode, useEffect, useState, useRef, useMemo } from 'react';
import { WebSocketFirebaseProvider } from '@/contexts/websocket-firebase-context';
import { useAuth } from '@/hooks/use-auth';

interface WebSocketProviderWrapperProps {
  children: ReactNode;
}

export function WebSocketProviderWrapper({ children }: WebSocketProviderWrapperProps) {
  // ✅ FIX: Only extract primitive values from useAuth to prevent excessive re-renders
  const { privyAuthenticated, ready: privyReady, backendUser } = useAuth();
  
  const [jwtToken, setJwtToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Use refs to track retry logic and prevent multiple instances
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const isMountedRef = useRef(true);
  const maxRetries = 5;

  // ✅ FIX: Memoize firebaseConfig to prevent useEffect re-runs
  const firebaseConfig = useMemo(() => ({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
  }), []); // ✅ Empty dependency array - config never changes

  // WebSocket Gateway configuration
  const websocketUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:3008';

  // ✅ FIX: Inline function implementations to avoid callback dependencies
  // ✅ FIX: Only depend on primitive values to prevent circular dependencies
  useEffect(() => {
    if (!isMountedRef.current) return;

    // Clear any existing timeout
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    // Reset state when user changes
    if (privyReady && privyAuthenticated) {
      console.log('🔐 WebSocket Provider: Privy authenticated, checking JWT token...');
      retryCountRef.current = 0;
      setError(prev => prev !== null ? null : prev); // ✅ Only update if different
      
      // Inline JWT token retrieval logic
      const getJwtToken = () => {
        if (!isMountedRef.current) return;

        const token = localStorage.getItem('accessToken');
        if (token) {
          console.log('✅ WebSocket Provider: JWT token found, initializing WebSocket connection');
          if (isMountedRef.current) {
            setJwtToken(prev => prev !== token ? token : prev); // ✅ Only update if different
            setIsReady(prev => prev !== true ? true : prev); // ✅ Only update if different
            setError(prev => prev !== null ? null : prev); // ✅ Only update if different
            retryCountRef.current = 0;
          }
          return;
        }

        // No token found - retry if not exceeded max attempts
        if (retryCountRef.current < maxRetries) {
          retryCountRef.current++;
          console.log(`🔄 WebSocket Provider: JWT token not found, retrying... (${retryCountRef.current}/${maxRetries})`);
          
          // Exponential backoff: 500ms, 1s, 2s, 4s, 8s
          const delay = 500 * Math.pow(2, retryCountRef.current - 1);
          
          retryTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              getJwtToken();
            }
          }, delay);
        } else {
          console.warn('⚠️ WebSocket Provider: Max retries reached, WebSocket will not initialize');
          if (isMountedRef.current) {
            setError(prev => prev !== 'Failed to get JWT token after multiple attempts' ? 'Failed to get JWT token after multiple attempts' : prev);
            setIsReady(prev => prev !== false ? false : prev);
          }
        }
      };

      getJwtToken();
    } else {
      console.log('👤 WebSocket Provider: Privy not authenticated, cleaning up...');
      // Inline reset state logic
      if (isMountedRef.current) {
        setJwtToken(prev => prev !== null ? null : prev); // ✅ Only update if different
        setIsReady(prev => prev !== false ? false : prev); // ✅ Only update if different
        setError(prev => prev !== null ? null : prev); // ✅ Only update if different
        retryCountRef.current = 0;
      }
    }
  }, [privyReady, privyAuthenticated]); // ✅ Only primitive dependencies

  // Track mount/unmount lifecycle
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, []); // ✅ No dependencies

  // ✅ FIX: Memoize the decision to prevent unnecessary re-renders
  const shouldRenderProvider = useMemo(() => {
    return isReady && !!jwtToken && !!backendUser?.id; // ✅ FIX: Also wait for userId
  }, [isReady, jwtToken, backendUser?.id]);

  // Don't render WebSocket provider if not ready
  if (!shouldRenderProvider) {
    return <>{children}</>;
  }

  console.log('🚀 WebSocket Provider: Initializing WebSocket connection');

  return (
    <WebSocketFirebaseProvider
      websocketUrl={websocketUrl}
      firebaseConfig={firebaseConfig}
      jwtToken={jwtToken!} // ✅ Non-null assertion - guaranteed by shouldRenderProvider check
      userId={backendUser?.id || null} // ✅ FIX: Pass userId from backend user
      enabled={true}
    >
      {children}
    </WebSocketFirebaseProvider>
  );
}

// Hook to check WebSocket Gateway configuration
export function useWebSocketGatewayStatus() {
  const hasFirebaseConfig = !!(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY && 
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  );
  
  const hasWebSocketUrl = !!process.env.NEXT_PUBLIC_WEBSOCKET_URL;
  const websocketUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:3008';
  
  return {
    isConfigured: hasFirebaseConfig && hasWebSocketUrl,
    hasFirebaseConfig,
    hasWebSocketUrl,
    websocketUrl,
    config: {
      websocketUrl,
      firebaseConfig: {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
        measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
      }
    }
  };
} 