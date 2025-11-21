#!/bin/bash

# HR Interview Agent - Client-Server Startup Script
# This script starts the FastAPI server and opens the web client

# --- Configuration ---
set -e # Exit immediately if a command exits with a non-zero status.
set -o pipefail # The return value of a pipeline is the status of the last command to exit with a non-zero status.

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Ports and Paths
SERVER_PORT=8001
HTTPS_API_PORT=8002
CLIENT_HTTP_PORT=5173
CLIENT_HTTPS_PORT=8443
SERVER_BIND_HOST="0.0.0.0"
OLLAMA_PORT=11434
OLLAMA_URL="http://127.0.0.1:$OLLAMA_PORT"
OLLAMA_BINARY="ollama"

# Dynamically determine project paths
CLIENT_SERVER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$CLIENT_SERVER_DIR")"
# The script runs inside the hr_agent folder, so point server and client directly
SERVER_DIR="$CLIENT_SERVER_DIR/server"
CLIENT_DIR="$CLIENT_SERVER_DIR/frontend"
CERT_PATH="$CLIENT_SERVER_DIR/cert.pem"
KEY_PATH="$CLIENT_SERVER_DIR/key.pem"

# PID management
PIDS=()

# --- Functions ---

# Gracefully clean up all background processes on exit
cleanup_on_exit() {
    echo -e "\n${YELLOW}Shutting down servers...${NC}"
    for pid in "${PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            echo "   Stopping process with PID $pid..."
            kill "$pid" 2>/dev/null || kill -9 "$pid" 2>/dev/null
        fi
    done
    echo -e "${GREEN}Shutdown complete.${NC}"
    exit 0
}
trap cleanup_on_exit SIGINT SIGTERM

# Get the primary local network IP address
get_local_ip() {
    # macOS
    if command -v ipconfig &> /dev/null; then
        ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "127.0.0.1"
    # Linux
    elif command -v hostname &> /dev/null; then
        hostname -I 2>/dev/null | awk '{print $1}' || echo "127.0.0.1"
    else
        echo "127.0.0.1"
    fi
}

# Check if a port is in use
is_port_in_use() {
    lsof -Pi :"$1" -sTCP:LISTEN -t >/dev/null 2>&1
}

# Stop any processes currently using the required ports
stop_existing_processes() {
    echo -e "${YELLOW}Checking for and stopping existing processes...${NC}"
    local ports=("$SERVER_PORT" "$HTTPS_API_PORT" "$CLIENT_HTTP_PORT" "$CLIENT_HTTPS_PORT")
    for port in "${ports[@]}"; do
        if is_port_in_use "$port"; then
            echo "   Stopping service on port $port..."
            lsof -ti:"$port" | xargs kill -9 2>/dev/null || true
            sleep 1
        fi
    done

    # Also stop Ollama if we started it
    if [ -n "$OLLAMA_PID" ] && kill -0 "$OLLAMA_PID" 2>/dev/null; then
        echo "   Stopping Ollama with PID $OLLAMA_PID..."
        kill "$OLLAMA_PID" 2>/dev/null || kill -9 "$OLLAMA_PID" 2>/dev/null
        sleep 1
    fi
}

# Generate a self-signed certificate if needed
ensure_certificate() {
    local local_ip
    local_ip=$(get_local_ip)

    if ! command -v openssl &>/dev/null; then
        echo -e "${YELLOW}OpenSSL not found. Skipping HTTPS servers.${NC}"
        return 1
    fi

    # Always regenerate if cert doesn't exist
    if [ ! -f "$CERT_PATH" ]; then
        echo -e "${BLUE}No certificate found. Generating new one...${NC}"
    # Regenerate weekly to catch IP changes
    elif [ $(find "$CERT_PATH" -mtime +7 2>/dev/null | wc -l) -gt 0 ]; then
        echo -e "${YELLOW}Certificate is over 7 days old. Regenerating...${NC}"
    else
        echo -e "${GREEN}Using existing certificate.${NC}"
        return 0
    fi

    echo -e "${BLUE}Generating self-signed certificate for SANs: localhost, 127.0.0.1, $local_ip, *.local...${NC}"
    
    # Use a temporary directory for config and key generation
    local tmp_dir
    tmp_dir=$(mktemp -d)

    # Build a more comprehensive SAN list
    local san_config="[alt_names]
DNS.1 = localhost
DNS.2 = *.local
DNS.3 = $(hostname 2>/dev/null || echo localhost)
IP.1 = 127.0.0.1"
    
    if [[ "$local_ip" != "127.0.0.1" ]]; then
        san_config+="
IP.2 = $local_ip"
    fi
    
    # Create OpenSSL config on the fly
    cat > "$tmp_dir/cert.conf" << EOF
[req]
distinguished_name = dn
prompt = no
req_extensions = v3_req

[dn]
CN = localhost
O = HR Interview Agent (Development)
C = US

[v3_req]
subjectAltName = @alt_names
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth

$san_config
EOF

    local openssl_log="$tmp_dir/openssl.log"
    if ! openssl req -x509 -newkey rsa:2048 -sha256 -days 365 -nodes \
        -keyout "$KEY_PATH" -out "$CERT_PATH" \
        -config "$tmp_dir/cert.conf" >"$openssl_log" 2>&1; then
        echo -e "${RED}Failed to generate certificate.${NC}"
        echo -e "${YELLOW}   OpenSSL output:${NC}"
        sed 's/^/      /' "$openssl_log"
        rm -rf "$tmp_dir"
        return 1
    fi

    rm -rf "$tmp_dir"
    chmod 600 "$KEY_PATH"
    echo -e "${GREEN}Certificate created successfully.${NC}"
}

# Start Ollama if not already running
start_ollama() {
    # If Ollama is already receiving requests, do nothing
    if lsof -i :$OLLAMA_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "Ollama appears to be already running on port $OLLAMA_PORT"
        return 0
    fi

    if ! command -v "$OLLAMA_BINARY" >/dev/null 2>&1; then
        echo -e "${YELLOW}ollama binary not found, skipping Ollama startup. If you want local LLMs, install Ollama.${NC}"
        return 1
    fi

    echo -e "${BLUE}Starting Ollama local LLM service...${NC}"
    # Start Ollama in background; keep logs for debugging
    "$OLLAMA_BINARY" serve >/tmp/ollama.log 2>&1 &
    OLLAMA_PID=$!
    PIDS+=("$OLLAMA_PID")

    # Wait for Ollama to be responsive
    wait_for_service "$OLLAMA_URL/api/version" "Ollama daemon" || {
        echo -e "${RED}Ollama failed to start within timeout.${NC}"
        return 2
    }

    # Check if models are available, load default if not
    if ! curl -s "$OLLAMA_URL/api/tags" | grep -q '"name"'; then
        echo -e "${YELLOW}No models loaded in Ollama. Loading default model (gemma3:27b)...${NC}"
        "$OLLAMA_BINARY" pull gemma3:27b >/dev/null 2>&1 &
        # Don't wait for pull, as it may take time; server will retry
    fi

    echo -e "${GREEN}Ollama started (PID $OLLAMA_PID).${NC}"
    return 0
}

# Check and install Python dependencies
check_dependencies() {
    echo -e "${BLUE}Checking dependencies...${NC}"
    if ! command -v python3 &> /dev/null; then
        echo -e "${RED}Python 3 is required but not installed.${NC}"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}npm is required but not installed. Please install Node.js.${NC}"
        exit 1
    fi
    
    # Always activate the main venv from the current directory
    if [ -f "$CLIENT_SERVER_DIR/venv/bin/activate" ]; then
        source "$CLIENT_SERVER_DIR/venv/bin/activate"
    else
        echo -e "${RED}Python venv not found at $CLIENT_SERVER_DIR/venv. Please create it and install dependencies.${NC}"
        exit 1
    fi
        
    if ! python3 -c "import fastapi, uvicorn" &>/dev/null; then
        echo -e "${YELLOW}Required Python packages not found. Installing...${NC}"
        if [ -f "$SERVER_DIR/requirements.txt" ]; then
            python3 -m pip install -r "$SERVER_DIR/requirements.txt"
        else
            echo -e "${RED}Server requirements.txt not found.${NC}"
            exit 1
        fi
    fi
    
    # Check Node.js dependencies
    if [ ! -d "$CLIENT_DIR/node_modules" ]; then
        echo -e "${YELLOW}Installing Node.js dependencies...${NC}"
        (cd "$CLIENT_DIR" && npm install)
    fi
    
    echo -e "${GREEN}Dependencies are satisfied.${NC}"
}

# Wait for a service to become available
wait_for_service() {
    local url=$1
    local service_name=$2
    local curl_opts=$3
    echo "   Waiting for $service_name to be ready..."
    for i in {1..30}; do
        if curl --fail --silent --show-error $curl_opts "$url" >/dev/null 2>&1; then
            echo -e "${GREEN}$service_name is ready!${NC}"
            return 0
        fi
        sleep 1
    done
    echo -e "${RED}$service_name failed to start after 30 seconds.${NC}"
    return 1
}

# Start all servers
start_servers() {
    echo -e "${BLUE}Starting all services...${NC}"
    
    # Ensure both the hr_agent folder and its parent (workspace root) are on PYTHONPATH
    export PYTHONPATH="$CLIENT_SERVER_DIR:$PROJECT_ROOT:$PYTHONPATH"
    
    # 0. Start local Ollama if available so the LLM endpoints respond
    start_ollama || true

    # 1. Start HTTP API Server
    echo "Starting HTTP API Server..."
    # Run from project root so package imports and relative imports resolve properly
    cd "$PROJECT_ROOT"
    uvicorn_cmd="python3 -m uvicorn"
    $uvicorn_cmd server.main:app --host "$SERVER_BIND_HOST" --port "$SERVER_PORT" >/tmp/hr_agent_api_http.log 2>&1 &
    PIDS+=($!)
    wait_for_service "http://127.0.0.1:$SERVER_PORT/health" "HTTP API Server" || cleanup_on_exit

    # 2. Start Vite Dev Client Server
    echo "Starting Vite Dev Client Server..."
    (cd "$CLIENT_DIR" && npm run dev -- --host "$SERVER_BIND_HOST" --port "$CLIENT_HTTP_PORT" >/tmp/hr_agent_client_ui.log 2>&1) &
    PIDS+=($!)
    # Vite serves from root
    wait_for_service "https://127.0.0.1:$CLIENT_HTTP_PORT" "Vite Dev Server" "-k" || cleanup_on_exit

    # 3. Start HTTPS API Server (if certificate is available)
    if ensure_certificate; then
        echo "Starting HTTPS API Server..."
        # Run from project root so package imports and relative imports resolve properly
        cd "$PROJECT_ROOT"
        $uvicorn_cmd server.main:app --host "$SERVER_BIND_HOST" --port "$HTTPS_API_PORT" --ssl-keyfile "$KEY_PATH" --ssl-certfile "$CERT_PATH" >/tmp/hr_agent_api_https.log 2>&1 &
        PIDS+=($!)
        wait_for_service "https://127.0.0.1:$HTTPS_API_PORT/health" "HTTPS API Server" "-k" || cleanup_on_exit
        
        # Note: HTTPS client not started as Vite dev server does not support HTTPS by default
        # To enable HTTPS for client, configure Vite with SSL certificates in vite.config.js
    fi
}

# Display final information and URLs
show_info() {
    local local_ip
    local_ip=$(get_local_ip)
    local client_path="/"
    echo
    echo "=================================================="
    echo -e "${GREEN}All services are running!${NC}"
    echo "=================================================="
    echo
    echo -e "${BLUE}Web Client URLs:${NC}"
    echo "   - Local:    https://127.0.0.1:$CLIENT_HTTP_PORT$client_path"
    if [[ "$local_ip" != "127.0.0.1" ]]; then
        echo "   - Network:  https://$local_ip:$CLIENT_HTTP_PORT$client_path"
    fi
    
    echo
    echo -e "${BLUE}API Server URLs:${NC}"
    echo "   - Docs:     http://127.0.0.1:$SERVER_PORT/docs"
    if is_port_in_use "$HTTPS_API_PORT"; then
        echo "   - Docs TLS: https://127.0.0.1:$HTTPS_API_PORT/docs"
    fi
    echo
    echo -e "${YELLOW}For Network HTTPS Access:${NC}"
    echo "   1. First visit: https://$local_ip:$CLIENT_HTTP_PORT$client_path"
    echo "   2. Accept the security warning (self-signed cert)"
    echo "   3. Then you can use the application with microphone access."
    echo
    echo -e "${YELLOW}Troubleshooting:${NC}"
    echo "   - Check firewall allows ports $SERVER_PORT, $HTTPS_API_PORT, $CLIENT_HTTP_PORT"
    echo "   - Server logs: /tmp/hr_agent_*.log"
    echo
}

# Open the web client in the default browser
open_in_browser() {
    local url=$1
    echo -e "${BLUE}Opening '$url' in your browser...${NC}"
    case "$(uname -s)" in
        Linux*)  xdg-open "$url" 2>/dev/null ;;
        Darwin*) open "$url" ;;
        CYGWIN*|MINGW*|MSYS*) start "$url" ;;
        *)       echo -e "${YELLOW}Could not detect OS to open browser. Please open the URL manually.${NC}" ;;
    esac
}

# --- Main Execution Logic ---
main() {
    # Handle simple commands first
    case "${1:-}" in
        stop|clean)
            stop_existing_processes
            exit 0
            ;;
        help|-h|--help)
            echo "Usage: $0 [start|stop|help]"
            echo "  - start (default): Checks dependencies, cleans old processes, and starts all services."
            echo "  - stop / clean:    Finds and stops all running services started by this script."
            echo "  - help:            Shows this help message."
            exit 0
            ;;
    esac
    
    stop_existing_processes
    check_dependencies
    start_servers
    show_info
    
    # Prompt user to open browser
    read -p "Open web client in browser? (y/N): " -n 1 -r REPLY
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        local url_to_open="http://127.0.0.1:$CLIENT_HTTP_PORT/"
        # Check if cert exists to determine if we should use HTTPS on the standard port
        if [ -f "$CERT_PATH" ]; then
            url_to_open="https://127.0.0.1:$CLIENT_HTTP_PORT/"
        elif is_port_in_use "$CLIENT_HTTPS_PORT"; then
            url_to_open="https://127.0.0.1:$CLIENT_HTTPS_PORT/"
        fi
        open_in_browser "$url_to_open"
    fi
    
    echo -e "${GREEN}Servers are running in the background. Press Ctrl+C to stop everything.${NC}"
    wait
}

# Run the main function with all provided script arguments
main "$@"