import axios from 'axios'
import { v4 as uuidv4 } from 'uuid'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface StreamEvent {
  event: string
  data: any
  run_id?: string
  name?: string
  metadata?: any
}

export interface ChatConfig {
  app: string
  user_id: string
  conversation_id: string
  user_name: string
  user_full_name: string
  language: string
  chat_type: string
  response_markdown: boolean
  version: number
}

export class ChatApiService {
  private baseUrl = 'https://api.moonx.farm/api/agent'
  private conversationId: string
  private abortController: AbortController | null = null

  constructor(userId?: string, userName?: string) {
    this.conversationId = this.generateSessionId()
    this.userId = userId || 'anonymous'
    this.userName = userName || 'Anonymous User'
  }

  private userId: string
  private userName: string

  // Generate new conversation session
  generateSessionId(): string {
    return uuidv4()
  }

  // Start new conversation
  startNewConversation(): void {
    this.conversationId = this.generateSessionId()
    this.abortController?.abort()
    this.abortController = null
  }

  // Get current conversation ID
  getConversationId(): string {
    return this.conversationId
  }

  // Update user info
  updateUserInfo(userId: string, userName: string): void {
    this.userId = userId
    this.userName = userName
  }

  // Build request payload
  private buildPayload(userMessage: string, context?: any): any {
    const messages: any[] = []
    
    // Add system context if provided (for suggestion questions)
    if (context?.systemContext) {
      messages.push({
        role: 'system',
        content: `Context: ${context.systemContext}. You are Lili, the friendly AI assistant for MoonX Farm DeFi trading platform. Please provide helpful, accurate information about MoonX Farm's features and DeFi trading.`
      })
    }
    
    // Add user message
    messages.push({
      role: 'user',
      content: userMessage
    })

    return {
      input: {
        messages: messages
      },
      config: {
        configurable: {
          app: 'moonx-farm',
          user_id: this.userId,
          conversation_id: this.conversationId,
          user_name: this.userName,
          user_full_name: this.userName,
          language: 'en',
          chat_type: 'private',
          response_markdown: true,
          version: 4
        }
      }
    }
  }

  // Parse streaming response
  private parseStreamLine(line: string): StreamEvent | null {
    try {
      // Skip empty lines
      if (!line.trim()) return null
      
      // Handle server-sent events format (data: {...})
      if (line.startsWith('data: ')) {
        const jsonStr = line.slice(6) // Remove "data: " prefix
        if (jsonStr.trim() === '' || jsonStr.trim() === '[DONE]') return null
        return JSON.parse(jsonStr) as StreamEvent
      }
      
      // Handle event: data format (ignore non-data events)
      if (line.startsWith('event: ')) {
        return null // Skip event lines, wait for data lines
      }
      
      // Handle direct JSON format (LangChain raw streaming)
      if (line.trim().startsWith('{')) {
        return JSON.parse(line.trim()) as StreamEvent
      }
      
      return null
    } catch (error) {
      console.warn('Failed to parse stream line:', line, error)
      return null
    }
  }

  // Extract AI message content from stream events
  private extractMessageContent(event: StreamEvent): string | null {
    try {
      // Handle LangChain chat model streaming events
      if (event.event === 'on_chat_model_stream' && event.data?.chunk) {
        const chunk = event.data.chunk
        // Handle different chunk formats
        if (chunk.content) return chunk.content
        if (chunk.message?.content) return chunk.message.content
        if (typeof chunk === 'string') return chunk
      }

      // Handle LLM streaming events
      if (event.event === 'on_llm_stream' && event.data?.chunk) {
        const chunk = event.data.chunk
        if (chunk.content) return chunk.content
        if (chunk.message?.content) return chunk.message.content
        if (typeof chunk === 'string') return chunk
      }

      // Handle chain streaming events
      if (event.event === 'on_chain_stream' && event.data?.chunk) {
        // Handle messages format
        if (event.data.chunk.messages) {
          const messages = event.data.chunk.messages
          const aiMessage = messages.find((msg: any) => msg.type === 'ai')
          return aiMessage?.content || null
        }
        // Handle direct content
        if (event.data.chunk.content) {
          const content = event.data.chunk.content.trim()
          // Filter out internal workflow signals
          const internalSignals = ['continue', 'end', 'start', 'next', 'stop', 'error', 'success']
          if (internalSignals.includes(content.toLowerCase())) {
            return null
          }
          return event.data.chunk.content
        }
      }

      // Handle final chain output
      if (event.event === 'on_chain_end' && event.data?.output) {
        // Handle messages format
        if (event.data.output.messages) {
          const messages = event.data.output.messages
          const aiMessage = messages.find((msg: any) => msg.type === 'ai')
          return aiMessage?.content || null
        }
        // Handle direct content
        if (event.data.output.content) return event.data.output.content
        
        // Filter out internal workflow signals
        if (typeof event.data.output === 'string') {
          const output = event.data.output.trim()
          // Skip internal LangChain workflow signals
          const internalSignals = ['continue', 'end', 'start', 'next', 'stop', 'error', 'success']
          if (internalSignals.includes(output.toLowerCase())) {
            return null
          }
          // Only return if it looks like actual content (not just a single word command)
          if (output.length > 10 || /[.!?]/.test(output)) {
            return output
          }
          return null
        }
      }

      // Handle custom stream events  
      if (event.event === 'stream' && event.data) {
        if (event.data.content) {
          const content = event.data.content.trim()
          // Filter out internal workflow signals
          const internalSignals = ['continue', 'end', 'start', 'next', 'stop', 'error', 'success']
          if (internalSignals.includes(content.toLowerCase())) {
            return null
          }
          return event.data.content
        }
        if (typeof event.data === 'string') {
          const data = event.data.trim()
          // Filter out internal workflow signals
          const internalSignals = ['continue', 'end', 'start', 'next', 'stop', 'error', 'success']
          if (internalSignals.includes(data.toLowerCase())) {
            return null
          }
          // Only return if it looks like actual content
          if (data.length > 10 || /[.!?]/.test(data)) {
            return data
          }
          return null
        }
      }

      return null
    } catch (error) {
      console.warn('Failed to extract message content:', event, error)
      return null
    }
  }

  // Send message with streaming response
  async sendMessage(
    userMessage: string,
    onProgress: (content: string) => void,
    onComplete: (finalContent: string) => void,
    onError: (error: Error, shouldStartNew?: boolean) => void,
    context?: any
  ): Promise<void> {
    // Cancel previous request if exists
    this.abortController?.abort()
    this.abortController = new AbortController()

    try {
      const payload = this.buildPayload(userMessage, context)
      const url = `${this.baseUrl}/threads/${this.conversationId}/runs/stream`

      console.log('🚀 Sending message to API:', { url, payload })

      // Use fetch API for browser-compatible streaming
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: this.abortController.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      if (!response.body) {
        throw new Error('No response body for streaming')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      
      let finalContent = ''
      let hasReceivedContent = false
      let buffer = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          
          if (done) {
            console.log('✅ Stream completed')
            break
          }

          // Decode chunk and add to buffer
          buffer += decoder.decode(value, { stream: true })
          
          // Process complete lines
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.trim() === '') continue

            const event = this.parseStreamLine(line)
            if (!event) continue

            console.log('📦 Stream event:', event.event, event.data)

            const content = this.extractMessageContent(event)
            if (content) {
              // For streaming events, append incremental content
              if (event.event === 'on_chat_model_stream' || event.event === 'on_llm_stream') {
                finalContent += content
                hasReceivedContent = true
                onProgress(finalContent)
              } 
              // For end events, only update if we haven't received any streaming content yet
              // or if the content is significantly longer (indicating a complete response)
              else if (event.event === 'on_chain_end' || event.event === 'on_chain_stream') {
                if (!hasReceivedContent || (content.length > finalContent.length + 50)) {
                  finalContent = content
                  hasReceivedContent = true
                  onProgress(finalContent)
                }
              }
            }
          }
        }

        // Process any remaining buffer
        if (buffer.trim()) {
          const event = this.parseStreamLine(buffer.trim())
          if (event) {
            console.log('📦 Final stream event:', event.event, event.data)
            
            const content = this.extractMessageContent(event)
            if (content) {
              // For streaming events, append incremental content
              if (event.event === 'on_chat_model_stream' || event.event === 'on_llm_stream') {
                finalContent += content
                hasReceivedContent = true
                onProgress(finalContent)
              } 
              // For end events, only update if we haven't received any streaming content yet
              // or if the content is significantly longer (indicating a complete response)
              else if (event.event === 'on_chain_end' || event.event === 'on_chain_stream') {
                if (!hasReceivedContent || (content.length > finalContent.length + 50)) {
                  finalContent = content
                  hasReceivedContent = true
                  onProgress(finalContent)
                }
              }
            }
          }
        }

        if (hasReceivedContent) {
          onComplete(finalContent)
        } else {
          onError(new Error('No response received from AI'), true)
        }

      } finally {
        reader.releaseLock()
      }

    } catch (error: any) {
      console.error('❌ API Error:', error)

      if (error.name === 'AbortError') {
        // Request was cancelled
        return
      } else if (error.message?.includes('timeout')) {
        onError(new Error('Request timeout. Please try again.'), false)
      } else if (error.message?.includes('404')) {
        onError(new Error('Conversation not found. Starting new conversation.'), true)
      } else if (error.message?.includes('5')) {
        onError(new Error('Server error. Please try again later.'), false)
      } else if (error.message?.includes('429')) {
        onError(new Error('Rate limit exceeded. Please wait a moment and try again.'), false)
      } else {
        onError(new Error('Failed to send message. Please try again.'), false)
      }
    }
  }

  // Stop current request
  stopRequest(): void {
    this.abortController?.abort()
    this.abortController = null
  }

  // Cleanup
  destroy(): void {
    this.stopRequest()
  }
} 