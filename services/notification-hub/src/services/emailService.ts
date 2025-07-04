import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

interface EmailConfig {
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  from: string;
}

interface EmailNotification {
  to: string;
  subject: string;
  body: string;
  data?: any;
  template?: string;
}

interface EmailResult {
  success: boolean;
  error?: string;
  messageId?: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter;
  private config: EmailConfig;
  private templates: Map<string, any> = new Map();

  constructor(config: EmailConfig) {
    this.config = config;
    this.initializeTransporter();
    this.loadTemplates();
  }

  private initializeTransporter() {
    this.transporter = nodemailer.createTransporter(this.config.smtp);
    
    // Verify connection
    this.transporter.verify((error) => {
      if (error) {
        logger.error('Email transporter verification failed:', error);
      } else {
        logger.info('Email transporter ready');
      }
    });
  }

  private loadTemplates() {
    // Load email templates
    this.templates.set('swap_completed', {
      subject: 'Swap Completed - MoonXFarm',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Swap Completed Successfully</h2>
          <p>Your swap transaction has been completed.</p>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Transaction Details</h3>
            <p><strong>From:</strong> {{fromToken}} {{fromAmount}}</p>
            <p><strong>To:</strong> {{toToken}} {{toAmount}}</p>
            <p><strong>Transaction Hash:</strong> <a href="{{explorerUrl}}" target="_blank">{{txHash}}</a></p>
          </div>
          <p>Thank you for using MoonXFarm!</p>
        </div>
      `
    });

    this.templates.set('order_filled', {
      subject: 'Order Filled - MoonXFarm',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Order Filled Successfully</h2>
          <p>Your {{orderType}} order has been executed.</p>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Order Details</h3>
            <p><strong>Order ID:</strong> {{orderId}}</p>
            <p><strong>Type:</strong> {{orderType}}</p>
            <p><strong>Amount:</strong> {{amount}}</p>
            <p><strong>Price:</strong> {{price}}</p>
          </div>
          <p>Thank you for trading with MoonXFarm!</p>
        </div>
      `
    });

    this.templates.set('price_alert', {
      subject: 'Price Alert - MoonXFarm',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Price Alert Triggered</h2>
          <p>{{symbol}} has reached your target price!</p>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Alert Details</h3>
            <p><strong>Symbol:</strong> {{symbol}}</p>
            <p><strong>Current Price:</strong> ${{currentPrice}}</p>
            <p><strong>Target Price:</strong> ${{targetPrice}}</p>
            <p><strong>Direction:</strong> {{direction}}</p>
          </div>
          <p>Start trading on MoonXFarm now!</p>
        </div>
      `
    });

    this.templates.set('system_message', {
      subject: 'System Notification - MoonXFarm',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>{{title}}</h2>
          <p>{{body}}</p>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Timestamp:</strong> {{timestamp}}</p>
          </div>
          <p>Best regards,<br>MoonXFarm Team</p>
        </div>
      `
    });

    logger.info('Email templates loaded');
  }

  async sendNotification(notification: EmailNotification): Promise<EmailResult> {
    try {
      const template = this.templates.get(notification.template || 'default');
      
      let htmlContent: string;
      let subject: string;

      if (template) {
        // Use template
        htmlContent = this.renderTemplate(template.html, notification.data);
        subject = this.renderTemplate(template.subject, notification.data) || notification.subject;
      } else {
        // Use plain content
        htmlContent = this.generatePlainHtml(notification.subject, notification.body);
        subject = notification.subject;
      }

      const mailOptions = {
        from: this.config.from,
        to: notification.to,
        subject,
        html: htmlContent,
        text: this.stripHtml(htmlContent)
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      logger.info(`Email sent successfully to ${notification.to}, messageId: ${result.messageId}`);
      
      return {
        success: true,
        messageId: result.messageId
      };
    } catch (error) {
      logger.error(`Error sending email to ${notification.to}:`, error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  private renderTemplate(template: string, data: any): string {
    if (!data) return template;
    
    let rendered = template;
    
    // Replace placeholders
    Object.keys(data).forEach(key => {
      const placeholder = `{{${key}}}`;
      const value = data[key];
      rendered = rendered.replace(new RegExp(placeholder, 'g'), value);
    });

    return rendered;
  }

  private generatePlainHtml(title: string, body: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${title}</h2>
        <p>${body}</p>
        <hr style="margin: 20px 0;">
        <p style="font-size: 12px; color: #666;">
          This email was sent from MoonXFarm notification system.
        </p>
      </div>
    `;
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  async sendBatchNotifications(notifications: EmailNotification[]): Promise<EmailResult[]> {
    const results: EmailResult[] = [];
    
    // Send emails in batches to avoid overwhelming SMTP server
    const batchSize = 10;
    const batches = [];
    
    for (let i = 0; i < notifications.length; i += batchSize) {
      batches.push(notifications.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      const batchPromises = batch.map(notification => 
        this.sendNotification(notification)
      );

      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            success: false,
            error: result.reason.message || 'Unknown error'
          });
        }
      });

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    logger.info(`Batch email send completed: ${results.length} emails processed`);
    return results;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      logger.error('Email service connection test failed:', error);
      return false;
    }
  }

  async getStats(): Promise<any> {
    return {
      service: 'email',
      provider: 'smtp',
      host: this.config.smtp.host,
      port: this.config.smtp.port,
      secure: this.config.smtp.secure,
      templatesLoaded: this.templates.size,
      connectionStatus: await this.testConnection()
    };
  }
} 