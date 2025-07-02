/**
 * Health Check API Endpoint
 * 
 * Provides health status for Docker container monitoring
 * and load balancer health checks.
 */

import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Basic health check - can be extended with database/service checks
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'moonx-web',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
    }

    return NextResponse.json(healthData, { status: 200 })
  } catch (error) {
    console.error('Health check failed:', error)
    
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
      },
      { status: 500 }
    )
  }
} 