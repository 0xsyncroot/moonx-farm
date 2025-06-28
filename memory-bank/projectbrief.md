# MoonXFarm Router - Project Brief

**Dự án**: MoonXFarm Multi-Aggregator Router  
**Phiên bản**: v1.0  
**Trạng thái**: Smart Contracts Complete - Backend Development  
**Ngày cập nhật**: 25/06/2025  

## 🎯 Tổng Quan Dự Án

MoonXFarm là một **multi-aggregator router** thế hệ mới, được thiết kế để mang lại trải nghiệm giao dịch vượt trội thông qua việc tổng hợp thanh khoản từ nhiều nguồn, gasless transactions và bảo vệ MEV. Dự án sử dụng kiến trúc microservices hiện đại kết hợp với Account Abstraction và Diamond Proxy pattern cho smart contracts.

## 🚀 Mục Tiêu Kinh Doanh

### Mục Tiêu Chính
- **Trải nghiệm gasless**: Người dùng có thể giao dịch mà không cần trả gas fees
- **Tốc độ vượt trội**: p95 quote latency ≤ 200ms, p95 swap time ≤ 3s
- **Bảo vệ MEV**: ≥80% giao dịch được bảo vệ khỏi MEV attacks
- **Đa dạng tính năng**: Hỗ trợ swap, limit orders, DCA (Dollar Cost Averaging)
- **Social Login**: Dễ dàng onboarding với đăng nhập mạng xã hội

### KPIs Quý 1
| Chỉ Số | Mục Tiêu | Cách Đo |
|--------|----------|---------|
| Quote Latency (p95) | ≤ 200ms | API Gateway metrics |
| End-to-End Swap (p95) | ≤ 3s | Frontend to tx hash |
| Gasless Adoption Rate | ≥ 70% | % giao dịch qua Paymaster |
| MEV Protected Swaps | ≥ 80% | % qua private relays |
| System Uptime | ≥ 99.9% | Core services availability |

## 🏗️ Kiến Trúc Hệ Thống

### Core Components
1. **Frontend**: Next.js App với Privy integration
2. **API Gateway**: Nginx/Fastify cho routing và middleware
3. **Core Services**: 
   - Auth Service (Privy + JWT)
   - Wallet Registry (ZeroDev AA wallets)
   - Aggregator Service (Aggregators integration)
   - Swap Orchestrator (UserOperation builder)
   - Position Indexer (P&L tracking)
   - Notify Service (Real-time notifications)

4. **Workers**:
   - Price Crawler (Multi-source price aggregation)
   - Order Executor (Automated limit/DCA execution)

5. **Smart Contracts**: MoonXFarmRouter (Diamond Proxy EIP-2535) với LifiProxyFacet, OneInchProxyFacet, RelayProxyFacet

6. **Infrastructure**: PostgreSQL, Redis, Kafka, Kubernetes

## 🎯 Phạm Vi Phiên Bản 1.0

### Bao Gồm
- ✅ Swap Trading (exactIn/exactOut)
- ✅ Limit Order với on-chain escrow
- ✅ DCA (Dollar-Cost Averaging)
- ✅ Gasless transactions với Session Keys
- ✅ Social Login với Privy
- ✅ Portfolio tracking với P&L
- ✅ Multi-chain: Base, BSC (Mainnet/Testnet)

### Không Bao Gồm (v2+)
- ❌ Margin/Leverage trading
- ❌ Options trading
- ❌ Cross-chain bridge tích hợp
- ❌ Governance token
- ❌ Staking/Farming

## 📋 Roadmap Phát Triển

### Sprint 0: Foundation Setup (3 người-tuần)
- Memory Bank và documentation
- Hoàn thiện shared packages
- Docker Compose local environment
- CI/CD workflows

### Sprint 1: Smart Contracts (8 người-tuần)
- Diamond Proxy implementation
- SwapFacet, LimitFacet, DCAFacet
- Account Abstraction integration
- Testing và deployment scripts

### Sprint 2: Auth & Wallet (10 người-tuần)
- Auth Service với Privy
- Wallet Registry với ZeroDev
- Session Key management
- API Gateway setup

### Sprint 3: Trading Engine (6 người-tuần)
- Aggregator Service với aggregators
- Swap Orchestrator
- Price Crawler worker
- WebSocket real-time

### Sprint 4: Advanced Features (7 người-tuần)
- Order Executor worker
- Position Indexer
- Notification Service
- P&L tracking

### Sprint 5: Frontend (7 người-tuần)
- Next.js application
- Trading interface
- Portfolio management
- Mobile-responsive UI

### Sprint 6: Production Ready (5 người-tuần)
- MEV protection
- Security hardening
- Load testing
- K8s deployment

## 💰 Business Model

### Revenue Streams
1. **Trading Fees**: 0.25% trên mỗi swap
2. **Premium Features**: Advanced analytics, API access
3. **Partnerships**: Revenue sharing với aggregators
4. **Staking Rewards**: (Future) Platform token staking

### Cost Structure
- **Gas Sponsorship**: ~$50-100/day cho 10 tx đầu tiên của mỗi user
- **Infrastructure**: AWS/GCP costs cho K8s cluster
- **Third-party APIs**: Aggregators, price feeds, RPC providers
- **Team**: Development và operations

## 🎯 Success Metrics

### Technical Metrics
- **Performance**: Quote latency, swap execution time
- **Reliability**: Uptime, error rates
- **Scalability**: TPS, concurrent users

### Business Metrics
- **User Growth**: MAU, retention rate
- **Trading Volume**: Daily/monthly volume
- **Revenue**: Fees collected, profitability

### User Experience Metrics
- **Onboarding**: Time to first trade
- **Satisfaction**: NPS, support tickets
- **Engagement**: Trades per user, feature usage

## 🔄 Competitive Advantages

1. **Multi-Aggregator Strategy**: Tổng hợp 3 aggregators (LI.FI, 1inch, Relay) cho best price discovery
2. **Gasless Experience**: Người dùng không cần lo về gas fees với ZeroDev integration
3. **MEV Protection**: Built-in MEV protection qua Relay và routing optimization
4. **Social Login**: Không cần seed phrase phức tạp với Privy integration
5. **Advanced Router Features**: Sophisticated fee collection, multi-chain support
6. **Diamond Upgradeable**: Easy addition của new aggregators và features
7. **Redundancy & Reliability**: Fallback providers nếu aggregator nào đó down

## 🚨 Key Risks & Mitigation

### Technical Risks
- **Smart Contract Vulnerabilities**: Multiple audits, bug bounty
- **Third-party Dependencies**: Fallback providers, circuit breakers
- **Scalability Issues**: Horizontal scaling, caching strategies

### Business Risks
- **Regulatory Changes**: Legal compliance, jurisdiction flexibility
- **Market Competition**: Unique features, user experience focus
- **Token Price Volatility**: Diversified revenue streams

### Operational Risks
- **Team Scaling**: Clear documentation, onboarding process
- **Infrastructure Costs**: Cost optimization, usage monitoring
- **Security Breaches**: Security best practices, incident response

## 🎉 Definition of Success

**MoonXFarm v1.0 được coi là thành công khi**:
- Đạt tất cả KPIs đã đề ra trong Q1
- Có ít nhất 1,000 active users/tháng
- Trading volume > $1M/tháng
- Zero critical security incidents
- Positive user feedback (NPS > 50)
- Profitable hoặc break-even về operations cost
