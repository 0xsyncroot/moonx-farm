package lifi

// QuoteValidation represents validation results
type QuoteValidation struct {
	IsValid bool     `json:"is_valid"`
	Score   float64  `json:"score"`
	Issues  []string `json:"issues"`
}

// ErrorCategory represents categorized API errors
type ErrorCategory struct {
	Category         string `json:"category"`
	IsRetryable      bool   `json:"is_retryable"`
	FallbackStrategy string `json:"fallback_strategy,omitempty"`
	Message          string `json:"message"`
} 