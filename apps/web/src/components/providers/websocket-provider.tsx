'use client'

import React, { ReactNode, useEffect, useState, useRef, useMemo } from 'react';
import { WebSocketFirebaseProvider } from '@/contexts/websocket-firebase-context';
import { useAuth } from '@/hooks/use-auth';

interface WebSocketProviderWrapperProps {
  children: ReactNode;
}

export function WebSocketProviderWrapper({ children }: WebSocketProviderWrapperProps) {
  // ✅ OPTIMIZED: Only extract primitive values from useAuth to prevent excessive re-renders
  const { privyAuthenticated, ready: privyReady, backendUser, hasAccessToken } = useAuth();
  
  const [jwtToken, setJwtToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 🚀 OPTIMIZED: Reduced retry logic and faster connection
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const isMountedRef = useRef(true);
  const maxRetries = 3; // ✅ REDUCED: from 5 to 3 retries
  const hasTriedImmediateRef = useRef(false); // ✅ NEW: track immediate attempt
  const wrapperInstanceId = useRef(Math.random().toString(36).substr(2, 9));

  // ✅ OPTIMIZED: Memoize firebaseConfig to prevent useEffect re-runs
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

  // 🚀 OPTIMIZED: Always render provider to prevent component re-mounting
  // Instead of conditionally rendering, pass enabled state to provider
  const providerEnabled = useMemo(() => {
    return isReady && !!jwtToken;
  }, [isReady, jwtToken]);

  // 🚀 DEBUG: Log provider state changes
  console.log(`🔍 [WebSocketProviderWrapper-${wrapperInstanceId.current}] Provider render`, {
    privyReady,
    privyAuthenticated,
    hasJwtToken: !!jwtToken,
    isReady,
    providerEnabled,
    backendUserId: backendUser?.id || 'none'
  });

  // 🚀 DEBUG: Track key state changes
  useEffect(() => {
    console.log(`🔄 [WebSocketProviderWrapper-${wrapperInstanceId.current}] Auth state changed`, {
      privyReady,
      privyAuthenticated,
      hasAccessToken: hasAccessToken(),
      backendUserId: backendUser?.id || 'none'
    });
  }, [privyReady, privyAuthenticated, backendUser?.id, hasAccessToken]);

  useEffect(() => {
    console.log(`🔄 [WebSocketProviderWrapper-${wrapperInstanceId.current}] Provider enabled changed`, {
      providerEnabled,
      hasJwtToken: !!jwtToken,
      isReady
    });
  }, [providerEnabled, jwtToken, isReady]);

  // 🚀 OPTIMIZED: Immediate token check function using auth helper
  const checkTokenImmediately = () => {
    if (!isMountedRef.current) return false;
    
    // 🚀 OPTIMIZED: Use hasAccessToken helper for consistent checking
    if (hasAccessToken()) {
      const token = localStorage.getItem('accessToken');
      if (token) {
        console.log(`✅ [WebSocketProviderWrapper-${wrapperInstanceId.current}] JWT token found immediately`);
        setJwtToken(prev => prev !== token ? token : prev);
        setIsReady(prev => prev !== true ? true : prev);
        setError(prev => prev !== null ? null : prev);
        return true;
      }
    }
    return false;
  };

  // 🚀 OPTIMIZED: Simplified retry logic with faster delays
  const tryGetToken = () => {
    if (!isMountedRef.current) return;

    // Clear any existing timeout
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    // 🚀 OPTIMIZED: Use hasAccessToken helper for consistent checking
    if (hasAccessToken()) {
      const token = localStorage.getItem('accessToken');
      if (token) {
        console.log(`✅ [WebSocketProviderWrapper-${wrapperInstanceId.current}] JWT token found after retry`);
        if (isMountedRef.current) {
          setJwtToken(prev => prev !== token ? token : prev);
          setIsReady(prev => prev !== true ? true : prev);
          setError(prev => prev !== null ? null : prev);
          retryCountRef.current = 0;
        }
        return;
      }
    }

    // ✅ OPTIMIZED: Faster retry with reduced max attempts
    if (retryCountRef.current < maxRetries) {
      retryCountRef.current++;
      console.log(`🔄 [WebSocketProviderWrapper-${wrapperInstanceId.current}] JWT token not found, retrying... (${retryCountRef.current}/${maxRetries})`);
      
      // 🚀 OPTIMIZED: Much faster backoff - 100ms, 200ms, 400ms
      const delay = 100 * Math.pow(2, retryCountRef.current - 1);
      
      retryTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          tryGetToken();
        }
      }, delay);
    } else {
      console.warn(`⚠️ [WebSocketProviderWrapper-${wrapperInstanceId.current}] Max retries reached, but will continue in background`);
      // ✅ OPTIMIZED: Don't set error state, just log warning
      // This allows the component to still render and potentially recover
    }
  };

  // 🚀 OPTIMIZED: Simplified and faster connection logic
  useEffect(() => {
    if (!isMountedRef.current) return;

    // Clear any existing timeout
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    // ✅ OPTIMIZED: Early connection when Privy is ready and authenticated
    if (privyReady && privyAuthenticated) {
      console.log('🔐 WebSocket Provider: Privy authenticated, checking JWT token...');
      retryCountRef.current = 0;
      setError(prev => prev !== null ? null : prev);
      
      // 🚀 OPTIMIZED: Try immediate connection first
      if (!hasTriedImmediateRef.current) {
        hasTriedImmediateRef.current = true;
        
        // Try immediate token check
        if (checkTokenImmediately()) {
          return; // Success - no need to retry
        }
      }
      
      // If immediate check failed, start retry logic
      tryGetToken();
    } else {
      console.log('👤 WebSocket Provider: Privy not ready/authenticated, cleaning up...');
      // ✅ OPTIMIZED: Reset state when user logs out
      if (isMountedRef.current) {
        setJwtToken(prev => prev !== null ? null : prev);
        setIsReady(prev => prev !== false ? false : prev);
        setError(prev => prev !== null ? null : prev);
        retryCountRef.current = 0;
        hasTriedImmediateRef.current = false;
      }
    }
  }, [privyReady, privyAuthenticated, hasAccessToken]); // ✅ OPTIMIZED: Added hasAccessToken dependency

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
  }, []);

  // 🚀 OPTIMIZED: Eager connection - don't wait for backendUser
  const shouldRenderProvider = useMemo(() => {
    return isReady && !!jwtToken;
  }, [isReady, jwtToken]);

  // 🚀 CRITICAL FIX: Always render provider to prevent component re-mount
  // This prevents the duplicate API calls issue
  console.log(`🚀 [WebSocketProviderWrapper-${wrapperInstanceId.current}] Rendering with enabled=`, providerEnabled);

  return (
    <WebSocketFirebaseProvider
      websocketUrl={websocketUrl}
      firebaseConfig={firebaseConfig}
      jwtToken={jwtToken || ''} // Pass empty string if no token
      userId={backendUser?.id || null}
      enabled={providerEnabled} // Use enabled prop instead of conditional rendering
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