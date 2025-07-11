# @moonx-farm/shared

Shared utilities and types for MoonX Farm ecosystem.

## Overview

This package provides standardized JSON-RPC 2.0 types, interfaces, and utilities for WebSocket communication between client and server components in the MoonX Farm ecosystem. It contains common types and utilities that can be used across different services.

## Features

- **JSON-RPC 2.0 Compliance**: Full implementation of JSON-RPC 2.0 specification
- **TypeScript Support**: Complete type definitions and type safety
- **Message Builders**: Convenient utilities for creating standardized messages
- **Validation**: Built-in message validation utilities
- **Shared**: Common types and utilities for MoonX Farm ecosystem

## Installation

```bash
npm install @moonx-farm/shared
```

## Usage

### Basic Types

```typescript
import { 
  JsonRpcRequest, 
  JsonRpcNotification, 
  JsonRpcResponse,
  JsonRpcErrorResponse,
  JsonRpcErrorCodes 
} from '@moonx-farm/shared';

// Create a request
const request: JsonRpcRequest = {
  jsonrpc: "2.0",
  method: "your_method",
  params: { key: "value" },
  id: "req_123"
};
```

### Message Builder

```typescript
import { JsonRpcMessageHelper } from '@moonx-farm/shared';

// Create a request
const request = JsonRpcMessageHelper.createRequest("your_method", { key: "value" });

// Create a notification
const notification = JsonRpcMessageHelper.createNotification("event", { data: "value" });

// Create error response
const errorResponse = JsonRpcMessageHelper.createMethodNotFoundError("unknown_method", "req_123");
```

### Message Validation

```typescript
import { JsonRpcValidator } from '@moonx-farm/shared';

const message = JSON.parse(rawMessage);

if (JsonRpcValidator.isValidMessage(message)) {
  if (JsonRpcValidator.isRequest(message)) {
    // Handle request
  } else if (JsonRpcValidator.isNotification(message)) {
    // Handle notification
  }
}
```

### Message Parsing

```typescript
import { JsonRpcMessageHelper } from '@moonx-farm/shared';

// Parse incoming message
const message = JsonRpcMessageHelper.parseMessage(rawMessage);

if (message) {
  // Valid JSON-RPC message
  console.log(message);
}

// Serialize message
const serialized = JsonRpcMessageHelper.serializeMessage(message);
```

## JSON-RPC 2.0 Message Types

### Request
A request message that expects a response:
```json
{
  "jsonrpc": "2.0",
  "method": "method_name",
  "params": { "key": "value" },
  "id": "request_id"
}
```

### Notification
A request message that doesn't expect a response:
```json
{
  "jsonrpc": "2.0",
  "method": "method_name",
  "params": { "key": "value" }
}
```

### Response (Success)
A successful response to a request:
```json
{
  "jsonrpc": "2.0",
  "result": { "data": "value" },
  "id": "request_id"
}
```

### Response (Error)
An error response to a request:
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32601,
    "message": "Method not found",
    "data": { "method": "unknown_method" }
  },
  "id": "request_id"
}
```

## Standard Error Codes

JSON-RPC 2.0 defines the following error codes:

- `-32700` Parse error - Invalid JSON was received
- `-32600` Invalid Request - The JSON sent is not a valid Request object
- `-32601` Method not found - The method does not exist / is not available
- `-32602` Invalid params - Invalid method parameter(s)
- `-32603` Internal error - Internal JSON-RPC error
- `-32000` to `-32099` Server error - Reserved for implementation-defined server-errors

## Development

```bash
# Install dependencies
npm install

# Build the package
npm run build

# Run tests
npm test

# Run linter
npm run lint
```

## License

MIT 