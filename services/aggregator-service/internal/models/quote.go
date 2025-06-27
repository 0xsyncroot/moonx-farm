package models

import (
	"time"

	"github.com/shopspring/decimal"
)

// Token represents a cryptocurrency token
type Token struct {
	Address     string                 `json:"address"`
	Symbol      string                 `json:"symbol"`
	Name        string                 `json:"name"`
	Decimals    int                    `json:"decimals"`
	ChainID     int                    `json:"chainId"`
	LogoURI     string                 `json:"logoURI,omitempty"`
	Tags        []string               `json:"tags,omitempty"`
	IsNative    bool                   `json:"isNative"`
	PriceUSD    decimal.Decimal        `json:"priceUSD,omitempty"`
	MarketCap   decimal.Decimal        `json:"marketCap,omitempty"`
	Volume24h   decimal.Decimal        `json:"volume24h,omitempty"`
	Change24h   decimal.Decimal        `json:"change24h,omitempty"`
	LastUpdated time.Time              `json:"lastUpdated,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	// Additional fields for external API integration
	Source      string                 `json:"source,omitempty"`      // API source (geckoterminal, dexscreener, binance, onchain)
	Verified    bool                   `json:"verified,omitempty"`    // Whether token is verified
	Popular     bool                   `json:"popular,omitempty"`     // Whether token is in popular list
}

// QuoteRequest represents a quote request
type QuoteRequest struct {
	FromToken         string          `json:"fromToken" binding:"required"`
	ToToken           string          `json:"toToken" binding:"required"`
	Amount            decimal.Decimal `json:"amount" binding:"required"`
	ChainID           int             `json:"chainId" binding:"required"`
	ToChainID         int             `json:"toChainId,omitempty"`
	SlippageTolerance decimal.Decimal `json:"slippageTolerance,omitempty"`
	UserAddress       string          `json:"userAddress,omitempty"`
	IncludeGasEstimate bool           `json:"includeGasEstimate,omitempty"`
	Protocols         []string        `json:"protocols,omitempty"`
}

// Quote represents a swap quote from an aggregator
type Quote struct {
	ID                string                 `json:"id"`
	FromToken         *Token                 `json:"fromToken"`
	ToToken           *Token                 `json:"toToken"`
	FromAmount        decimal.Decimal        `json:"fromAmount"`
	ToAmount          decimal.Decimal        `json:"toAmount"`
	ToAmountMin       decimal.Decimal        `json:"toAmountMin"`
	Price             decimal.Decimal        `json:"price"`
	PriceImpact       decimal.Decimal        `json:"priceImpact"`
	SlippageTolerance decimal.Decimal        `json:"slippageTolerance"`
	GasEstimate       *GasEstimate           `json:"gasEstimate,omitempty"`
	Route             *Route                 `json:"route"`
	Provider          string                 `json:"provider"`
	CreatedAt         time.Time              `json:"createdAt"`
	ExpiresAt         time.Time              `json:"expiresAt"`
	CallData          string                 `json:"callData,omitempty"`
	Value             string                 `json:"value,omitempty"`
	To                string                 `json:"to,omitempty"`
	Metadata          map[string]interface{} `json:"metadata,omitempty"`
}

// Route represents a swap route through multiple DEXs
type Route struct {
	Steps       []*RouteStep    `json:"steps"`
	TotalFee    decimal.Decimal `json:"totalFee"`
	GasEstimate *GasEstimate    `json:"gasEstimate,omitempty"`
}

// RouteStep represents a single step in a swap route
type RouteStep struct {
	Type           string          `json:"type"`
	FromToken      *Token          `json:"fromToken"`
	ToToken        *Token          `json:"toToken"`
	FromAmount     decimal.Decimal `json:"fromAmount"`
	ToAmount       decimal.Decimal `json:"toAmount"`
	Protocol       string          `json:"protocol"`
	PoolAddress    string          `json:"poolAddress,omitempty"`
	Fee            decimal.Decimal `json:"fee"`
	PriceImpact    decimal.Decimal `json:"priceImpact"`
	GasEstimate    *GasEstimate    `json:"gasEstimate,omitempty"`
}

// GasEstimate represents gas estimation for a transaction
type GasEstimate struct {
	GasLimit    uint64          `json:"gasLimit"`
	GasPrice    decimal.Decimal `json:"gasPrice"`
	GasFee      decimal.Decimal `json:"gasFee"`
	GasFeeUSD   decimal.Decimal `json:"gasFeeUSD,omitempty"`
}

// CompareQuotesRequest represents a request to compare quotes from multiple sources
type CompareQuotesRequest struct {
	FromToken         string          `json:"fromToken" binding:"required"`
	ToToken           string          `json:"toToken" binding:"required"`
	Amount            decimal.Decimal `json:"amount" binding:"required"`
	ChainID           int             `json:"chainId" binding:"required"`
	ToChainID         int             `json:"toChainId,omitempty"`
	SlippageTolerance decimal.Decimal `json:"slippageTolerance,omitempty"`
	UserAddress       string          `json:"userAddress,omitempty"`
	Sources           []string        `json:"sources,omitempty"`
}

// QuotesResponse represents a simplified response with ordered quotes (best first)
type QuotesResponse struct {
	Quotes       []*Quote               `json:"quotes"`           // Ordered list with best quote first
	QuotesCount  int                    `json:"quotesCount"`
	ResponseTime time.Duration          `json:"responseTime"`
	CreatedAt    time.Time              `json:"createdAt"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

// CompareQuotesResponse represents a response comparing quotes from multiple sources
type CompareQuotesResponse struct {
	Quotes      []*Quote         `json:"quotes"`      // Ordered list with best quote first
	Comparison  *QuoteComparison `json:"comparison"`
	RequestedAt time.Time        `json:"requestedAt"`
}

// AllQuotesResponse represents all quotes from providers with best quote suggestion
// DEPRECATED: Use QuotesResponse instead for simplified response
type AllQuotesResponse struct {
	AllQuotes    []*Quote               `json:"allQuotes"`
	BestQuote    *Quote                 `json:"bestQuote"`
	QuotesCount  int                    `json:"quotesCount"`
	ResponseTime time.Duration          `json:"responseTime"`
	CreatedAt    time.Time              `json:"createdAt"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

// QuoteComparison provides comparison metrics between quotes
type QuoteComparison struct {
	BestPrice        decimal.Decimal `json:"bestPrice"`
	WorstPrice       decimal.Decimal `json:"worstPrice"`
	PriceDifference  decimal.Decimal `json:"priceDifference"`
	PriceDifferencePercent decimal.Decimal `json:"priceDifferencePercent"`
	BestGasEstimate  *GasEstimate    `json:"bestGasEstimate,omitempty"`
	WorstGasEstimate *GasEstimate    `json:"worstGasEstimate,omitempty"`
}

// TokenListRequest represents a request for token list
type TokenListRequest struct {
	ChainID int      `json:"chainId,omitempty"`
	Search  string   `json:"search,omitempty"`
	Tags    []string `json:"tags,omitempty"`
	Limit   int      `json:"limit,omitempty"`
	Offset  int      `json:"offset,omitempty"`
}

// TokenListResponse represents a response with token list
type TokenListResponse struct {
	Tokens    []*Token               `json:"tokens"`
	Total     int                    `json:"total"`
	Page      int                    `json:"page"`
	Limit     int                    `json:"limit"`
	UpdatedAt time.Time              `json:"updatedAt"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// PriceRequest represents a request for token price
type PriceRequest struct {
	Token   string `json:"token" binding:"required"`
	ChainID int    `json:"chainId" binding:"required"`
	Currency string `json:"currency,omitempty"`
}

// PriceResponse represents a token price response
type PriceResponse struct {
	Token     *Token          `json:"token"`
	Price     decimal.Decimal `json:"price"`
	Currency  string          `json:"currency"`
	Source    string          `json:"source"`
	UpdatedAt time.Time       `json:"updatedAt"`
}

// MultiPriceRequest represents a request for multiple token prices
type MultiPriceRequest struct {
	Tokens   []string `json:"tokens" binding:"required"`
	ChainID  int      `json:"chainId" binding:"required"`
	Currency string   `json:"currency,omitempty"`
}

// MultiPriceResponse represents multiple token prices response
type MultiPriceResponse struct {
	Prices    map[string]*PriceResponse `json:"prices"`
	Currency  string                    `json:"currency"`
	UpdatedAt time.Time                 `json:"updatedAt"`
}

// RouteRequest represents a request for best route
type RouteRequest struct {
	FromToken string          `json:"fromToken" binding:"required"`
	ToToken   string          `json:"toToken" binding:"required"`
	Amount    decimal.Decimal `json:"amount" binding:"required"`
	ChainID   int             `json:"chainId" binding:"required"`
	MaxSteps  int             `json:"maxSteps,omitempty"`
	Protocols []string        `json:"protocols,omitempty"`
}

// RouteResponse represents a route response
type RouteResponse struct {
	Route     *Route    `json:"route"`
	Quotes    []*Quote  `json:"quotes,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
}

// ErrorResponse represents an error response
type ErrorResponse struct {
	Error   string            `json:"error"`
	Message string            `json:"message"`
	Code    int               `json:"code,omitempty"`
	Details map[string]interface{} `json:"details,omitempty"`
}

// HealthResponse represents a health check response
type HealthResponse struct {
	Status    string            `json:"status"`
	Timestamp time.Time         `json:"timestamp"`
	Version   string            `json:"version"`
	Uptime    string            `json:"uptime"` // Duration as string for swagger compatibility
	Checks    map[string]string `json:"checks,omitempty"`
}

// Provider constants
const (
	ProviderLiFi       = "lifi"
	ProviderOneInch    = "1inch"
	ProviderDexScreener = "dexscreener"
	ProviderParaswap   = "paraswap"
)

// Status constants
const (
	StatusHealthy   = "healthy"
	StatusUnhealthy = "unhealthy"
	StatusDegraded  = "degraded"
)

// Currency constants
const (
	CurrencyUSD = "USD"
	CurrencyETH = "ETH"
	CurrencyBTC = "BTC"
)