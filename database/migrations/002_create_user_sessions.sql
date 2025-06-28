-- Migration: 002_create_user_sessions
-- Description: Create user_sessions table for session management
-- Created: 2025-06-25

-- Create user_sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    session_token VARCHAR(255) NOT NULL UNIQUE,
    refresh_token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    
    -- Foreign key constraint
    CONSTRAINT fk_user_sessions_user_id 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE,
    
    -- Check constraints
    CONSTRAINT user_sessions_expires_at_future 
        CHECK (expires_at > created_at)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_refresh_token ON user_sessions(refresh_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_created_at ON user_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_ip_address ON user_sessions(ip_address);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active 
    ON user_sessions(user_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_user_sessions_token_active 
    ON user_sessions(session_token, expires_at);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_user_sessions_updated_at 
    BEFORE UPDATE ON user_sessions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM user_sessions 
    WHERE expires_at <= NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON TABLE user_sessions IS 'User authentication sessions';
COMMENT ON COLUMN user_sessions.id IS 'Session UUID';
COMMENT ON COLUMN user_sessions.user_id IS 'Reference to users table';
COMMENT ON COLUMN user_sessions.session_token IS 'JWT token ID (jti claim)';
COMMENT ON COLUMN user_sessions.refresh_token IS 'Refresh token ID';
COMMENT ON COLUMN user_sessions.expires_at IS 'Session expiration time';
COMMENT ON COLUMN user_sessions.created_at IS 'Session creation time';
COMMENT ON COLUMN user_sessions.updated_at IS 'Last session update time';
COMMENT ON COLUMN user_sessions.ip_address IS 'Client IP address';
COMMENT ON COLUMN user_sessions.user_agent IS 'Client user agent string';
COMMENT ON FUNCTION cleanup_expired_sessions() IS 'Remove expired sessions and return count';