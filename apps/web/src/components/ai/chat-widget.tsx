'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { MessageCircle, X, Send, User, Sparkles, TrendingUp, Wallet, HelpCircle, Settings, Square, RotateCcw, Sun, Moon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { useChat } from './chat-provider'
import { LiliAvatar } from './lili-avatar'
import ReactMarkdown from 'react-markdown'

// Typing Animation Component (replaces "Lili is thinking...")
const TypingAnimation = ({ isDark }: { isDark: boolean }) => (
  <div className="flex items-center gap-0.5">
    <div className={cn("w-1 h-1 rounded-full animate-bounce", isDark ? "bg-gray-300" : "bg-gray-600")} style={{ animationDelay: '0ms' }}></div>
    <div className={cn("w-1 h-1 rounded-full animate-bounce", isDark ? "bg-gray-300" : "bg-gray-600")} style={{ animationDelay: '150ms' }}></div>
    <div className={cn("w-1 h-1 rounded-full animate-bounce", isDark ? "bg-gray-300" : "bg-gray-600")} style={{ animationDelay: '300ms' }}></div>
  </div>
)

// Typewriter Effect Component for character-by-character animation
const TypewriterText: React.FC<{ 
  text: string; 
  speed?: number; 
  onComplete?: () => void;
  isStreaming?: boolean;
  isDark?: boolean;
}> = ({ text, speed = 40, onComplete, isStreaming = false, isDark = true }) => {
  const [displayedText, setDisplayedText] = useState('')
  const [showCursor, setShowCursor] = useState(false)
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const currentTextRef = useRef('')
  const typingIndexRef = useRef(0)

  // Clear any existing timeout
  const clearTyping = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  // Start typing animation
  const startTyping = useCallback((targetText: string, fromIndex: number = 0) => {
    clearTyping()
    
    if (!targetText) {
      setDisplayedText('')
      setShowCursor(false)
      return
    }

    typingIndexRef.current = fromIndex
    setShowCursor(true)

    const typeChar = () => {
      if (typingIndexRef.current < targetText.length) {
        typingIndexRef.current++
        setDisplayedText(targetText.slice(0, typingIndexRef.current))
        timeoutRef.current = setTimeout(typeChar, speed)
      } else {
        setShowCursor(false)
        onComplete?.()
      }
    }

    // Start immediately if at beginning, small delay if continuing
    const delay = fromIndex === 0 ? 0 : speed
    timeoutRef.current = setTimeout(typeChar, delay)
  }, [speed, onComplete, clearTyping])

  // Handle text changes
  useEffect(() => {
    if (!text) {
      clearTyping()
      setDisplayedText('')
      setShowCursor(false)
      currentTextRef.current = ''
      typingIndexRef.current = 0
      return
    }

    const prevText = currentTextRef.current
    currentTextRef.current = text

    // If completely new text or not streaming - start from beginning
    if (!isStreaming || !prevText || !text.startsWith(prevText)) {
      typingIndexRef.current = 0
      setDisplayedText('')
      startTyping(text, 0)
    }
    // If streaming and text is extended - continue from current position
    else if (text.length > prevText.length && typingIndexRef.current >= prevText.length) {
      startTyping(text, typingIndexRef.current)
    }
  }, [text, isStreaming, startTyping])

  // Cleanup on unmount
  useEffect(() => {
    return clearTyping
  }, [clearTyping])



  // If streaming and no text yet, show typing animation instead of empty markdown
  if (isStreaming && !displayedText) {
    return (
      <div className="flex items-center py-1">
        <TypingAnimation isDark={isDark} />
      </div>
    )
  }

  const textColor = isDark ? 'text-gray-100' : 'text-gray-800'
  const strongColor = isDark ? 'text-white' : 'text-gray-900'
  const emColor = isDark ? 'text-gray-200' : 'text-gray-700'
  const codeColor = isDark ? 'text-orange-200' : 'text-orange-800'
  const codeBg = isDark ? 'bg-[#ff7842]/20' : 'bg-orange-100'
  const codeBorder = isDark ? 'border-[#ff7842]/30' : 'border-orange-300'
  const preBg = isDark ? 'bg-gray-800' : 'bg-gray-100'
  const preBorder = isDark ? 'border-gray-600' : 'border-gray-300'
  const preText = isDark ? 'text-gray-200' : 'text-gray-800'
  const blockquoteBorder = isDark ? 'border-[#ff7842]' : 'border-orange-500'
  const blockquoteBg = isDark ? 'bg-[#ff7842]/5' : 'bg-orange-50'
  const blockquoteText = isDark ? 'text-gray-200' : 'text-gray-700'
  const hrBorder = isDark ? 'border-gray-600' : 'border-gray-300'

  return (
    <div className={cn("max-w-none text-xs", textColor)}>
      <ReactMarkdown
        components={{
          // Custom styles for markdown elements
          p: ({ children }) => <p className={cn("mb-2 last:mb-0", textColor)}>{children}</p>,
          strong: ({ children }) => <strong className={cn("font-bold", strongColor)}>{children}</strong>,
          em: ({ children }) => <em className={cn("italic", emColor)}>{children}</em>,
          ul: ({ children }) => <ul className={cn("list-disc list-inside mb-2 space-y-1", textColor)}>{children}</ul>,
          ol: ({ children }) => <ol className={cn("list-decimal list-inside mb-2 space-y-1", textColor)}>{children}</ol>,
          li: ({ children }) => <li className={cn("text-xs", textColor)}>{children}</li>,
          code: ({ children }) => (
            <code className={cn(codeBg, codeColor, codeBorder, "px-1.5 py-0.5 rounded text-[11px] font-mono border")}>{children}</code>
          ),
          pre: ({ children }) => (
            <pre className={cn(preBg, preBorder, preText, "border p-3 rounded-lg text-[11px] font-mono overflow-x-auto")}>{children}</pre>
          ),
          h1: ({ children }) => <h1 className={cn("text-sm font-bold mb-2", strongColor)}>{children}</h1>,
          h2: ({ children }) => <h2 className={cn("text-sm font-semibold mb-2", strongColor)}>{children}</h2>,
          h3: ({ children }) => <h3 className={cn("text-xs font-semibold mb-1", emColor)}>{children}</h3>,
          blockquote: ({ children }) => (
            <blockquote className={cn("border-l-3 pl-3 my-2 py-1", blockquoteBorder, blockquoteBg, blockquoteText)}>{children}</blockquote>
          ),
          hr: () => <hr className={cn("my-3", hrBorder)} />
        }}
      >
        {displayedText}
      </ReactMarkdown>
      {showCursor && displayedText && (
        <span className="inline-block w-[2px] h-3 bg-[#ff7842] ml-[1px] animate-pulse"></span>
      )}
    </div>
  )
}

interface ChatWidgetProps {
  className?: string
}

export function ChatWidget({ className }: ChatWidgetProps) {
  const { messages, isLoading, isOpen, setIsOpen, sendMessage, isWalkerEnabled, setIsWalkerEnabled, conversationId, startNewConversation, stopGeneration } = useChat()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [inputValue, setInputValue] = useState('')
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  
  // Scroll state management
  const [isUserScrolling, setIsUserScrolling] = useState(false)
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastScrollTop = useRef(0)
  const isScrollingProgrammatically = useRef(false)

  // Wait until mounted to avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Get current theme (light/dark) - resolvedTheme handles 'system' automatically
  const isDarkMode = mounted ? resolvedTheme === 'dark' : true

  // Smooth scroll to bottom function
  const scrollToBottom = useCallback((force = false) => {
    if (!messagesEndRef.current || !messagesContainerRef.current) return
    
    // Check if user is near bottom (within 100px)
    const container = messagesContainerRef.current
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100
    
    if (force || (!isUserScrolling && (shouldAutoScroll || isNearBottom))) {
      isScrollingProgrammatically.current = true
      
      // Use smooth scrolling with proper behavior
      messagesEndRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'end',
        inline: 'nearest'
      })
      
      // Reset programmatic scroll flag after animation
      setTimeout(() => {
        isScrollingProgrammatically.current = false
      }, 500)
    }
  }, [isUserScrolling, shouldAutoScroll])

  // Throttled scroll handler
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current || isScrollingProgrammatically.current) return
    
    const container = messagesContainerRef.current
    const { scrollTop, scrollHeight, clientHeight } = container
    
    // Detect if user is scrolling manually
    if (Math.abs(scrollTop - lastScrollTop.current) > 1) {
      setIsUserScrolling(true)
      
      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
      
      // Reset user scrolling after delay
      scrollTimeoutRef.current = setTimeout(() => {
        setIsUserScrolling(false)
      }, 1000)
    }
    
    // Update auto-scroll state based on position
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50
    setShouldAutoScroll(isAtBottom)
    
    lastScrollTop.current = scrollTop
  }, [])

  // Debounced scroll event listener
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return

    let timeoutId: NodeJS.Timeout
    const debouncedHandleScroll = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(handleScroll, 50)
    }

    container.addEventListener('scroll', debouncedHandleScroll, { passive: true })
    
    return () => {
      container.removeEventListener('scroll', debouncedHandleScroll)
      clearTimeout(timeoutId)
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [handleScroll])

  // Auto-scroll when messages change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      scrollToBottom()
    }, 100)
    
    return () => clearTimeout(timeoutId)
  }, [messages, scrollToBottom])

  // Smoother auto-scroll during loading with intervals
  useEffect(() => {
    if (!isLoading) return

    const intervalId = setInterval(() => {
      if (shouldAutoScroll) {
        scrollToBottom()
      }
    }, 200)
    
    return () => clearInterval(intervalId)
  }, [isLoading, shouldAutoScroll, scrollToBottom])

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return
    
    const messageToSend = inputValue.trim()
    setInputValue('') // Clear input immediately
    
    try {
      await sendMessage(messageToSend)
    } catch (error) {
      console.error('Error sending message:', error)
      // Input is already cleared, so user can retry
    }
    
    // Focus back to input after sending
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus()
      }
    }, 100)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const quickSuggestions = [
    { 
      icon: TrendingUp, 
      text: 'How to start trading?', 
      query: 'How do I start trading on MoonX Farm? Explain the steps from connecting wallet to making my first swap.',
      context: 'User is asking about getting started with DeFi trading on MoonX Farm platform. MoonX Farm is a DeFi trading platform with Account Abstraction, smart wallets, gasless transactions, session keys for automation, and multi-chain support (Base, BSC, Ethereum, Polygon, Arbitrum). Guide them through wallet connection and first swap process.'
    },
    { 
      icon: Wallet, 
      text: 'Smart wallets & gasless trading', 
      query: 'What are smart wallets and how does gasless trading work on MoonX Farm?',
      context: 'User wants to understand MoonX Farm Account Abstraction technology. MoonX Farm uses ZeroDev Account Abstraction for smart wallets that enable gasless transactions, social login, and enhanced security. Explain how users can trade without holding native tokens for gas fees.'
    },
    { 
      icon: Settings, 
      text: 'Session keys for automation', 
      query: 'How do session keys work and how can I set up automated trading?',
      context: 'User is interested in MoonX Farm session key feature for automated DeFi trading. Session keys allow users to pre-authorize specific trading actions without signing every transaction, enabling automated strategies like DCA, limit orders, and stop-loss. Explain the setup process and security benefits.'
    },
    { 
      icon: HelpCircle, 
      text: 'Supported chains & fees', 
      query: 'What blockchains does MoonX Farm support and what are the trading fees?',
      context: 'User wants to know about MoonX Farm multi-chain support and fee structure. MoonX Farm supports Base, BSC, Ethereum, Polygon, and Arbitrum networks. Explain the benefits of each chain, gas optimization features, and competitive trading fees compared to traditional DEXs.'
    }
  ]

  const handleSuggestionClick = async (query: string, context: string) => {
    if (isLoading) return
    
    // Gửi message với enhanced system context để AI hiểu rõ về MoonX Farm
    const enhancedContext = `You are Lili, AI assistant for MoonX Farm DeFi trading platform. ${context}. Always provide accurate information specific to MoonX Farm's features and capabilities. Current platform info: Jupiter-inspired UI, Account Abstraction with ZeroDev, multi-chain DEX aggregation, session-based automation.`
    
    await sendMessage(query, { 
      systemContext: enhancedContext,
      platform: 'MoonX Farm DeFi Trading Platform',
      type: 'suggestion_question',
      features: ['Account Abstraction', 'Smart Wallets', 'Gasless Trading', 'Session Keys', 'Multi-chain Support', 'Automated Trading'],
      chains: ['Base', 'BSC', 'Ethereum', 'Polygon', 'Arbitrum']
    })
  }

  // Theme-based class helpers
  const getThemeClasses = () => {
    if (isDarkMode) {
      return {
        container: 'bg-gray-900/95 border-white/10',
        header: 'border-white/10 bg-gradient-to-r from-[#ff7842]/10 to-[#ff4d00]/10',
        headerText: 'text-white',
        headerSubtext: 'text-gray-400',
        avatar: 'bg-gradient-to-br from-[#ff7842]/20 to-[#ff4d00]/20 border-[#ff7842]/30',
        button: 'hover:bg-white/10 text-gray-400',
        buttonHover: 'group-hover:text-white',
        welcomeText: 'text-gray-300',
        suggestion: 'bg-white/5 hover:bg-white/10 border-white/10 text-gray-200 hover:text-white hover:border-[#ff7842]/30',
        userMessage: 'bg-[#ff7842] text-white',
        assistantMessage: 'bg-white/5 text-white border-white/10',
        systemMessage: 'bg-blue-500/20 text-blue-200 border-blue-500/30',
        typingContainer: 'bg-white/5 text-white border-white/10',
        input: 'bg-white/5 border-white/10 text-white placeholder-gray-300 focus:ring-2 focus:ring-[#ff7842]/50 focus:border-[#ff7842]/50',
        inputContainer: 'border-white/10 bg-gray-900/50',
        stopButton: 'bg-red-500/20 hover:bg-red-500/30 text-red-300',
        floatingButton: 'bg-gradient-to-br from-[#ff7842] to-[#ff4d00] hover:from-[#ff7842]/90 hover:to-[#ff4d00]/90'
      }
    } else {
      return {
        container: 'bg-white/95 border-gray-200',
        header: 'border-gray-200 bg-gradient-to-r from-orange-50 to-orange-100',
        headerText: 'text-gray-900',
        headerSubtext: 'text-gray-600',
        avatar: 'bg-gradient-to-br from-orange-100 to-orange-200 border-orange-300',
        button: 'hover:bg-gray-100 text-gray-600',
        buttonHover: 'group-hover:text-gray-900',
        welcomeText: 'text-gray-700',
        suggestion: 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700 hover:text-gray-900 hover:border-orange-300',
        userMessage: 'bg-[#ff7842] text-white',
        assistantMessage: 'bg-gray-50 text-gray-900 border-gray-200',
        systemMessage: 'bg-blue-50 text-blue-800 border-blue-200',
        typingContainer: 'bg-gray-50 text-gray-900 border-gray-200',
        input: 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-[#ff7842]/50 focus:border-[#ff7842]/50',
        inputContainer: 'border-gray-200 bg-white/50',
        stopButton: 'bg-red-50 hover:bg-red-100 text-red-600',
        floatingButton: 'bg-gradient-to-br from-[#ff7842] to-[#ff4d00] hover:from-[#ff7842]/90 hover:to-[#ff4d00]/90'
      }
    }
  }

  const themeClasses = getThemeClasses()

  return (
    <div className={cn("fixed bottom-4 right-4 z-50", className)}>
      {/* Chat Interface */}
      {isOpen && (
        <div className={cn(
          "mb-4 w-80 sm:w-96 h-[500px] max-h-[80vh] backdrop-blur-xl rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-2 duration-200",
          themeClasses.container
        )}>
          {/* Header */}
          <div className={cn("p-4 border-b", themeClasses.header)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center border", themeClasses.avatar)}>
                  <LiliAvatar size="sm" isAnimated={true} />
                </div>
                <div>
                  <h3 className={cn("text-sm font-medium", themeClasses.headerText)}>Lili</h3>
                  <p className={cn("text-xs", themeClasses.headerSubtext)}>Your friendly DeFi assistant</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className={cn("p-1 rounded-lg transition-colors group", themeClasses.button)}
                  title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
                >
                  {isDarkMode ? (
                    <Sun className={cn("w-3 h-3", themeClasses.button, themeClasses.buttonHover)} />
                  ) : (
                    <Moon className={cn("w-3 h-3", themeClasses.button, themeClasses.buttonHover)} />
                  )}
                </button>
                <button
                  onClick={() => setIsWalkerEnabled(!isWalkerEnabled)}
                  className={cn("p-1 rounded-lg transition-colors group", themeClasses.button)}
                  title={isWalkerEnabled ? "Disable Lili walker" : "Enable Lili walker"}
                >
                  <div className="text-xs">
                    {isWalkerEnabled ? "🚶‍♀️" : "⏸️"}
                  </div>
                </button>
                <button
                  onClick={startNewConversation}
                  className={cn("p-1 rounded-lg transition-colors group", themeClasses.button)}
                  title="Start new conversation"
                >
                  <RotateCcw className={cn("w-3 h-3", themeClasses.button, themeClasses.buttonHover)} />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className={cn("p-1 rounded-lg transition-colors", themeClasses.button)}
                >
                  <X className={cn("w-4 h-4", themeClasses.button)} />
                </button>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div 
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent"
          >
            {/* Welcome Message when no messages */}
            {messages.length === 0 && !isLoading && (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4">
                  <LiliAvatar size="lg" isAnimated={true} />
                </div>
                <p className={cn("text-xs mb-6", themeClasses.welcomeText)}>
                  Hi! I'm Lili, your AI assistant for MoonX Farm - a DeFi trading platform with smart wallets, gasless transactions, and automated trading. How can I help you today?
                </p>
                
                                 {/* Quick suggestions for first time users */}
                 <div className="space-y-2">
                   <p className={cn("text-xs font-medium", themeClasses.welcomeText)}>Quick suggestions:</p>
                  <div className="grid grid-cols-1 gap-2">
                    {quickSuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => handleSuggestionClick(suggestion.query, suggestion.context)}
                        className={cn(
                          "flex items-center gap-2 p-2 border rounded-lg text-xs transition-all duration-200 text-left disabled:opacity-50 disabled:cursor-not-allowed",
                          themeClasses.suggestion
                        )}
                        disabled={isLoading}
                      >
                        <suggestion.icon className="w-3 h-3 text-[#ff7842]" />
                        {suggestion.text}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {messages.map((message, index) => {
              const isLastMessage = index === messages.length - 1
              const isLastAssistantMessage = message.role === 'assistant' && isLastMessage
              
              return (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-2 animate-in fade-in duration-200",
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {message.role === 'assistant' && (
                    <div className={cn("w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-1 border", themeClasses.avatar)}>
                      <LiliAvatar size="xs" isAnimated={true} />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[80%] p-3 rounded-lg leading-relaxed",
                      message.role === 'user'
                        ? themeClasses.userMessage
                        : message.role === 'system'
                        ? cn(themeClasses.systemMessage, "border")
                        : cn(themeClasses.assistantMessage, "border")
                    )}
                  >
                    {message.role === 'user' ? (
                      <div className="text-xs whitespace-pre-wrap text-white">{message.content}</div>
                    ) : (
                      // Welcome messages và system messages hiển thị ngay, không cần animation
                      message.id.includes('welcome') || message.role === 'system' ? (
                        <div className={cn("max-w-none text-xs", isDarkMode ? "text-gray-100" : "text-gray-800")}>
                          <ReactMarkdown
                            components={{
                              p: ({ children }) => <p className={cn("mb-2 last:mb-0", isDarkMode ? "text-gray-100" : "text-gray-800")}>{children}</p>,
                              strong: ({ children }) => <strong className={cn("font-bold", isDarkMode ? "text-white" : "text-gray-900")}>{children}</strong>,
                              em: ({ children }) => <em className={cn("italic", isDarkMode ? "text-gray-200" : "text-gray-700")}>{children}</em>,
                              ul: ({ children }) => <ul className={cn("list-disc list-inside mb-2 space-y-1", isDarkMode ? "text-gray-100" : "text-gray-800")}>{children}</ul>,
                              ol: ({ children }) => <ol className={cn("list-decimal list-inside mb-2 space-y-1", isDarkMode ? "text-gray-100" : "text-gray-800")}>{children}</ol>,
                              li: ({ children }) => <li className={cn("text-xs", isDarkMode ? "text-gray-100" : "text-gray-800")}>{children}</li>,
                              code: ({ children }) => (
                                <code className={cn(
                                  "px-1.5 py-0.5 rounded text-[11px] font-mono border",
                                  isDarkMode ? "bg-[#ff7842]/20 text-orange-200 border-[#ff7842]/30" : "bg-orange-100 text-orange-800 border-orange-300"
                                )}>{children}</code>
                              ),
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <TypewriterText 
                          key={`${message.id}-${message.content.length}`}
                          text={message.content} 
                          isStreaming={isLastAssistantMessage && isLoading}
                          speed={30}
                          isDark={isDarkMode}
                        />
                      )
                    )}
                  </div>
                  {message.role === 'user' && (
                    <div className={cn("w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-1", isDarkMode ? "bg-gray-600" : "bg-gray-300")}>
                      <User className={cn("w-3 h-3", isDarkMode ? "text-white" : "text-gray-700")} />
                    </div>
                  )}
                </div>
              )
            })}
            
            {isLoading && (() => {
              // Show typing dots ONLY if:
              // 1. No messages yet, OR
              // 2. Last message is from user (waiting for assistant response)
              // (Do NOT show if assistant message exists, even if empty - TypewriterText will handle it)
              const lastMessage = messages[messages.length - 1]
              const shouldShowTyping = 
                messages.length === 0 || 
                (lastMessage && lastMessage.role === 'user')
              
              return shouldShowTyping && (
                <div className="flex gap-2 justify-start animate-in fade-in duration-200">
                  <div className={cn("w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 border", themeClasses.avatar)}>
                    <LiliAvatar size="xs" isAnimated={true} />
                  </div>
                  <div className={cn("p-3 rounded-lg min-h-[32px] flex items-center border", themeClasses.typingContainer)}>
                    <TypingAnimation isDark={isDarkMode} />
                  </div>
                </div>
              )
            })()}

            {/* Quick Suggestions (only show if this is the first conversation) */}
            {messages.length === 1 && !isLoading && (
              <div className="space-y-2 animate-in fade-in duration-500 delay-300">
                <p className={cn("text-xs font-medium", themeClasses.welcomeText)}>Quick suggestions:</p>
                <div className="grid grid-cols-1 gap-2">
                  {quickSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion.query, suggestion.context)}
                      className={cn(
                        "flex items-center gap-2 p-2 border rounded-lg text-xs transition-all duration-200 text-left disabled:opacity-50 disabled:cursor-not-allowed",
                        themeClasses.suggestion
                      )}
                      disabled={isLoading}
                    >
                      <suggestion.icon className="w-3 h-3 text-[#ff7842]" />
                      {suggestion.text}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className={cn("p-4 border-t", themeClasses.inputContainer)}>
            {/* Status bar - chỉ hiện khi cần */}
            {isLoading && (
              <div className="mb-2 flex justify-end">
                <button
                  onClick={stopGeneration}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors",
                    themeClasses.stopButton
                  )}
                  title="Stop generation"
                >
                  <Square className="w-3 h-3" />
                  Stop
                </button>
              </div>
            )}
            
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything about trading..."
                className={cn(
                  "flex-1 px-3 py-2 border rounded-lg focus:outline-none text-xs transition-all duration-200",
                  themeClasses.input
                )}
                disabled={isLoading}
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isLoading}
                className="p-2 bg-[#ff7842] hover:bg-[#ff7842]/90 disabled:bg-[#ff7842]/50 
                         text-white rounded-lg transition-all duration-200 disabled:cursor-not-allowed
                         hover:scale-105 active:scale-95"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-14 h-14 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center group hover:scale-105 active:scale-95",
          themeClasses.floatingButton
        )}
      >
        <LiliAvatar size="lg" isAnimated={true} className="group-hover:scale-110 transition-transform duration-200" />
        {/* Online indicator */}
        <div className={cn(
          "absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 animate-pulse",
          isDarkMode ? "border-gray-900" : "border-white"
        )}></div>
      </button>

      {/* Mobile positioning adjustments & animations */}
      <style jsx global>{`
        @media (max-width: 640px) {
          .chat-widget-mobile {
            bottom: 1rem;
            right: 1rem;
          }
          .chat-interface-mobile {
            width: calc(100vw - 2rem);
            max-width: 380px;
            height: calc(100vh - 8rem);
          }
        }
        
        /* Smooth typing cursor animation */
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        
        /* Enhanced bounce animation for typing dots */
        @keyframes typing-bounce {
          0%, 60%, 100% {
            transform: translateY(0);
          }
          30% {
            transform: translateY(-4px);
          }
        }
        
        .animate-bounce {
          animation: typing-bounce 1.2s infinite ease-in-out;
        }
      `}</style>
    </div>
  )
}

 