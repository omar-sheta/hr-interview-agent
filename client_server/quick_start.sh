#!/bin/bash

# Quick start script for HR Interview Agent Client-Server
# Simple version for immediate use

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🚀 Starting HR Interview Agent Client-Server...${NC}"

# Kill any existing server on port 8001
lsof -ti:8001 | xargs kill -9 2>/dev/null || true

# Get the project root directory  
PROJECT_ROOT="$(dirname "$(dirname "$(realpath "$0")")")"
CLIENT_SERVER_DIR="$(dirname "$(realpath "$0")")"

# Activate virtual environment if it exists
if [ -f "$PROJECT_ROOT/venv/bin/activate" ]; then
    echo -e "${GREEN}Activating virtual environment...${NC}"
    source "$PROJECT_ROOT/venv/bin/activate"
elif [ -f "$PROJECT_ROOT/.venv/bin/activate" ]; then
    echo -e "${GREEN}Activating virtual environment...${NC}"
    source "$PROJECT_ROOT/.venv/bin/activate"
fi

# Start server
cd "$CLIENT_SERVER_DIR/server"
export PYTHONPATH="$PROJECT_ROOT:$PYTHONPATH"

echo -e "${GREEN}Starting server on port 8001...${NC}"
python3 main.py &
SERVER_PID=$!

# Wait for server to start
sleep 3

echo ""
echo "=================================================="
echo -e "${GREEN}🎉 HR Interview Agent Ready!${NC}"
echo "=================================================="
echo ""
echo -e "${BLUE}🌐 Web Client:${NC}"
echo "   Open: file://$CLIENT_SERVER_DIR/client/index.html"
echo ""
echo -e "${BLUE}🔧 API Server:${NC}"
echo "   URL: http://localhost:8001"
echo "   Docs: http://localhost:8001/docs"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
echo ""

# Open web client
if command -v open &> /dev/null; then
    open "file://$CLIENT_SERVER_DIR/client/index.html"
fi

wait $SERVER_PID