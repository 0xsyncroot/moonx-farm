'use client'

import { useRef, useEffect, useState } from 'react'
import { MessageCircle, X, Send, User, Sparkles, TrendingUp, Wallet, HelpCircle, Settings, Square, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { useChat } from './chat-provider'
import { LiliAvatar } from './lili-avatar'
import ReactMarkdown from 'react-markdown'

// Typing Animation Component (replaces "Lili is thinking...")
const TypingAnimation = () => (
  <div className="flex items-center gap-0.5">
    <div className="w-1 h-1 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
    <div className="w-1 h-1 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
    <div className="w-1 h-1 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
  </div>
)

// Typewriter Effect Component for character-by-character animation
const TypewriterText: React.FC<{ 
  text: string; 
  speed?: number; 
  onComplete?: () => void;
  isStreaming?: boolean;
}> = ({ text, speed = 50, onComplete, isStreaming = false }) => {
  const [displayedText, setDisplayedText] = useState('')
  const [showCursor, setShowCursor] = useState(false)
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastTextRef = useRef('')
  const wasStreamingRef = useRef(false)
  const isTypingRef = useRef(false)

  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (!text) {
      setDisplayedText('')
      setShowCursor(false)
      lastTextRef.current = ''
      wasStreamingRef.current = false
      isTypingRef.current = false
      return
    }

    // Currently streaming - show text immediately
    if (isStreaming) {
      setDisplayedText(text)
      setShowCursor(true)
      lastTextRef.current = text
      wasStreamingRef.current = true
      isTypingRef.current = false
      return
    }

    // Just finished streaming - keep text, hide cursor
    if (!isStreaming && wasStreamingRef.current) {
      setDisplayedText(text)
      setShowCursor(false)
      wasStreamingRef.current = false
      isTypingRef.current = false
      onComplete?.()
      return
    }

    // New message - start typing animation
    if (!isStreaming && !isTypingRef.current && text !== lastTextRef.current) {
      setDisplayedText('')
      setShowCursor(true)
      lastTextRef.current = text
      isTypingRef.current = true
      
      let charIndex = 0
      intervalRef.current = setInterval(() => {
        charIndex++
        setDisplayedText(text.slice(0, charIndex))
        
        if (charIndex >= text.length) {
          clearInterval(intervalRef.current!)
          intervalRef.current = null
          setShowCursor(false)
          isTypingRef.current = false
          onComplete?.()
        }
      }, speed)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [text, isStreaming, speed])

  // Reset typing flag for new messages
  useEffect(() => {
    if (text && text !== lastTextRef.current && !isStreaming) {
      isTypingRef.current = false
    }
  }, [text, isStreaming])

  // If streaming and no text yet, show typing animation instead of empty markdown
  if (isStreaming && !displayedText) {
    return (
      <div className="flex items-center py-1">
        <TypingAnimation />
      </div>
    )
  }

  return (
    <div className="prose prose-sm max-w-none text-xs text-gray-100">
      <ReactMarkdown
        components={{
          // Custom styles for markdown elements
          p: ({ children }) => <p className="mb-2 last:mb-0 text-gray-100">{children}</p>,
          strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
          em: ({ children }) => <em className="italic text-gray-200">{children}</em>,
          ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1 text-gray-100">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1 text-gray-100">{children}</ol>,
          li: ({ children }) => <li className="text-xs text-gray-100">{children}</li>,
          code: ({ children }) => (
            <code className="bg-[#ff7842]/20 text-orange-200 px-1.5 py-0.5 rounded text-[11px] font-mono border border-[#ff7842]/30">{children}</code>
          ),
          pre: ({ children }) => (
            <pre className="bg-gray-800 border border-gray-600 p-3 rounded-lg text-[11px] font-mono overflow-x-auto text-gray-200">{children}</pre>
          ),
          h1: ({ children }) => <h1 className="text-sm font-bold mb-2 text-white">{children}</h1>,
          h2: ({ children }) => <h2 className="text-sm font-semibold mb-2 text-white">{children}</h2>,
          h3: ({ children }) => <h3 className="text-xs font-semibold mb-1 text-gray-200">{children}</h3>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-3 border-[#ff7842] pl-3 my-2 text-gray-200 bg-[#ff7842]/5 py-1">{children}</blockquote>
          ),
          hr: () => <hr className="border-gray-600 my-3" />
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
  const inputRef = useRef<HTMLInputElement>(null)
  const [inputValue, setInputValue] = useState('')

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return
    
    await sendMessage(inputValue)
    setInputValue('')
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

  return (
    <div className={cn("fixed bottom-4 right-4 z-50", className)}>
      {/* Chat Interface */}
      {isOpen && (
        <div className="mb-4 w-80 sm:w-96 h-[500px] max-h-[80vh] bg-gray-900/95 backdrop-blur-xl 
                      border border-white/10 rounded-xl shadow-2xl flex flex-col overflow-hidden
                      animate-in slide-in-from-bottom-2 duration-200">
          {/* Header */}
          <div className="p-4 border-b border-white/10 bg-gradient-to-r from-[#ff7842]/10 to-[#ff4d00]/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-[#ff7842]/20 to-[#ff4d00]/20 border border-[#ff7842]/30">
                  <LiliAvatar size="sm" isAnimated={true} />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-white">Lili</h3>
                  <p className="text-xs text-gray-400">Your friendly DeFi assistant</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsWalkerEnabled(!isWalkerEnabled)}
                  className="p-1 hover:bg-white/10 rounded-lg transition-colors group"
                  title={isWalkerEnabled ? "Disable Lili walker" : "Enable Lili walker"}
                >
                  <div className="text-xs">
                    {isWalkerEnabled ? "🚶‍♀️" : "⏸️"}
                  </div>
                </button>
                <button
                  onClick={startNewConversation}
                  className="p-1 hover:bg-white/10 rounded-lg transition-colors group"
                  title="Start new conversation"
                >
                  <RotateCcw className="w-3 h-3 text-gray-400 group-hover:text-white" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
            {/* Welcome Message when no messages */}
            {messages.length === 0 && !isLoading && (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4">
                  <LiliAvatar size="lg" isAnimated={true} />
                </div>
                <p className="text-gray-300 text-xs mb-6">
                  Hi! I'm Lili, your AI assistant for MoonX Farm - a DeFi trading platform with smart wallets, gasless transactions, and automated trading. How can I help you today?
                </p>
                
                                 {/* Quick suggestions for first time users */}
                 <div className="space-y-2">
                   <p className="text-xs text-gray-300 font-medium">Quick suggestions:</p>
                  <div className="grid grid-cols-1 gap-2">
                    {quickSuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => handleSuggestionClick(suggestion.query, suggestion.context)}
                        className="flex items-center gap-2 p-2 bg-white/5 hover:bg-white/10 border border-white/10 
                                 rounded-lg text-xs text-gray-200 hover:text-white transition-all duration-200 
                                 text-left hover:border-[#ff7842]/30 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-1 
                                  bg-gradient-to-br from-[#ff7842]/20 to-[#ff4d00]/20 border border-[#ff7842]/30">
                      <LiliAvatar size="xs" isAnimated={true} />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[80%] p-3 rounded-lg leading-relaxed",
                      message.role === 'user'
                        ? 'bg-[#ff7842] text-white text-xs'
                        : message.role === 'system'
                        ? 'bg-blue-500/20 text-blue-200 border border-blue-500/30 text-xs'
                        : 'bg-white/5 text-white border border-white/10'
                    )}
                  >
                    {message.role === 'user' ? (
                      <div className="text-xs whitespace-pre-wrap text-white">{message.content}</div>
                    ) : (
                      // Welcome messages và system messages hiển thị ngay, không cần animation
                      message.id.includes('welcome') || message.role === 'system' ? (
                        <div className="prose prose-sm max-w-none text-xs text-gray-100">
                          <ReactMarkdown
                            components={{
                              p: ({ children }) => <p className="mb-2 last:mb-0 text-gray-100">{children}</p>,
                              strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
                              em: ({ children }) => <em className="italic text-gray-200">{children}</em>,
                              ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1 text-gray-100">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1 text-gray-100">{children}</ol>,
                              li: ({ children }) => <li className="text-xs text-gray-100">{children}</li>,
                              code: ({ children }) => (
                                <code className="bg-[#ff7842]/20 text-orange-200 px-1.5 py-0.5 rounded text-[11px] font-mono border border-[#ff7842]/30">{children}</code>
                              ),
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <TypewriterText 
                          text={message.content} 
                          isStreaming={isLastAssistantMessage && isLoading}
                          speed={50}
                        />
                      )
                    )}
                  </div>
                  {message.role === 'user' && (
                    <div className="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <User className="w-3 h-3 text-white" />
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
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 
                                bg-gradient-to-br from-[#ff7842]/20 to-[#ff4d00]/20 border border-[#ff7842]/30">
                    <LiliAvatar size="xs" isAnimated={true} />
                  </div>
                  <div className="bg-white/5 text-white border border-white/10 p-3 rounded-lg min-h-[32px] flex items-center">
                    <TypingAnimation />
                  </div>
                </div>
              )
            })()}

            {/* Quick Suggestions (only show if this is the first conversation) */}
            {messages.length === 1 && !isLoading && (
              <div className="space-y-2 animate-in fade-in duration-500 delay-300">
                <p className="text-xs text-gray-300 font-medium">Quick suggestions:</p>
                <div className="grid grid-cols-1 gap-2">
                  {quickSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion.query, suggestion.context)}
                      className="flex items-center gap-2 p-2 bg-white/5 hover:bg-white/10 border border-white/10 
                               rounded-lg text-xs text-gray-200 hover:text-white transition-all duration-200 
                               text-left hover:border-[#ff7842]/30 disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="p-4 border-t border-white/10 bg-gray-900/50">
            {/* Status bar - chỉ hiện khi cần */}
            {isLoading && (
              <div className="mb-2 flex justify-end">
                <button
                  onClick={stopGeneration}
                  className="flex items-center gap-1 px-2 py-1 bg-red-500/20 hover:bg-red-500/30 
                           text-red-300 rounded text-xs transition-colors"
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
                className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white 
                         placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#ff7842]/50 
                         focus:border-[#ff7842]/50 text-xs transition-all duration-200"
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
        className="w-14 h-14 bg-gradient-to-br from-[#ff7842] to-[#ff4d00] hover:from-[#ff7842]/90 
                 hover:to-[#ff4d00]/90 text-white rounded-full shadow-lg hover:shadow-xl 
                 transition-all duration-200 flex items-center justify-center group
                 hover:scale-105 active:scale-95"
      >
        <LiliAvatar size="lg" isAnimated={true} className="group-hover:scale-110 transition-transform duration-200" />
        {/* Online indicator */}
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-gray-900 
                      animate-pulse"></div>
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

 