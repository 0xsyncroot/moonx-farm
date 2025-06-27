'use client'

import { useEffect, useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
  const [isInitialized, setIsInitialized] = useState(false)

  // Get current user from backend
  const { 
    data: backendUser, 
    isLoading: userLoading,
    error: userError 
  } = useQuery({
    queryKey: ['currentUser'],
    queryFn: authApi.getCurrentUser,
    enabled: isBackendAuthenticated,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Backend login mutation
  const backendLoginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (response) => {
      if (response.success) {
        setIsBackendAuthenticated(true)
        queryClient.invalidateQueries({ queryKey: ['currentUser'] })
        toast.success('Successfully connected to MoonX!')
      }
    },
    onError: (error) => {
      console.error('Backend login failed:', error)
      toast.error('Failed to connect to MoonX services')
    },
  })

  // Backend logout mutation
  const backendLogoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      setIsBackendAuthenticated(false)
      queryClient.clear()
    },
  })

  // Handle Privy authentication changes
  useEffect(() => {
    const handleAuth = async () => {
      if (!privyReady) return

      if (privyAuthenticated && privyUser) {
        try {
          // Get Privy access token
          const privyToken = await getAccessToken()
          if (privyToken) {
            // Login to backend with Privy token
            await backendLoginMutation.mutateAsync(privyToken)
          }
        } catch (error) {
          console.error('Auth integration failed:', error)
          toast.error('Authentication failed')
        }
      } else {
        // User logged out from Privy
        if (isBackendAuthenticated) {
          await backendLogoutMutation.mutateAsync()
        }
      }

      setIsInitialized(true)
    }

    handleAuth()
  }, [privyReady, privyAuthenticated, privyUser])

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
                   !isInitialized || 
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
    isInitialized,

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
    ready: privyReady && isInitialized,
  }
} 