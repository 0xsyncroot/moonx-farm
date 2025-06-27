package lifi

// LiFiTimingConfig represents timing optimization strategies
type LiFiTimingConfig struct {
	Order                    string `json:"order"`                     // CHEAPEST, FASTEST
	PreferExchanges          string `json:"preferExchanges,omitempty"` // Preferred DEX list
	PreferBridges            string `json:"preferBridges,omitempty"`   // Preferred bridge list
	SwapStepTimingStrategies string `json:"swapStepTimingStrategies,omitempty"`
	RouteTimingStrategies    string `json:"routeTimingStrategies,omitempty"`
}

// LiFiQuoteRequest represents the enhanced request parameters
type LiFiQuoteRequest struct {
	FromChain       string   `json:"fromChain"` // String format as per API docs
	ToChain         string   `json:"toChain"`   // String format as per API docs
	FromToken       string   `json:"fromToken"`
	ToToken         string   `json:"toToken"`
	FromAmount      string   `json:"fromAmount"`
	FromAddress     string   `json:"fromAddress"`
	ToAddress       string   `json:"toAddress,omitempty"`
	Slippage        string   `json:"slippage,omitempty"`
	Integrator      string   `json:"integrator,omitempty"`
	Referrer        string   `json:"referrer,omitempty"`
	Order           string   `json:"order,omitempty"`
	PreferExchanges []string `json:"preferExchanges,omitempty"` // Array of preferred exchanges
	PreferBridges   []string `json:"preferBridges,omitempty"`   // Array of preferred bridges
}
