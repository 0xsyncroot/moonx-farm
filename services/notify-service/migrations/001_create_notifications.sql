-- Notification Service Database Schema
-- Compatible with existing moonx_farm database

-- User notification preferences table
CREATE TABLE IF NOT EXISTS user_notification_preferences (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    websocket_enabled BOOLEAN DEFAULT TRUE,
    fcm_enabled BOOLEAN DEFAULT TRUE,
    email_enabled BOOLEAN DEFAULT FALSE,
    telegram_enabled BOOLEAN DEFAULT FALSE,
    email_address VARCHAR(255),
    telegram_chat_id VARCHAR(255),
    telegram_username VARCHAR(255),
    fcm_token VARCHAR(512),
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notification templates table
CREATE TABLE IF NOT EXISTS notification_templates (
    id SERIAL PRIMARY KEY,
    template_key VARCHAR(100) NOT NULL UNIQUE,
    template_name VARCHAR(255) NOT NULL,
    channel VARCHAR(50) NOT NULL, -- websocket, fcm, email, telegram
    subject_template TEXT,
    content_template TEXT NOT NULL,
    html_template TEXT,
    variables JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    notification_type VARCHAR(100) NOT NULL, -- trading, price_alert, portfolio, security, system
    template_key VARCHAR(100),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, urgent
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notification delivery attempts table
CREATE TABLE IF NOT EXISTS notification_deliveries (
    id SERIAL PRIMARY KEY,
    notification_id INTEGER NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    channel VARCHAR(50) NOT NULL, -- websocket, fcm, email, telegram
    status VARCHAR(50) NOT NULL, -- pending, sent, delivered, failed, skipped
    recipient VARCHAR(255), -- email address, telegram chat_id, fcm token
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    failed_at TIMESTAMP,
    failure_reason TEXT,
    response_data JSONB,
    retry_count INTEGER DEFAULT 0,
    next_retry_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notification queue table (for batch processing)
CREATE TABLE IF NOT EXISTS notification_queue (
    id SERIAL PRIMARY KEY,
    notification_id INTEGER NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    channel VARCHAR(50) NOT NULL,
    priority INTEGER DEFAULT 0,
    scheduled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processing_at TIMESTAMP,
    processed_at TIMESTAMP,
    failed_at TIMESTAMP,
    failure_reason TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notification metrics table
CREATE TABLE IF NOT EXISTS notification_metrics (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    channel VARCHAR(50) NOT NULL,
    notification_type VARCHAR(100) NOT NULL,
    total_sent INTEGER DEFAULT 0,
    total_delivered INTEGER DEFAULT 0,
    total_failed INTEGER DEFAULT 0,
    avg_delivery_time_ms INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, channel, notification_type)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_notification_preferences_user_id ON user_notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_expires_at ON notifications(expires_at);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_notification_id ON notification_deliveries(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_channel ON notification_deliveries(channel);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_status ON notification_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_sent_at ON notification_deliveries(sent_at);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_next_retry_at ON notification_deliveries(next_retry_at);

CREATE INDEX IF NOT EXISTS idx_notification_queue_channel ON notification_queue(channel);
CREATE INDEX IF NOT EXISTS idx_notification_queue_priority ON notification_queue(priority);
CREATE INDEX IF NOT EXISTS idx_notification_queue_scheduled_at ON notification_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_notification_queue_processing_at ON notification_queue(processing_at);

CREATE INDEX IF NOT EXISTS idx_notification_metrics_date ON notification_metrics(date);
CREATE INDEX IF NOT EXISTS idx_notification_metrics_channel ON notification_metrics(channel);

-- Update timestamp triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_notification_preferences_updated_at 
    BEFORE UPDATE ON user_notification_preferences 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_templates_updated_at 
    BEFORE UPDATE ON notification_templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notifications_updated_at 
    BEFORE UPDATE ON notifications 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_deliveries_updated_at 
    BEFORE UPDATE ON notification_deliveries 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_metrics_updated_at 
    BEFORE UPDATE ON notification_metrics 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default notification templates
INSERT INTO notification_templates (template_key, template_name, channel, subject_template, content_template, html_template, variables) 
VALUES 
    ('order_filled', 'Order Filled', 'websocket', NULL, 'Your {{orderType}} order for {{amount}} {{tokenSymbol}} has been filled!', NULL, '["orderType", "amount", "tokenSymbol", "transactionHash"]'),
    ('order_filled', 'Order Filled', 'fcm', 'Order Filled', 'Your {{orderType}} order for {{amount}} {{tokenSymbol}} has been filled!', NULL, '["orderType", "amount", "tokenSymbol", "transactionHash"]'),
    ('order_filled', 'Order Filled', 'email', 'Order Filled - MoonXFarm', 'Your {{orderType}} order for {{amount}} {{tokenSymbol}} has been filled!', '<h2>Order Filled</h2><p>Your {{orderType}} order for <strong>{{amount}} {{tokenSymbol}}</strong> has been filled!</p><p>Transaction: <a href="{{explorerUrl}}">{{transactionHash}}</a></p>', '["orderType", "amount", "tokenSymbol", "transactionHash", "explorerUrl"]'),
    ('order_filled', 'Order Filled', 'telegram', NULL, '🎉 Your {{orderType}} order for {{amount}} {{tokenSymbol}} has been filled!\n\nTransaction: {{transactionHash}}', NULL, '["orderType", "amount", "tokenSymbol", "transactionHash"]'),
    
    ('price_alert', 'Price Alert', 'websocket', NULL, '{{tokenSymbol}} price {{direction}} ${{currentPrice}} ({{changePercent}}%)', NULL, '["tokenSymbol", "direction", "currentPrice", "changePercent"]'),
    ('price_alert', 'Price Alert', 'fcm', 'Price Alert', '{{tokenSymbol}} price {{direction}} ${{currentPrice}} ({{changePercent}}%)', NULL, '["tokenSymbol", "direction", "currentPrice", "changePercent"]'),
    ('price_alert', 'Price Alert', 'email', 'Price Alert - {{tokenSymbol}} - MoonXFarm', '{{tokenSymbol}} price {{direction}} ${{currentPrice}} ({{changePercent}}%)', '<h2>Price Alert</h2><p><strong>{{tokenSymbol}}</strong> price {{direction}} <strong>${{currentPrice}}</strong> ({{changePercent}}%)</p>', '["tokenSymbol", "direction", "currentPrice", "changePercent"]'),
    ('price_alert', 'Price Alert', 'telegram', NULL, '📈 {{tokenSymbol}} price {{direction}} ${{currentPrice}} ({{changePercent}}%)', NULL, '["tokenSymbol", "direction", "currentPrice", "changePercent"]'),
    
    ('portfolio_update', 'Portfolio Update', 'websocket', NULL, 'Your portfolio value {{direction}} {{changePercent}}% to ${{currentValue}}', NULL, '["direction", "changePercent", "currentValue"]'),
    ('portfolio_update', 'Portfolio Update', 'fcm', 'Portfolio Update', 'Your portfolio value {{direction}} {{changePercent}}% to ${{currentValue}}', NULL, '["direction", "changePercent", "currentValue"]'),
    ('portfolio_update', 'Portfolio Update', 'email', 'Portfolio Update - MoonXFarm', 'Your portfolio value {{direction}} {{changePercent}}% to ${{currentValue}}', '<h2>Portfolio Update</h2><p>Your portfolio value {{direction}} <strong>{{changePercent}}%</strong> to <strong>${{currentValue}}</strong></p>', '["direction", "changePercent", "currentValue"]'),
    ('portfolio_update', 'Portfolio Update', 'telegram', NULL, '💰 Your portfolio value {{direction}} {{changePercent}}% to ${{currentValue}}', NULL, '["direction", "changePercent", "currentValue"]');

-- Insert default user preferences for existing users (if any)
-- This would be handled by the application when users first access the notification service 