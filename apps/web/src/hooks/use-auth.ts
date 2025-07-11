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
  
  // Prevent multiple concurrent login attempts - Use sessionStorage for persistence
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
      // Call verify if we have accessToken, regardless of isBackendAuthenticated
      const enabled = privyReady && typeof window !== 'undefined' && !!localStorage.getItem('accessToken')
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
    },
    onSuccess: (response) => {
      loginAttemptRef.current = false
      
      if (response.success) {
        // Small delay to ensure tokens are set in ApiClient
        setTimeout(() => {
          setIsBackendAuthenticated(true)
          // Additional delay to ensure tokens are fully set
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['currentUser'] })
          }, 50)
        }, 100)
      } else {
        console.error('❌ Backend login failed:', response)
        clearAttemptedUser() // Allow retry on failure
      }
    },
    onError: (error) => {
      loginAttemptRef.current = false
      // Reset user attempt on error to allow retry
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

  // Handle backend login when Privy authenticates - SIMPLIFIED SINGLE EFFECT
  useEffect(() => {
    effectCallCountRef.current += 1
    const attemptedUser = getAttemptedUser()

    // Early returns to prevent unnecessary execution
    if (!privyReady) {
      return
    }
    if (!privyAuthenticated || !privyUser) {
      // Reset attempt flags if user logged out
      clearAttemptedUser()
      return
    }
    if (isBackendAuthenticated) {
      return
    }
    if (attemptedUser === privyUser.id) {
      return
    }
    if (loginAttemptRef.current || backendLoginMutation.isPending) {
      return
    }
    // Skip login if we already have accessToken (let verify query handle it)
    if (typeof window !== 'undefined' && localStorage.getItem('accessToken')) {
      return
    }

    // Mark that we've attempted login for this user - BEFORE async call
    setAttemptedUser(privyUser.id)

    const attemptBackendLogin = async () => {
      try {
        loginAttemptRef.current = true
        
        const privyToken = await getAccessToken()
        if (privyToken) {
          await backendLoginMutation.mutateAsync(privyToken)
        } else {
          console.error('❌ No Privy token available')
          loginAttemptRef.current = false
          // Don't reset attempt for no token case - user-specific issue
        }
      } catch (error) {
        console.error('❌ Backend login failed:', error)
        loginAttemptRef.current = false
        // Reset attempt flags on error to allow retry if user logs out and back in
        clearAttemptedUser()
      }
    }

    attemptBackendLogin()
  }, [privyReady, privyAuthenticated, privyUser?.id]) // Simplified dependencies

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
      
      // Clear localStorage tokens when logged out
      if (typeof window !== 'undefined') {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
      }
    }
  }, [privyReady, privyAuthenticated, isBackendAuthenticated])

  // Login function
  const login = async () => {
    try {
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

  // Combined authentication status
  const isAuthenticated = privyAuthenticated && isBackendAuthenticated

  // Loading states
  const isLoading = !privyReady || 
                   backendLoginMutation.isPending || 
                   backendLogoutMutation.isPending ||
                   (isBackendAuthenticated && userLoading)

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
  }
} 