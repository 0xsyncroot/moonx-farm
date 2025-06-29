#!/bin/bash

set -e

ls -la ~/go/bin/ && export PATH=$PATH:~/go/bin && echo "PATH updated"

swag init -g cmd/server/main.go -o docs/