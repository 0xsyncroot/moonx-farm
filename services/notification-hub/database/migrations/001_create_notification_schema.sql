-- ==========================================================================
-- Migration: 001_create_notification_schema.sql
-- Description: Create MoonX Farm notification system database schema
-- Version: 1.0.0
-- Created: 2024-01-15
-- Author: MoonX Farm Team
-- ==========================================================================

-- Create migration tracking table
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    description TEXT,
    rollback_sql TEXT
);

-- ==========================================================================
-- CORE NOTIFICATION SYSTEM TABLES
-- ==========================================================================

-- 1. Main notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'medium',
    channels JSONB NOT NULL DEFAULT '["websocket"]'::jsonb,
    data JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE
);

-- Add constraints for notifications table (only if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'chk_notifications_priority' 
                   AND table_name = 'notifications') THEN
        ALTER TABLE notifications ADD CONSTRAINT chk_notifications_priority 
        CHECK (priority IN ('low', 'medium', 'high', 'urgent'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'chk_notifications_status' 
                   AND table_name = 'notifications') THEN
        ALTER TABLE notifications ADD CONSTRAINT chk_notifications_status 
        CHECK (status IN ('pending', 'processing', 'delivered', 'failed', 'expired', 'cancelled'));
    END IF;
END $$;

-- 2. User preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id VARCHAR(255) PRIMARY KEY,
    preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    enabled_channels JSONB DEFAULT '["websocket", "push"]'::jsonb,
    timezone VARCHAR(50) DEFAULT 'UTC',
    quiet_hours JSONB DEFAULT '{}'::jsonb,
    frequency_limits JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Notification templates table
CREATE TABLE IF NOT EXISTS notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    title_template TEXT NOT NULL,
    body_template TEXT NOT NULL,
    default_priority VARCHAR(20) DEFAULT 'medium',
    default_channels JSONB DEFAULT '["websocket"]'::jsonb,
    variables JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add unique constraint for notification templates
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'notification_templates_type_unique' 
                   AND table_name = 'notification_templates') THEN
        ALTER TABLE notification_templates ADD CONSTRAINT notification_templates_type_unique 
        UNIQUE (type);
    END IF;
END $$;

-- ==========================================================================
-- PRICE AND VOLUME ALERTS
-- ==========================================================================

-- 4. Price alerts table
CREATE TABLE IF NOT EXISTS price_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    base_token VARCHAR(42) NOT NULL,
    quote_token VARCHAR(42) NOT NULL,
    target_price DECIMAL(20,8) NOT NULL,
    current_price DECIMAL(20,8),
    direction VARCHAR(10) NOT NULL,
    percentage_change DECIMAL(5,2),
    condition_type VARCHAR(20) DEFAULT 'absolute',
    timeframe VARCHAR(20) DEFAULT '1h',
    is_active BOOLEAN DEFAULT true,
    is_repeating BOOLEAN DEFAULT false,
    triggered_count INTEGER DEFAULT 0,
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add constraints for price alerts
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'chk_price_direction' 
                   AND table_name = 'price_alerts') THEN
        ALTER TABLE price_alerts ADD CONSTRAINT chk_price_direction 
        CHECK (direction IN ('above', 'below', 'change'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'chk_price_condition_type' 
                   AND table_name = 'price_alerts') THEN
        ALTER TABLE price_alerts ADD CONSTRAINT chk_price_condition_type 
        CHECK (condition_type IN ('absolute', 'percentage', 'moving_average'));
    END IF;
END $$;

-- 5. Volume alerts table
CREATE TABLE IF NOT EXISTS volume_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    base_token VARCHAR(42) NOT NULL,
    quote_token VARCHAR(42) NOT NULL,
    volume_threshold DECIMAL(20,8) NOT NULL,
    volume_type VARCHAR(20) DEFAULT 'usd',
    timeframe VARCHAR(20) DEFAULT '1h',
    condition VARCHAR(20) DEFAULT 'above',
    baseline_volume DECIMAL(20,8),
    spike_multiplier DECIMAL(4,2) DEFAULT 2.0,
    is_active BOOLEAN DEFAULT true,
    is_repeating BOOLEAN DEFAULT false,
    triggered_count INTEGER DEFAULT 0,
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add constraints for volume alerts
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'chk_volume_type' 
                   AND table_name = 'volume_alerts') THEN
        ALTER TABLE volume_alerts ADD CONSTRAINT chk_volume_type 
        CHECK (volume_type IN ('usd', 'token', 'percentage'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'chk_volume_condition' 
                   AND table_name = 'volume_alerts') THEN
        ALTER TABLE volume_alerts ADD CONSTRAINT chk_volume_condition 
        CHECK (condition IN ('above', 'below', 'spike'));
    END IF;
END $$;

-- ==========================================================================
-- WALLET TRACKING SYSTEM
-- ==========================================================================

-- 6. Tracked wallets table
CREATE TABLE IF NOT EXISTS tracked_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    wallet_address VARCHAR(42) NOT NULL,
    wallet_label VARCHAR(100),
    wallet_type VARCHAR(20) DEFAULT 'unknown',
    tracking_settings JSONB DEFAULT '{}'::jsonb,
    notification_settings JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add unique constraint for tracked wallets
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'tracked_wallets_user_wallet_unique' 
                   AND table_name = 'tracked_wallets') THEN
        ALTER TABLE tracked_wallets ADD CONSTRAINT tracked_wallets_user_wallet_unique 
        UNIQUE (user_id, wallet_address);
    END IF;
END $$;

-- 7. Wallet activity alerts table
CREATE TABLE IF NOT EXISTS wallet_activity_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    tracked_wallet_id UUID NOT NULL,
    activity_type VARCHAR(50) NOT NULL,
    threshold_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add constraints for wallet activity alerts
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'chk_wallet_activity_type' 
                   AND table_name = 'wallet_activity_alerts') THEN
        ALTER TABLE wallet_activity_alerts ADD CONSTRAINT chk_wallet_activity_type 
        CHECK (activity_type IN ('large_transaction', 'new_position', 'liquidation', 'swap', 'transfer', 'deposit', 'withdrawal'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'fk_wallet_activity_tracked_wallet' 
                   AND table_name = 'wallet_activity_alerts') THEN
        ALTER TABLE wallet_activity_alerts ADD CONSTRAINT fk_wallet_activity_tracked_wallet 
        FOREIGN KEY (tracked_wallet_id) REFERENCES tracked_wallets(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 8. Whale alerts table
CREATE TABLE IF NOT EXISTS whale_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    token_address VARCHAR(42) NOT NULL,
    min_value_usd DECIMAL(20,8) NOT NULL DEFAULT 100000,
    transaction_types JSONB DEFAULT '["swap", "transfer"]'::jsonb,
    exclude_known_addresses JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================================================
-- DELIVERY TRACKING AND ANALYTICS
-- ==========================================================================

-- 9. Notification deliveries table
CREATE TABLE IF NOT EXISTS notification_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL,
    channel VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    delivered_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add constraints for notification deliveries
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'chk_delivery_status' 
                   AND table_name = 'notification_deliveries') THEN
        ALTER TABLE notification_deliveries ADD CONSTRAINT chk_delivery_status 
        CHECK (status IN ('pending', 'delivered', 'failed', 'cancelled'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'fk_delivery_notification' 
                   AND table_name = 'notification_deliveries') THEN
        ALTER TABLE notification_deliveries ADD CONSTRAINT fk_delivery_notification 
        FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 10. User engagement table
CREATE TABLE IF NOT EXISTS user_engagement (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    notification_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Add constraints for user engagement
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'chk_engagement_action' 
                   AND table_name = 'user_engagement') THEN
        ALTER TABLE user_engagement ADD CONSTRAINT chk_engagement_action 
        CHECK (action IN ('delivered', 'opened', 'clicked', 'dismissed'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'fk_engagement_notification' 
                   AND table_name = 'user_engagement') THEN
        ALTER TABLE user_engagement ADD CONSTRAINT fk_engagement_notification 
        FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE;
    END IF;
END $$;

-- ==========================================================================
-- PERFORMANCE INDEXES
-- ==========================================================================

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at);

-- Price alerts indexes
CREATE INDEX IF NOT EXISTS idx_price_alerts_user_id ON price_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_price_alerts_symbol ON price_alerts(symbol);
CREATE INDEX IF NOT EXISTS idx_price_alerts_active ON price_alerts(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_price_alerts_user_active ON price_alerts(user_id, is_active) WHERE is_active = true;

-- Volume alerts indexes
CREATE INDEX IF NOT EXISTS idx_volume_alerts_user_id ON volume_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_volume_alerts_symbol ON volume_alerts(symbol);
CREATE INDEX IF NOT EXISTS idx_volume_alerts_active ON volume_alerts(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_volume_alerts_user_active ON volume_alerts(user_id, is_active) WHERE is_active = true;

-- Tracked wallets indexes
CREATE INDEX IF NOT EXISTS idx_tracked_wallets_user_id ON tracked_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_tracked_wallets_address ON tracked_wallets(wallet_address);
CREATE INDEX IF NOT EXISTS idx_tracked_wallets_active ON tracked_wallets(is_active) WHERE is_active = true;

-- Wallet activity alerts indexes
CREATE INDEX IF NOT EXISTS idx_wallet_activity_user_id ON wallet_activity_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_activity_tracked_wallet ON wallet_activity_alerts(tracked_wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_activity_type ON wallet_activity_alerts(activity_type);

-- Whale alerts indexes
CREATE INDEX IF NOT EXISTS idx_whale_alerts_user_id ON whale_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_whale_alerts_symbol ON whale_alerts(symbol);
CREATE INDEX IF NOT EXISTS idx_whale_alerts_token ON whale_alerts(token_address);
CREATE INDEX IF NOT EXISTS idx_whale_alerts_active ON whale_alerts(is_active) WHERE is_active = true;

-- Delivery tracking indexes
CREATE INDEX IF NOT EXISTS idx_deliveries_notification_id ON notification_deliveries(notification_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_channel ON notification_deliveries(channel);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON notification_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_created_at ON notification_deliveries(created_at);

-- User engagement indexes
CREATE INDEX IF NOT EXISTS idx_engagement_user_id ON user_engagement(user_id);
CREATE INDEX IF NOT EXISTS idx_engagement_notification_id ON user_engagement(notification_id);
CREATE INDEX IF NOT EXISTS idx_engagement_action ON user_engagement(action);
CREATE INDEX IF NOT EXISTS idx_engagement_timestamp ON user_engagement(timestamp);

-- ==========================================================================
-- BASIC NOTIFICATION TEMPLATES
-- ==========================================================================

-- Insert default notification templates
INSERT INTO notification_templates (type, category, title_template, body_template, default_priority, variables) 
VALUES 
    ('price_alert', 'market', 'Price Alert: {{symbol}}', '{{symbol}} has reached {{target_price}} USD', 'medium', '["symbol", "target_price"]'),
    ('volume_alert', 'market', 'Volume Alert: {{symbol}}', '{{symbol}} volume spike detected: {{volume}}', 'medium', '["symbol", "volume"]'),
    ('whale_alert', 'market', 'Whale Alert: {{symbol}}', 'Large transaction detected: {{amount}} {{symbol}}', 'high', '["symbol", "amount"]'),
    ('wallet_activity', 'tracking', 'Wallet Activity', 'Activity detected on {{wallet_label}}: {{activity_type}}', 'medium', '["wallet_label", "activity_type"]'),
    ('system_alert', 'system', 'System Alert', 'System notification: {{message}}', 'urgent', '["message"]'),
    ('welcome', 'user', 'Welcome to MoonX Farm', 'Welcome {{username}}! Your account is ready.', 'low', '["username"]')
ON CONFLICT (type) DO NOTHING;

-- ==========================================================================
-- RECORD MIGRATION SUCCESS
-- ==========================================================================

-- Record this migration
INSERT INTO schema_migrations (version, description, rollback_sql) VALUES 
('001', 'Initial notification system schema: 10 tables with full indexes and constraints', 
 'DROP TABLE IF EXISTS user_engagement, notification_deliveries, whale_alerts, wallet_activity_alerts, tracked_wallets, volume_alerts, price_alerts, notification_templates, user_preferences, notifications, schema_migrations CASCADE;')
ON CONFLICT (version) DO NOTHING;

-- ==========================================================================
-- VERIFICATION QUERIES
-- ==========================================================================

-- Verify tables were created
SELECT 
    'Migration completed successfully' as status,
    COUNT(*) as tables_created,
    CURRENT_TIMESTAMP as completed_at
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('notifications', 'user_preferences', 'notification_templates', 
                   'price_alerts', 'volume_alerts', 'tracked_wallets', 
                   'wallet_activity_alerts', 'whale_alerts', 'notification_deliveries', 
                   'user_engagement', 'schema_migrations'); 