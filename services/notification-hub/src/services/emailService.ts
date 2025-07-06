import { createLogger } from '@moonx-farm/common';
import sgMail from '@sendgrid/mail';

const logger = createLogger('EmailService');

interface EmailConfig {
  sendgrid: {
    apiKey: string;
    fromEmail: string;
    fromName: string;
  };
  smtp?: {
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

interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  templateId?: string;
  templateData?: Record<string, any>;
  attachments?: Array<{
    filename: string;
    content: string;
    type: string;
  }>;
}

export class EmailService {
  private config: EmailConfig;
  private isInitialized: boolean = false;

  constructor(config: EmailConfig) {
    this.config = config;
    this.initializeSendGrid();
  }

  private initializeSendGrid(): void {
    try {
      if (!this.config.sendgrid.apiKey) {
        throw new Error('SendGrid API key not provided');
      }
      
      if (!this.config.sendgrid.fromEmail) {
        throw new Error('SendGrid from email not provided');
      }

      // Initialize SendGrid with API key
      sgMail.setApiKey(this.config.sendgrid.apiKey);
      this.isInitialized = true;
      logger.info('SendGrid email service initialized successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to initialize SendGrid: ${errorMessage}`);
      this.isInitialized = false;
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.isInitialized) {
      logger.error('Email service not initialized');
      return false;
    }

    try {
      // Validate email address
      if (!this.isValidEmail(options.to)) {
        logger.error(`Invalid email address: ${options.to}`);
        return false;
      }

      // Validate required fields
      if (!options.subject || (!options.text && !options.html && !options.templateId)) {
        logger.error('Email must have subject and content (text, html, or templateId)');
        return false;
      }

      const msg: any = {
        to: options.to,
        from: {
          email: this.config.sendgrid.fromEmail,
          name: this.config.sendgrid.fromName
        },
        subject: options.subject
      };

      // Add content based on what's provided
      if (options.templateId) {
        msg.templateId = options.templateId;
        if (options.templateData) {
          msg.dynamicTemplateData = options.templateData;
        }
      } else {
        if (options.text) {
          msg.text = options.text;
        }
        if (options.html) {
          msg.html = options.html;
        }
      }

      // Add attachments if provided
      if (options.attachments && options.attachments.length > 0) {
        msg.attachments = options.attachments;
      }

      // Send email via SendGrid
      const [response] = await sgMail.send(msg);
      
      if (response.statusCode >= 200 && response.statusCode < 300) {
        logger.info(`Email sent successfully to ${options.to}`, {
          statusCode: response.statusCode,
          messageId: response.headers['x-message-id']
        });
        return true;
      } else {
        logger.error(`SendGrid returned non-success status: ${response.statusCode}`);
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to send email to ${options.to}: ${errorMessage}`, {
        error: error instanceof Error ? error.stack : error
      });
      return false;
    }
  }

  async sendNotificationEmail(
    userId: string,
    email: string,
    title: string,
    body: string,
    data?: any
  ): Promise<boolean> {
    try {
      const emailOptions: EmailOptions = {
        to: email,
        subject: title,
        text: body,
        html: this.createNotificationHTML(title, body, data),
        templateData: {
          title,
          body,
          data: data || {},
          userId
        }
      };

      return await this.sendEmail(emailOptions);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to send notification email: ${errorMessage}`);
      return false;
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  async sendBulkEmails(emails: EmailOptions[]): Promise<{ success: number; failed: number }> {
    if (!this.isInitialized) {
      logger.error('Email service not initialized');
      return { success: 0, failed: emails.length };
    }

    if (emails.length === 0) {
      logger.info('No emails to send');
      return { success: 0, failed: 0 };
    }

    let success = 0;
    let failed = 0;

    // Process in batches of 10 to avoid rate limits
    const batchSize = 10;
    const totalBatches = Math.ceil(emails.length / batchSize);
    
    logger.info(`Starting bulk email send: ${emails.length} emails in ${totalBatches} batches`);

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      
      try {
        logger.debug(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} emails)`);
        
        const sendPromises = batch.map(emailOptions => this.sendEmail(emailOptions));
        const results = await Promise.allSettled(sendPromises);
        
        results.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value) {
            success++;
          } else {
            failed++;
            const email = batch[index];
            if (result.status === 'rejected' && email) {
              logger.error(`Failed to send email to ${email.to}: ${result.reason}`);
            }
          }
        });

        // Rate limiting: wait 100ms between batches
        if (i + batchSize < emails.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Batch ${batchNumber} email sending failed: ${errorMessage}`);
        failed += batch.length;
      }
    }

    logger.info(`Bulk email completed: ${success} success, ${failed} failed (${emails.length} total)`);
    return { success, failed };
  }

  async sendTemplatedEmail(
    to: string,
    templateId: string,
    templateData: Record<string, any>
  ): Promise<boolean> {
    return await this.sendEmail({
      to,
      subject: '', // Will be set by template
      templateId,
      templateData
    });
  }

  private createNotificationHTML(title: string, body: string, data?: any): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>${title}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .header { background-color: #4f46e5; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { padding: 20px; }
            .footer { background-color: #f8f9fa; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #666; }
            .button { display: inline-block; background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
            .data-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            .data-table th, .data-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            .data-table th { background-color: #f8f9fa; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚀 MoonX Farm</h1>
              <h2>${title}</h2>
            </div>
            <div class="content">
              <p>${body}</p>
              ${data ? this.formatDataForHTML(data) : ''}
              <div style="margin-top: 20px;">
                <a href="https://app.moonx.farm" class="button">Open MoonX Farm</a>
              </div>
            </div>
            <div class="footer">
              <p>&copy; 2024 MoonX Farm. All rights reserved.</p>
              <p>You received this email because you subscribed to MoonX Farm notifications.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private formatDataForHTML(data: any): string {
    if (!data || typeof data !== 'object') {
      return '';
    }

    const entries = Object.entries(data);
    if (entries.length === 0) {
      return '';
    }

    const rows = entries.map(([key, value]) => {
      const escapedKey = this.escapeHtml(String(key));
      const escapedValue = this.escapeHtml(this.formatValue(value));
      return `<tr><td><strong>${escapedKey}</strong></td><td>${escapedValue}</td></tr>`;
    }).join('');

    return `
      <table class="data-table">
        <thead>
          <tr>
            <th>Property</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }

  private escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m] || m);
  }

  private formatValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return String(value);
      }
    }
    
    return String(value);
  }

  async healthCheck(): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }

    try {
      // Test SendGrid connection by attempting to send a test email
      // Note: This is a dry run, we won't actually send the email
      const testMsg = {
        to: 'work.hiepht@gmail.com',
        from: {
          email: this.config.sendgrid.fromEmail,
          name: this.config.sendgrid.fromName
        },
        subject: 'Health Check Test',
        text: 'This is a health check test email',
        mailSettings: {
          sandboxMode: {
            enable: true
          }
        }
      };

      await sgMail.send(testMsg);
      logger.debug('Email service health check passed');
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Email service health check failed: ${errorMessage}`);
      return false;
    }
  }

  // Compatibility method for existing code
  async send(options: EmailOptions): Promise<boolean> {
    return await this.sendEmail(options);
  }

  // Get service metrics
  getMetrics(): { initialized: boolean; config: Partial<EmailConfig> } {
    return {
      initialized: this.isInitialized,
      config: {
        sendgrid: {
          fromEmail: this.config.sendgrid.fromEmail,
          fromName: this.config.sendgrid.fromName,
          apiKey: this.config.sendgrid.apiKey ? '***configured***' : 'not configured'
        }
      }
    };
  }

  // Retry failed email with exponential backoff
  async retryEmail(options: EmailOptions, maxRetries: number = 3): Promise<boolean> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.sendEmail(options);
        if (result) {
          if (attempt > 1) {
            logger.info(`Email sent successfully on attempt ${attempt} to ${options.to}`);
          }
          return true;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        logger.warn(`Email attempt ${attempt} failed for ${options.to}: ${lastError.message}`);
        
        if (attempt < maxRetries) {
          // Exponential backoff: wait 2^attempt seconds
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    logger.error(`All ${maxRetries} attempts failed for email to ${options.to}`);
    return false;
  }
} 