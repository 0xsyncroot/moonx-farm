# Shared Packages Overview

## Tổng Quan

MoonXFarm DEX sử dụng shared packages architecture để tối ưu code reuse và maintain consistency across toàn bộ hệ thống monorepo.

## Package Architecture

### Current Structure
```
moonx-farm/
├── configs/                    # @moonx/configs (Centralized Configuration)
├── packages/
│   ├── common/                # @moonx/common (Utilities & Types)  
│   ├── api-client/            # @moonx/api-client (API SDK)
│   └── infrastructure/        # Legacy (deprecated)
├── contracts/                 # Smart contracts (Diamond Proxy)
├── services/                  # Backend microservices
└── apps/web/                  # Frontend application
```

### Package Dependencies
```
@moonx/configs (profile-based config loading)
    ↑
@moonx/common (utilities, types, logging)
    ↑
@moonx/api-client (internal API SDK)
    ↑
Services & Apps (business logic)
```

## Package Descriptions

### 1. @moonx/configs
**Location**: `/configs`  
**Purpose**: Centralized configuration management với profile-based loading  
**Key Features**:
- Service-specific configuration profiles
- Type-safe validation với Zod schemas
- Environment variable management
- Utility functions cho database, Redis, Kafka

### 2. @moonx/common  
**Location**: `/packages/common`  
**Purpose**: Shared utilities, types, logging, error handling  
**Key Features**:
- Core domain types cho DEX operations
- Structured logging với Winston
- Error handling hierarchy
- Utility functions (formatting, validation, retry logic)
- Blockchain utilities

### 3. @moonx/api-client
**Location**: `/packages/api-client`  
**Purpose**: Type-safe SDK cho internal service communication  
**Status**: Planned implementation  
**Key Features**:
- HTTP client với retry logic
- Type-safe service calls
- Request/response interceptors
- Error handling integration

### 4. packages/infrastructure (Legacy)
**Location**: `/packages/infrastructure`  
**Status**: Deprecated - being replaced by @moonx/configs  
**Migration**: Functionality moved to configs package

## Design Principles

### 1. Single Responsibility
- Mỗi package có purpose rõ ràng
- Tránh overlap functionality
- Clear boundaries giữa các packages

### 2. Dependency Management
- @moonx/configs là foundation layer
- @moonx/common builds on configs
- Services depend on both configs và common

### 3. Type Safety
- Strong TypeScript typing across all packages
- Zod validation cho runtime safety
- Type inference từ schemas

### 4. Zero External Dependencies (where possible)
- @moonx/common có minimal external deps
- @moonx/configs chỉ depend on Zod
- Giảm bundle size và security risks

## Usage Patterns

### Configuration Loading
```typescript
// Service-specific config
import { createAuthServiceConfig } from '@moonx/configs';
const config = createAuthServiceConfig();

// Utility functions
import { getDatabaseConfig } from '@moonx/configs';
const dbConfig = getDatabaseConfig('auth-service');
```

### Common Utilities
```typescript
// Types và utilities
import { formatTokenAmount, ChainId, TokenInfo } from '@moonx/common';

// Error handling
import { BadRequestError, ValidationError } from '@moonx/common';

// Logging
import { createLogger } from '@moonx/common';
const logger = createLogger('service-name');
```

### API Client (Future)
```typescript
// Internal service calls
import { apiClient } from '@moonx/api-client';

const quote = await apiClient.quoteService.getQuote({
  tokenIn: 'ETH',
  tokenOut: 'USDC',
  amount: '1000000000000000000'
});
```

## Development Workflow

### Building Packages
```bash
# Build all shared packages
npm run build:packages

# Build specific package
cd configs && npm run build
cd packages/common && npm run build
```

### Testing
```bash
# Test all packages
npm run test:packages

# Test specific package
cd packages/common && npm test
```

### Versioning
- Packages follow semantic versioning
- Breaking changes require major version bump
- Coordinated releases across dependent packages

## Migration Guide

### From packages/infrastructure to @moonx/configs
1. Update imports: `@moonx/infrastructure` → `@moonx/configs`
2. Use profile-based loading instead of direct imports
3. Update configuration schemas
4. Test service startup với new config system

### Adding New Shared Functionality
1. Determine appropriate package (configs vs common vs api-client)
2. Add types to @moonx/common if needed
3. Implement functionality với proper error handling
4. Add comprehensive tests
5. Update documentation

## Best Practices

### Package Design
- Keep packages focused và cohesive
- Minimize cross-package dependencies
- Use consistent naming conventions
- Document public APIs thoroughly

### Usage Guidelines
- Import only what you need
- Use type-safe configurations
- Handle errors appropriately
- Follow logging conventions

### Performance Considerations
- Lazy load heavy dependencies
- Use tree shaking friendly exports
- Minimize runtime overhead
- Cache expensive operations

## Future Roadmap

### Short Term
- Complete @moonx/api-client implementation
- Migrate remaining infrastructure package usage
- Add comprehensive integration tests
- Performance optimization

### Medium Term
- Add @moonx/ui-components for shared UI
- @moonx/contracts-sdk for blockchain interactions
- Enhanced monitoring và observability
- Automated dependency updates

### Long Term
- Micro-frontend architecture support
- Cross-team package governance
- Advanced caching strategies
- Package performance analytics

## Related Documentation

- [Configs Package Details](./configs-package.md)
- [Common Package Details](./common-package.md)  
- [API Client Design](./api-client-design.md)
- [Package Migration Guide](./package-migration.md)

---

**Note**: This overview provides high-level architecture. See individual package documentation for implementation details.
