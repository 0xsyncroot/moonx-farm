# Build stage
FROM golang:1.23-alpine AS builder

# Set working directory
WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the binary
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -a -installsuffix cgo -ldflags="-w -s" -o server ./cmd/server

# Runtime stage - minimal distroless image
FROM gcr.io/distroless/static-debian11

# Copy the binary from builder
COPY --from=builder /app/server /server

# Expose port
EXPOSE 3003

# Run the binary
CMD ["/server"] 