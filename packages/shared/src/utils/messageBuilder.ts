import {
  JsonRpcRequest,
  JsonRpcNotification,
  JsonRpcResponse,
  JsonRpcErrorResponse,
  JsonRpcMessageBuilder,
  JsonRpcErrorCodes,
  JsonRpcId,
  JsonRpcParams
} from '../types/jsonRpc';

/**
 * Generic JSON-RPC Message Builder
 * Provides convenient methods to create standardized JSON-RPC messages
 */
export class JsonRpcMessageHelper {
  
  // Generic Message Creation
  static createRequest(method: string, params?: JsonRpcParams, id?: JsonRpcId): JsonRpcRequest {
    return JsonRpcMessageBuilder.createRequest(method, params, id);
  }

  static createNotification(method: string, params?: JsonRpcParams): JsonRpcNotification {
    return JsonRpcMessageBuilder.createNotification(method, params);
  }

  static createResponse(result: any, id: JsonRpcId): JsonRpcResponse {
    return JsonRpcMessageBuilder.createResponse(result, id);
  }

  static createError(code: number, message: string, id: JsonRpcId, data?: any): JsonRpcErrorResponse {
    return JsonRpcMessageBuilder.createError(code, message, id, data);
  }

  // Standard Error Responses
  static createParseErrorResponse(id: JsonRpcId = null): JsonRpcErrorResponse {
    return JsonRpcMessageBuilder.createError(
      JsonRpcErrorCodes.PARSE_ERROR,
      'Parse error',
      id
    );
  }

  static createInvalidRequestError(id: JsonRpcId = null): JsonRpcErrorResponse {
    return JsonRpcMessageBuilder.createError(
      JsonRpcErrorCodes.INVALID_REQUEST,
      'Invalid Request',
      id
    );
  }

  static createMethodNotFoundError(method: string, id: JsonRpcId): JsonRpcErrorResponse {
    return JsonRpcMessageBuilder.createError(
      JsonRpcErrorCodes.METHOD_NOT_FOUND,
      'Method not found',
      id,
      { method }
    );
  }

  static createInvalidParamsError(id: JsonRpcId): JsonRpcErrorResponse {
    return JsonRpcMessageBuilder.createError(
      JsonRpcErrorCodes.INVALID_PARAMS,
      'Invalid params',
      id
    );
  }

  static createInternalError(id: JsonRpcId, details?: any): JsonRpcErrorResponse {
    return JsonRpcMessageBuilder.createError(
      JsonRpcErrorCodes.INTERNAL_ERROR,
      'Internal error',
      id,
      details
    );
  }

  static createServerError(id: JsonRpcId, message: string, data?: any): JsonRpcErrorResponse {
    return JsonRpcMessageBuilder.createError(
      JsonRpcErrorCodes.SERVER_ERROR,
      message,
      id,
      data
    );
  }

  // Utility Methods
  static createSuccessResponse(message: string, id: JsonRpcId, data?: any): JsonRpcResponse {
    return JsonRpcMessageBuilder.createResponse({
      success: true,
      message,
      timestamp: Date.now(),
      data
    }, id);
  }

  static createErrorResponse(message: string, id: JsonRpcId, code: number = JsonRpcErrorCodes.SERVER_ERROR, data?: any): JsonRpcErrorResponse {
    return JsonRpcMessageBuilder.createError(code, message, id, data);
  }

  // Message Parsing
  static parseMessage(rawMessage: string): JsonRpcRequest | JsonRpcNotification | JsonRpcResponse | JsonRpcErrorResponse | null {
    try {
      const parsed = JSON.parse(rawMessage);
      
      // Basic validation
      if (!parsed || typeof parsed !== 'object' || parsed.jsonrpc !== '2.0') {
        return null;
      }

      return parsed;
    } catch (error) {
      return null;
    }
  }

  // Message Serialization
  static serializeMessage(message: JsonRpcRequest | JsonRpcNotification | JsonRpcResponse | JsonRpcErrorResponse): string {
    return JSON.stringify(message);
  }
} 