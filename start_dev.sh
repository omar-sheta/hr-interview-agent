#!/bin/bash

# --- Configuration ---
OLLAMA_MODEL="gemma3:27b" # The model to use. Update this if you use a different one.

# Ensure Homebrew paths are available for ffmpeg and other tools
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

# --- Helper Functions ---

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to setup and verify Ollama
setup_ollama() {
    echo "--- Checking Ollama Setup ---"
    if ! command_exists ollama; then
        echo "Error: ollama command not found."
        echo "Please install Ollama by following the instructions at https://ollama.com"
        exit 1
    fi

    # Check if Ollama server is running by trying to list models
    if ! ollama ps > /dev/null 2>&1; then
        echo "Error: Ollama server is not running."
        echo "Please start it with 'ollama serve' in a separate terminal and then run this script again."
        exit 1
    fi
    echo "Ollama server is running."

    # Check if the model is available locally
    if ! ollama list | grep -q "$OLLAMA_MODEL"; then
        echo "Model '$OLLAMA_MODEL' not found locally. Pulling it now... (This may take a while)"
        ollama pull "$OLLAMA_MODEL"
        if [ $? -ne 0 ]; then
            echo "Error: Failed to pull Ollama model '$OLLAMA_MODEL'."
            exit 1
        fi
        echo "Model pulled successfully."
    else
        echo "Model '$OLLAMA_MODEL' is already available."
    fi
    echo "--------------------------"
    echo
}

# Function to install dependencies
install_dependencies() {
    echo "--- Installing Dependencies ---"
    # Backend dependencies (Python)
    if [ ! -d "venv" ]; then
        echo "Python virtual environment not found. Creating and installing dependencies..."
        python3 -m venv venv
        source venv/bin/activate
        pip install -r requirements.txt
    else
        echo "Python virtual environment found."
    fi

    # Frontend dependencies (Node.js)
    if [ ! -d "frontend/node_modules" ]; then
        echo "Node modules not found. Installing frontend dependencies..."
        (cd frontend && npm install)
    else
        echo "Node modules found."
    fi
    echo "---------------------------"
    echo
}

# Function to start services
start_services() {
    # Kill any existing processes on the ports we need
    echo "--- Cleaning Up Existing Processes ---"
    echo "Stopping any existing backend processes (port 8000)..."
    pkill -f "uvicorn hr_agent.main:app" 2>/dev/null || true
    pkill -f "uvicorn" 2>/dev/null || true
    lsof -ti:8000 | xargs kill -9 2>/dev/null || echo "No process found on port 8000"
    
    echo "Stopping any existing frontend processes (ports 5173-5176)..."
    pkill -f "vite" 2>/dev/null || true
    pkill -f "npm run dev" 2>/dev/null || true
    lsof -ti:5173 | xargs kill -9 2>/dev/null || echo "No process found on port 5173"
    lsof -ti:5174 | xargs kill -9 2>/dev/null || true
    lsof -ti:5175 | xargs kill -9 2>/dev/null || true
    lsof -ti:5176 | xargs kill -9 2>/dev/null || true
    
    # Wait longer for processes to fully terminate
    echo "Waiting for processes to terminate..."
    sleep 5
    echo "Cleanup complete."
    echo

    # Run setup checks
    setup_ollama
    install_dependencies

    echo "--- Starting Services ---"
    echo "Starting backend server..."
    (cd "$(dirname "$0")" && export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH" && source venv/bin/activate && python -m uvicorn hr_agent.main:app --host 0.0.0.0 --port 8000 --reload --reload-delay 1) &
    BACKEND_PID=$!
    echo "Backend server started with PID $BACKEND_PID"

    # Give the backend a moment to start
    sleep 3

    echo "Starting frontend dev server..."
    (cd "$(dirname "$0")/frontend" && npm run dev -- --port 5173) &
    FRONTEND_PID=$!
    echo "Frontend server started with PID $FRONTEND_PID"

    echo ""
    echo "🚀 Services are starting up!"
    echo "📱 Frontend: http://localhost:5173"
    echo "🔧 Backend API: http://localhost:8000"
    echo "📚 API Docs: http://localhost:8000/docs"
    echo ""
    echo "Press Ctrl+C to stop all services"
    echo ""

    # Function to handle cleanup on script exit
    cleanup() {
        echo ""
        echo "Shutting down services..."
        stop_services
        exit 0
    }

    # Set up signal handlers
    trap cleanup SIGINT SIGTERM

    # Wait for either process to exit
    while kill -0 $BACKEND_PID 2>/dev/null && kill -0 $FRONTEND_PID 2>/dev/null; do
        sleep 1
    done

    echo "A service has stopped. Stopping all related services..."
    stop_services
}

# Function to stop services
stop_services() {
    echo "--- Stopping All Services ---"
    # Find and kill processes listening on ports 8000 and 5173 (or whatever Vite is using)
    # This is more robust than relying on PIDs from the start script.
    echo "Stopping backend server (port 8000)..."
    pkill -f "uvicorn hr_agent.main:app" 2>/dev/null || true
    pkill -f "uvicorn" 2>/dev/null || true
    lsof -ti:8000 | xargs kill -9 2>/dev/null || echo "No process found on port 8000"
    
    echo "Stopping frontend server (port 5173-5176)..."
    pkill -f "vite" 2>/dev/null || true
    pkill -f "npm run dev" 2>/dev/null || true
    lsof -ti:5173 | xargs kill -9 2>/dev/null || echo "No process found on port 5173"
    lsof -ti:5174 | xargs kill -9 2>/dev/null || true
    lsof -ti:5175 | xargs kill -9 2>/dev/null || true
    lsof -ti:5176 | xargs kill -9 2>/dev/null || true
    
    echo "Services stopped."
}

# Main script logic
case "${1:-start}" in
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    *)
        echo "Usage: $0 {start|stop}"
        exit 1
        ;;
esac

