package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"sync"
	"time"

	"github.com/moonx-farm/aggregator-service/internal/config"
	"github.com/moonx-farm/aggregator-service/internal/models"
	"github.com/sirupsen/logrus"
)

type OnchainService struct {
	httpClient   *http.Client
	cacheService *CacheService
	rpcEndpoints map[int]string // chainID -> RPC URL
	environment  string
}

type ERC20TokenInfo struct {
	Name     string
	Symbol   string
	Decimals uint8
	ChainID  int
	Address  string
}

type RPCRequest struct {
	JSONRPC string        `json:"jsonrpc"`
	Method  string        `json:"method"`
	Params  []interface{} `json:"params"`
	ID      int           `json:"id"`
}

type RPCResponse struct {
	JSONRPC string    `json:"jsonrpc"`
	Result  string    `json:"result"`
	Error   *RPCError `json:"error,omitempty"`
	ID      int       `json:"id"`
}

type RPCError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

func NewOnchainService(cacheService *CacheService, environment string) *OnchainService {
	// RPC endpoints for major chains
	rpcEndpoints := map[int]string{
		1:     "https://eth.llamarpc.com",
		56:    "https://bsc-dataseed.binance.org",
		137:   "https://polygon-rpc.com",
		8453:  "https://mainnet.base.org",
		42161: "https://arb1.arbitrum.io/rpc",
		10:    "https://mainnet.optimism.io",
	}

	return &OnchainService{
		httpClient: &http.Client{
			Timeout: 3 * time.Second,
		},
		cacheService: cacheService,
		rpcEndpoints: rpcEndpoints,
		environment:  environment,
	}
}

// GetTokenInfoByAddress gets token info by address across all chains concurrently
func (s *OnchainService) GetTokenInfoByAddress(ctx context.Context, tokenAddress string) (*models.Token, error) {
	// Check cache first
	cacheKey := fmt.Sprintf("onchain:token:%s", tokenAddress)
	var cached *models.Token
	if err := s.cacheService.Get(ctx, cacheKey, &cached); err == nil && cached != nil {
		return cached, nil
	}

	// Get active chains from config
	activeChains := config.GetActiveChains(s.environment)

	type chainResult struct {
		token   *models.Token
		chainID int
		error   error
	}

	results := make(chan chainResult, len(activeChains))
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()

	var wg sync.WaitGroup

	// Launch concurrent calls to each chain
	for chainID := range activeChains {
		if rpcURL, exists := s.rpcEndpoints[chainID]; exists {
			wg.Add(1)
			go func(cID int, rpcURL string) {
				defer wg.Done()
				defer func() {
					if r := recover(); r != nil {
						results <- chainResult{nil, cID, fmt.Errorf("panic: %v", r)}
					}
				}()

				tokenInfo, err := s.getTokenInfoFromChain(ctx, tokenAddress, cID, rpcURL)
				if err != nil {
					results <- chainResult{nil, cID, err}
					return
				}

				if tokenInfo != nil {
					token := &models.Token{
						Address:  tokenAddress,
						Symbol:   tokenInfo.Symbol,
						Name:     tokenInfo.Name,
						ChainID:  tokenInfo.ChainID,
						Decimals: int(tokenInfo.Decimals),
						Source:   "onchain",
						Verified: true,
						Metadata: map[string]interface{}{
							"detectedChain": cID,
							"rpcSource":     rpcURL,
						},
					}
					results <- chainResult{token, cID, nil}
				} else {
					results <- chainResult{nil, cID, fmt.Errorf("token not found")}
				}
			}(chainID, rpcURL)
		}
	}

	// Close results channel when all goroutines finish
	go func() {
		wg.Wait()
		close(results)
	}()

	// Collect results - return on first success
	for result := range results {
		if result.error == nil && result.token != nil {
			logrus.WithFields(logrus.Fields{
				"address": tokenAddress,
				"chainID": result.chainID,
				"symbol":  result.token.Symbol,
				"name":    result.token.Name,
			}).Info("Token found onchain")

			// Cache for 10 minutes
			s.cacheService.Set(ctx, cacheKey, result.token, 10*time.Minute)

			return result.token, nil
		}
	}

	return nil, fmt.Errorf("token not found on any supported chain")
}

// getTokenInfoFromChain gets token info from a specific chain
func (s *OnchainService) getTokenInfoFromChain(ctx context.Context, tokenAddress string, chainID int, rpcURL string) (*ERC20TokenInfo, error) {
	// Prepare RPC calls for name, symbol, decimals
	calls := []struct {
		method string
		data   string
	}{
		{"name", "0x06fdde03"},     // name()
		{"symbol", "0x95d89b41"},   // symbol()
		{"decimals", "0x313ce567"}, // decimals()
	}

	results := make(map[string]string)

	for _, call := range calls {
		result, err := s.callContract(ctx, rpcURL, tokenAddress, call.data)
		if err != nil {
			logrus.WithError(err).WithFields(logrus.Fields{
				"chainID": chainID,
				"method":  call.method,
				"address": tokenAddress,
			}).Debug("Contract call failed")
			return nil, err
		}
		results[call.method] = result
	}

	// Decode results
	name := s.decodeString(results["name"])
	symbol := s.decodeString(results["symbol"])
	decimals := s.decodeUint8(results["decimals"])

	if name == "" || symbol == "" {
		return nil, fmt.Errorf("invalid token data")
	}

	return &ERC20TokenInfo{
		Name:     name,
		Symbol:   symbol,
		Decimals: decimals,
		ChainID:  chainID,
		Address:  tokenAddress,
	}, nil
}

// callContract makes an eth_call to a contract
func (s *OnchainService) callContract(ctx context.Context, rpcURL, contractAddress, data string) (string, error) {
	reqBody := RPCRequest{
		JSONRPC: "2.0",
		Method:  "eth_call",
		Params: []interface{}{
			map[string]string{
				"to":   contractAddress,
				"data": data,
			},
			"latest",
		},
		ID: 1,
	}

	reqBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal RPC request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", rpcURL, bytes.NewBuffer(reqBytes))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to make RPC call: %w", err)
	}
	defer resp.Body.Close()

	var rpcResp RPCResponse
	if err := json.NewDecoder(resp.Body).Decode(&rpcResp); err != nil {
		return "", fmt.Errorf("failed to decode RPC response: %w", err)
	}

	if rpcResp.Error != nil {
		return "", fmt.Errorf("RPC error: %s", rpcResp.Error.Message)
	}

	return rpcResp.Result, nil
}

// decodeString decodes hex string result to UTF-8 string
func (s *OnchainService) decodeString(hexResult string) string {
	if len(hexResult) < 2 || hexResult[:2] != "0x" {
		return ""
	}

	// Remove 0x prefix and decode hex
	hexResult = hexResult[2:]
	if len(hexResult) < 128 { // Minimum for string response
		return ""
	}

	// Skip offset and length, get actual string data
	// String data starts at position 128 (64 bytes for offset + 64 bytes for length)
	if len(hexResult) <= 128 {
		return ""
	}

	stringData := hexResult[128:]

	// Convert hex to bytes
	result := ""
	for i := 0; i < len(stringData); i += 2 {
		if i+1 >= len(stringData) {
			break
		}
		hex := stringData[i : i+2]
		if hex == "00" {
			break
		}
		// Simple hex to ASCII conversion
		var b byte
		fmt.Sscanf(hex, "%02x", &b)
		if b >= 32 && b <= 126 { // Printable ASCII
			result += string(b)
		}
	}

	return result
}

// decodeUint8 decodes hex result to uint8
func (s *OnchainService) decodeUint8(hexResult string) uint8 {
	if len(hexResult) < 2 || hexResult[:2] != "0x" {
		return 18 // Default to 18 decimals
	}

	// Parse as big int then convert to uint8
	value := new(big.Int)
	value.SetString(hexResult[2:], 16)

	if value.IsUint64() {
		decimals := value.Uint64()
		if decimals <= 255 {
			return uint8(decimals)
		}
	}

	return 18 // Default to 18 decimals
}
