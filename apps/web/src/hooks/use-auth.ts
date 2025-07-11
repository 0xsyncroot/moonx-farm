'use client'

import { useState, useRef, useEffect } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { authApi } from '@/lib/api-client'
import { toast } from 'react-hot-toast'

export function useAuth() {
  const queryClient = useQueryClient()
  const { 
    ready: privyReady, 
    authenticated: privyAuthenticated, 
    user: privyUser, 
    login: privyLogin, 
    logout: privyLogout,
    getAccessToken
  } = usePrivy()

  const [isBackendAuthenticated, setIsBackendAuthenticated] = useState(false)
  
  // 🚀 OPTIMIZED: Prevent multiple concurrent login attempts - Use sessionStorage for persistence
  const loginAttemptRef = useRef(false)
  const effectCallCountRef = useRef(0) // Debug counter
  
  // Helper functions for session storage
  const getAttemptedUser = () => {
    if (typeof window === 'undefined') return null
    return sessionStorage.getItem('moonx_attempted_user')
  }
  
  const setAttemptedUser = (userId: string) => {
    if (typeof window === 'undefined') return
    sessionStorage.setItem('moonx_attempted_user', userId)
  }
  
  const clearAttemptedUser = () => {
    if (typeof window === 'undefined') return
    sessionStorage.removeItem('moonx_attempted_user')
  }

  // 🚀 OPTIMIZED: Faster token availability check
  const hasAccessToken = () => {
    if (typeof window === 'undefined') return false
    return !!localStorage.getItem('accessToken')
  }

  // Get current user from backend
  const { 
    data: backendUser, 
    isLoading: userLoading,
    error: userError 
  } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      try {
        const response = await authApi.getCurrentUser()
        // If verify succeeds, set backend as authenticated
        if (response.success && response.data?.user) {
          setIsBackendAuthenticated(true)
        }
        return response
      } catch (error) {
        // If verify fails, reset backend authentication
        setIsBackendAuthenticated(false)
        throw error
      }
    },
    enabled: (() => {
      // 🚀 OPTIMIZED: Use faster token check
      const enabled = privyReady && hasAccessToken()
      return enabled
    })(),
    retry: false,
    staleTime: 10 * 60 * 1000, // 10 minutes - longer cache
    refetchOnWindowFocus: false, // Don't refetch on focus
    refetchOnMount: true, // Allow refetch on mount to handle page refresh
  })

  // Backend login mutation
  const backendLoginMutation = useMutation({
    mutationFn: authApi.login,
    onMutate: () => {
      // 🚀 OPTIMIZED: Set authenticating state immediately
      console.log('🔄 Backend login started...')
    },
    onSuccess: (response) => {
      loginAttemptRef.current = false
      
      if (response.success) {
        console.log('✅ Backend login successful')
        // 🚀 OPTIMIZED: Smaller delay for faster response
        setTimeout(() => {
          setIsBackendAuthenticated(true)
          // 🚀 OPTIMIZED: Even smaller delay for token sync
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['currentUser'] })
          }, 25) // Reduced from 50ms to 25ms
        }, 50) // Reduced from 100ms to 50ms
      } else {
        console.error('❌ Backend login failed:', response)
        clearAttemptedUser() // Allow retry on failure
      }
    },
    onError: (error) => {
      loginAttemptRef.current = false
      clearAttemptedUser()
      console.error('❌ Backend login failed:', error)
      toast.error('Failed to connect to MoonX services')
    },
  })

  // Backend logout mutation
  const backendLogoutMutation = useMutation({
    mutationFn: authApi.logout,
    onMutate: () => {
      // Clear authentication state immediately to prevent any more verify calls
      setIsBackendAuthenticated(false)
      // Reset login attempt flags to allow fresh login next time  
      clearAttemptedUser()
      loginAttemptRef.current = false
    },
    onSuccess: () => {
      queryClient.clear()
    },
    onError: (error) => {
      console.error('❌ Backend logout failed:', error)
      // Still clear state even if logout API fails
      setIsBackendAuthenticated(false)
      queryClient.clear()
    },
  })

  // 🚀 OPTIMIZED: Simplified backend login logic
  useEffect(() => {
    effectCallCountRef.current += 1
    const attemptedUser = getAttemptedUser()

    // Early returns to prevent unnecessary execution
    if (!privyReady) return
    if (!privyAuthenticated || !privyUser) {
      // Reset attempt flags if user logged out
      clearAttemptedUser()
      return
    }
    if (isBackendAuthenticated) return
    if (attemptedUser === privyUser.id) return
    if (loginAttemptRef.current || backendLoginMutation.isPending) return
    
    // 🚀 OPTIMIZED: Skip login if we already have accessToken (let verify query handle it)
    if (hasAccessToken()) {
      console.log('🔄 Access token found, letting verify query handle authentication')
      return
    }

    // Mark that we've attempted login for this user - BEFORE async call
    setAttemptedUser(privyUser.id)

    const attemptBackendLogin = async () => {
      try {
        loginAttemptRef.current = true
        console.log('🚀 Attempting backend login...')
        
        const privyToken = await getAccessToken()
        if (privyToken) {
          await backendLoginMutation.mutateAsync(privyToken)
        } else {
          console.error('❌ No Privy token available')
          loginAttemptRef.current = false
        }
      } catch (error) {
        console.error('❌ Backend login failed:', error)
        loginAttemptRef.current = false
        clearAttemptedUser()
      }
    }

    attemptBackendLogin()
  }, [privyReady, privyAuthenticated, privyUser?.id, isBackendAuthenticated]) // ✅ OPTIMIZED: Added isBackendAuthenticated dependency

  // Handle backend logout when Privy logs out
  useEffect(() => {
    if (!privyReady) return
    
    // If Privy logged out, reset login attempt flags
    if (!privyAuthenticated) {
      clearAttemptedUser()
      loginAttemptRef.current = false
      
      // If backend still authenticated, logout from backend
      if (isBackendAuthenticated) {
        backendLogoutMutation.mutate()
      }
      
      // 🚀 OPTIMIZED: Clear localStorage tokens when logged out
      if (typeof window !== 'undefined') {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
      }
    }
  }, [privyReady, privyAuthenticated, isBackendAuthenticated])

  // Login function
  const login = async () => {
    try {
      console.log('🚀 Starting login flow...')
      await privyLogin()
      // Backend login will be handled by useEffect
    } catch (error) {
      console.error('Login failed:', error)
      toast.error('Login failed')
    }
  }

  // Logout function
  const logout = async () => {
    try {
      console.log('🚀 Starting logout flow...')
      // Logout from backend first
      if (isBackendAuthenticated) {
        await backendLogoutMutation.mutateAsync()
      }
      // Then logout from Privy
      await privyLogout()
    } catch (error) {
      console.error('Logout failed:', error)
      toast.error('Logout failed')
    }
  }

  // Get wallet info
  const getWalletInfo = () => {
    if (!privyUser?.wallet) return null

    return {
      address: privyUser.wallet.address,
      chainId: 8453,
      walletClientType: privyUser.wallet.walletClientType,
    }
  }

  // Check if user has wallet
  const hasWallet = Boolean(privyUser?.wallet)

  // 🚀 OPTIMIZED: Combined authentication status - more permissive during login
  const isAuthenticated = privyAuthenticated && (isBackendAuthenticated || backendLoginMutation.isPending)

  // 🚀 OPTIMIZED: Simplified loading states
  const isLoading = !privyReady || 
                   backendLoginMutation.isPending || 
                   backendLogoutMutation.isPending ||
                   (privyAuthenticated && !isBackendAuthenticated && !backendLoginMutation.isPending && !hasAccessToken())

  return {
    // Authentication status
    isAuthenticated,
    isBackendAuthenticated,
    privyAuthenticated,
    hasWallet,
    isLoading,

    // User data
    privyUser,
    backendUser: backendUser?.data?.user,
    walletInfo: getWalletInfo(),

    // Functions
    login,
    logout,

    // Error states
    error: userError || backendLoginMutation.error || backendLogoutMutation.error,

    // Utility
    ready: privyReady,
    
    // 🚀 OPTIMIZED: Additional helper for WebSocket
    hasAccessToken,
  }
} 