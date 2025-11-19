#!/bin/bash

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}=== HR Agent Email Setup ===${NC}"
echo "This script will help you configure real email sending using Gmail."
echo

# Default values
DEFAULT_EMAIL="hive_internship@gmail.com"
DEFAULT_HOST="smtp.gmail.com"
DEFAULT_PORT="587"

# Prompt for email
read -p "Enter your Gmail address [$DEFAULT_EMAIL]: " EMAIL
EMAIL=${EMAIL:-$DEFAULT_EMAIL}

echo -e "\n${YELLOW}IMPORTANT: You need a Gmail App Password, not your login password.${NC}"
echo "1. Go to https://myaccount.google.com/security"
echo "2. Enable 2-Step Verification if not already enabled."
echo "3. Search for 'App passwords'."
echo "4. Create a new app password (name it 'HR Agent')."
echo "5. Copy the 16-character password."
echo

# Prompt for password (hidden input)
read -s -p "Enter your Gmail App Password: " PASSWORD
echo
echo

if [ -z "$PASSWORD" ]; then
    echo -e "${YELLOW}No password entered. Starting in MOCK MODE.${NC}"
    ./start_client_server.sh
else
    echo -e "${GREEN}Starting server with email configuration...${NC}"
    
    # Export variables for the server process
    export SMTP_HOST="$DEFAULT_HOST"
    export SMTP_PORT="$DEFAULT_PORT"
    export SMTP_USER="$EMAIL"
    export SMTP_PASS="$PASSWORD"
    export FROM_EMAIL="$EMAIL"
    
    # Start the main script
    ./start_client_server.sh
fi
