package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/shopspring/decimal"
	"github.com/sirupsen/logrus"

	"github.com/moonx-farm/aggregator-service/internal/config"
	"github.com/moonx-farm/aggregator-service/internal/models"
	"github.com/moonx-farm/aggregator-service/internal/utils"
)

// RelayService handles Relay.link API integration
type RelayService struct {
	apiConfig    *config.APIConfig
	httpClient   *http.Client
	baseURL      string
	cacheService *CacheService
	tokenUtils   *utils.TokenUtils
}

// NewRelayService creates a new Relay service
func NewRelayService(apiConfig *config.APIConfig, cacheService *CacheService) *RelayService {
	return &RelayService{
		apiConfig:    apiConfig,
		httpClient:   &http.Client{Timeout: 30 * time.Second},
		baseURL:      "https://api.relay.link",
		cacheService: cacheService,
		tokenUtils:   utils.NewTokenUtils(),
	}
}

// Relay API request and response structures
type RelayQuoteRequest struct {
	User                 string `json:"user"`                 // Required field!
	OriginChainId        int    `json:"originChainId"`        // Required field!
	DestinationChainId   int    `json:"destinationChainId"`   // Required field!
	OriginCurrency       string `json:"originCurrency"`       // Required field!
	DestinationCurrency  string `json:"destinationCurrency"`  // Required field!
	Recipient            string `json:"recipient"`            // Required field!
	TradeType            string `json:"tradeType"`            // Required field!
	Amount               string `json:"amount"`               // Required field!
	Referrer             string `json:"referrer"`             // Fixed to "moonx.farm"
	UseExternalLiquidity bool   `json:"useExternalLiquidity"` // Required field!
	UseDepositAddress    bool   `json:"useDepositAddress"`    // Required field!
	TopupGas             bool   `json:"topupGas"`             // Required field!
}

type RelayQuoteResponse struct {
	Steps []struct {
		ID          string `json:"id"`
		Action      string `json:"action"`
		Description string `json:"description"`
		Kind        string `json:"kind"`
		RequestID   string `json:"requestId,omitempty"`
		Items       []struct {
			Status string `json:"status"`
			Data   struct {
				From                 string `json:"from"`
				To                   string `json:"to"`
				Data                 string `json:"data"`
				Value                string `json:"value"`
				MaxFeePerGas         string `json:"maxFeePerGas"`
				MaxPriorityFeePerGas string `json:"maxPriorityFeePerGas"`
				ChainID              int    `json:"chainId"`
			} `json:"data"`
			Check struct {
				Endpoint string `json:"endpoint"`
				Method   string `json:"method"`
			} `json:"check"`
		} `json:"items"`
	} `json:"steps"`
	Fees struct {
		Gas struct {
			Currency struct {
				ChainID  int    `json:"chainId"`
				Address  string `json:"address"`
				Symbol   string `json:"symbol"`
				Name     string `json:"name"`
				Decimals int    `json:"decimals"`
				Metadata struct {
					LogoURI  string `json:"logoURI"`
					Verified bool   `json:"verified"`
					IsNative bool   `json:"isNative"`
				} `json:"metadata"`
			} `json:"currency"`
			Amount          string `json:"amount"`
			AmountFormatted string `json:"amountFormatted"`
			AmountUsd       string `json:"amountUsd"`
			MinimumAmount   string `json:"minimumAmount"`
		} `json:"gas"`
		Relayer struct {
			Currency struct {
				ChainID  int    `json:"chainId"`
				Address  string `json:"address"`
				Symbol   string `json:"symbol"`
				Name     string `json:"name"`
				Decimals int    `json:"decimals"`
			} `json:"currency"`
			Amount          string `json:"amount"`
			AmountFormatted string `json:"amountFormatted"`
			AmountUsd       string `json:"amountUsd"`
		} `json:"relayer"`
	} `json:"fees"`
	Details struct {
		Operation    string `json:"operation"`
		TimeEstimate int    `json:"timeEstimate"`
		Sender       string `json:"sender"`
		Recipient    string `json:"recipient"`
		CurrencyIn   struct {
			Currency struct {
				ChainID  int    `json:"chainId"`
				Address  string `json:"address"`
				Symbol   string `json:"symbol"`
				Name     string `json:"name"`
				Decimals int    `json:"decimals"`
				Metadata struct {
					LogoURI  string `json:"logoURI"`
					Verified bool   `json:"verified"`
					IsNative bool   `json:"isNative"`
				} `json:"metadata"`
			} `json:"currency"`
			Amount          string `json:"amount"`
			AmountFormatted string `json:"amountFormatted"`
			AmountUsd       string `json:"amountUsd"`
		} `json:"currencyIn"`
		CurrencyOut struct {
			Currency struct {
				ChainID  int    `json:"chainId"`
				Address  string `json:"address"`
				Symbol   string `json:"symbol"`
				Name     string `json:"name"`
				Decimals int    `json:"decimals"`
				Metadata struct {
					LogoURI  string `json:"logoURI"`
					Verified bool   `json:"verified"`
					IsNative bool   `json:"isNative"`
				} `json:"metadata"`
			} `json:"currency"`
			Amount          string `json:"amount"`
			AmountFormatted string `json:"amountFormatted"`
			AmountUsd       string `json:"amountUsd"`
			MinimumAmount   string `json:"minimumAmount"`
		} `json:"currencyOut"`
		TotalImpact struct {
			Usd     string `json:"usd"`
			Percent string `json:"percent"`
		} `json:"totalImpact"`
		SwapImpact struct {
			Usd     string `json:"usd"`
			Percent string `json:"percent"`
		} `json:"swapImpact"`
		Rate string `json:"rate"`
	} `json:"details"`
}

type RelayCurrenciesResponse struct {
	Currencies []struct {
		Contract string `json:"contract"`
		Name     string `json:"name"`
		Symbol   string `json:"symbol"`
		Decimals int    `json:"decimals"`
		Metadata struct {
			LogoURI  string `json:"logoURI"`
			Verified bool   `json:"verified"`
			IsNative bool   `json:"isNative"`
		} `json:"metadata"`
	} `json:"currencies"`
}

// GetQuote gets a quote from Relay.link
func (r *RelayService) GetQuote(ctx context.Context, req *models.QuoteRequest) (*models.Quote, error) {
	// Build request payload
	requestPayload, err := r.buildQuoteRequest(req)
	if err != nil {
		return nil, fmt.Errorf("failed to build quote request: %w", err)
	}

	// Execute API call
	relayResp, err := r.executeQuoteRequest(ctx, requestPayload)
	if err != nil {
		logrus.WithError(err).Error("Relay API call failed")
		return nil, fmt.Errorf("failed to get quote from Relay: %w", err)
	}

	// Convert response to quote
	quote, err := r.convertResponseToQuote(relayResp, req)
	if err != nil {
		return nil, fmt.Errorf("failed to convert Relay response: %w", err)
	}

	return quote, nil
}

// GetMultipleQuotes gets multiple quotes from Relay
func (r *RelayService) GetMultipleQuotes(ctx context.Context, req *models.QuoteRequest, maxQuotes int) ([]*models.Quote, error) {
	// Get single quote for speed
	quote, err := r.GetQuote(ctx, req)
	if err != nil {
		return nil, err
	}

	return []*models.Quote{quote}, nil
}

// buildQuoteRequest builds the Relay API request payload
func (r *RelayService) buildQuoteRequest(req *models.QuoteRequest) (*RelayQuoteRequest, error) {
	if req == nil || req.Amount.IsZero() {
		return nil, fmt.Errorf("invalid request")
	}

	// Use amount as-is - user provides wei/smallest unit amount
	amountWei := req.Amount.String()

	// Use user address or fallback
	userAddress := req.UserAddress
	if userAddress == "" {
		userAddress = "0x000000000000000000000000000000000000dEaD"
	}

	// Determine destination chain
	destinationChainId := req.ChainID
	if req.ToChainID != 0 {
		destinationChainId = req.ToChainID
	}

	return &RelayQuoteRequest{
		User:                 userAddress,
		OriginChainId:        req.ChainID,
		DestinationChainId:   destinationChainId,
		OriginCurrency:       r.normalizeTokenAddress(req.FromToken),
		DestinationCurrency:  r.normalizeTokenAddress(req.ToToken),
		Recipient:            userAddress,
		TradeType:            "EXACT_INPUT",
		Amount:               amountWei,
		Referrer:             "moonx.farm",
		UseExternalLiquidity: false,
		UseDepositAddress:    false,
		TopupGas:             false,
	}, nil
}

// executeQuoteRequest executes the API request
func (r *RelayService) executeQuoteRequest(ctx context.Context, payload *RelayQuoteRequest) (*RelayQuoteResponse, error) {
	// Serialize payload
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	logrus.WithFields(logrus.Fields{
		"url":                 fmt.Sprintf("%s/quote", r.baseURL),
		"originChainId":       payload.OriginChainId,
		"destinationChainId":  payload.DestinationChainId,
		"originCurrency":      payload.OriginCurrency,
		"destinationCurrency": payload.DestinationCurrency,
		"amount":              payload.Amount,
		"user":                payload.User,
		"referrer":            payload.Referrer,
	}).Info("🔗 Relay API Request")

	// Create HTTP request
	requestURL := fmt.Sprintf("%s/quote", r.baseURL)
	httpReq, err := http.NewRequestWithContext(ctx, "POST", requestURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create HTTP request: %w", err)
	}

	// Set headers
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")

	// Execute request
	resp, err := r.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("network error: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// Handle non-200 status
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Relay API error (%d): %s", resp.StatusCode, string(body))
	}

	// Parse response
	var relayResp RelayQuoteResponse
	if err := json.Unmarshal(body, &relayResp); err != nil {
		return nil, fmt.Errorf("failed to decode Relay response: %w", err)
	}

	return &relayResp, nil
}

// convertResponseToQuote converts Relay response to our Quote model
func (r *RelayService) convertResponseToQuote(relayResp *RelayQuoteResponse, req *models.QuoteRequest) (*models.Quote, error) {
	// Extract amounts - use wei format directly when available
	fromAmount, err := decimal.NewFromString(relayResp.Details.CurrencyIn.Amount)
	if err != nil {
		return nil, fmt.Errorf("invalid currencyIn amount: %w", err)
	}

	toAmount, err := decimal.NewFromString(relayResp.Details.CurrencyOut.Amount)
	if err != nil {
		return nil, fmt.Errorf("invalid currencyOut amount: %w", err)
	}

	// Use minimumAmount directly from API (already in wei format)
	toAmountMin, err := decimal.NewFromString(relayResp.Details.CurrencyOut.MinimumAmount)
	if err != nil {
		// Fallback: calculate with slippage if minimumAmount is not available
		slippageDecimal := req.SlippageTolerance.Div(decimal.NewFromInt(100))
		if slippageDecimal.IsZero() {
			slippageDecimal = decimal.NewFromFloat(0.005) // Default 0.5%
		}
		toAmountMin = toAmount.Mul(decimal.NewFromInt(1).Sub(slippageDecimal))

		logrus.WithFields(logrus.Fields{
			"toAmount":   toAmount.String(),
			"slippage":   slippageDecimal.String(),
			"calculated": toAmountMin.String(),
		}).Warn("⚠️ Using calculated toAmountMin (minimumAmount not available)")
	} else {
		logrus.WithFields(logrus.Fields{
			"minimumAmount": toAmountMin.String(),
		}).Debug("✅ Using API minimumAmount")
	}

	// Calculate price
	var price decimal.Decimal
	if relayResp.Details.Rate != "" {
		if ratePrice, err := decimal.NewFromString(relayResp.Details.Rate); err == nil {
			price = ratePrice
		} else {
			// Fallback calculation
			if !fromAmount.IsZero() {
				price = toAmount.Div(fromAmount)
			}
		}
	} else if !fromAmount.IsZero() {
		price = toAmount.Div(fromAmount)
	}

	// Use price impact from API
	var priceImpact decimal.Decimal
	if relayResp.Details.SwapImpact.Percent != "" {
		if impact, err := decimal.NewFromString(relayResp.Details.SwapImpact.Percent); err == nil {
			// Convert to absolute value since API returns negative values
			priceImpact = impact.Abs()
			logrus.WithFields(logrus.Fields{
				"swapImpactPercent": relayResp.Details.SwapImpact.Percent,
				"priceImpact":       priceImpact.String(),
			}).Debug("✅ Using API swap impact")
		} else {
			logrus.WithError(err).Warn("⚠️ Failed to parse swap impact, using fallback")
			priceImpact = decimal.NewFromFloat(0.001) // Default 0.1%
		}
	} else if relayResp.Details.TotalImpact.Percent != "" {
		// Fallback to total impact
		if impact, err := decimal.NewFromString(relayResp.Details.TotalImpact.Percent); err == nil {
			priceImpact = impact.Abs()
			logrus.WithFields(logrus.Fields{
				"totalImpactPercent": relayResp.Details.TotalImpact.Percent,
				"priceImpact":        priceImpact.String(),
			}).Debug("📊 Using API total impact as fallback")
		} else {
			priceImpact = decimal.NewFromFloat(0.001) // Default 0.1%
		}
	} else {
		priceImpact = decimal.NewFromFloat(0.001) // Default 0.1%
	}

	// Build from/to token objects
	fromTokenObj := &models.Token{
		Address:     relayResp.Details.CurrencyIn.Currency.Address,
		Symbol:      relayResp.Details.CurrencyIn.Currency.Symbol,
		Name:        relayResp.Details.CurrencyIn.Currency.Name,
		Decimals:    relayResp.Details.CurrencyIn.Currency.Decimals,
		ChainID:     relayResp.Details.CurrencyIn.Currency.ChainID,
		LogoURI:     relayResp.Details.CurrencyIn.Currency.Metadata.LogoURI,
		IsNative:    relayResp.Details.CurrencyIn.Currency.Metadata.IsNative,
		LastUpdated: time.Now(),
	}

	toTokenObj := &models.Token{
		Address:     relayResp.Details.CurrencyOut.Currency.Address,
		Symbol:      relayResp.Details.CurrencyOut.Currency.Symbol,
		Name:        relayResp.Details.CurrencyOut.Currency.Name,
		Decimals:    relayResp.Details.CurrencyOut.Currency.Decimals,
		ChainID:     relayResp.Details.CurrencyOut.Currency.ChainID,
		LogoURI:     relayResp.Details.CurrencyOut.Currency.Metadata.LogoURI,
		IsNative:    relayResp.Details.CurrencyOut.Currency.Metadata.IsNative,
		LastUpdated: time.Now(),
	}

	// Calculate total fees from Relay fee structure
	totalFees := decimal.Zero
	var gasEstimate *models.GasEstimate

	if relayResp.Fees.Gas.Amount != "" {
		if gasAmount, err := decimal.NewFromString(relayResp.Fees.Gas.Amount); err == nil {
			totalFees = totalFees.Add(gasAmount)

			// Build gas estimate
			var gasAmountUSD decimal.Decimal
			if relayResp.Fees.Gas.AmountUsd != "" {
				gasAmountUSD, _ = decimal.NewFromString(relayResp.Fees.Gas.AmountUsd)
			}

			gasEstimate = &models.GasEstimate{
				GasLimit:  0, // Relay doesn't provide gas limit
				GasPrice:  gasAmount,
				GasFee:    gasAmount,
				GasFeeUSD: gasAmountUSD,
			}
		}
	}

	if relayResp.Fees.Relayer.Amount != "" {
		if relayerAmount, err := decimal.NewFromString(relayResp.Fees.Relayer.Amount); err == nil {
			totalFees = totalFees.Add(relayerAmount)
		}
	}

	// Build route steps from Relay steps
	var routeSteps []*models.RouteStep
	for _, step := range relayResp.Steps {
		routeStep := &models.RouteStep{
			Protocol:    "relay",
			FromToken:   fromTokenObj,
			ToToken:     toTokenObj,
			FromAmount:  fromAmount,
			ToAmount:    toAmount,
			Fee:         totalFees,
			GasEstimate: gasEstimate,
		}
		routeSteps = append(routeSteps, routeStep)

		// Log step details for debugging
		logrus.WithFields(logrus.Fields{
			"stepId":          step.ID,
			"stepAction":      step.Action,
			"stepDescription": step.Description,
			"stepKind":        step.Kind,
		}).Debug("Relay route step processed")
	}

	// If no steps, create a single step
	if len(routeSteps) == 0 {
		routeSteps = []*models.RouteStep{
			{
				Protocol:    "relay",
				FromToken:   fromTokenObj,
				ToToken:     toTokenObj,
				FromAmount:  fromAmount,
				ToAmount:    toAmount,
				Fee:         totalFees,
				GasEstimate: gasEstimate,
			},
		}
	}

	route := &models.Route{
		Steps:       routeSteps,
		TotalFee:    totalFees,
		GasEstimate: gasEstimate,
	}

	// Extract transaction data from Relay steps
	var callData, toAddress, value string
	var maxFeePerGas, maxPriorityFeePerGas string
	for _, step := range relayResp.Steps {
		if step.Kind == "transaction" && len(step.Items) > 0 {
			txData := step.Items[0].Data
			callData = txData.Data
			toAddress = txData.To
			value = txData.Value
			maxFeePerGas = txData.MaxFeePerGas
			maxPriorityFeePerGas = txData.MaxPriorityFeePerGas
			break
		}
	}

	// Log final amounts for verification
	logrus.WithFields(logrus.Fields{
		"fromAmount":  fromAmount.String(),
		"toAmount":    toAmount.String(),
		"toAmountMin": toAmountMin.String(),
		"priceImpact": priceImpact.String(),
		"provider":    "relay",
	}).Info("🎯 Final quote amounts (all in wei format)")

	// Create comprehensive quote
	quote := &models.Quote{
		ID:                fmt.Sprintf("relay-%d", time.Now().Unix()),
		Provider:          "relay",
		FromToken:         fromTokenObj,
		ToToken:           toTokenObj,
		FromAmount:        fromAmount,
		ToAmount:          toAmount,
		ToAmountMin:       toAmountMin,
		Price:             price,
		PriceImpact:       priceImpact,
		SlippageTolerance: req.SlippageTolerance,
		GasEstimate:       gasEstimate,
		Route:             route,
		CreatedAt:         time.Now(),
		ExpiresAt:         time.Now().Add(30 * time.Second), // Relay quotes valid for 30 seconds
		CallData:          callData,
		Value:             value,
		To:                toAddress,
		Metadata: map[string]interface{}{
			"relayOperation":       relayResp.Details.Operation,
			"timeEstimate":         relayResp.Details.TimeEstimate,
			"sender":               relayResp.Details.Sender,
			"recipient":            relayResp.Details.Recipient,
			"hasTransactionData":   callData != "",
			"maxFeePerGas":         maxFeePerGas,
			"maxPriorityFeePerGas": maxPriorityFeePerGas,
			"currencyInUSD":        relayResp.Details.CurrencyIn.AmountUsd,
			"currencyOutUSD":       relayResp.Details.CurrencyOut.AmountUsd,
			"gasAmountUSD":         relayResp.Fees.Gas.AmountUsd,
			"relayerFeeAmount":     relayResp.Fees.Relayer.Amount,
			"relayerFeeAmountUSD":  relayResp.Fees.Relayer.AmountUsd,
			"totalSteps":           len(relayResp.Steps),
			"crossChain":           req.ChainID != req.ToChainID,
			"originChainId":        req.ChainID,
			"destinationChainId":   req.ToChainID,
			// New fields from updated API response
			"swapImpactPercent":  relayResp.Details.SwapImpact.Percent,
			"swapImpactUSD":      relayResp.Details.SwapImpact.Usd,
			"totalImpactPercent": relayResp.Details.TotalImpact.Percent,
			"totalImpactUSD":     relayResp.Details.TotalImpact.Usd,
			"minimumAmountWei":   relayResp.Details.CurrencyOut.MinimumAmount,
		},
	}

	return quote, nil
}

// GetTokenList gets supported tokens from Relay.link
func (r *RelayService) GetTokenList(ctx context.Context, chainID int) ([]*models.Token, error) {
	// Check cache first
	if cachedList, err := r.cacheService.GetTokenList(ctx, chainID); err == nil && cachedList != nil {
		if time.Since(cachedList.UpdatedAt) < 2*time.Minute {
			logrus.WithField("chainID", chainID).Debug("Relay token list found in cache")
			return cachedList.Tokens, nil
		}
	}

	requestURL := fmt.Sprintf("%s/currencies/v1", r.baseURL)
	if chainID > 0 {
		requestURL += fmt.Sprintf("?chainId=%d", chainID)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "GET", requestURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create HTTP request: %w", err)
	}

	httpReq.Header.Set("Accept", "application/json")

	resp, err := r.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to make HTTP request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Relay API error (status %d): %s", resp.StatusCode, string(body))
	}

	var relayResp RelayCurrenciesResponse
	if err := json.NewDecoder(resp.Body).Decode(&relayResp); err != nil {
		return nil, fmt.Errorf("failed to decode Relay currencies response: %w", err)
	}

	// Process tokens
	tokens := r.processTokenList(relayResp, chainID)

	// Cache the result
	tokenList := &models.TokenListResponse{
		Tokens:    tokens,
		Total:     len(tokens),
		UpdatedAt: time.Now(),
	}

	go func() {
		if err := r.cacheService.SetTokenList(context.Background(), chainID, tokenList); err != nil {
			logrus.WithError(err).Warn("Failed to cache Relay token list")
		}
	}()

	logrus.WithFields(logrus.Fields{
		"chainID":    chainID,
		"tokenCount": len(tokens),
		"provider":   "relay",
	}).Info("Relay token list retrieved")

	return tokens, nil
}

// processTokenList processes tokens with intelligent prioritization
func (r *RelayService) processTokenList(relayResp RelayCurrenciesResponse, chainID int) []*models.Token {
	var nativeTokens []*models.Token
	var popularTokens []*models.Token
	var stablecoins []*models.Token
	var verifiedTokens []*models.Token
	var otherTokens []*models.Token

	// Define categories
	popularAddresses := map[string]bool{
		"0x0000000000000000000000000000000000000000": true, // ETH
		"0x4200000000000000000000000000000000000006": true, // WETH (Base)
		"0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": true, // WETH (Ethereum)
	}

	stablecoinSymbols := map[string]bool{
		"USDC": true, "USDT": true, "DAI": true, "FRAX": true,
		"USDB": true, // Removed USDbC due to low liquidity
	}

	for _, currency := range relayResp.Currencies {
		normalizedAddr := strings.ToLower(currency.Contract)
		normalizedSymbol := strings.ToUpper(currency.Symbol)

		modelToken := &models.Token{
			Address:     currency.Contract,
			Symbol:      currency.Symbol,
			Name:        currency.Name,
			Decimals:    currency.Decimals,
			ChainID:     chainID,
			LogoURI:     currency.Metadata.LogoURI,
			IsNative:    currency.Metadata.IsNative,
			LastUpdated: time.Now(),
			Metadata: map[string]interface{}{
				"source":     "relay",
				"isNative":   currency.Metadata.IsNative,
				"isVerified": currency.Metadata.Verified,
				"isPopular":  popularAddresses[normalizedAddr],
				"isStable":   stablecoinSymbols[normalizedSymbol],
			},
		}

		// Categorize tokens
		if currency.Metadata.IsNative {
			nativeTokens = append(nativeTokens, modelToken)
		} else if popularAddresses[normalizedAddr] {
			popularTokens = append(popularTokens, modelToken)
		} else if stablecoinSymbols[normalizedSymbol] {
			stablecoins = append(stablecoins, modelToken)
		} else if currency.Metadata.Verified {
			verifiedTokens = append(verifiedTokens, modelToken)
		} else {
			otherTokens = append(otherTokens, modelToken)
		}
	}

	// Sort each category
	sortBySymbol := func(tokens []*models.Token) {
		sort.Slice(tokens, func(i, j int) bool {
			return tokens[i].Symbol < tokens[j].Symbol
		})
	}

	sortBySymbol(nativeTokens)
	sortBySymbol(popularTokens)
	sortBySymbol(stablecoins)
	sortBySymbol(verifiedTokens)
	sortBySymbol(otherTokens)

	// Combine in optimal order
	result := append(nativeTokens, popularTokens...)
	result = append(result, stablecoins...)
	result = append(result, verifiedTokens...)
	return append(result, otherTokens...)
}

// GetTokenByAddress gets a specific token by address
func (r *RelayService) GetTokenByAddress(ctx context.Context, address string, chainID int) (*models.Token, error) {
	tokens, err := r.GetTokenList(ctx, chainID)
	if err != nil {
		return nil, err
	}

	normalizedAddress := strings.ToLower(address)
	for _, token := range tokens {
		if strings.ToLower(token.Address) == normalizedAddress {
			return token, nil
		}
	}

	return nil, fmt.Errorf("token not found in Relay: %s", address)
}

// normalizeTokenAddress normalizes token addresses for Relay API
func (r *RelayService) normalizeTokenAddress(tokenAddress string) string {
	// Convert native ETH representation to Relay format
	if tokenAddress == "0x0000000000000000000000000000000000000000" ||
		tokenAddress == "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" {
		return "0x0000000000000000000000000000000000000000"
	}
	return tokenAddress
}
