-- =================================================================
-- MoonX Farm Notification Hub - Production Database Schema
-- =================================================================
-- Comprehensive notification system for DEX/DeFi platform
-- Based on analysis of: DexTools, Uniswap, PancakeSwap, Zerion, etc.
-- =================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- =================================================================
-- 1. CORE NOTIFICATION TABLES
-- =================================================================

-- Main notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  channels JSONB NOT NULL DEFAULT '["websocket"]',
  data JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  CONSTRAINT chk_priority CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  CONSTRAINT chk_status CHECK (status IN ('pending', 'processing', 'delivered', 'failed', 'expired', 'cancelled'))
);

-- User preferences for notifications
CREATE TABLE user_preferences (
  user_id VARCHAR(255) PRIMARY KEY,
  preferences JSONB NOT NULL DEFAULT '{}',
  enabled_channels JSONB DEFAULT '["websocket", "push"]',
  timezone VARCHAR(50) DEFAULT 'UTC',
  quiet_hours JSONB DEFAULT '{}', -- {"start": "22:00", "end": "08:00"}
  frequency_limits JSONB DEFAULT '{}', -- Rate limiting per notification type
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notification templates for consistency
CREATE TABLE notification_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  title_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  default_priority VARCHAR(20) DEFAULT 'medium',
  default_channels JSONB DEFAULT '["websocket"]',
  variables JSONB DEFAULT '[]', -- Array of required variables
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(type)
);

-- =================================================================
-- 2. PRICE ALERTS & MONITORING
-- =================================================================

-- Price alerts (existing but enhanced)
CREATE TABLE price_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  base_token VARCHAR(42) NOT NULL, -- Token contract address
  quote_token VARCHAR(42) NOT NULL, -- Quote token contract address
  target_price DECIMAL(20,8) NOT NULL,
  current_price DECIMAL(20,8),
  direction VARCHAR(10) NOT NULL, -- 'above', 'below', 'change'
  percentage_change DECIMAL(5,2), -- For percentage-based alerts
  condition_type VARCHAR(20) DEFAULT 'absolute', -- 'absolute', 'percentage', 'moving_average'
  timeframe VARCHAR(20) DEFAULT '1h', -- '1m', '5m', '15m', '1h', '4h', '1d'
  is_active BOOLEAN DEFAULT true,
  is_repeating BOOLEAN DEFAULT false,
  triggered_count INTEGER DEFAULT 0,
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT chk_direction CHECK (direction IN ('above', 'below', 'change')),
  CONSTRAINT chk_condition_type CHECK (condition_type IN ('absolute', 'percentage', 'moving_average'))
);

-- Volume alerts
CREATE TABLE volume_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  base_token VARCHAR(42) NOT NULL,
  quote_token VARCHAR(42) NOT NULL,
  volume_threshold DECIMAL(20,8) NOT NULL,
  volume_type VARCHAR(20) DEFAULT 'usd', -- 'usd', 'token', 'percentage'
  timeframe VARCHAR(20) DEFAULT '1h', -- '1m', '5m', '15m', '1h', '4h', '1d'
  condition VARCHAR(20) DEFAULT 'above', -- 'above', 'below', 'spike'
  baseline_volume DECIMAL(20,8), -- For spike detection
  spike_multiplier DECIMAL(4,2) DEFAULT 2.0, -- 2x, 3x, etc.
  is_active BOOLEAN DEFAULT true,
  is_repeating BOOLEAN DEFAULT false,
  triggered_count INTEGER DEFAULT 0,
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT chk_volume_type CHECK (volume_type IN ('usd', 'token', 'percentage')),
  CONSTRAINT chk_condition CHECK (condition IN ('above', 'below', 'spike'))
);

-- =================================================================
-- 3. WALLET TRACKING & MONITORING
-- =================================================================

-- Wallets being tracked
CREATE TABLE tracked_wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  wallet_address VARCHAR(42) NOT NULL,
  wallet_label VARCHAR(100), -- User-defined label
  wallet_type VARCHAR(20) DEFAULT 'unknown', -- 'whale', 'smart_money', 'institution', 'unknown'
  tracking_settings JSONB DEFAULT '{}',
  notification_settings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Composite unique constraint
  UNIQUE(user_id, wallet_address)
);

-- Wallet activity alerts
CREATE TABLE wallet_activity_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  tracked_wallet_id UUID NOT NULL REFERENCES tracked_wallets(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL, -- 'large_transaction', 'new_position', 'liquidation', 'swap', 'transfer'
  threshold_settings JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT chk_activity_type CHECK (activity_type IN 
    ('large_transaction', 'new_position', 'liquidation', 'swap', 'transfer', 'deposit', 'withdrawal'))
);

-- Large transactions / Whale alerts
CREATE TABLE whale_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  token_address VARCHAR(42) NOT NULL,
  min_value_usd DECIMAL(20,8) NOT NULL DEFAULT 100000, -- $100k+
  transaction_types JSONB DEFAULT '["swap", "transfer"]',
  exclude_known_addresses JSONB DEFAULT '[]', -- CEX addresses to exclude
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =================================================================
-- 4. LIQUIDITY & POOL MONITORING
-- =================================================================

-- Liquidity pool alerts
CREATE TABLE liquidity_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  pool_address VARCHAR(42) NOT NULL,
  pool_symbol VARCHAR(50) NOT NULL, -- e.g., "ETH-USDC"
  dex_name VARCHAR(50) NOT NULL, -- 'uniswap', 'pancakeswap', etc.
  alert_type VARCHAR(30) NOT NULL, -- 'liquidity_change', 'apy_change', 'new_pool'
  threshold_settings JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT chk_liquidity_alert_type CHECK (alert_type IN 
    ('liquidity_change', 'apy_change', 'new_pool', 'pool_imbalance', 'impermanent_loss'))
);

-- New token listings
CREATE TABLE new_token_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  dex_filters JSONB DEFAULT '[]', -- Which DEXs to monitor
  market_cap_filter JSONB DEFAULT '{}', -- Min/max market cap
  volume_filter JSONB DEFAULT '{}', -- Min volume requirements
  liquidity_filter JSONB DEFAULT '{}', -- Min liquidity requirements
  exclude_meme_tokens BOOLEAN DEFAULT false,
  exclude_scam_tokens BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =================================================================
-- 5. PORTFOLIO & POSITION MONITORING
-- =================================================================

-- Portfolio alerts
CREATE TABLE portfolio_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  wallet_address VARCHAR(42) NOT NULL,
  alert_type VARCHAR(30) NOT NULL, -- 'total_value', 'token_balance', 'pnl', 'rebalance'
  threshold_settings JSONB NOT NULL DEFAULT '{}',
  notification_frequency VARCHAR(20) DEFAULT 'immediate', -- 'immediate', 'daily', 'weekly'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT chk_portfolio_alert_type CHECK (alert_type IN 
    ('total_value', 'token_balance', 'pnl', 'rebalance', 'exposure_limit'))
);

-- Position health alerts (for lending/borrowing)
CREATE TABLE position_health_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  protocol VARCHAR(50) NOT NULL, -- 'aave', 'compound', 'venus', etc.
  wallet_address VARCHAR(42) NOT NULL,
  position_id VARCHAR(100), -- Protocol-specific position ID
  health_factor_threshold DECIMAL(10,8) DEFAULT 1.1, -- Liquidation warning threshold
  collateral_ratio_threshold DECIMAL(10,8), -- For other protocols
  alert_levels JSONB DEFAULT '[]', -- Multiple warning levels
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =================================================================
-- 6. YIELD FARMING & STAKING
-- =================================================================

-- Yield farming alerts
CREATE TABLE yield_farming_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  protocol VARCHAR(50) NOT NULL,
  pool_address VARCHAR(42) NOT NULL,
  farm_symbol VARCHAR(50) NOT NULL,
  alert_type VARCHAR(30) NOT NULL, -- 'apy_change', 'reward_claim', 'pool_end'
  threshold_settings JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT chk_yield_alert_type CHECK (alert_type IN 
    ('apy_change', 'reward_claim', 'pool_end', 'emissions_change', 'lock_expiry'))
);

-- Staking alerts
CREATE TABLE staking_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  protocol VARCHAR(50) NOT NULL,
  validator_address VARCHAR(42),
  stake_amount DECIMAL(20,8),
  alert_type VARCHAR(30) NOT NULL, -- 'unlock_period', 'reward_available', 'slash_risk'
  threshold_settings JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT chk_staking_alert_type CHECK (alert_type IN 
    ('unlock_period', 'reward_available', 'slash_risk', 'validator_change'))
);

-- =================================================================
-- 7. GOVERNANCE & DAO
-- =================================================================

-- Governance alerts
CREATE TABLE governance_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  dao_address VARCHAR(42) NOT NULL,
  dao_name VARCHAR(100) NOT NULL,
  alert_types JSONB DEFAULT '[]', -- 'new_proposal', 'voting_deadline', 'proposal_executed'
  voting_power_threshold DECIMAL(20,8), -- Only alert if user has voting power
  proposal_categories JSONB DEFAULT '[]', -- Filter by proposal categories
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =================================================================
-- 8. SECURITY & RISK MONITORING
-- =================================================================

-- Security alerts
CREATE TABLE security_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  alert_type VARCHAR(30) NOT NULL, -- 'rug_pull', 'exploit', 'honeypot', 'suspicious_activity'
  monitored_addresses JSONB DEFAULT '[]', -- Addresses to monitor
  risk_threshold VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high'
  auto_notifications BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT chk_security_alert_type CHECK (alert_type IN 
    ('rug_pull', 'exploit', 'honeypot', 'suspicious_activity', 'contract_upgrade', 'pause_event'))
);

-- =================================================================
-- 9. MARKET ANALYSIS & INSIGHTS
-- =================================================================

-- Market trend alerts
CREATE TABLE market_trend_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  trend_type VARCHAR(30) NOT NULL, -- 'technical_analysis', 'social_sentiment', 'funding_rate'
  indicator_settings JSONB NOT NULL DEFAULT '{}',
  timeframe VARCHAR(20) DEFAULT '1h',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT chk_trend_type CHECK (trend_type IN 
    ('technical_analysis', 'social_sentiment', 'funding_rate', 'fear_greed_index', 'derivatives_oi'))
);

-- =================================================================
-- 10. SYSTEM & OPERATIONAL TABLES
-- =================================================================

-- Notification delivery tracking
CREATE TABLE notification_delivery_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  channel VARCHAR(50) NOT NULL,
  delivery_status VARCHAR(20) NOT NULL, -- 'sent', 'delivered', 'failed', 'bounced'
  attempt_count INTEGER DEFAULT 1,
  provider_response JSONB DEFAULT '{}',
  delivery_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT chk_delivery_status CHECK (delivery_status IN 
    ('sent', 'delivered', 'failed', 'bounced', 'spam', 'blocked'))
);

-- Rate limiting and throttling
CREATE TABLE rate_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  notification_type VARCHAR(100) NOT NULL,
  channel VARCHAR(50) NOT NULL,
  limit_count INTEGER NOT NULL DEFAULT 10,
  time_window_minutes INTEGER NOT NULL DEFAULT 60,
  current_count INTEGER DEFAULT 0,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, notification_type, channel)
);

-- Event sourcing for audit trail
CREATE TABLE notification_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  notification_id UUID REFERENCES notifications(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- 'created', 'updated', 'delivered', 'failed', 'cancelled'
  event_data JSONB DEFAULT '{}',
  user_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT chk_event_type CHECK (event_type IN 
    ('created', 'updated', 'delivered', 'failed', 'cancelled', 'read', 'clicked'))
);

-- =================================================================
-- 11. PERFORMANCE & ANALYTICS
-- =================================================================

-- Analytics and metrics
CREATE TABLE notification_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date_bucket DATE NOT NULL,
  notification_type VARCHAR(100) NOT NULL,
  channel VARCHAR(50) NOT NULL,
  total_sent INTEGER DEFAULT 0,
  total_delivered INTEGER DEFAULT 0,
  total_failed INTEGER DEFAULT 0,
  total_clicked INTEGER DEFAULT 0,
  total_dismissed INTEGER DEFAULT 0,
  avg_delivery_time_ms INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(date_bucket, notification_type, channel)
);

-- User engagement metrics
CREATE TABLE user_engagement_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  date_bucket DATE NOT NULL,
  notifications_received INTEGER DEFAULT 0,
  notifications_clicked INTEGER DEFAULT 0,
  notifications_dismissed INTEGER DEFAULT 0,
  engagement_score DECIMAL(3,2) DEFAULT 0.0, -- 0.0 to 1.0
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, date_bucket)
);

-- =================================================================
-- 12. INDEXES FOR PERFORMANCE
-- =================================================================

-- Core notification indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
CREATE INDEX idx_notifications_priority ON notifications(priority);
CREATE INDEX idx_notifications_expires_at ON notifications(expires_at) WHERE expires_at IS NOT NULL;

-- Price alerts indexes
CREATE INDEX idx_price_alerts_user_id ON price_alerts(user_id);
CREATE INDEX idx_price_alerts_symbol ON price_alerts(symbol);
CREATE INDEX idx_price_alerts_active ON price_alerts(is_active) WHERE is_active = true;
CREATE INDEX idx_price_alerts_tokens ON price_alerts(base_token, quote_token);

-- Volume alerts indexes
CREATE INDEX idx_volume_alerts_user_id ON volume_alerts(user_id);
CREATE INDEX idx_volume_alerts_symbol ON volume_alerts(symbol);
CREATE INDEX idx_volume_alerts_active ON volume_alerts(is_active) WHERE is_active = true;

-- Wallet tracking indexes
CREATE INDEX idx_tracked_wallets_user_id ON tracked_wallets(user_id);
CREATE INDEX idx_tracked_wallets_address ON tracked_wallets(wallet_address);
CREATE INDEX idx_tracked_wallets_active ON tracked_wallets(is_active) WHERE is_active = true;

-- Delivery log indexes
CREATE INDEX idx_notification_delivery_log_notification_id ON notification_delivery_log(notification_id);
CREATE INDEX idx_notification_delivery_log_created_at ON notification_delivery_log(created_at);
CREATE INDEX idx_notification_delivery_log_status ON notification_delivery_log(delivery_status);

-- Analytics indexes
CREATE INDEX idx_notification_analytics_date_type ON notification_analytics(date_bucket, notification_type);
CREATE INDEX idx_user_engagement_metrics_user_date ON user_engagement_metrics(user_id, date_bucket);

-- GIN indexes for JSONB columns
CREATE INDEX idx_notifications_data_gin ON notifications USING gin(data);
CREATE INDEX idx_user_preferences_gin ON user_preferences USING gin(preferences);
CREATE INDEX idx_tracked_wallets_settings_gin ON tracked_wallets USING gin(tracking_settings);

-- =================================================================
-- 13. TRIGGERS FOR AUTOMATIC UPDATES
-- =================================================================

-- Update timestamps trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers to relevant tables
CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_price_alerts_updated_at BEFORE UPDATE ON price_alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_volume_alerts_updated_at BEFORE UPDATE ON volume_alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tracked_wallets_updated_at BEFORE UPDATE ON tracked_wallets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =================================================================
-- 14. VIEWS FOR COMMON QUERIES
-- =================================================================

-- Active alerts summary view
CREATE VIEW active_alerts_summary AS
SELECT 
  user_id,
  'price_alert' as alert_type,
  COUNT(*) as count
FROM price_alerts 
WHERE is_active = true 
GROUP BY user_id
UNION ALL
SELECT 
  user_id,
  'volume_alert' as alert_type,
  COUNT(*) as count
FROM volume_alerts 
WHERE is_active = true 
GROUP BY user_id
UNION ALL
SELECT 
  user_id,
  'wallet_tracking' as alert_type,
  COUNT(*) as count
FROM tracked_wallets 
WHERE is_active = true 
GROUP BY user_id;

-- Notification delivery performance view
CREATE VIEW notification_delivery_performance AS
SELECT 
  n.type,
  COUNT(*) as total_notifications,
  COUNT(CASE WHEN n.status = 'delivered' THEN 1 END) as delivered,
  COUNT(CASE WHEN n.status = 'failed' THEN 1 END) as failed,
  AVG(EXTRACT(EPOCH FROM (n.delivered_at - n.created_at))) as avg_delivery_time_seconds
FROM notifications n
WHERE n.created_at >= NOW() - INTERVAL '24 hours'
GROUP BY n.type;

-- =================================================================
-- 15. SAMPLE DATA FOR TESTING
-- =================================================================

-- Insert sample notification templates
INSERT INTO notification_templates (type, category, title_template, body_template, default_priority, variables) VALUES
('price_alert', 'market', 'Price Alert: {{symbol}}', '{{symbol}} has {{direction}} {{target_price}} USD', 'medium', '["symbol", "direction", "target_price"]'),
('volume_alert', 'market', 'Volume Alert: {{symbol}}', '{{symbol}} volume has reached {{volume}} in the last {{timeframe}}', 'medium', '["symbol", "volume", "timeframe"]'),
('whale_alert', 'market', 'Whale Alert: {{symbol}}', 'Large {{transaction_type}} of {{amount}} {{symbol}} ({{value_usd}} USD)', 'high', '["symbol", "transaction_type", "amount", "value_usd"]'),
('wallet_activity', 'tracking', 'Wallet Activity: {{wallet_label}}', '{{wallet_label}} has {{activity_type}} {{details}}', 'medium', '["wallet_label", "activity_type", "details"]'),
('liquidity_alert', 'defi', 'Liquidity Alert: {{pool_symbol}}', '{{pool_symbol}} liquidity has {{change_type}} by {{percentage}}%', 'medium', '["pool_symbol", "change_type", "percentage"]'),
('position_health', 'defi', 'Position Health Warning', 'Your {{protocol}} position health factor is {{health_factor}}', 'urgent', '["protocol", "health_factor"]'),
('new_token_listing', 'market', 'New Token Listed: {{symbol}}', '{{symbol}} has been listed on {{dex_name}} with {{initial_liquidity}} liquidity', 'low', '["symbol", "dex_name", "initial_liquidity"]'),
('governance_alert', 'dao', 'Governance: {{dao_name}}', 'New proposal: {{proposal_title}}', 'low', '["dao_name", "proposal_title"]'),
('security_alert', 'security', 'Security Alert: {{alert_type}}', '{{description}} - Please review your positions', 'urgent', '["alert_type", "description"]'),
('yield_farming', 'defi', 'Yield Farming: {{protocol}}', '{{farm_symbol}} APY changed to {{new_apy}}%', 'medium', '["protocol", "farm_symbol", "new_apy"]');

-- =================================================================
-- END OF SCHEMA
-- =================================================================

-- Add comments for documentation
COMMENT ON TABLE notifications IS 'Core notifications table storing all notification records';
COMMENT ON TABLE user_preferences IS 'User-specific notification preferences and settings';
COMMENT ON TABLE price_alerts IS 'Price monitoring alerts for tokens and trading pairs';
COMMENT ON TABLE volume_alerts IS 'Volume-based alerts for trading activity monitoring';
COMMENT ON TABLE tracked_wallets IS 'Wallets being monitored for activity';
COMMENT ON TABLE whale_alerts IS 'Large transaction monitoring and alerts';
COMMENT ON TABLE liquidity_alerts IS 'Liquidity pool monitoring alerts';
COMMENT ON TABLE portfolio_alerts IS 'Portfolio value and composition alerts';
COMMENT ON TABLE position_health_alerts IS 'DeFi position health monitoring';
COMMENT ON TABLE yield_farming_alerts IS 'Yield farming and staking alerts';
COMMENT ON TABLE governance_alerts IS 'DAO governance and voting alerts';
COMMENT ON TABLE security_alerts IS 'Security and risk monitoring alerts';
COMMENT ON TABLE notification_delivery_log IS 'Delivery tracking and audit trail';
COMMENT ON TABLE rate_limits IS 'Rate limiting and throttling controls';
COMMENT ON TABLE notification_analytics IS 'Performance metrics and analytics'; 