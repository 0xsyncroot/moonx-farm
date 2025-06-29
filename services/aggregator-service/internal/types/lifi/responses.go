package lifi

// LiFiQuoteResponse represents the response from LiFi quote endpoint
type LiFiQuoteResponse struct {
	Type               string              `json:"type"`
	Id                 string              `json:"id"`
	Tool               string              `json:"tool"`
	ToolDetails        ToolDetails         `json:"toolDetails"`
	Action             Action              `json:"action"`
	Estimate           Estimate            `json:"estimate"`
	IncludedSteps      []Step              `json:"includedSteps"`
	TransactionRequest *TransactionRequest `json:"transactionRequest"`
}

// LiFiRoutesResponse represents the response from LiFi routes endpoint
type LiFiRoutesResponse struct {
	Routes []LiFiRoute `json:"routes"`
}

// LiFiRoute represents a single route from LiFi routes endpoint
type LiFiRoute struct {
	Id              string      `json:"id"`
	FromChainId     int         `json:"fromChainId"`
	FromAmountUSD   string      `json:"fromAmountUSD"`
	FromAmount      string      `json:"fromAmount"`
	FromToken       LiFiToken   `json:"fromToken"`
	FromAddress     string      `json:"fromAddress"`
	ToChainId       int         `json:"toChainId"`
	ToAmountUSD     string      `json:"toAmountUSD"`
	ToAmount        string      `json:"toAmount"`
	ToAmountMin     string      `json:"toAmountMin"`
	ToToken         LiFiToken   `json:"toToken"`
	ToAddress       string      `json:"toAddress"`
	GasCostUSD      string      `json:"gasCostUSD"`
	Steps           []RouteStep `json:"steps"`
	Insurance       *Insurance  `json:"insurance,omitempty"`
	Tags            []string    `json:"tags"`
	Tool            string      `json:"tool"`
	OrderPreference string      `json:"orderPreference,omitempty"` // CHEAPEST, FASTEST, RECOMMENDED
}

// RouteStep represents a step in a LiFi route
type RouteStep struct {
	Id                 string              `json:"id"`
	Type               string              `json:"type"`
	Tool               string              `json:"tool"`
	ToolDetails        ToolDetails         `json:"toolDetails"`
	Action             Action              `json:"action"`
	Estimate           Estimate            `json:"estimate"`
	IncludedSteps      []Step              `json:"includedSteps"`
	TransactionRequest *TransactionRequest `json:"transactionRequest,omitempty"`
}

// Insurance represents insurance information for a route
type Insurance struct {
	State        string `json:"state"`
	FeeAmountUsd string `json:"feeAmountUsd"`
}

// ToolDetails contains information about the tool/protocol
type ToolDetails struct {
	Key     string `json:"key"`
	Name    string `json:"name"`
	LogoURI string `json:"logoURI"`
}

// Action contains swap/bridge action details
type Action struct {
	FromChainId int       `json:"fromChainId"`
	FromAmount  string    `json:"fromAmount"`
	FromToken   LiFiToken `json:"fromToken"`
	ToChainId   int       `json:"toChainId"`
	ToToken     LiFiToken `json:"toToken"`
	Slippage    float64   `json:"slippage"`
	FromAddress string    `json:"fromAddress,omitempty"`
	ToAddress   string    `json:"toAddress,omitempty"`
}

// Estimate contains cost and time estimates
type Estimate struct {
	Tool              string    `json:"tool"`
	FromAmount        string    `json:"fromAmount"`
	ToAmount          string    `json:"toAmount"`
	ToAmountMin       string    `json:"toAmountMin"`
	ApprovalAddress   string    `json:"approvalAddress"`
	ExecutionDuration int       `json:"executionDuration"`
	FeeCosts          []FeeCost `json:"feeCosts"`
	GasCosts          []GasCost `json:"gasCosts"`
	FromAmountUSD     string    `json:"fromAmountUSD"`
	ToAmountUSD       string    `json:"toAmountUSD"`
}

// Step represents a detailed step in the execution
type Step struct {
	Id                 string              `json:"id"`
	Type               string              `json:"type"`
	Tool               string              `json:"tool"`
	ToolDetails        ToolDetails         `json:"toolDetails"`
	Action             Action              `json:"action"`
	Estimate           Estimate            `json:"estimate"`
	TransactionRequest *TransactionRequest `json:"transactionRequest,omitempty"`
}

// TransactionRequest contains the actual transaction data
type TransactionRequest struct {
	Data     string `json:"data"`
	To       string `json:"to"`
	Value    string `json:"value"`
	From     string `json:"from"`
	ChainId  int    `json:"chainId"`
	GasPrice string `json:"gasPrice"`
	GasLimit string `json:"gasLimit"`
}

// FeeCost represents fee information
type FeeCost struct {
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Token       LiFiToken `json:"token"`
	Amount      string    `json:"amount"`
	AmountUSD   string    `json:"amountUSD"`
	Percentage  string    `json:"percentage"`
	Included    bool      `json:"included"`
}

// GasCost represents gas cost information
type GasCost struct {
	Type      string    `json:"type"`
	Price     string    `json:"price"`
	Estimate  string    `json:"estimate"`
	Limit     string    `json:"limit"`
	Amount    string    `json:"amount"`
	AmountUSD string    `json:"amountUSD"`
	Token     LiFiToken `json:"token"`
}

// LiFiTokensResponse represents the response from LiFi tokens endpoint
type LiFiTokensResponse struct {
	Tokens map[string][]LiFiToken `json:"tokens"`
}

// LiFiToken represents a token in the LiFi ecosystem
type LiFiToken struct {
	ChainId  int    `json:"chainId"`
	Address  string `json:"address"`
	Symbol   string `json:"symbol"`
	Name     string `json:"name"`
	Decimals int    `json:"decimals"`
	LogoURI  string `json:"logoURI"`
	PriceUSD string `json:"priceUSD"`
	CoinKey  string `json:"coinKey,omitempty"`
}
