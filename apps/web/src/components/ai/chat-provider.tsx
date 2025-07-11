'use client'

import { createContext, useContext, useState, ReactNode, useRef, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { ChatApiService } from '@/services/chat-api'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  type?: 'text' | 'suggestion' | 'action'
  metadata?: {
    tradingPair?: string
    chainId?: number
    txHash?: string
    amount?: string
  }
}

interface ChatContextType {
  messages: ChatMessage[]
  isLoading: boolean
  isOpen: boolean
  isWalkerEnabled: boolean
  conversationId: string
  setIsOpen: (open: boolean) => void
  setIsWalkerEnabled: (enabled: boolean) => void
  sendMessage: (content: string, context?: Record<string, unknown>) => Promise<void>
  clearChat: () => void
  startNewConversation: () => void
  addSystemMessage: (content: string) => void
  stopGeneration: () => void
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

interface ChatProviderProps {
  children: ReactNode
}

export function ChatProvider({ children }: ChatProviderProps) {
  const { privyUser, isAuthenticated } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isWalkerEnabled, setIsWalkerEnabled] = useState(true)
  const chatApiService = useRef<ChatApiService>()
  const [conversationId, setConversationId] = useState('')
  
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: isAuthenticated 
        ? `Welcome back! I'm Lili, your friendly DeFi assistant at MoonX Farm! ✨ I can help you with trading, portfolio management, and DeFi questions. What would you like to explore today?`
        : `Hello! I'm Lili, your friendly DeFi assistant! 🌟 I can help you understand MoonX Farm's features, guide you through trading, or answer DeFi questions. Connect your wallet to get personalized assistance!`,
      timestamp: new Date(),
      type: 'text'
    }
  ])

  // Initialize chat API service
  useEffect(() => {
    const userId = isAuthenticated ? (privyUser?.wallet?.address || privyUser?.id || 'authenticated_user') : 'anonymous'
    const userName = isAuthenticated ? (privyUser?.wallet?.address || 'Authenticated User') : 'Anonymous User'
    
    chatApiService.current = new ChatApiService(userId, userName)
    setConversationId(chatApiService.current.getConversationId())

    return () => {
      chatApiService.current?.destroy()
    }
  }, [isAuthenticated, privyUser])

  // Update user info when authentication changes
  useEffect(() => {
    if (chatApiService.current) {
      const userId = isAuthenticated ? (privyUser?.wallet?.address || privyUser?.id || 'authenticated_user') : 'anonymous'
      const userName = isAuthenticated ? (privyUser?.wallet?.address || 'Authenticated User') : 'Anonymous User'
      chatApiService.current.updateUserInfo(userId, userName)
    }
  }, [isAuthenticated, privyUser])

  const sendMessage = async (content: string, context?: Record<string, unknown>) => {
    if (!content.trim() || isLoading || !chatApiService.current) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
      type: 'text'
    }

    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)

    // Add placeholder for AI response that will be updated with streaming content
    const aiMessageId = (Date.now() + 1).toString()
    const aiMessage: ChatMessage = {
      id: aiMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      type: 'text'
    }

    setMessages(prev => [...prev, aiMessage])

    try {
      await chatApiService.current.sendMessage(
        content.trim(),
        // On progress (streaming content)
        (streamContent: string) => {
          setMessages(prev => 
            prev.map(msg => 
              msg.id === aiMessageId 
                ? { ...msg, content: streamContent }
                : msg
            )
          )
        },
        // On complete
        (finalContent: string) => {
          setMessages(prev => 
            prev.map(msg => 
              msg.id === aiMessageId 
                ? { ...msg, content: finalContent }
                : msg
            )
          )
          setIsLoading(false)
        },
        // On error
        (error: Error, shouldStartNew?: boolean) => {
          console.error('Chat API Error:', error)
          
          if (shouldStartNew) {
            // Remove the failed AI message and add error message with new conversation suggestion
            setMessages(prev => 
              prev.filter(msg => msg.id !== aiMessageId).concat([{
                id: Date.now().toString(),
                role: 'assistant',
                content: `${error.message} I've started a fresh conversation for you. Please try your question again! ✨`,
                timestamp: new Date(),
                type: 'text'
              }])
            )
            startNewConversation()
          } else {
            // Update the AI message with error content
            setMessages(prev => 
              prev.map(msg => 
                msg.id === aiMessageId 
                  ? { ...msg, content: `Sorry, ${error.message} Please try again! 💙` }
                  : msg
              )
            )
          }
          setIsLoading(false)
        },
        // Pass context for API
        context
      )
    } catch (error) {
      console.error('Unexpected error:', error)
      setMessages(prev => 
        prev.map(msg => 
          msg.id === aiMessageId 
            ? { ...msg, content: 'Oops! Something unexpected happened. Please try again! 💙' }
            : msg
        )
      )
      setIsLoading(false)
    }
  }

  const clearChat = () => {
    setMessages([
      {
        id: 'welcome-reset',
        role: 'assistant',
        content: 'Chat cleared! I\'m Lili, ready to help you with anything DeFi-related! ✨ What would you like to know?',
        timestamp: new Date(),
        type: 'text'
      }
    ])
  }

  const startNewConversation = () => {
    if (chatApiService.current) {
      chatApiService.current.startNewConversation()
      setConversationId(chatApiService.current.getConversationId())
    }
    clearChat()
  }

  const stopGeneration = () => {
    if (chatApiService.current) {
      chatApiService.current.stopRequest()
      setIsLoading(false)
    }
  }

  const addSystemMessage = (content: string) => {
    const systemMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'system',
      content,
      timestamp: new Date(),
      type: 'text'
    }
    setMessages(prev => [...prev, systemMessage])
  }

  const value: ChatContextType = {
    messages,
    isLoading,
    isOpen,
    isWalkerEnabled,
    conversationId,
    setIsOpen,
    setIsWalkerEnabled,
    sendMessage,
    clearChat,
    startNewConversation,
    addSystemMessage,
    stopGeneration
  }

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChat() {
  const context = useContext(ChatContext)
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider')
  }
  return context
}

 