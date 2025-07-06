-- =================================================================
-- Seed Data for Notification Hub Testing & Development
-- =================================================================

-- Sample users for testing
INSERT INTO user_preferences (user_id, preferences, enabled_channels, timezone, quiet_hours, frequency_limits) VALUES
('user_001', 
 '{"email_notifications": true, "push_notifications": true, "sms_notifications": false}',
 '["websocket", "push", "email"]',
 'UTC',
 '{"start": "22:00", "end": "08:00"}',
 '{"price_alert": {"max_per_hour": 10}, "volume_alert": {"max_per_hour": 5}}'
),
('user_002',
 '{"email_notifications": true, "push_notifications": false, "sms_notifications": false}',
 '["websocket", "email"]',
 'America/New_York',
 '{"start": "23:00", "end": "07:00"}',
 '{"whale_alert": {"max_per_hour": 3}, "liquidity_alert": {"max_per_hour": 5}}'
),
('user_003',
 '{"email_notifications": false, "push_notifications": true, "sms_notifications": false}',
 '["websocket", "push"]',
 'Asia/Tokyo',
 '{"start": "22:30", "end": "07:30"}',
 '{"all": {"max_per_hour": 20}}'
);

-- Sample price alerts
INSERT INTO price_alerts (user_id, symbol, base_token, quote_token, target_price, direction, condition_type, timeframe) VALUES
('user_001', 'BTC-USDC', '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', '0xA0b86a33E6417aD6F2E7Ba65b8a5a6bb2B3e1AB8', 45000.00, 'above', 'absolute', '1h'),
('user_001', 'ETH-USDC', '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', '0xA0b86a33E6417aD6F2E7Ba65b8a5a6bb2B3e1AB8', 2500.00, 'below', 'absolute', '1h'),
('user_002', 'BTC-USDC', '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', '0xA0b86a33E6417aD6F2E7Ba65b8a5a6bb2B3e1AB8', 50000.00, 'above', 'absolute', '4h'),
('user_003', 'ETH-USDC', '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', '0xA0b86a33E6417aD6F2E7Ba65b8a5a6bb2B3e1AB8', 5.0, 'change', 'percentage', '1d');

-- Sample volume alerts
INSERT INTO volume_alerts (user_id, symbol, base_token, quote_token, volume_threshold, volume_type, timeframe, condition) VALUES
('user_001', 'BTC-USDC', '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', '0xA0b86a33E6417aD6F2E7Ba65b8a5a6bb2B3e1AB8', 1000000.00, 'usd', '1h', 'above'),
('user_002', 'ETH-USDC', '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', '0xA0b86a33E6417aD6F2E7Ba65b8a5a6bb2B3e1AB8', 500000.00, 'usd', '15m', 'spike'),
('user_003', 'UNI-USDC', '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', '0xA0b86a33E6417aD6F2E7Ba65b8a5a6bb2B3e1AB8', 100000.00, 'usd', '1h', 'above');

-- Sample tracked wallets
INSERT INTO tracked_wallets (user_id, wallet_address, wallet_label, wallet_type, tracking_settings, notification_settings) VALUES
('user_001', '0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503', 'Binance Hot Wallet', 'institution', 
 '{"track_swaps": true, "track_transfers": true, "min_value_usd": 10000}',
 '{"immediate": true, "email": false}'
),
('user_002', '0x742D35Cc0C6466C5b48C5C65b1B3B6a5C47BDB6e', 'Whale Trader #1', 'whale',
 '{"track_swaps": true, "track_transfers": false, "min_value_usd": 50000}',
 '{"immediate": true, "email": true}'
),
('user_003', '0x8Ba1f109551bD432803012645Hac136c', 'Smart Money Wallet', 'smart_money',
 '{"track_swaps": true, "track_transfers": true, "track_liquidity": true, "min_value_usd": 5000}',
 '{"immediate": true, "email": false}'
);

-- Sample wallet activity alerts
INSERT INTO wallet_activity_alerts (user_id, tracked_wallet_id, activity_type, threshold_settings) VALUES
((SELECT id FROM tracked_wallets WHERE wallet_label = 'Binance Hot Wallet'), 'user_001', 'large_transaction', '{"min_value_usd": 100000}'),
((SELECT id FROM tracked_wallets WHERE wallet_label = 'Whale Trader #1'), 'user_002', 'swap', '{"min_value_usd": 50000}'),
((SELECT id FROM tracked_wallets WHERE wallet_label = 'Smart Money Wallet'), 'user_003', 'new_position', '{"min_value_usd": 10000}');

-- Sample whale alerts
INSERT INTO whale_alerts (user_id, symbol, token_address, min_value_usd, transaction_types) VALUES
('user_001', 'BTC', '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', 500000.00, '["swap", "transfer"]'),
('user_002', 'ETH', '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', 250000.00, '["swap", "transfer", "liquidation"]'),
('user_003', 'USDC', '0xA0b86a33E6417aD6F2E7Ba65b8a5a6bb2B3e1AB8', 1000000.00, '["transfer"]');

-- Sample liquidity alerts
INSERT INTO liquidity_alerts (user_id, pool_address, pool_symbol, dex_name, alert_type, threshold_settings) VALUES
('user_001', '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640', 'ETH-USDC', 'uniswap', 'liquidity_change', '{"percentage_change": 20}'),
('user_002', '0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8', 'ETH-USDT', 'uniswap', 'apy_change', '{"min_apy": 5.0}'),
('user_003', '0x4585FE77225b41b697C938B018E2Ac67Ac5a20c0', 'BTC-ETH', 'uniswap', 'impermanent_loss', '{"max_loss_percentage": 10}');

-- Sample new token alerts
INSERT INTO new_token_alerts (user_id, dex_filters, market_cap_filter, volume_filter, liquidity_filter) VALUES
('user_001', '["uniswap", "pancakeswap"]', '{"min": 1000000, "max": 100000000}', '{"min_24h": 500000}', '{"min": 100000}'),
('user_002', '["uniswap"]', '{"min": 10000000}', '{"min_24h": 1000000}', '{"min": 1000000}'),
('user_003', '["pancakeswap", "sushiswap"]', '{"min": 500000, "max": 50000000}', '{"min_24h": 100000}', '{"min": 50000}');

-- Sample portfolio alerts
INSERT INTO portfolio_alerts (user_id, wallet_address, alert_type, threshold_settings, notification_frequency) VALUES
('user_001', '0x742D35Cc0C6466C5b48C5C65b1B3B6a5C47BDB6e', 'total_value', '{"threshold": 100000, "direction": "below"}', 'immediate'),
('user_002', '0x8Ba1f109551bD432803012645Hac136c', 'pnl', '{"threshold": -10, "type": "percentage"}', 'daily'),
('user_003', '0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503', 'token_balance', '{"token": "ETH", "threshold": 10, "direction": "below"}', 'immediate');

-- Sample position health alerts
INSERT INTO position_health_alerts (user_id, protocol, wallet_address, health_factor_threshold, alert_levels) VALUES
('user_001', 'aave', '0x742D35Cc0C6466C5b48C5C65b1B3B6a5C47BDB6e', 1.2, '[{"level": "warning", "threshold": 1.5}, {"level": "danger", "threshold": 1.1}]'),
('user_002', 'compound', '0x8Ba1f109551bD432803012645Hac136c', 1.3, '[{"level": "warning", "threshold": 1.6}, {"level": "critical", "threshold": 1.2}]'),
('user_003', 'venus', '0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503', 1.1, '[{"level": "warning", "threshold": 1.4}, {"level": "danger", "threshold": 1.15}]');

-- Sample yield farming alerts
INSERT INTO yield_farming_alerts (user_id, protocol, pool_address, farm_symbol, alert_type, threshold_settings) VALUES
('user_001', 'uniswap', '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640', 'ETH-USDC LP', 'apy_change', '{"min_change": 2.0}'),
('user_002', 'pancakeswap', '0x16b9a82891338f9bA80E2D6970FddA79D1eb0daE', 'BNB-BUSD LP', 'reward_claim', '{"auto_claim": false, "min_reward": 10}'),
('user_003', 'sushiswap', '0xC3D03e4F041Fd4cD388c549Ee2A29a9E5075882f', 'SUSHI-ETH LP', 'pool_end', '{"advance_notice_days": 7}');

-- Sample staking alerts
INSERT INTO staking_alerts (user_id, protocol, validator_address, stake_amount, alert_type, threshold_settings) VALUES
('user_001', 'ethereum', '0x00000000219ab540356cBB839Cbe05303d7705Fa', 32.0, 'unlock_period', '{"days_before": 7}'),
('user_002', 'polygon', '0x0000000000000000000000000000000000001001', 100.0, 'reward_available', '{"min_reward": 1.0}'),
('user_003', 'avalanche', '0x0100000000000000000000000000000000000000', 2000.0, 'slash_risk', '{"risk_threshold": 0.1}');

-- Sample governance alerts
INSERT INTO governance_alerts (user_id, dao_address, dao_name, alert_types, voting_power_threshold) VALUES
('user_001', '0x5e4be8Bc9637f0EAA1A755019e06A68ce081D58F', 'Uniswap DAO', '["new_proposal", "voting_deadline"]', 100.0),
('user_002', '0x8dA3d2A7A3B0Bc3C6B6a5D5E4B7d8E7F6A9C8B7D', 'Compound DAO', '["new_proposal", "proposal_executed"]', 50.0),
('user_003', '0x3A4B5C6D7E8F9A0B1C2D3E4F5A6B7C8D9E0F1A2B', 'Aave DAO', '["voting_deadline"]', 25.0);

-- Sample security alerts
INSERT INTO security_alerts (user_id, alert_type, monitored_addresses, risk_threshold) VALUES
('user_001', 'exploit', '["0x742D35Cc0C6466C5b48C5C65b1B3B6a5C47BDB6e"]', 'medium'),
('user_002', 'rug_pull', '[]', 'high'), -- Monitor all new tokens
('user_003', 'suspicious_activity', '["0x8Ba1f109551bD432803012645Hac136c", "0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503"]', 'low');

-- Sample market trend alerts
INSERT INTO market_trend_alerts (user_id, symbol, trend_type, indicator_settings, timeframe) VALUES
('user_001', 'BTC', 'technical_analysis', '{"indicators": ["RSI", "MACD"], "rsi_threshold": 70}', '1h'),
('user_002', 'ETH', 'social_sentiment', '{"sentiment_threshold": 0.8, "volume_threshold": 1000}', '4h'),
('user_003', 'BNB', 'funding_rate', '{"threshold": 0.01}', '8h');

-- Sample notifications for testing
INSERT INTO notifications (user_id, type, title, body, priority, channels, data, status) VALUES
('user_001', 'price_alert', 'Price Alert: BTC-USDC', 'BTC has reached above $45,000 USD', 'medium', '["websocket", "push"]', '{"symbol": "BTC-USDC", "price": 45123.45, "direction": "above"}', 'delivered'),
('user_002', 'volume_alert', 'Volume Alert: ETH-USDC', 'ETH volume has spiked 3x in the last 15 minutes', 'high', '["websocket", "email"]', '{"symbol": "ETH-USDC", "volume": 1500000, "spike_multiplier": 3}', 'delivered'),
('user_003', 'whale_alert', 'Whale Alert: Large ETH Transfer', 'Large transfer of 1,000 ETH ($2.5M USD)', 'high', '["websocket", "push"]', '{"symbol": "ETH", "amount": 1000, "value_usd": 2500000}', 'delivered'),
('user_001', 'wallet_activity', 'Wallet Activity: Binance Hot Wallet', 'Binance Hot Wallet has made a large swap of $500K', 'medium', '["websocket"]', '{"wallet_label": "Binance Hot Wallet", "activity": "swap", "value_usd": 500000}', 'pending'),
('user_002', 'position_health', 'Position Health Warning', 'Your Aave position health factor is 1.15 - consider adding collateral', 'urgent', '["websocket", "push", "email"]', '{"protocol": "aave", "health_factor": 1.15}', 'delivered');

-- Sample delivery logs
INSERT INTO notification_delivery_log (notification_id, channel, delivery_status, attempt_count, delivery_time_ms) VALUES
((SELECT id FROM notifications WHERE title = 'Price Alert: BTC-USDC'), 'websocket', 'delivered', 1, 45),
((SELECT id FROM notifications WHERE title = 'Price Alert: BTC-USDC'), 'push', 'delivered', 1, 1200),
((SELECT id FROM notifications WHERE title = 'Volume Alert: ETH-USDC'), 'websocket', 'delivered', 1, 32),
((SELECT id FROM notifications WHERE title = 'Volume Alert: ETH-USDC'), 'email', 'sent', 1, 850),
((SELECT id FROM notifications WHERE title = 'Whale Alert: Large ETH Transfer'), 'websocket', 'delivered', 1, 28);

-- Sample analytics data
INSERT INTO notification_analytics (date_bucket, notification_type, channel, total_sent, total_delivered, total_failed, total_clicked, avg_delivery_time_ms) VALUES
(CURRENT_DATE, 'price_alert', 'websocket', 150, 148, 2, 45, 38),
(CURRENT_DATE, 'price_alert', 'push', 120, 115, 5, 67, 1150),
(CURRENT_DATE, 'volume_alert', 'websocket', 75, 74, 1, 23, 42),
(CURRENT_DATE, 'whale_alert', 'websocket', 25, 25, 0, 18, 35),
(CURRENT_DATE, 'wallet_activity', 'websocket', 45, 43, 2, 12, 41);

-- Sample user engagement metrics
INSERT INTO user_engagement_metrics (user_id, date_bucket, notifications_received, notifications_clicked, notifications_dismissed, engagement_score) VALUES
('user_001', CURRENT_DATE, 25, 12, 5, 0.68),
('user_002', CURRENT_DATE, 18, 8, 3, 0.61),
('user_003', CURRENT_DATE, 32, 15, 8, 0.72);

-- Sample rate limits
INSERT INTO rate_limits (user_id, notification_type, channel, limit_count, time_window_minutes, current_count) VALUES
('user_001', 'price_alert', 'push', 10, 60, 3),
('user_002', 'volume_alert', 'email', 5, 60, 1),
('user_003', 'whale_alert', 'websocket', 20, 60, 8); 