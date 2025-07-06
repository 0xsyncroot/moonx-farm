import { createLogger } from '@moonx-farm/common';
import { Bot, Context, InlineKeyboard, InputFile } from 'grammy';

const logger = createLogger('TelegramService');

// Optional imports for performance enhancements
let autoRetry: any;
let apiThrottler: any;

try {
  autoRetry = require('@grammyjs/auto-retry').autoRetry;
} catch (error) {
  logger.warn('Auto-retry plugin not available, continuing without it');
}

try {
  apiThrottler = require('@grammyjs/transformer-throttler').apiThrottler;
} catch (error) {
  logger.warn('API throttler plugin not available, continuing without it');
}

interface TelegramConfig {
  botToken: string;
  webhookUrl?: string;
  adminChats?: string[];
  blockedChats?: string[];
  enablePolling?: boolean;
  rateLimitPerSecond?: number;
}

interface TelegramMessage {
  chatId: string;
  text: string;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  disableWebPagePreview?: boolean;
  disableNotification?: boolean;
  replyMarkup?: InlineKeyboard;
  photo?: string | InputFile;
  document?: string | InputFile;
  caption?: string;
}

interface MessageStats {
  total: number;
  success: number;
  failed: number;
  blocked: number;
  rateLimit: number;
}

export class TelegramService {
  private bot!: Bot; // Definite assignment assertion - initialized in initializeBot()
  private config: TelegramConfig;
  private isInitialized: boolean = false;
  private adminChats: Set<string> = new Set();
  private blockedChats: Set<string> = new Set();
  private messageStats: MessageStats = {
    total: 0,
    success: 0,
    failed: 0,
    blocked: 0,
    rateLimit: 0
  };

  constructor(config: TelegramConfig) {
    this.config = config;
    this.initializeBot();
  }

  private initializeBot(): void {
    try {
      if (!this.config.botToken) {
        throw new Error('Telegram bot token not provided');
      }

             // Initialize grammy Bot
       this.bot = new Bot(this.config.botToken);

       // Add auto-retry middleware for failed API calls (if available)
       if (autoRetry) {
         this.bot.api.config.use(autoRetry());
         logger.info('Auto-retry middleware enabled');
       }

       // Add throttler to respect Telegram rate limits (if available)
       if (apiThrottler) {
         this.bot.api.config.use(apiThrottler({
           // Allow up to 30 messages per second (Telegram's limit)
           maxConcurrentCalls: this.config.rateLimitPerSecond || 30,
           minDelayMs: 1000 / 30, // ~33ms between calls
         }));
         logger.info('API throttler middleware enabled');
       }

      // Set admin chats
      if (this.config.adminChats) {
        this.config.adminChats.forEach(chatId => {
          this.adminChats.add(chatId);
        });
      }

      // Set blocked chats
      if (this.config.blockedChats) {
        this.config.blockedChats.forEach(chatId => {
          this.blockedChats.add(chatId);
        });
      }

      // Set up basic commands for admin chats
      this.setupAdminCommands();

      // Set up error handling
      this.bot.catch((err) => {
        logger.error('Telegram bot error:', err);
      });

      this.isInitialized = true;
      logger.info('Telegram Bot service initialized with grammy');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to initialize Telegram Bot: ${errorMessage}`);
      this.isInitialized = false;
    }
  }

  private setupAdminCommands(): void {
    // Admin-only commands
    this.bot.command('start', async (ctx) => {
      if (!this.isAdminChat(ctx.chat.id.toString())) {
        await this.sendWelcomeMessage(ctx.chat.id.toString(), ctx.from?.username);
        return;
      }

      await ctx.reply(
        '🚀 <b>MoonX Farm Admin Bot</b>\n\n' +
        'Available commands:\n' +
        '/stats - View bot statistics\n' +
        '/health - Check bot health\n' +
        '/block [chat_id] - Block a chat\n' +
        '/unblock [chat_id] - Unblock a chat\n' +
        '/test - Send test notification',
        { parse_mode: 'HTML' }
      );
    });

    this.bot.command('stats', async (ctx) => {
      if (!this.isAdminChat(ctx.chat.id.toString())) {
        return; // Ignore non-admin commands
      }

      const stats = await this.getStats();
      await ctx.reply(
        `📊 <b>Bot Statistics</b>\n\n` +
        `<b>Messages:</b>\n` +
        `• Total: ${stats.messageStats.total}\n` +
        `• Success: ${stats.messageStats.success}\n` +
        `• Failed: ${stats.messageStats.failed}\n` +
        `• Blocked: ${stats.messageStats.blocked}\n` +
        `• Rate Limited: ${stats.messageStats.rateLimit}\n\n` +
        `<b>Configuration:</b>\n` +
        `• Admin Chats: ${stats.adminChatsCount}\n` +
        `• Blocked Chats: ${stats.blockedChatsCount}\n` +
        `• Initialized: ${stats.isInitialized ? '✅' : '❌'}`,
        { parse_mode: 'HTML' }
      );
    });

    this.bot.command('health', async (ctx) => {
      if (!this.isAdminChat(ctx.chat.id.toString())) {
        return;
      }

      const isHealthy = await this.healthCheck();
      await ctx.reply(
        `🏥 <b>Bot Health Check</b>\n\n` +
        `Status: ${isHealthy ? '✅ Healthy' : '❌ Unhealthy'}\n` +
        `Uptime: ${process.uptime()} seconds`,
        { parse_mode: 'HTML' }
      );
    });

    this.bot.command('test', async (ctx) => {
      if (!this.isAdminChat(ctx.chat.id.toString())) {
        return;
      }

      const success = await this.sendNotification(
        ctx.chat.id.toString(),
        '🧪 Test Notification',
        'This is a test notification from MoonX Farm Bot!',
        { type: 'test', timestamp: new Date().toISOString() }
      );

      await ctx.reply(
        success ? '✅ Test notification sent successfully!' : '❌ Failed to send test notification',
        { parse_mode: 'HTML' }
      );
    });
  }

  async sendMessage(message: TelegramMessage): Promise<boolean> {
    if (!this.isInitialized) {
      logger.error('Telegram service not initialized');
      return false;
    }

    this.messageStats.total++;

    // Check if chat is blocked
    if (this.blockedChats.has(message.chatId)) {
      this.messageStats.blocked++;
      logger.warn(`Chat ${message.chatId} is blocked`);
      return false;
    }

    try {
      const chatId = parseInt(message.chatId);
      
      // Prepare message options
      const options = {
        parse_mode: message.parseMode || 'HTML' as const,
        disable_web_page_preview: message.disableWebPagePreview,
        disable_notification: message.disableNotification,
        reply_markup: message.replyMarkup
      };

      // Send different types of messages
      if (message.photo) {
        await this.bot.api.sendPhoto(chatId, message.photo, {
          caption: message.caption || message.text,
          ...options
        });
      } else if (message.document) {
        await this.bot.api.sendDocument(chatId, message.document, {
          caption: message.caption || message.text,
          ...options
        });
      } else {
        await this.bot.api.sendMessage(chatId, message.text, options);
      }

      this.messageStats.success++;
      logger.info(`Telegram message sent to chat ${message.chatId}`);
      return true;
    } catch (error) {
      this.messageStats.failed++;
      
      if (error instanceof Error) {
        // Handle specific Telegram errors
        if (error.message.includes('Too Many Requests')) {
          this.messageStats.rateLimit++;
          logger.warn(`Rate limit hit for chat ${message.chatId}`);
        } else if (error.message.includes('chat not found') || error.message.includes('USER_DEACTIVATED')) {
          // User blocked the bot or deleted account
          this.addBlockedChat(message.chatId);
          logger.warn(`Chat ${message.chatId} blocked bot or deleted account`);
        } else {
          logger.error(`Failed to send Telegram message to ${message.chatId}: ${error.message}`);
        }
      } else {
        logger.error(`Failed to send Telegram message to ${message.chatId}: ${String(error)}`);
      }
      
      return false;
    }
  }

  async sendNotification(
    chatId: string,
    title: string,
    body: string,
    data?: any
  ): Promise<boolean> {
    try {
      const message = this.formatNotificationMessage(title, body, data);
      const keyboard = this.createNotificationKeyboard(data);

      return await this.sendMessage({
        chatId,
        text: message,
        parseMode: 'HTML',
        replyMarkup: keyboard,
        disableWebPagePreview: true
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to send Telegram notification: ${errorMessage}`);
      return false;
    }
  }

  async sendBulkMessages(messages: TelegramMessage[]): Promise<{ success: number; failed: number }> {
    if (!this.isInitialized) {
      logger.error('Telegram service not initialized');
      return { success: 0, failed: messages.length };
    }

    if (messages.length === 0) {
      return { success: 0, failed: 0 };
    }

    let success = 0;
    let failed = 0;

    // grammy handles rate limiting automatically, but we still batch for better control
    const batchSize = 10;
    const totalBatches = Math.ceil(messages.length / batchSize);
    
    logger.info(`Starting bulk Telegram send: ${messages.length} messages in ${totalBatches} batches`);

    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      
      try {
        logger.debug(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} messages)`);
        
        const sendPromises = batch.map(message => this.sendMessage(message));
        const results = await Promise.allSettled(sendPromises);
        
        results.forEach(result => {
          if (result.status === 'fulfilled' && result.value) {
            success++;
          } else {
            failed++;
          }
        });

        // Small delay between batches for safety
        if (i + batchSize < messages.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Batch Telegram sending failed: ${errorMessage}`);
        failed += batch.length;
      }
    }

    logger.info(`Bulk Telegram completed: ${success} success, ${failed} failed`);
    return { success, failed };
  }

  private formatNotificationMessage(title: string, body: string, data?: any): string {
    let message = `<b>🚀 MoonX Farm</b>\n\n`;
    message += `<b>${this.escapeHtml(title)}</b>\n`;
    message += `${this.escapeHtml(body)}\n\n`;

    if (data && typeof data === 'object') {
      message += `<b>📊 Details:</b>\n`;
      Object.entries(data).forEach(([key, value]) => {
        if (key !== 'chatId' && key !== 'telegramChatId' && key !== 'type') {
          const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
          message += `• <b>${formattedKey}:</b> ${this.escapeHtml(String(value))}\n`;
        }
      });
      message += `\n`;
    }

    message += `<i>Powered by MoonX Farm 🌙</i>`;
    return message;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  private createNotificationKeyboard(data?: any): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    // Always add "Open App" button
    keyboard.url('🚀 Open MoonX Farm', 'https://app.moonx.farm');

    // Add specific buttons based on notification type
    if (data?.type === 'price_alert' && data?.symbol) {
      keyboard.row();
      keyboard.url(`📈 View ${data.symbol} Chart`, `https://app.moonx.farm/trade/${data.symbol}`);
    }

    if (data?.type === 'whale_alert' && data?.txHash) {
      keyboard.row();
      keyboard.url('🔍 View Transaction', `https://bscscan.com/tx/${data.txHash}`);
    }

    if (data?.type === 'order_filled' || data?.type === 'swap_completed') {
      keyboard.row();
      keyboard.url('💼 View Portfolio', 'https://app.moonx.farm/portfolio');
    }

    // Add settings button
    keyboard.row();
    keyboard.url('⚙️ Settings', 'https://app.moonx.farm/settings');

    return keyboard;
  }

  async sendPriceAlert(
    chatId: string,
    symbol: string,
    currentPrice: number,
    targetPrice: number,
    direction: 'above' | 'below'
  ): Promise<boolean> {
    const emoji = direction === 'above' ? '📈' : '📉';
    const title = `${emoji} Price Alert: ${symbol}`;
    const body = `${symbol} has ${direction === 'above' ? 'risen above' : 'fallen below'} your target price!`;

    return await this.sendNotification(chatId, title, body, {
      type: 'price_alert',
      symbol,
      currentPrice: `$${currentPrice.toFixed(4)}`,
      targetPrice: `$${targetPrice.toFixed(4)}`,
      direction,
      timestamp: new Date().toISOString()
    });
  }

  async sendWhaleAlert(
    chatId: string,
    symbol: string,
    amount: number,
    txHash: string,
    direction: 'buy' | 'sell'
  ): Promise<boolean> {
    const emoji = direction === 'buy' ? '🐋💚' : '🐋❤️';
    const title = `${emoji} Whale Alert: ${symbol}`;
    const body = `Large ${direction} detected: ${amount.toLocaleString()} ${symbol}`;

    return await this.sendNotification(chatId, title, body, {
      type: 'whale_alert',
      symbol,
      amount: amount.toLocaleString(),
      txHash,
      direction,
      timestamp: new Date().toISOString()
    });
  }

  async sendSystemAlert(
    chatId: string,
    message: string,
    priority: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<boolean> {
    const emojis = {
      low: 'ℹ️',
      medium: '⚠️',
      high: '🚨'
    };

    const title = `${emojis[priority]} System Alert`;
    return await this.sendNotification(chatId, title, message, {
      type: 'system_alert',
      priority,
      timestamp: new Date().toISOString()
    });
  }

  async sendWelcomeMessage(chatId: string, userName?: string): Promise<boolean> {
    const name = userName ? ` ${userName}` : '';
    const title = `🎉 Welcome${name}!`;
    const body = `Welcome to MoonX Farm notifications! You'll receive real-time updates about your trades, price alerts, and important announcements.`;

    const keyboard = new InlineKeyboard()
      .url('🚀 Open App', 'https://app.moonx.farm')
      .url('📊 View Charts', 'https://app.moonx.farm/charts')
      .row()
      .url('💼 Portfolio', 'https://app.moonx.farm/portfolio')
      .url('⚙️ Settings', 'https://app.moonx.farm/settings');

    return await this.sendMessage({
      chatId,
      text: this.formatNotificationMessage(title, body),
      parseMode: 'HTML',
      replyMarkup: keyboard
    });
  }

  async setupWebhook(webhookUrl: string): Promise<boolean> {
    try {
      await this.bot.api.setWebhook(webhookUrl);
      logger.info(`Telegram webhook set to: ${webhookUrl}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to set Telegram webhook: ${errorMessage}`);
      return false;
    }
  }

  async removeWebhook(): Promise<boolean> {
    try {
      await this.bot.api.deleteWebhook();
      logger.info('Telegram webhook removed');
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to remove Telegram webhook: ${errorMessage}`);
      return false;
    }
  }

  // Admin management methods
  addAdminChat(chatId: string): void {
    this.adminChats.add(chatId);
    logger.info(`Added chat ${chatId} to admin list`);
  }

  removeAdminChat(chatId: string): void {
    this.adminChats.delete(chatId);
    logger.info(`Removed chat ${chatId} from admin list`);
  }

  isAdminChat(chatId: string): boolean {
    return this.adminChats.has(chatId);
  }

  // Blocked chats management
  addBlockedChat(chatId: string): void {
    this.blockedChats.add(chatId);
    logger.info(`Added chat ${chatId} to blocked list`);
  }

  removeBlockedChat(chatId: string): void {
    this.blockedChats.delete(chatId);
    logger.info(`Removed chat ${chatId} from blocked list`);
  }

  isBlockedChat(chatId: string): boolean {
    return this.blockedChats.has(chatId);
  }

  async startPolling(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Bot not initialized');
    }

    try {
      await this.bot.start();
      logger.info('Telegram bot started polling');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to start Telegram bot polling: ${errorMessage}`);
      throw error;
    }
  }

  async stopPolling(): Promise<void> {
    try {
      await this.bot.stop();
      logger.info('Telegram bot stopped polling');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to stop Telegram bot polling: ${errorMessage}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }

    try {
      // Test bot connection by getting bot info
      await this.bot.api.getMe();
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Telegram health check failed: ${errorMessage}`);
      return false;
    }
  }

  async getStats(): Promise<any> {
    return {
      service: 'telegram',
      isInitialized: this.isInitialized,
      adminChatsCount: this.adminChats.size,
      blockedChatsCount: this.blockedChats.size,
      messageStats: { ...this.messageStats },
      adminChats: Array.from(this.adminChats),
      blockedChats: Array.from(this.blockedChats).map(chatId => 
        chatId.replace(/\d(?=\d{4})/g, '*') // Mask chat IDs for privacy
      )
    };
  }

  // Get the grammy bot instance for advanced usage
  getBot(): Bot {
    return this.bot;
  }

  // Compatibility method for existing code
  async send(message: TelegramMessage): Promise<boolean> {
    return await this.sendMessage(message);
  }
} 