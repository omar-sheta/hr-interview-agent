# Development Guide

## Overview

This guide covers setting up a development environment, understanding the codebase architecture, and contributing to the HR Interview Agent project.

## Development Environment Setup

### Prerequisites
- Python 3.12+
- Node.js 18+
- Git
- Code editor (VS Code recommended)
- Ollama with Gemma model

### Initial Setup

1. **Clone and Setup Repository**
   ```bash
   git clone <repository-url>
   cd hr_agent_final_attempt
   
   # Create Python virtual environment
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   
   # Install dependencies
   pip install -r requirements.txt
   pip install -r requirements-dev.txt  # Development dependencies
   
   # Frontend setup
   cd frontend && npm install && cd ..
   ```

2. **Configure Development Tools**
   ```bash
   # Install pre-commit hooks
   pre-commit install
   
   # Setup environment variables
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start Development Services**
   ```bash
   # Terminal 1: Start Ollama
   ollama serve
   
   # Terminal 2: Start development servers
   ./start_dev.sh
   ```

## Project Structure Deep Dive

### Backend Architecture (`/hr_agent/`)

```
hr_agent/
├── main.py              # FastAPI application entry point
├── config.py            # Configuration management
├── models.py            # ML model management
├── api/                 # API route handlers
│   ├── __init__.py
│   ├── health.py        # Health check endpoints
│   ├── interviews.py    # Interview session management
│   ├── questions.py     # Question generation
│   ├── scoring.py       # AI scoring system
│   ├── tts.py          # Text-to-speech
│   └── stt_mlx.py      # Speech-to-text
├── data/               # Data storage
│   └── sessions/       # Interview sessions
└── uploads/            # Uploaded audio files
```

#### Key Components

**1. FastAPI Application (`main.py`)**
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="HR Interview Agent",
    description="AI-powered interview system",
    version="1.0.0"
)

# Middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Route registration
app.include_router(health.router, prefix="/api/health")
app.include_router(interviews.router, prefix="/api/interviews")
# ... other routers
```

**2. Configuration Management (`config.py`)**
```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    GEMMA_MODEL: str = "gemma2:27b"
    
    class Config:
        env_file = ".env"

settings = Settings()
```

**3. API Router Pattern**
```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

class RequestModel(BaseModel):
    field1: str
    field2: int

@router.post("/endpoint")
async def endpoint_handler(request: RequestModel):
    try:
        # Business logic here
        result = process_request(request)
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

### Frontend Architecture (`/frontend/`)

```
frontend/
├── src/
│   ├── App.jsx          # Main application component
│   ├── main.jsx         # React entry point
│   ├── index.css        # Global styles (Tailwind)
│   └── components/      # Reusable components (future)
├── public/              # Static assets
├── package.json         # Dependencies and scripts
└── vite.config.js       # Vite configuration
```

#### Key Frontend Patterns

**1. State Management (React Hooks)**
```javascript
// Global application state
const [sessionId, setSessionId] = useState(null);
const [currentQuestion, setCurrentQuestion] = useState(null);
const [interviewStatus, setInterviewStatus] = useState('setup');
const [questions, setQuestions] = useState([]);

// Audio recording state
const [isRecording, setIsRecording] = useState(false);
const [recordingTime, setRecordingTime] = useState(0);
const mediaRecorderRef = useRef(null);
```

**2. API Communication**
```javascript
const API_BASE = 'http://localhost:8000';

async function callAPI(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
}
```

**3. Audio Recording Implementation**
```javascript
const startRecording = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/mp4'  // Prefer MP4 for better compatibility
    });
    
    const chunks = [];
    mediaRecorder.ondataavailable = (event) => {
      chunks.push(event.data);
    };
    
    mediaRecorder.onstop = async () => {
      const blob = new Blob(chunks, { type: 'audio/mp4' });
      await uploadAudio(blob);
    };
    
    mediaRecorder.start();
    mediaRecorderRef.current = mediaRecorder;
    setIsRecording(true);
  } catch (error) {
    console.error('Recording failed:', error);
  }
};
```

## Key Development Workflows

### Adding New API Endpoints

1. **Create Route Handler**
   ```python
   # hr_agent/api/new_feature.py
   from fastapi import APIRouter
   
   router = APIRouter()
   
   @router.post("/new-endpoint")
   async def new_endpoint_handler(request: RequestModel):
       # Implementation here
       pass
   ```

2. **Register Router**
   ```python
   # hr_agent/main.py
   from hr_agent.api import new_feature
   
   app.include_router(
       new_feature.router, 
       prefix="/api/new-feature",
       tags=["New Feature"]
   )
   ```

3. **Add Tests**
   ```python
   # tests/test_new_feature.py
   import pytest
   from fastapi.testclient import TestClient
   
   def test_new_endpoint():
       response = client.post("/api/new-feature/new-endpoint")
       assert response.status_code == 200
   ```

### Adding Frontend Features

1. **Create Component State**
   ```javascript
   const [newFeatureState, setNewFeatureState] = useState(null);
   ```

2. **Add API Integration**
   ```javascript
   const handleNewFeature = async () => {
     try {
       const result = await callAPI('/api/new-feature/new-endpoint', {
         method: 'POST',
         body: JSON.stringify(data)
       });
       setNewFeatureState(result);
     } catch (error) {
       console.error('Feature failed:', error);
     }
   };
   ```

3. **Update UI**
   ```jsx
   {newFeatureState && (
     <div className="new-feature-container">
       <h3>New Feature</h3>
       <p>{newFeatureState.message}</p>
     </div>
   )}
   ```

## Testing

### Backend Testing

**Setup Test Environment**
```python
# tests/conftest.py
import pytest
from fastapi.testclient import TestClient
from hr_agent.main import app

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def mock_ollama():
    # Mock Ollama responses for testing
    pass
```

**API Testing Example**
```python
# tests/test_interviews.py
def test_create_interview(client):
    response = client.post("/api/interviews/create", json={
        "job_description": "test job",
        "questions": [{"question": "test question"}]
    })
    assert response.status_code == 200
    assert "session_id" in response.json()

def test_next_question(client):
    # Create session first
    create_response = client.post("/api/interviews/create", json={...})
    session_id = create_response.json()["session_id"]
    
    # Test next question
    response = client.post(f"/api/interviews/{session_id}/next")
    assert response.status_code == 200
    assert "question" in response.json()
```

**Run Tests**
```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=hr_agent

# Run specific test file
pytest tests/test_interviews.py -v
```

### Frontend Testing

**Setup (using Vitest)**
```javascript
// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
  },
})
```

**Component Testing Example**
```javascript
// src/test/App.test.jsx
import { render, screen, fireEvent } from '@testing-library/react'
import App from '../App'

test('renders interview setup', () => {
  render(<App />)
  expect(screen.getByText('HR Interview Agent')).toBeInTheDocument()
  expect(screen.getByPlaceholderText('Enter job description')).toBeInTheDocument()
})

test('generates questions', async () => {
  render(<App />)
  
  const input = screen.getByPlaceholderText('Enter job description')
  fireEvent.change(input, { target: { value: 'software engineer' } })
  
  const generateButton = screen.getByText('Generate Questions')
  fireEvent.click(generateButton)
  
  // Test async behavior
  await screen.findByText('Questions generated successfully')
})
```

**Run Frontend Tests**
```bash
cd frontend
npm test
```

## Code Quality and Standards

### Python Code Standards

**Formatting and Linting**
```bash
# Format code
black hr_agent/
isort hr_agent/

# Lint code
flake8 hr_agent/
mypy hr_agent/
```

**Pre-commit Configuration**
```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/psf/black
    rev: 22.3.0
    hooks:
      - id: black
  - repo: https://github.com/pycqa/isort
    rev: 5.10.1
    hooks:
      - id: isort
  - repo: https://github.com/pycqa/flake8
    rev: 4.0.1
    hooks:
      - id: flake8
```

### JavaScript Code Standards

**ESLint Configuration**
```javascript
// .eslintrc.js
module.exports = {
  extends: [
    'eslint:recommended',
    '@vitejs/eslint-config-react',
  ],
  rules: {
    'no-console': 'warn',
    'no-unused-vars': 'error',
    'react-hooks/exhaustive-deps': 'warn',
  },
}
```

**Prettier Configuration**
```json
// .prettierrc
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2
}
```

## Debugging

### Backend Debugging

**Enable Debug Logging**
```python
import logging
logging.basicConfig(level=logging.DEBUG)

# In your code
logger = logging.getLogger(__name__)
logger.debug("Debug message")
```

**Interactive Debugging**
```python
# Add breakpoint
import pdb; pdb.set_trace()

# Or use ipdb for better experience
import ipdb; ipdb.set_trace()
```

**FastAPI Debug Mode**
```python
# main.py
if __name__ == "__main__":
    uvicorn.run(
        "hr_agent.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,  # Enable hot reload
        debug=True,   # Enable debug mode
    )
```

### Frontend Debugging

**Browser DevTools**
- Console: Check for JavaScript errors
- Network: Monitor API requests
- Application: Inspect localStorage/sessionStorage

**React Developer Tools**
- Install React DevTools browser extension
- Inspect component state and props
- Profile component performance

**Debug API Calls**
```javascript
// Add detailed logging
const callAPI = async (endpoint, options) => {
  console.log('API Request:', endpoint, options);
  
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, options);
    console.log('API Response:', response.status, response);
    
    const data = await response.json();
    console.log('API Data:', data);
    
    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};
```

## Performance Optimization

### Backend Performance

**Async Best Practices**
```python
import asyncio
import httpx

# Use async HTTP client
async_client = httpx.AsyncClient()

async def make_concurrent_requests():
    tasks = [
        async_client.get(url1),
        async_client.get(url2),
        async_client.get(url3),
    ]
    responses = await asyncio.gather(*tasks)
    return responses
```

**Caching**
```python
from functools import lru_cache

@lru_cache(maxsize=128)
def expensive_computation(param):
    # Cached result
    return result
```

**Database Optimization** (Future)
```python
# Use connection pooling
from sqlalchemy.pool import QueuePool

engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=20,
    max_overflow=0,
)
```

### Frontend Performance

**Code Splitting**
```javascript
import { lazy, Suspense } from 'react';

const ScoringDashboard = lazy(() => import('./ScoringDashboard'));

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ScoringDashboard />
    </Suspense>
  );
}
```

**Memoization**
```javascript
import { useMemo, useCallback } from 'react';

const ExpensiveComponent = ({ data }) => {
  const processedData = useMemo(() => {
    return expensiveDataProcessing(data);
  }, [data]);

  const handleClick = useCallback(() => {
    // Event handler
  }, []);

  return <div>{processedData}</div>;
};
```

## Contributing Guidelines

### Git Workflow

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/new-feature-name
   ```

2. **Make Changes**
   - Follow code standards
   - Add tests for new functionality
   - Update documentation

3. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat: add new feature description"
   ```

4. **Push and Create PR**
   ```bash
   git push origin feature/new-feature-name
   # Create pull request on GitHub
   ```

### Commit Message Format
```
type(scope): description

feat: add new feature
fix: bug fix
docs: documentation update
style: formatting changes
refactor: code refactoring
test: add tests
chore: maintenance tasks
```

### Pull Request Process
1. Ensure all tests pass
2. Update documentation
3. Add description of changes
4. Request code review
5. Address review feedback
6. Merge after approval

## Troubleshooting Development Issues

### Common Development Problems

**Ollama Not Starting**
```bash
# Check if port is in use
lsof -i :11434

# Kill existing process
pkill ollama

# Restart with debug
ollama serve --verbose
```

**MLX-Whisper Import Errors**
```bash
# Ensure you're on Apple Silicon
python -c "import platform; print(platform.machine())"

# Reinstall MLX packages
pip uninstall mlx-whisper
pip install mlx-whisper
```

**Frontend Build Issues**
```bash
# Clear node modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Vite cache
rm -rf node_modules/.vite
```

**Port Conflicts**
```bash
# Find processes using ports
lsof -i :8000
lsof -i :5173

# Kill processes
kill -9 <PID>
```