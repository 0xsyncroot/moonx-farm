/**
 * Events system for MoonX Farm microservices
 * 
 * This module provides:
 * - Generic event types and interfaces
 * - EventFactory for creating events with envelope pattern
 * - EventPublisher for publishing events to Kafka
 * - Shared utilities for event handling
 */

export * from './types';
export * from './eventFactory';
export * from './eventPublisher'; 