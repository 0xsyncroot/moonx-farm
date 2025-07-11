/**
 * JSON-RPC 2.0 Types and Interfaces
 * Based on: https://www.jsonrpc.org/specification
 */

// JSON-RPC 2.0 Base Types
export type JsonRpcId = string | number | null;
export type JsonRpcParams = Record<string, any> | Array<any> | undefined;

/**
 * JSON-RPC 2.0 Request
 */
export interface JsonRpcRequest {
  jsonrpc: "2.0";
  method: string;
  params?: JsonRpcParams;
  id: JsonRpcId;
}

/**
 * JSON-RPC 2.0 Notification (no response expected)
 */
export interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: JsonRpcParams;
  // Note: id is omitted for notifications
}

/**
 * JSON-RPC 2.0 Response (Success)
 */
export interface JsonRpcResponse {
  jsonrpc: "2.0";
  result: any;
  id: JsonRpcId;
}

/**
 * JSON-RPC 2.0 Error Object
 */
export interface JsonRpcError {
  code: number;
  message: string;
  data?: any;
}

/**
 * JSON-RPC 2.0 Error Response
 */
export interface JsonRpcErrorResponse {
  jsonrpc: "2.0";
  error: JsonRpcError;
  id: JsonRpcId;
}

/**
 * Union type for any JSON-RPC message
 */
export type JsonRpcMessage = 
  | JsonRpcRequest 
  | JsonRpcNotification 
  | JsonRpcResponse 
  | JsonRpcErrorResponse;

/**
 * Standard JSON-RPC 2.0 Error Codes
 */
export const JsonRpcErrorCodes = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  // Server errors: -32000 to -32099 (reserved for implementation-defined server-errors)
  SERVER_ERROR: -32000
} as const;



/**
 * JSON-RPC Message Builder Helper
 */
export class JsonRpcMessageBuilder {
  /**
   * Create a JSON-RPC request
   */
  static createRequest(
    method: string, 
    params?: JsonRpcParams, 
    id?: JsonRpcId
  ): JsonRpcRequest {
    return {
      jsonrpc: "2.0",
      method,
      params,
      id: id ?? this.generateId()
    };
  }

  /**
   * Create a JSON-RPC notification
   */
  static createNotification(
    method: string, 
    params?: JsonRpcParams
  ): JsonRpcNotification {
    return {
      jsonrpc: "2.0",
      method,
      params
    };
  }

  /**
   * Create a JSON-RPC success response
   */
  static createResponse(
    result: any, 
    id: JsonRpcId
  ): JsonRpcResponse {
    return {
      jsonrpc: "2.0",
      result,
      id
    };
  }

  /**
   * Create a JSON-RPC error response
   */
  static createError(
    code: number, 
    message: string, 
    id: JsonRpcId, 
    data?: any
  ): JsonRpcErrorResponse {
    return {
      jsonrpc: "2.0",
      error: {
        code,
        message,
        data
      },
      id
    };
  }

  /**
   * Generate unique ID for requests
   */
  private static generateId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * JSON-RPC Message Validator
 */
export class JsonRpcValidator {
  /**
   * Check if message is valid JSON-RPC 2.0
   */
  static isValidMessage(message: any): message is JsonRpcMessage {
    return (
      typeof message === 'object' &&
      message !== null &&
      message.jsonrpc === "2.0"
    );
  }

  /**
   * Check if message is a request
   */
  static isRequest(message: JsonRpcMessage): message is JsonRpcRequest {
    return 'method' in message && 'id' in message;
  }

  /**
   * Check if message is a notification
   */
  static isNotification(message: JsonRpcMessage): message is JsonRpcNotification {
    return 'method' in message && !('id' in message);
  }

  /**
   * Check if message is a response
   */
  static isResponse(message: JsonRpcMessage): message is JsonRpcResponse {
    return 'result' in message && 'id' in message;
  }

  /**
   * Check if message is an error response
   */
  static isErrorResponse(message: JsonRpcMessage): message is JsonRpcErrorResponse {
    return 'error' in message && 'id' in message;
  }

  /**
   * Validate method name
   */
  static isValidMethod(method: string): boolean {
    return typeof method === 'string' && method.length > 0;
  }

  /**
   * Validate parameters
   */
  static isValidParams(params: any): params is JsonRpcParams {
    return (
      params === undefined ||
      Array.isArray(params) ||
      (typeof params === 'object' && params !== null)
    );
  }
} 