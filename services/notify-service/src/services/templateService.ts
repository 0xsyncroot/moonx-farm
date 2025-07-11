import * as Handlebars from 'handlebars';
import { createLogger } from '@moonx-farm/common';
import { DatabaseService } from './databaseService';
import {
  NotificationTemplate,
  NotificationChannel,
  TemplateVariables,
  ITemplateService
} from '../types';

const logger = createLogger('template-service');

export class TemplateService implements ITemplateService {
  private db: DatabaseService;
  private templateCache: Map<string, NotificationTemplate> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor(databaseService: DatabaseService) {
    this.db = databaseService;
    this.setupHandlebarsHelpers();
  }

  private setupHandlebarsHelpers(): void {
    // Helper for formatting currency
    Handlebars.registerHelper('currency', (value: string | number) => {
      const num = typeof value === 'string' ? parseFloat(value) : value;
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(num);
    });

    // Helper for formatting percentage
    Handlebars.registerHelper('percentage', (value: string | number) => {
      const num = typeof value === 'string' ? parseFloat(value) : value;
      return `${num.toFixed(2)}%`;
    });

    // Helper for formatting large numbers
    Handlebars.registerHelper('number', (value: string | number) => {
      const num = typeof value === 'string' ? parseFloat(value) : value;
      return new Intl.NumberFormat('en-US').format(num);
    });

    // Helper for conditional text
    Handlebars.registerHelper('ifEquals', function(this: any, arg1: any, arg2: any, options: any) {
      return (arg1 === arg2) ? options.fn(this) : options.inverse(this);
    });

    // Helper for direction arrows
    Handlebars.registerHelper('directionIcon', (direction: string) => {
      return direction === 'up' ? '📈' : direction === 'down' ? '📉' : '📊';
    });

    // Helper for priority styling
    Handlebars.registerHelper('priorityColor', (priority: string) => {
      switch (priority) {
        case 'urgent': return '#ff4444';
        case 'high': return '#ff8800';
        case 'normal': return '#0088ff';
        case 'low': return '#888888';
        default: return '#0088ff';
      }
    });

    // Helper for date formatting
    Handlebars.registerHelper('formatDate', (date: string | Date) => {
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    });

    // Helper for short date
    Handlebars.registerHelper('shortDate', (date: string | Date) => {
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    });

    // Helper for truncating transaction hash
    Handlebars.registerHelper('shortHash', (hash: string, length = 8) => {
      if (!hash || hash.length <= length * 2) return hash;
      return `${hash.slice(0, length)}...${hash.slice(-length)}`;
    });

    // Helper for token symbol formatting
    Handlebars.registerHelper('tokenSymbol', (symbol: string) => {
      return symbol?.toUpperCase() || 'TOKEN';
    });

    logger.info('Handlebars helpers registered');
  }

  async getTemplate(templateKey: string, channel: NotificationChannel): Promise<NotificationTemplate | null> {
    const cacheKey = `${templateKey}:${channel}`;
    
    // Check cache first
    const cached = this.templateCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const template = await this.db.getTemplate(templateKey, channel);
      
      if (template) {
        // Cache the template
        this.templateCache.set(cacheKey, template);
        
        // Set cache expiration
        setTimeout(() => {
          this.templateCache.delete(cacheKey);
        }, this.cacheTimeout);
        
        logger.debug('Template cached', { templateKey, channel });
      }

      return template;
    } catch (error) {
      logger.error('Failed to get template', { templateKey, channel, error });
      return null;
    }
  }

  async renderTemplate(
    templateKey: string, 
    channel: NotificationChannel, 
    variables: TemplateVariables
  ): Promise<{ subject?: string; content: string; html?: string }> {
    const template = await this.getTemplate(templateKey, channel);
    
    if (!template) {
      throw new Error(`Template not found: ${templateKey} for channel ${channel}`);
    }

    try {
      // Prepare variables with defaults
      const templateVars = {
        ...variables,
        timestamp: variables.timestamp || new Date().toISOString(),
        appUrl: variables.appUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://moonx.farm'
      };

      // Render content
      const contentTemplate = Handlebars.compile(template.contentTemplate);
      const content = contentTemplate(templateVars);

      // Render subject if exists
      let subject: string | undefined;
      if (template.subjectTemplate) {
        const subjectTemplate = Handlebars.compile(template.subjectTemplate);
        subject = subjectTemplate(templateVars);
      }

      // Render HTML if exists
      let html: string | undefined;
      if (template.htmlTemplate) {
        const htmlTemplate = Handlebars.compile(template.htmlTemplate);
        html = htmlTemplate(templateVars);
      }

      logger.debug('Template rendered successfully', { 
        templateKey, 
        channel, 
        hasSubject: !!subject, 
        hasHtml: !!html 
      });

      return { subject, content, html };
    } catch (error) {
      logger.error('Failed to render template', { templateKey, channel, error });
      throw new Error(`Template rendering failed: ${error}`);
    }
  }

  async validateTemplate(
    templateKey: string,
    channel: NotificationChannel,
    variables: TemplateVariables
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      const template = await this.getTemplate(templateKey, channel);
      
      if (!template) {
        errors.push(`Template not found: ${templateKey} for channel ${channel}`);
        return { valid: false, errors };
      }

      // Check if all required variables are provided
      const requiredVars = template.variables || [];
      for (const varName of requiredVars) {
        if (!(varName in variables)) {
          errors.push(`Missing required variable: ${varName}`);
        }
      }

      // Try to compile templates
      try {
        Handlebars.compile(template.contentTemplate);
      } catch (error) {
        errors.push(`Content template compilation error: ${error}`);
      }

      if (template.subjectTemplate) {
        try {
          Handlebars.compile(template.subjectTemplate);
        } catch (error) {
          errors.push(`Subject template compilation error: ${error}`);
        }
      }

      if (template.htmlTemplate) {
        try {
          Handlebars.compile(template.htmlTemplate);
        } catch (error) {
          errors.push(`HTML template compilation error: ${error}`);
        }
      }

      return { valid: errors.length === 0, errors };
    } catch (error) {
      errors.push(`Template validation failed: ${error}`);
      return { valid: false, errors };
    }
  }

  async previewTemplate(
    templateKey: string,
    channel: NotificationChannel,
    sampleVariables?: Partial<TemplateVariables>
  ): Promise<{ subject?: string; content: string; html?: string }> {
    // Provide sample data for preview
    const defaultSampleVars: TemplateVariables = {
      userId: 'user-123',
      timestamp: new Date().toISOString(),
      appUrl: 'https://moonx.farm',
      
      // Trading variables
      orderType: 'limit',
      amount: '100.00',
      tokenSymbol: 'USDC',
      price: '1.00',
      transactionHash: '0x1234567890abcdef1234567890abcdef12345678',
      explorerUrl: 'https://basescan.org/tx/0x1234567890abcdef1234567890abcdef12345678',
      
      // Price alert variables
      currentPrice: '2500.00',
      previousPrice: '2400.00',
      changePercent: '4.17',
      direction: 'up',
      
      // Portfolio variables
      currentValue: '10000.00',
      previousValue: '9500.00',
      pnl: '+500.00',
      
      // Security variables
      action: 'login',
      ipAddress: '192.168.1.1',
      location: 'San Francisco, CA',
      
      // System variables
      maintenanceStart: new Date().toISOString(),
      maintenanceEnd: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      version: '1.0.0'
    };

    const variables = { ...defaultSampleVars, ...sampleVariables };
    return this.renderTemplate(templateKey, channel, variables);
  }

  async getAllTemplates(): Promise<NotificationTemplate[]> {
    try {
      return await this.db.getAllTemplates();
    } catch (error) {
      logger.error('Failed to get all templates', { error });
      throw error;
    }
  }

  clearCache(): void {
    this.templateCache.clear();
    logger.info('Template cache cleared');
  }

  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.templateCache.size,
      keys: Array.from(this.templateCache.keys())
    };
  }

  // Common template rendering utilities
  private async renderNotificationForAllChannels(
    templateKey: string,
    variables: TemplateVariables
  ): Promise<Record<NotificationChannel, { subject?: string; content: string; html?: string }>> {
    const results: Record<string, any> = {};

    const channels = [
      NotificationChannel.WEBSOCKET,
      NotificationChannel.FCM,
      NotificationChannel.EMAIL,
      NotificationChannel.TELEGRAM
    ];

    for (const channel of channels) {
      try {
        results[channel] = await this.renderTemplate(templateKey, channel, variables);
      } catch (error) {
        logger.warn('Failed to render template for channel', { channel, error });
        // Provide fallback content based on template key
        results[channel] = this.getFallbackContent(templateKey, variables);
      }
    }

    return results as Record<NotificationChannel, { subject?: string; content: string; html?: string }>;
  }

  private getFallbackContent(templateKey: string, variables: TemplateVariables): { content: string } {
    switch (templateKey) {
      case 'order_filled':
        return {
          content: `Your ${variables.orderType || 'order'} for ${variables.amount} ${variables.tokenSymbol} has been filled!`
        };
      case 'price_alert':
        return {
          content: `${variables.tokenSymbol} price ${variables.direction} $${variables.currentPrice} (${variables.changePercent}%)`
        };
      case 'portfolio_update':
        return {
          content: `Your portfolio value ${variables.direction} ${variables.changePercent}% to $${variables.currentValue}`
        };
      default:
        return {
          content: 'You have a new notification from MoonXFarm'
        };
    }
  }

  async renderOrderFilledNotification(variables: {
    orderType: string;
    amount: string;
    tokenSymbol: string;
    transactionHash: string;
    explorerUrl?: string;
  }): Promise<Record<NotificationChannel, { subject?: string; content: string; html?: string }>> {
    const templateVars: TemplateVariables = {
      userId: 'user', // Will be replaced with actual userId
      timestamp: new Date().toISOString(),
      appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://moonx.farm',
      ...variables
    };

    return this.renderNotificationForAllChannels('order_filled', templateVars);
  }

  async renderPriceAlertNotification(variables: {
    tokenSymbol: string;
    currentPrice: string;
    changePercent: string;
    direction: 'up' | 'down';
  }): Promise<Record<NotificationChannel, { subject?: string; content: string; html?: string }>> {
    const templateVars: TemplateVariables = {
      userId: 'user',
      timestamp: new Date().toISOString(),
      appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://moonx.farm',
      ...variables
    };

    return this.renderNotificationForAllChannels('price_alert', templateVars);
  }

  async renderPortfolioUpdateNotification(variables: {
    currentValue: string;
    changePercent: string;
    direction: 'up' | 'down';
  }): Promise<Record<NotificationChannel, { subject?: string; content: string; html?: string }>> {
    const templateVars: TemplateVariables = {
      userId: 'user',
      timestamp: new Date().toISOString(),
      appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://moonx.farm',
      ...variables
    };

    return this.renderNotificationForAllChannels('portfolio_update', templateVars);
  }
} 