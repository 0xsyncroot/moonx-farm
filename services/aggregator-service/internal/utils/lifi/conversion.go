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
	logrus.WithFields(logrus.Fields{
		"lifiId":      lifiResp.Id,
		"tool":        lifiResp.Tool,
		"hasEstimate": lifiResp.Estimate.ToAmount != "",
	}).Debug("🔄 Converting LiFi response to Quote")

	// ✅ FIXED: Use direct amounts from estimate (already in wei format per API docs)
	toAmount, err := c.ParseAmountFromString(lifiResp.Estimate.ToAmount)
	if err != nil {
		logrus.WithFields(logrus.Fields{
			"toAmount": lifiResp.Estimate.ToAmount,
			"error":    err.Error(),
		}).Error("❌ Failed to parse toAmount from LiFi estimate")
		toAmount = decimal.Zero
	}

	toAmountMin, err := c.ParseAmountFromString(lifiResp.Estimate.ToAmountMin)
	if err != nil {
		logrus.WithFields(logrus.Fields{
			"toAmountMin": lifiResp.Estimate.ToAmountMin,
			"error":       err.Error(),
		}).Error("❌ Failed to parse toAmountMin from LiFi estimate")
		toAmountMin = decimal.Zero
	}

	// ✅ FIXED: Proper price calculation using wei amounts
	price := decimal.Zero
	if !req.Amount.IsZero() && !toAmount.IsZero() {
		price = toAmount.Div(req.Amount)
	}

	// ✅ IMPROVED: Calculate price impact from USD values if available
	priceImpact := decimal.Zero
	if lifiResp.Estimate.FromAmountUSD != "" && lifiResp.Estimate.ToAmountUSD != "" {
		if fromUSD, err1 := decimal.NewFromString(lifiResp.Estimate.FromAmountUSD); err1 == nil {
			if toUSD, err2 := decimal.NewFromString(lifiResp.Estimate.ToAmountUSD); err2 == nil && !fromUSD.IsZero() {
				// Price impact = (fromUSD - toUSD) / fromUSD * 100
				impactRatio := fromUSD.Sub(toUSD).Div(fromUSD)
				priceImpact = impactRatio.Mul(decimal.NewFromInt(100))
				logrus.WithFields(logrus.Fields{
					"fromAmountUSD": lifiResp.Estimate.FromAmountUSD,
					"toAmountUSD":   lifiResp.Estimate.ToAmountUSD,
					"priceImpact":   priceImpact.String(),
				}).Debug("📊 Calculated price impact from USD values")
			}
		}
	}

	// ✅ ENHANCED: Comprehensive gas estimation from all gas costs
	var gasEstimate *models.GasEstimate
	if len(lifiResp.Estimate.GasCosts) > 0 {
		// Sum all gas costs for total estimate
		totalGasFee := decimal.Zero
		totalGasFeeUSD := decimal.Zero
		var gasLimit uint64
		gasPrice := decimal.Zero

		for _, gasCost := range lifiResp.Estimate.GasCosts {
			// Parse gas limit (use highest)
			if limit, err := strconv.ParseUint(gasCost.Limit, 10, 64); err == nil && limit > gasLimit {
				gasLimit = limit
			}

			// Parse gas price (use latest)
			if price, err := decimal.NewFromString(gasCost.Price); err == nil {
				gasPrice = price
			}

			// Sum gas fees
			if fee, err := decimal.NewFromString(gasCost.Amount); err == nil {
				totalGasFee = totalGasFee.Add(fee)
			}

			// Sum gas fees USD
			if feeUSD, err := decimal.NewFromString(gasCost.AmountUSD); err == nil {
				totalGasFeeUSD = totalGasFeeUSD.Add(feeUSD)
			}
		}

		gasEstimate = &models.GasEstimate{
			GasLimit:  gasLimit,
			GasPrice:  gasPrice,
			GasFee:    totalGasFee,
			GasFeeUSD: totalGasFeeUSD,
		}

		logrus.WithFields(logrus.Fields{
			"gasLimit":     gasLimit,
			"gasPrice":     gasPrice.String(),
			"totalGasFee":  totalGasFee.String(),
			"totalGasUSD":  totalGasFeeUSD.String(),
			"gasCostCount": len(lifiResp.Estimate.GasCosts),
		}).Debug("⛽ Aggregated gas costs from LiFi response")
	}

	// ✅ ENHANCED: Convert route steps with proper step information
	routeSteps := c.convertRouteSteps(lifiResp)

	// ✅ ENHANCED: Calculate total fee from fee costs
	totalFee := decimal.Zero
	if lifiResp.Estimate.FeeCosts != nil {
		for _, feeCost := range lifiResp.Estimate.FeeCosts {
			if feeAmount, err := decimal.NewFromString(feeCost.Amount); err == nil {
				totalFee = totalFee.Add(feeAmount)
			}
		}
		logrus.WithFields(logrus.Fields{
			"totalFee":     totalFee.String(),
			"feeCostCount": len(lifiResp.Estimate.FeeCosts),
		}).Debug("💰 Calculated total fees from LiFi response")
	}

	route := &models.Route{
		Steps:       routeSteps,
		TotalFee:    totalFee,
		GasEstimate: gasEstimate,
	}

	// ✅ ENHANCED: Convert tokens with price information
	fromToken := &models.Token{
		Address:  lifiResp.Action.FromToken.Address,
		Symbol:   lifiResp.Action.FromToken.Symbol,
		Name:     lifiResp.Action.FromToken.Name,
		Decimals: lifiResp.Action.FromToken.Decimals,
		ChainID:  lifiResp.Action.FromToken.ChainId,
		LogoURI:  lifiResp.Action.FromToken.LogoURI,
	}

	// Add price USD if available
	if lifiResp.Action.FromToken.PriceUSD != "" {
		if priceUSD, err := decimal.NewFromString(lifiResp.Action.FromToken.PriceUSD); err == nil {
			fromToken.PriceUSD = priceUSD
		}
	}

	toToken := &models.Token{
		Address:  lifiResp.Action.ToToken.Address,
		Symbol:   lifiResp.Action.ToToken.Symbol,
		Name:     lifiResp.Action.ToToken.Name,
		Decimals: lifiResp.Action.ToToken.Decimals,
		ChainID:  lifiResp.Action.ToToken.ChainId,
		LogoURI:  lifiResp.Action.ToToken.LogoURI,
	}

	// Add price USD if available
	if lifiResp.Action.ToToken.PriceUSD != "" {
		if priceUSD, err := decimal.NewFromString(lifiResp.Action.ToToken.PriceUSD); err == nil {
			toToken.PriceUSD = priceUSD
		}
	}

	// ✅ ENHANCED: Create quote with comprehensive metadata
	quote := &models.Quote{
		ID:                lifiResp.Id,
		Provider:          "lifi",
		FromToken:         fromToken,
		ToToken:           toToken,
		FromAmount:        req.Amount,
		ToAmount:          toAmount,
		ToAmountMin:       toAmountMin,
		Price:             price,
		PriceImpact:       priceImpact,
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
			"priceImpactPercent": priceImpact.String(),
			"totalSteps":         len(routeSteps),
			"crossChain":         lifiResp.Action.FromChainId != lifiResp.Action.ToChainId,
			"slippage":           lifiResp.Action.Slippage,
		},
	}

	logrus.WithFields(logrus.Fields{
		"quoteId":     quote.ID,
		"fromSymbol":  fromToken.Symbol,
		"toSymbol":    toToken.Symbol,
		"toAmount":    toAmount.String(),
		"toAmountMin": toAmountMin.String(),
		"priceImpact": priceImpact.String(),
		"steps":       len(routeSteps),
		"crossChain":  quote.Metadata["crossChain"],
		"tool":        lifiResp.Tool,
	}).Info("✅ Successfully converted LiFi response to Quote")

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

		// Determine step type based on chain IDs
		stepType := "swap"
		if lifiResp.Action.FromChainId != lifiResp.Action.ToChainId {
			stepType = "bridge"
		}

		return []*models.RouteStep{
			{
				Type:        stepType,
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

	// ✅ ENHANCED: Convert actual detailed steps from API response
	steps := make([]*models.RouteStep, 0, len(lifiResp.IncludedSteps))

	logrus.WithFields(logrus.Fields{
		"totalSteps": len(lifiResp.IncludedSteps),
	}).Debug("🔄 Converting LiFi included steps")

	for i, step := range lifiResp.IncludedSteps {
		logrus.WithFields(logrus.Fields{
			"stepIndex":   i,
			"stepId":      step.Id,
			"stepType":    step.Type,
			"tool":        step.Tool,
			"fromChainId": step.Action.FromChainId,
			"toChainId":   step.Action.ToChainId,
			"fromToken":   step.Action.FromToken.Symbol,
			"toToken":     step.Action.ToToken.Symbol,
		}).Debug("🎯 Processing LiFi step")

		// Convert tokens for this step
		fromToken := &models.Token{
			Address:  step.Action.FromToken.Address,
			Symbol:   step.Action.FromToken.Symbol,
			Name:     step.Action.FromToken.Name,
			Decimals: step.Action.FromToken.Decimals,
			ChainID:  step.Action.FromToken.ChainId,
			LogoURI:  step.Action.FromToken.LogoURI,
		}

		toToken := &models.Token{
			Address:  step.Action.ToToken.Address,
			Symbol:   step.Action.ToToken.Symbol,
			Name:     step.Action.ToToken.Name,
			Decimals: step.Action.ToToken.Decimals,
			ChainID:  step.Action.ToToken.ChainId,
			LogoURI:  step.Action.ToToken.LogoURI,
		}

		// Add price USD if available
		if step.Action.FromToken.PriceUSD != "" {
			if priceUSD, err := decimal.NewFromString(step.Action.FromToken.PriceUSD); err == nil {
				fromToken.PriceUSD = priceUSD
			}
		}
		if step.Action.ToToken.PriceUSD != "" {
			if priceUSD, err := decimal.NewFromString(step.Action.ToToken.PriceUSD); err == nil {
				toToken.PriceUSD = priceUSD
			}
		}

		// Parse amounts (already in wei format from API)
		fromAmount, err1 := decimal.NewFromString(step.Estimate.FromAmount)
		if err1 != nil {
			logrus.WithFields(logrus.Fields{
				"stepIndex":  i,
				"fromAmount": step.Estimate.FromAmount,
				"error":      err1.Error(),
			}).Warn("⚠️ Failed to parse step fromAmount")
			fromAmount = decimal.Zero
		}

		toAmount, err2 := decimal.NewFromString(step.Estimate.ToAmount)
		if err2 != nil {
			logrus.WithFields(logrus.Fields{
				"stepIndex": i,
				"toAmount":  step.Estimate.ToAmount,
				"error":     err2.Error(),
			}).Warn("⚠️ Failed to parse step toAmount")
			toAmount = decimal.Zero
		}

		// Calculate step fee from fee costs
		stepFee := decimal.Zero
		if step.Estimate.FeeCosts != nil {
			for _, feeCost := range step.Estimate.FeeCosts {
				if feeAmount, err := decimal.NewFromString(feeCost.Amount); err == nil {
					stepFee = stepFee.Add(feeAmount)
				}
			}
		}

		// Calculate price impact for this step
		stepPriceImpact := decimal.Zero
		// For cross-chain steps, use slippage from action
		if step.Type == "cross" && step.Action.Slippage > 0 {
			stepPriceImpact = decimal.NewFromFloat(step.Action.Slippage * 100) // Convert to percentage
		}

		// Map step type from API response
		stepType := "swap"
		switch step.Type {
		case "swap":
			stepType = "swap"
		case "cross":
			stepType = "bridge"
		default:
			stepType = step.Type // Use as-is for unknown types
		}

		routeStep := &models.RouteStep{
			Type:        stepType,
			FromToken:   fromToken,
			ToToken:     toToken,
			FromAmount:  fromAmount,
			ToAmount:    toAmount,
			Protocol:    step.Tool,
			Fee:         stepFee,
			PriceImpact: stepPriceImpact,
		}

		steps = append(steps, routeStep)

		logrus.WithFields(logrus.Fields{
			"stepIndex":   i,
			"stepType":    stepType,
			"protocol":    step.Tool,
			"fromAmount":  fromAmount.String(),
			"toAmount":    toAmount.String(),
			"fee":         stepFee.String(),
			"priceImpact": stepPriceImpact.String(),
			"crossChain":  step.Action.FromChainId != step.Action.ToChainId,
		}).Debug("✅ Converted LiFi step")
	}

	logrus.WithFields(logrus.Fields{
		"convertedSteps": len(steps),
		"totalSteps":     len(lifiResp.IncludedSteps),
	}).Info("🎉 Successfully converted all LiFi route steps")

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
			"priceUSD": lifiToken.PriceUSD,
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
