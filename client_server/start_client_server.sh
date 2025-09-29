#!/bin/bash

# HR Interview Agent - Client-Server Startup Script
# This script starts the FastAPI server and opens the web client

set -e  # Exit on any error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
SERVER_PORT=8001
SERVER_BIND_HOST="0.0.0.0"
LOCAL_HEALTH_HOST="127.0.0.1"
PUBLIC_HOST=""
CLIENT_HTTP_PORT=8080
CLIENT_HTTPS_PORT=8443
CLIENT_HTTP_PID=""
CLIENT_HTTPS_PID=""
HTTPS_API_PID=""
CLIENT_WEB_PATH="/client_server/client/index.html"
CLIENT_HTTPS_WEB_PATH="/client_server/client/index.html"
HTTPS_API_PORT=8002

get_local_ip() {
    if command -v ipconfig &> /dev/null; then
        ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null
    elif command -v hostname &> /dev/null; then
        hostname -I 2>/dev/null | awk '{print $1}'
    fi
}

detect_public_host() {
    if [ -n "$PUBLIC_HOST" ]; then
        return
    fi

    local ip_candidate
    ip_candidate=$(get_local_ip)

    if [ -n "$ip_candidate" ]; then
        PUBLIC_HOST="$ip_candidate"
    else
        PUBLIC_HOST="$LOCAL_HEALTH_HOST"
    fi
}

CLIENT_SERVER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$CLIENT_SERVER_DIR")"
SERVER_DIR="$CLIENT_SERVER_DIR/server"
CLIENT_DIR="$CLIENT_SERVER_DIR/client"
CERT_PATH="$CLIENT_SERVER_DIR/cert.pem"
KEY_PATH="$CLIENT_SERVER_DIR/key.pem"

echo -e "${BLUE}🚀 HR Interview Agent - Client-Server Setup${NC}"
echo "=================================================="

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Function to stop existing processes
cleanup() {
    echo -e "${YELLOW}🧹 Cleaning up existing processes...${NC}"
    
    # Kill processes on server port
    if check_port $SERVER_PORT; then
        echo "Stopping existing server on port $SERVER_PORT..."
        lsof -ti:$SERVER_PORT | xargs kill -9 2>/dev/null || true
        sleep 2
    fi

    if check_port $CLIENT_HTTP_PORT; then
        echo "Stopping existing client web server on port $CLIENT_HTTP_PORT..."
        lsof -ti:$CLIENT_HTTP_PORT | xargs kill -9 2>/dev/null || true
        sleep 1
    fi

    if check_port $CLIENT_HTTPS_PORT; then
        echo "Stopping existing HTTPS web server on port $CLIENT_HTTPS_PORT..."
        lsof -ti:$CLIENT_HTTPS_PORT | xargs kill -9 2>/dev/null || true
        sleep 1
    fi

    if check_port $HTTPS_API_PORT; then
        echo "Stopping existing HTTPS API server on port $HTTPS_API_PORT..."
        lsof -ti:$HTTPS_API_PORT | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
    
    echo "Cleanup complete."
}

ensure_certificate() {
    if [ -f "$CERT_PATH" ] && [ -f "$KEY_PATH" ]; then
        return 0
    fi

    detect_public_host
    local subject_cn
    subject_cn=${PUBLIC_HOST:-127.0.0.1}

    local openssl_bin
    openssl_bin=$(command -v openssl || true)
    if [ -z "$openssl_bin" ]; then
        echo -e "${YELLOW}⚠️  TLS certificate not found and OpenSSL missing. HTTPS client will be skipped.${NC}"
        return 1
    fi

    echo -e "${BLUE}🔐 Generating self-signed certificate for $subject_cn...${NC}"
    local openssl_log="/tmp/hr_agent_cert_gen.log"
    local tmp_dir
    tmp_dir=$(mktemp -d 2>/dev/null || mktemp -d -t hr_agent_cert)

    if ! "$openssl_bin" req -x509 -newkey rsa:2048 -nodes -days 365 \
        -keyout "$tmp_dir/key.pem" -out "$tmp_dir/cert.pem" \
        -subj "/CN=$subject_cn" >"$openssl_log" 2>&1; then
        echo -e "${YELLOW}⚠️  Failed to generate certificate. HTTPS client will be skipped.${NC}"
        if [ -s "$openssl_log" ]; then
            echo -e "${YELLOW}   ↳ OpenSSL output:${NC}"
            sed 's/^/      /' "$openssl_log"
        fi
        rm -rf "$tmp_dir"
        return 1
    fi

    # Copy files to the correct location
    if ! cp "$tmp_dir/key.pem" "$KEY_PATH" 2>/dev/null; then
        echo -e "${YELLOW}⚠️  Unable to write key to $KEY_PATH. HTTPS client will be skipped.${NC}"
        rm -rf "$tmp_dir"
        return 1
    fi

    if ! cp "$tmp_dir/cert.pem" "$CERT_PATH" 2>/dev/null; then
        echo -e "${YELLOW}⚠️  Unable to write certificate to $CERT_PATH. HTTPS client will be skipped.${NC}"
        rm -rf "$tmp_dir"
        return 1
    fi

    rm -rf "$tmp_dir"
    chmod 600 "$KEY_PATH" 2>/dev/null || true
    chmod 644 "$CERT_PATH" 2>/dev/null || true

    echo -e "${GREEN}✅ Created self-signed certificate at $CERT_PATH${NC}"
    return 0
}

# Function to check dependencies
check_dependencies() {
    echo -e "${BLUE}🔍 Checking dependencies...${NC}"
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        echo -e "${RED}❌ Python 3 is required but not installed${NC}"
        exit 1
    fi
    
    # Check if in virtual environment or if packages are available
    if ! python3 -c "import fastapi" 2>/dev/null; then
        echo -e "${YELLOW}⚠️  FastAPI not found. Installing server dependencies...${NC}"
        
        # Try to activate virtual environment if it exists
        if [ -f "$PROJECT_ROOT/venv/bin/activate" ]; then
            echo "Activating virtual environment..."
            source "$PROJECT_ROOT/venv/bin/activate"
        elif [ -f "$PROJECT_ROOT/.venv/bin/activate" ]; then
            echo "Activating virtual environment..."
            source "$PROJECT_ROOT/.venv/bin/activate"
        fi
        
        # Install dependencies
        if [ -f "$SERVER_DIR/requirements.txt" ]; then
            pip install -r "$SERVER_DIR/requirements.txt"
        else
            echo -e "${RED}❌ Server requirements.txt not found${NC}"
            exit 1
        fi
    fi
    
    echo -e "${GREEN}✅ Dependencies check complete${NC}"
}

# Function to start the server
start_server() {
    echo -e "${BLUE}🖥️  Starting FastAPI server...${NC}"
    
    # Activate virtual environment if available
    if [ -f "$PROJECT_ROOT/venv/bin/activate" ]; then
        source "$PROJECT_ROOT/venv/bin/activate"
    elif [ -f "$PROJECT_ROOT/.venv/bin/activate" ]; then
        source "$PROJECT_ROOT/.venv/bin/activate"
    fi
    
    # Add project root to Python path so server can import hr_agent modules
    export PYTHONPATH="$PROJECT_ROOT:$PYTHONPATH"
    
    cd "$SERVER_DIR"
    
    # Start server in background
    python3 main.py &
    SERVER_PID=$!
    
    echo -e "${GREEN}✅ Server started with PID $SERVER_PID${NC}"
    
    # Wait for server to be ready
    echo "Waiting for server to start..."
    for i in {1..30}; do
        if curl -s "http://$LOCAL_HEALTH_HOST:$SERVER_PORT/health" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Server is ready!${NC}"
            break
        fi
        if [ $i -eq 30 ]; then
            echo -e "${RED}❌ Server failed to start within 30 seconds${NC}"
            kill $SERVER_PID 2>/dev/null || true
            exit 1
        fi
        sleep 1
    done
}

start_https_api_server() {
    if ! ensure_certificate; then
        echo -e "${YELLOW}⚠️  No certificate available. Skipping HTTPS API server.${NC}"
        return
    fi

    echo -e "${BLUE}🔒 Starting HTTPS FastAPI server on port $HTTPS_API_PORT...${NC}"
    
    # Activate virtual environment if available
    if [ -f "$PROJECT_ROOT/venv/bin/activate" ]; then
        source "$PROJECT_ROOT/venv/bin/activate"
    elif [ -f "$PROJECT_ROOT/.venv/bin/activate" ]; then
        source "$PROJECT_ROOT/.venv/bin/activate"
    fi
    
    export PYTHONPATH="$PROJECT_ROOT:$PYTHONPATH"
    cd "$SERVER_DIR"
    
    # Start HTTPS server in background
    uvicorn main:app --host 0.0.0.0 --port $HTTPS_API_PORT --ssl-keyfile "$KEY_PATH" --ssl-certfile "$CERT_PATH" >/tmp/hr_agent_api_https.log 2>&1 &
    HTTPS_API_PID=$!
    
    echo -e "${GREEN}✅ HTTPS API server started with PID $HTTPS_API_PID${NC}"
    
    # Wait for HTTPS server to be ready
    for i in {1..30}; do
        if curl -k -s "https://$LOCAL_HEALTH_HOST:$HTTPS_API_PORT/health" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ HTTPS API server is ready!${NC}"
            return
        fi
        sleep 1
    done
    
    echo -e "${YELLOW}⚠️  HTTPS API server may still be starting. Check /tmp/hr_agent_api_https.log if needed.${NC}"
}

start_client_static_server() {
    echo -e "${BLUE}🌍 Starting static web client server on port $CLIENT_HTTP_PORT...${NC}"
    python3 -m http.server $CLIENT_HTTP_PORT --bind 0.0.0.0 --directory "$PROJECT_ROOT" >/tmp/hr_agent_client_ui.log 2>&1 &
    CLIENT_HTTP_PID=$!

    for i in {1..15}; do
        if curl -s "http://$LOCAL_HEALTH_HOST:$CLIENT_HTTP_PORT$CLIENT_WEB_PATH" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Client web server is ready!${NC}"
            return
        fi
        sleep 1
    done

    echo -e "${YELLOW}⚠️  Client web server may still be starting. Check /tmp/hr_agent_client_ui.log if needed.${NC}"
}

start_client_https_server() {
    if [ ! -f "$CLIENT_SERVER_DIR/serve_https.py" ]; then
        echo -e "${YELLOW}⚠️  HTTPS helper script not found. Skipping HTTPS server.${NC}"
        return
    fi

    if ! ensure_certificate; then
        return
    fi

    echo -e "${BLUE}🔒 Starting HTTPS web client server on port $CLIENT_HTTPS_PORT...${NC}"
    python3 "$CLIENT_SERVER_DIR/serve_https.py" \
        --host 0.0.0.0 \
        --port $CLIENT_HTTPS_PORT \
        --directory "$PROJECT_ROOT" \
        --cert "$CERT_PATH" \
        --key "$KEY_PATH" \
        >/tmp/hr_agent_client_ui_https.log 2>&1 &
    CLIENT_HTTPS_PID=$!

    for i in {1..20}; do
        if curl -k -s "https://$LOCAL_HEALTH_HOST:$CLIENT_HTTPS_PORT$CLIENT_HTTPS_WEB_PATH" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ HTTPS client web server is ready!${NC}"
            return
        fi
        sleep 1
    done

    echo -e "${YELLOW}⚠️  HTTPS web server may still be starting. Check /tmp/hr_agent_client_ui_https.log if needed.${NC}"
}

# Function to display URLs and information
show_info() {
    detect_public_host
    echo ""
    echo "=================================================="
    echo -e "${GREEN}🎉 HR Interview Agent Client-Server Started!${NC}"
    echo "=================================================="
    echo ""
    echo -e "${BLUE}📱 Web Client:${NC}"
    echo "   Local:    http://$LOCAL_HEALTH_HOST:$CLIENT_HTTP_PORT$CLIENT_WEB_PATH"
    echo "   Network:  http://$PUBLIC_HOST:$CLIENT_HTTP_PORT$CLIENT_WEB_PATH"
    if [ -n "$CLIENT_HTTPS_PID" ]; then
        echo "   Local TLS: https://$LOCAL_HEALTH_HOST:$CLIENT_HTTPS_PORT$CLIENT_HTTPS_WEB_PATH"
        echo "   Network TLS: https://$PUBLIC_HOST:$CLIENT_HTTPS_PORT$CLIENT_HTTPS_WEB_PATH"
        echo "   Note: Self-signed certificate. Use 'Show Details' → 'visit this website' in Safari to trust it."
    else
        echo "   HTTPS:    (not running)"
    fi
    echo "   Source:   $CLIENT_DIR/index.html"
    echo ""
    echo -e "${BLUE}🔧 API Server:${NC}"
    echo "   Local:    http://$LOCAL_HEALTH_HOST:$SERVER_PORT"
    echo "   Network:  http://$PUBLIC_HOST:$SERVER_PORT"
    echo "   Docs:     http://$LOCAL_HEALTH_HOST:$SERVER_PORT/docs"
    if [ -n "$HTTPS_API_PID" ]; then
        echo "   Local TLS: https://$LOCAL_HEALTH_HOST:$HTTPS_API_PORT"
        echo "   Network TLS: https://$PUBLIC_HOST:$HTTPS_API_PORT"
        echo "   TLS Docs: https://$LOCAL_HEALTH_HOST:$HTTPS_API_PORT/docs"
    fi
    echo ""
    echo -e "${YELLOW}🌐 Share the network URL with teammates on the same Wi-Fi/LAN.${NC}"
    echo ""
    echo -e "${BLUE}🐍 Python Client Usage:${NC}"
    echo "   cd $CLIENT_DIR"
    echo "   python3 hr_client.py"
    echo ""
    echo -e "${BLUE}📋 API Endpoints:${NC}"
    echo "   POST /transcribe      - Speech to text"
    echo "   POST /synthesize      - Text to speech"
    echo "   POST /generate        - LLM generation"
    echo "   POST /interview/start - Start interview"
    echo "   POST /interview/submit - Submit response"
    echo ""
    echo -e "${YELLOW}💡 To stop the server: Press Ctrl+C or run 'kill $SERVER_PID'${NC}"
    echo ""
}

# Function to open web client
open_web_client() {
    local web_client_path="http://$LOCAL_HEALTH_HOST:$CLIENT_HTTP_PORT$CLIENT_WEB_PATH"
    
    echo -e "${BLUE}🌐 Opening web client...${NC}"
    
    # Try to open in default browser
    if command -v open &> /dev/null; then
        # macOS
        open "$web_client_path"
    elif command -v xdg-open &> /dev/null; then
        # Linux
        xdg-open "$web_client_path"
    elif command -v start &> /dev/null; then
        # Windows
        start "$web_client_path"
    else
        echo -e "${YELLOW}⚠️  Could not auto-open browser. Please manually open:${NC}"
        echo "   $web_client_path"
    fi
}

# Function to handle cleanup on exit
cleanup_on_exit() {
    echo ""
    echo -e "${YELLOW}🛑 Shutting down HR Interview Agent Client-Server...${NC}"
    
    if [ ! -z "$SERVER_PID" ]; then
        echo "Stopping server (PID: $SERVER_PID)..."
        kill $SERVER_PID 2>/dev/null || true
        wait $SERVER_PID 2>/dev/null || true
    fi

    if [ ! -z "$CLIENT_HTTP_PID" ]; then
        echo "Stopping client web server (PID: $CLIENT_HTTP_PID)..."
        kill $CLIENT_HTTP_PID 2>/dev/null || true
        wait $CLIENT_HTTP_PID 2>/dev/null || true
    fi

    if [ ! -z "$CLIENT_HTTPS_PID" ]; then
        echo "Stopping HTTPS web server (PID: $CLIENT_HTTPS_PID)..."
        kill $CLIENT_HTTPS_PID 2>/dev/null || true
        wait $CLIENT_HTTPS_PID 2>/dev/null || true
    fi

    if [ ! -z "$HTTPS_API_PID" ]; then
        echo "Stopping HTTPS API server (PID: $HTTPS_API_PID)..."
        kill $HTTPS_API_PID 2>/dev/null || true
        wait $HTTPS_API_PID 2>/dev/null || true
    fi
    
    # Additional cleanup
    if check_port $SERVER_PORT; then
        lsof -ti:$SERVER_PORT | xargs kill -9 2>/dev/null || true
    fi

    if check_port $CLIENT_HTTP_PORT; then
        lsof -ti:$CLIENT_HTTP_PORT | xargs kill -9 2>/dev/null || true
    fi

    if check_port $CLIENT_HTTPS_PORT; then
        lsof -ti:$CLIENT_HTTPS_PORT | xargs kill -9 2>/dev/null || true
    fi

    if check_port $HTTPS_API_PORT; then
        lsof -ti:$HTTPS_API_PORT | xargs kill -9 2>/dev/null || true
    fi
    
    echo -e "${GREEN}✅ Shutdown complete${NC}"
    exit 0
}

# Set up signal handlers
trap cleanup_on_exit SIGINT SIGTERM

# Main execution
main() {
    # Handle command line arguments
    case "${1:-}" in
        "stop")
            cleanup
            exit 0
            ;;
        "clean")
            cleanup
            exit 0
            ;;
        "help"|"-h"|"--help")
            echo "Usage: $0 [start|stop|clean|help]"
            echo ""
            echo "Commands:"
            echo "  start (default) - Start the client-server system"
            echo "  stop            - Stop running services"
            echo "  clean           - Clean up processes"
            echo "  help            - Show this help message"
            exit 0
            ;;
        "start"|"")
            # Continue with start process
            ;;
        *)
            echo -e "${RED}❌ Unknown command: $1${NC}"
            echo "Use '$0 help' for usage information"
            exit 1
            ;;
    esac
    
    # Start process
    cleanup
    check_dependencies
    detect_public_host
    start_server
    start_https_api_server
    start_client_static_server
    start_client_https_server
    show_info
    
    # Optionally open web client
    read -p "Open web client in browser? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if [ -n "$CLIENT_HTTPS_PID" ]; then
            open "https://$LOCAL_HEALTH_HOST:$CLIENT_HTTPS_PORT$CLIENT_HTTPS_WEB_PATH" 2>/dev/null || open_web_client
        else
            open_web_client
        fi
    fi
    
    echo ""
    echo -e "${GREEN}🔄 Server running... Press Ctrl+C to stop${NC}"
    
    # Keep script running and wait for server
    wait $SERVER_PID
}

# Run main function
main "$@"
