'use client'

import { useState, useRef, useEffect } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { authApi } from '@/lib/api-client'
import { toast } from 'react-hot-toast'

interface BackendUser {
  id: string
  privyUserId: string
  email?: string
  walletAddress?: string
  displayName?: string
  profileImage?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

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
    queryFn: () => {
      console.log('🤖 Query: getCurrentUser function called')
      return authApi.getCurrentUser()
    },
    enabled: (() => {
      const enabled = isBackendAuthenticated && privyReady && typeof window !== 'undefined' && !!localStorage.getItem('accessToken')
      console.log('🔍 Query enabled check:', {
        isBackendAuthenticated,
        privyReady,
        isClient: typeof window !== 'undefined',
        hasStoredToken: typeof window !== 'undefined' ? !!localStorage.getItem('accessToken') : false,
        enabled
      })
      return enabled
    })(),
    retry: false,
    staleTime: 10 * 60 * 1000, // 10 minutes - longer cache
    refetchOnWindowFocus: false, // Don't refetch on focus
    refetchOnMount: false, // Don't refetch on mount if data exists
  })

  // Backend login mutation
  const backendLoginMutation = useMutation({
    mutationFn: authApi.login,
    onMutate: () => {
      console.log('🚀 Backend login mutation started')
    },
    onSuccess: (response) => {
      loginAttemptRef.current = false
      console.log('📋 Backend login response received:', {
        success: response.success,
        hasData: !!response.data,
        dataKeys: response.data ? Object.keys(response.data) : [],
        hasAccessToken: !!(response.data?.accessToken),
        message: response.message
      })
      
      if (response.success) {
        console.log('✅ Backend login successful - setting authenticated state')
        // Small delay to ensure tokens are set in ApiClient
        setTimeout(() => {
          console.log('🎯 Setting backend authenticated state and invalidating queries')
          setIsBackendAuthenticated(true)
          // Additional delay to ensure tokens are fully set
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['currentUser'] })
          }, 50)
        }, 100)
        toast.success('Successfully connected to MoonX!')
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
      console.log('✅ Backend logout successful')
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
    
    console.log(`🔄 [CALL #${effectCallCountRef.current}] Backend login useEffect triggered:`, {
      privyReady,
      privyAuthenticated,
      hasPrivyUser: !!privyUser,
      privyUserId: privyUser?.id,
      isBackendAuthenticated,
      attemptedUser,
      loginInProgress: loginAttemptRef.current,
      mutationPending: backendLoginMutation.isPending
    })

    // Early returns to prevent unnecessary execution
    if (!privyReady) {
      console.log('⏭️ Skipping: Privy not ready')
      return
    }
    if (!privyAuthenticated || !privyUser) {
      console.log('⏭️ Skipping: Not authenticated or no user')
      // Reset attempt flags if user logged out
      clearAttemptedUser()
      return
    }
    if (isBackendAuthenticated) {
      console.log('⏭️ Skipping: Already backend authenticated')
      return
    }
    if (attemptedUser === privyUser.id) {
      console.log('⏭️ [GUARD SUCCESS] Skipping: Already attempted login for this user:', privyUser.id)
      return
    }
    if (loginAttemptRef.current || backendLoginMutation.isPending) {
      console.log('⏭️ Skipping: Login currently in progress')
      return
    }

    // Mark that we've attempted login for this user - BEFORE async call
    setAttemptedUser(privyUser.id)
    console.log('🎯 Proceeding with backend login attempt for user:', privyUser.id)

    const attemptBackendLogin = async () => {
      try {
        loginAttemptRef.current = true
        console.log('🔐 [SINGLE ATTEMPT] Backend login for user:', privyUser.id)
        
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
        console.log('🚪 Privy logged out, logging out from backend...')
        backendLogoutMutation.mutate()
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
      chainId: privyUser.wallet.chainId || 1,
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
    backendUser: backendUser?.data,
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