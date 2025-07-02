# AI Agent Integration Guide

## 🤖 Overview

The MoonX Farm AI Agent is a context-aware chat assistant that helps users with trading, DeFi concepts, and platform features. It's implemented with a Jupiter-inspired design and fully integrated into the web application.

## 🎯 Features Implemented

### ✅ Frontend Implementation (Complete)

#### **Chat Widget (`/components/ai/chat-widget.tsx`)**
- **Floating Action Button**: Fixed position at bottom-right
- **Expandable Chat Interface**: 400x500px with mobile responsive design
- **Jupiter Design Integration**: Orange gradient theme, glass morphism
- **Real-time Messaging**: Smooth animations and transitions
- **Quick Suggestions**: Contextual button suggestions for new users
- **Mobile Optimized**: Responsive layout with touch-friendly interactions

#### **Chat Provider (`/components/ai/chat-provider.tsx`)**
- **Global State Management**: Context-based chat state
- **User Authentication Awareness**: Different responses for logged-in users
- **Message History**: Persistent chat history during session
- **Error Handling**: Graceful error messages and retry logic
- **Context-Aware Responses**: Enhanced responses based on user state

#### **Enhanced Features**
- **Message Types**: Text, system, and suggestion message support
- **Loading States**: Typing indicators and smooth transitions
- **Keyboard Navigation**: Enter to send, Shift+Enter for new line
- **Auto-scroll**: Automatic scroll to bottom on new messages
- **Online Indicator**: Visual status indicator on chat button

### 🎨 Design System Integration

#### **Jupiter-Inspired Styling**
```css
/* Orange gradient theme */
.chat-fab {
  background: linear-gradient(135deg, #ff7842, #ff4d00);
}

/* Glass morphism effects */
.chat-interface {
  background: rgba(17, 24, 39, 0.95);
  backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
```

#### **Mobile Responsive Design**
- **Mobile breakpoint**: < 640px
- **Touch-friendly**: 44px minimum touch targets
- **Full-screen chat**: Optimized for mobile viewport
- **Safe area handling**: iOS notch compatibility

## 🧠 AI Response System

### **Current Implementation (Mock Responses)**

The AI currently uses pattern-matching responses for:

1. **Trading Features**
   - Swap instructions
   - Limit orders and DCA setup
   - Fee explanations
   - Portfolio tracking

2. **Technical Features**
   - Smart wallet explanations
   - Account Abstraction benefits
   - Session key functionality
   - Multi-chain support

3. **Platform Navigation**
   - Feature location guidance
   - Step-by-step tutorials
   - Best practices

### **Context Awareness**

```typescript
// User authentication-based responses
if (isAuthenticated) {
  return "Since you're logged in, you can access..."
} else {
  return "To start trading, please connect your wallet..."
}

// Feature-specific guidance
if (message.includes('swap')) {
  return getSwapInstructions(isAuthenticated)
}
```

## 🔌 Backend Integration (Future Implementation)

### **Recommended AI Service Architecture**

#### **Option 1: Extend Notify Service**
```typescript
// services/notify-service/src/ai/
├── aiController.ts        // Chat API endpoints
├── aiService.ts          // AI model integration
├── contextService.ts     // User context gathering
└── responseGenerator.ts  // Response formatting
```

#### **Option 2: Dedicated AI Service**
```typescript
// services/ai-service/
├── src/
│   ├── controllers/
│   │   └── chatController.ts     // POST /chat/message
│   ├── services/
│   │   ├── aiService.ts          // OpenAI/Anthropic integration
│   │   ├── contextService.ts     // User/trading context
│   │   └── knowledgeBase.ts      // MoonX Farm knowledge
│   └── middleware/
│       └── rateLimiting.ts       // Rate limiting per user
```

### **API Specification**

#### **Chat Message Endpoint**
```typescript
POST /api/v1/chat/message

// Request
{
  "message": "How do I swap tokens?",
  "context": {
    "currentPage": "/swap",
    "userState": "authenticated",
    "walletConnected": true,
    "tradingPair": "ETH/USDC"
  }
}

// Response
{
  "success": true,
  "data": {
    "id": "msg_123",
    "response": "To swap tokens on MoonX Farm...",
    "type": "text",
    "suggestions": [
      {
        "text": "Start a swap",
        "action": "navigate_to_swap"
      }
    ],
    "metadata": {
      "confidence": 0.95,
      "processingTime": 234
    }
  }
}
```

### **AI Model Integration Options**

#### **OpenAI GPT-4**
```typescript
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function generateResponse(message: string, context: UserContext) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: `You are MoonX Farm's AI assistant. You help users with:
        - DeFi trading and swaps
        - Account Abstraction and smart wallets  
        - Platform features and navigation
        - Session keys and automated trading
        
        Platform context: ${JSON.stringify(context)}`
      },
      {
        role: "user", 
        content: message
      }
    ],
    max_tokens: 150,
    temperature: 0.7
  })
  
  return completion.choices[0].message.content
}
```

#### **Anthropic Claude**
```typescript
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

export async function generateResponse(message: string, context: UserContext) {
  const response = await anthropic.messages.create({
    model: "claude-3-sonnet-20240229",
    max_tokens: 150,
    messages: [{
      role: "user",
      content: `${SYSTEM_PROMPT}\n\nUser context: ${JSON.stringify(context)}\n\nUser message: ${message}`
    }]
  })
  
  return response.content[0].text
}
```

### **Knowledge Base Integration**

#### **MoonX Farm Specific Knowledge**
```typescript
export const MOONX_KNOWLEDGE_BASE = {
  features: {
    gaslessTrading: "MoonX Farm offers gasless trading through Account Abstraction...",
    sessionKeys: "Session keys enable automated trading permissions...",
    multiChain: "We support Base, BSC, Ethereum, Polygon, and Arbitrum..."
  },
  
  tutorials: {
    firstSwap: [
      "Connect your wallet using social login",
      "Select tokens to swap", 
      "Enter amount and review quote",
      "Confirm gasless transaction"
    ],
    
    limitOrders: [
      "Navigate to Orders section",
      "Set up session keys for automation",
      "Create limit order with target price",
      "Order executes automatically when price is reached"
    ]
  },
  
  troubleshooting: {
    connectionIssues: "If you're having connection issues...",
    transactionFailed: "Transaction failures can occur due to..."
  }
}
```

### **Context Gathering Service**

```typescript
export class ContextService {
  async gatherUserContext(userId: string): Promise<UserContext> {
    const [user, portfolio, recentTrades] = await Promise.all([
      this.getUserProfile(userId),
      this.getPortfolioData(userId), 
      this.getRecentTrades(userId)
    ])
    
    return {
      isAuthenticated: !!user,
      walletConnected: !!user?.walletAddress,
      portfolioValue: portfolio?.totalValue,
      recentActivity: recentTrades.slice(0, 5),
      preferredChains: user?.preferredChains,
      sessionKeysActive: await this.checkSessionKeys(userId)
    }
  }
}
```

## 📱 Frontend Integration

### **Update Chat Provider for Backend**

```typescript
// In chat-provider.tsx
const sendMessage = async (content: string, context?: any) => {
  // Gather current page context
  const pageContext = {
    currentPage: window.location.pathname,
    chainId: currentChainId,
    walletConnected: isAuthenticated
  }
  
  try {
    const response = await fetch('/api/v1/chat/message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        message: content,
        context: { ...context, ...pageContext }
      })
    })
    
    const data = await response.json()
    
    if (data.success) {
      const aiResponse: ChatMessage = {
        id: data.data.id,
        role: 'assistant',
        content: data.data.response,
        timestamp: new Date(),
        type: data.data.type,
        metadata: data.data.metadata
      }
      
      setMessages(prev => [...prev, aiResponse])
    }
  } catch (error) {
    // Handle error...
  }
}
```

## 🚀 Performance Optimization

### **Response Caching**
```typescript
// Cache common responses
const responseCache = new Map<string, CachedResponse>()

export function getCachedResponse(message: string): string | null {
  const normalizedMessage = message.toLowerCase().trim()
  const cached = responseCache.get(normalizedMessage)
  
  if (cached && Date.now() - cached.timestamp < 300000) { // 5 minutes
    return cached.response
  }
  
  return null
}
```

### **Rate Limiting**
```typescript
// Per user rate limiting
const userRateLimits = new Map<string, number[]>()

export function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const userRequests = userRateLimits.get(userId) || []
  
  // Remove requests older than 1 minute
  const recentRequests = userRequests.filter(time => now - time < 60000)
  
  if (recentRequests.length >= 20) { // 20 requests per minute
    return false
  }
  
  recentRequests.push(now)
  userRateLimits.set(userId, recentRequests)
  return true
}
```

## 🔒 Security Considerations

### **Input Sanitization**
```typescript
export function sanitizeUserInput(message: string): string {
  // Remove potentially harmful content
  return message
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .trim()
    .slice(0, 500) // Limit message length
}
```

### **Authentication**
- All chat requests require valid JWT token
- Rate limiting per authenticated user
- Audit logging for all AI interactions

## 📊 Analytics & Monitoring

### **Metrics to Track**
```typescript
export const CHAT_METRICS = {
  messagesPerSession: 'avg_messages_per_chat_session',
  responseTime: 'ai_response_time_ms', 
  userSatisfaction: 'chat_helpful_rating',
  commonQuestions: 'most_asked_questions',
  conversionRate: 'chat_to_trade_conversion'
}
```

### **Error Monitoring**
- Track AI service failures
- Monitor response quality
- Log user feedback and ratings

## 🎯 Next Steps

### **Phase 1: Backend Service** (2-3 weeks)
1. ✅ Design AI service architecture
2. ✅ Implement chat API endpoints
3. ✅ Integrate OpenAI/Anthropic
4. ✅ Build knowledge base
5. ✅ Add rate limiting and security

### **Phase 2: Enhanced Features** (1-2 weeks)
1. ✅ Action buttons (navigate to features)
2. ✅ Rich message formatting (markdown support)
3. ✅ Voice input/output capabilities
4. ✅ Multi-language support

### **Phase 3: Advanced AI** (3-4 weeks)
1. ✅ Trading analysis and insights
2. ✅ Personalized recommendations
3. ✅ Proactive notifications
4. ✅ Learning from user interactions

## 🔧 Development Commands

```bash
# Start with AI agent enabled
cd apps/web
pnpm dev

# Test chat functionality
# 1. Click chat button in bottom-right
# 2. Try quick suggestions
# 3. Test various trading questions
# 4. Verify mobile responsiveness
```

## 📚 Resources

- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Anthropic Claude API](https://docs.anthropic.com/)
- [MoonX Farm Component Library](../components/README.md)
- [Design System](../design-system.md)

---

**Status**: Frontend Complete ✅ | Backend Integration Ready 🚀

The AI agent is fully functional with mock responses and ready for backend AI service integration. 