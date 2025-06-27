package lifi

import (
	"fmt"
	"strconv"
	"time"

	"github.com/shopspring/decimal"
	"github.com/sirupsen/logrus"

	"github.com/moonx-farm/aggregator-service/internal/models"
	"github.com/moonx-farm/aggregator-service/internal/types/lifi"
)

// ConversionUtils provides conversion utilities for LiFi service
type ConversionUtils struct{}

// NewConversionUtils creates a new conversion utils instance
func NewConversionUtils() *ConversionUtils {
	return &ConversionUtils{}
}

// ConvertLiFiToQuote converts LiFi quote response to internal Quote model
func (c *ConversionUtils) ConvertLiFiToQuote(lifiResp *lifi.LiFiQuoteResponse, req *models.QuoteRequest) *models.Quote {
	// Parse amounts
	toAmount, err := c.ParseAmountFromString(lifiResp.Estimate.ToAmount)
	if err != nil {
		logrus.WithError(err).Warn("Failed to parse toAmount from LiFi response")
		toAmount = decimal.Zero
	}

	toAmountMin, err := c.ParseAmountFromString(lifiResp.Estimate.ToAmountMin)
	if err != nil {
		logrus.WithError(err).Warn("Failed to parse toAmountMin from LiFi response")
		toAmountMin = decimal.Zero
	}

	// Calculate price
	price := decimal.Zero
	if !req.Amount.IsZero() && !toAmount.IsZero() {
		price = toAmount.Div(req.Amount)
	}

	// Estimate gas cost
	var gasEstimate *models.GasEstimate
	if len(lifiResp.Estimate.GasCosts) > 0 {
		gasCost := lifiResp.Estimate.GasCosts[0]
		gasLimit := uint64(0)
		if limit, err := strconv.ParseUint(gasCost.Limit, 10, 64); err == nil {
			gasLimit = limit
		}
		
		gasPrice := decimal.Zero
		if price, err := decimal.NewFromString(gasCost.Price); err == nil {
			gasPrice = price
		}
		
		gasFee := decimal.Zero
		if fee, err := decimal.NewFromString(gasCost.Amount); err == nil {
			gasFee = fee
		}
		
		gasFeeUSD := decimal.Zero
		if feeUSD, err := decimal.NewFromString(gasCost.AmountUSD); err == nil {
			gasFeeUSD = feeUSD
		}

		gasEstimate = &models.GasEstimate{
			GasLimit:  gasLimit,
			GasPrice:  gasPrice,
			GasFee:    gasFee,
			GasFeeUSD: gasFeeUSD,
		}
	}

	// Convert route steps and create Route struct
	routeSteps := c.convertRouteSteps(lifiResp)
	
	// Calculate total fee from fee costs
	totalFee := decimal.Zero
	if lifiResp.Estimate.FeeCosts != nil {
		for _, feeCost := range lifiResp.Estimate.FeeCosts {
			if feeAmount, err := decimal.NewFromString(feeCost.Amount); err == nil {
				totalFee = totalFee.Add(feeAmount)
			}
		}
	}
	
	route := &models.Route{
		Steps:       routeSteps,
		TotalFee:    totalFee,
		GasEstimate: gasEstimate,
	}

	// Convert tokens
	fromToken := &models.Token{
		Address:  lifiResp.Action.FromToken.Address,
		Symbol:   lifiResp.Action.FromToken.Symbol,
		Name:     lifiResp.Action.FromToken.Name,
		Decimals: lifiResp.Action.FromToken.Decimals,
		ChainID:  lifiResp.Action.FromToken.ChainId,
		LogoURI:  lifiResp.Action.FromToken.LogoURI,
	}

	toToken := &models.Token{
		Address:  lifiResp.Action.ToToken.Address,
		Symbol:   lifiResp.Action.ToToken.Symbol,
		Name:     lifiResp.Action.ToToken.Name,
		Decimals: lifiResp.Action.ToToken.Decimals,
		ChainID:  lifiResp.Action.ToToken.ChainId,
		LogoURI:  lifiResp.Action.ToToken.LogoURI,
	}

	quote := &models.Quote{
		ID:                lifiResp.Id,
		Provider:          "lifi",
		FromToken:         fromToken,
		ToToken:           toToken,
		FromAmount:        req.Amount,
		ToAmount:          toAmount,
		ToAmountMin:       toAmountMin,
		Price:             price,
		SlippageTolerance: req.SlippageTolerance,
		GasEstimate:       gasEstimate,
		Route:             route,
		CreatedAt:         time.Now(),
		ExpiresAt:         time.Now().Add(30 * time.Second), // LiFi quotes expire in 30s
		CallData:          c.getCallData(lifiResp),
		Value:             c.getValue(lifiResp),
		To:                c.getTo(lifiResp),
		Metadata: map[string]interface{}{
			"tool":               lifiResp.Tool,
			"toolDetails":        lifiResp.ToolDetails,
			"steps":              len(lifiResp.IncludedSteps),
			"executionDuration":  lifiResp.Estimate.ExecutionDuration,
			"fromAmountUSD":      lifiResp.Estimate.FromAmountUSD,
			"toAmountUSD":        lifiResp.Estimate.ToAmountUSD,
		},
	}

	return quote
}

// convertRouteSteps converts LiFi route steps to internal format
func (c *ConversionUtils) convertRouteSteps(lifiResp *lifi.LiFiQuoteResponse) []*models.RouteStep {
	if len(lifiResp.IncludedSteps) == 0 {
		// Create a single step for the main swap
		fromToken := &models.Token{
			Address:  lifiResp.Action.FromToken.Address,
			Symbol:   lifiResp.Action.FromToken.Symbol,
			Name:     lifiResp.Action.FromToken.Name,
			Decimals: lifiResp.Action.FromToken.Decimals,
			ChainID:  lifiResp.Action.FromToken.ChainId,
			LogoURI:  lifiResp.Action.FromToken.LogoURI,
		}

		toToken := &models.Token{
			Address:  lifiResp.Action.ToToken.Address,
			Symbol:   lifiResp.Action.ToToken.Symbol,
			Name:     lifiResp.Action.ToToken.Name,
			Decimals: lifiResp.Action.ToToken.Decimals,
			ChainID:  lifiResp.Action.ToToken.ChainId,
			LogoURI:  lifiResp.Action.ToToken.LogoURI,
		}

		fromAmount, _ := decimal.NewFromString(lifiResp.Estimate.FromAmount)
		toAmount, _ := decimal.NewFromString(lifiResp.Estimate.ToAmount)

		return []*models.RouteStep{
			{
				Type:        "swap",
				FromToken:   fromToken,
				ToToken:     toToken,
				FromAmount:  fromAmount,
				ToAmount:    toAmount,
				Protocol:    lifiResp.Tool,
				Fee:         decimal.Zero,
				PriceImpact: decimal.Zero,
			},
		}
	}

	// Convert actual steps
	steps := make([]*models.RouteStep, 0, len(lifiResp.IncludedSteps))
	for _, step := range lifiResp.IncludedSteps {
		routeStep := &models.RouteStep{
			Type:        "swap",
			Protocol:    step.Tool,
			Fee:         decimal.Zero,
			PriceImpact: decimal.Zero,
		}
		steps = append(steps, routeStep)
	}

	return steps
}

// getCallData extracts call data from transaction request
func (c *ConversionUtils) getCallData(lifiResp *lifi.LiFiQuoteResponse) string {
	if lifiResp.TransactionRequest != nil {
		return lifiResp.TransactionRequest.Data
	}
	return ""
}

// getValue extracts value from transaction request
func (c *ConversionUtils) getValue(lifiResp *lifi.LiFiQuoteResponse) string {
	if lifiResp.TransactionRequest != nil {
		return lifiResp.TransactionRequest.Value
	}
	return "0"
}

// getTo extracts to address from transaction request
func (c *ConversionUtils) getTo(lifiResp *lifi.LiFiQuoteResponse) string {
	if lifiResp.TransactionRequest != nil {
		return lifiResp.TransactionRequest.To
	}
	return ""
}

// ConvertLiFiToToken converts LiFi token to internal Token model
func (c *ConversionUtils) ConvertLiFiToToken(lifiToken lifi.LiFiToken) *models.Token {
	return &models.Token{
		Address:  lifiToken.Address,
		Symbol:   lifiToken.Symbol,
		Name:     lifiToken.Name,
		Decimals: lifiToken.Decimals,
		ChainID:  lifiToken.ChainId,
		LogoURI:  lifiToken.LogoURI,
		Tags:     []string{}, // LiFi doesn't provide tags
		Metadata: map[string]interface{}{
			"priceUSD":    lifiToken.PriceUSD,
		},
	}
}

// ConvertTokensListToInternalFormat converts LiFi tokens response to internal format
func (c *ConversionUtils) ConvertTokensListToInternalFormat(tokensResp *lifi.LiFiTokensResponse) []*models.Token {
	var tokens []*models.Token

	// Convert tokens from each chain
	for chainIDStr, chainTokens := range tokensResp.Tokens {
		chainID, err := strconv.Atoi(chainIDStr)
		if err != nil {
			logrus.WithFields(logrus.Fields{
				"chainId": chainIDStr,
				"error":   err,
			}).Warn("Failed to parse chain ID")
			continue
		}

		for _, lifiToken := range chainTokens {
			// Ensure chain ID is set
			if lifiToken.ChainId == 0 {
				lifiToken.ChainId = chainID
			}

			token := c.ConvertLiFiToToken(lifiToken)
			tokens = append(tokens, token)
		}
	}

	logrus.WithField("tokenCount", len(tokens)).Debug("Converted LiFi tokens to internal format")
	return tokens
}

// ParseAmountFromString safely parses amount string to decimal
func (c *ConversionUtils) ParseAmountFromString(amountStr string) (decimal.Decimal, error) {
	if amountStr == "" {
		return decimal.Zero, fmt.Errorf("empty amount string")
	}

	amount, err := decimal.NewFromString(amountStr)
	if err != nil {
		return decimal.Zero, fmt.Errorf("failed to parse amount '%s': %w", amountStr, err)
	}

	if amount.IsNegative() {
		return decimal.Zero, fmt.Errorf("negative amount not allowed: %s", amountStr)
	}

	return amount, nil
}

// FormatAmountForAPI formats decimal amount for LiFi API
func (c *ConversionUtils) FormatAmountForAPI(amount decimal.Decimal, decimals int) string {
	// Convert to base units (multiply by 10^decimals)
	multiplier := decimal.New(1, int32(decimals))
	baseAmount := amount.Mul(multiplier)
	
	// Return as integer string (no decimal places)
	return baseAmount.StringFixed(0)
}

