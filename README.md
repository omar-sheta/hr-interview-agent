# HR Interview Agent

This project is a comprehensive platform for conducting AI-powered job interviews. It features a web-based interface for both administrators and candidates, leveraging modern AI technologies to automate and enhance the interview process.

## Features

- **Dual User Roles:** Separate interfaces for Admins (to create and manage interviews) and Candidates (to take interviews).
- **AI-Powered Interviews:**
  - **Dynamic Question Generation:** Uses an LLM (via Ollama) to generate interview questions based on a provided job description.
  - **Speech-to-Text (STT):** Transcribes candidate's audio responses in real-time.
  - **Text-to-Speech (TTS):** Reads interview questions aloud to the candidate.
  - **Automated Evaluation:** Uses an LLM to evaluate the candidate's transcribed answers, providing a score and detailed feedback.
- **Secure Authentication:** JWT-based authentication to protect routes and user data.
- **Full-Stack Application:** A complete solution with a React frontend and a Python FastAPI backend.

## Architecture

- **Frontend:** A responsive user interface built with **React** and **Vite**. It communicates with the backend via RESTful API calls.
- **Backend:** A robust API server built with **Python** and **FastAPI**. It features a **modular architecture** with clear separation of concerns (routers, services, models) for maintainability and scalability. It handles business logic, user management, and orchestrates the AI services.
- **AI Services:**
  - **LLM:** Integrated with **Ollama** for question generation and response evaluation.
  - **STT:** Utilizes **mlx-whisper** for high-quality speech transcription, optimized for Apple Silicon.
  - **TTS:** Employs **piper-tts** for natural-sounding text-to-speech.
- **Data Storage:** A simple and effective file-based data store for managing users, interviews, and results.

## Getting Started

### Prerequisites

- **Python 3.8+** and `pip`
- **Node.js** and `npm`
- **Ollama:** The application is designed to work with a local Ollama instance. Please ensure it is installed and running. You can download it from [ollama.ai](https://ollama.ai/).

### Installation & Running

The entire application can be started with a single script. This script handles dependency installation, certificate generation, and starts both the backend and frontend servers.

1.  Navigate to the `hr_agent` directory:
    ```bash
    cd hr_agent
    ```

2.  Run the start script:
    ```bash
    ./start_client_server.sh
    ```

The script will automatically open the application in your default web browser at `https://localhost:8001`.

## Project Structure

```
hr_agent_final_attempt/
├── hr_agent/
│   ├── frontend/         # React frontend application
│   │   ├── src/
│   │   └── index.html
│   ├── server/           # FastAPI backend application
│   │   ├── main.py       # Main API entry point (Modular)
│   │   ├── models/       # Pydantic data models
│   │   ├── routers/      # API route modules (auth, admin, etc.)
│   │   ├── services/     # Business logic & AI services
│   │   └── utils/        # Utility functions
│   ├── serve_https.py    # Script to serve the frontend over HTTPS
│   └── start_client_server.sh # Main startup script
└── README.md             # This file
```
