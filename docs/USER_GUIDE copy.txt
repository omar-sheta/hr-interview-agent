# User Guide

## Getting Started

Welcome to the HR Interview Agent! This guide will help you conduct AI-powered interviews with automatic transcription and intelligent scoring.

## System Requirements

### Minimum Requirements
- **Operating System**: macOS 12+ (recommended), Windows 10+, or Linux
- **RAM**: 8GB (16GB+ recommended for best performance)
- **Storage**: 10GB free space
- **Internet**: Required for initial setup and model downloads
- **Microphone**: Built-in or external microphone for recording responses

### Recommended Setup
- **Computer**: Apple Silicon Mac (M1/M2/M3) for optimal MLX acceleration
- **RAM**: 16GB+ for smooth operation with large AI models
- **Microphone**: External USB microphone for better audio quality
- **Browser**: Chrome, Safari, or Firefox (latest versions)

## Installation

### Step 1: Install Prerequisites

**Install Python 3.12+**
```bash
# macOS (using Homebrew)
brew install python@3.12

# Windows: Download from python.org
# Linux: Use your package manager
```

**Install Node.js 18+**
```bash
# macOS
brew install node

# Windows: Download from nodejs.org
# Linux: Use your package manager
```

**Install Ollama**
```bash
# macOS
brew install ollama

# Windows/Linux: Download from ollama.ai
```

### Step 2: Setup the Application

1. **Download the Application**
   ```bash
   # If you have the source code
   cd hr_agent_final_attempt
   
   # Or clone from repository
   git clone <repository-url>
   cd hr_agent_final_attempt
   ```

2. **Install Python Dependencies**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Install Frontend Dependencies**
   ```bash
   cd frontend
   npm install
   cd ..
   ```

4. **Setup AI Models**
   ```bash
   # Start Ollama service (in a new terminal)
   ollama serve
   
   # Download the Gemma model (this may take 10-15 minutes)
   ollama pull gemma3:27b
   ```

### Step 3: Launch the Application

```bash
# Start both backend and frontend servers
./start_dev.sh
```

Wait for the startup messages:
- ✅ TTS (Piper) voice loaded successfully
- ✅ MLX-Whisper models loaded successfully
- 🎉 HR Interview Agent ready!

### Step 4: Access the Application

Open your web browser and navigate to:
- **Main Application**: http://localhost:5173
- **API Documentation**: http://localhost:8000/docs

## Conducting an Interview

### 1. Setup Phase

1. **Open the Application**
   - Navigate to http://localhost:5173
   - You'll see the HR Interview Agent interface

2. **Grant Microphone Permission**
   - Click "Grant Access" when prompted
   - Allow microphone access in your browser
   - On macOS: Go to System Settings → Privacy & Security → Microphone

3. **Enter Job Description**
   - Type the job role (e.g., "software engineer", "mechanic", "nurse")
   - The more specific, the better the generated questions

4. **Generate Questions**
   - Click "Generate Questions"
   - Wait for AI to create relevant interview questions (5-10 seconds)
   - Review the generated questions

5. **Start Interview**
   - Click "Start Interview" to begin the session
   - A unique interview session will be created

### 2. Interview Phase

#### Question Display
- Each question appears on screen with a question number
- Questions are automatically read aloud using natural speech
- You can replay the question audio by clicking "Play Question"

#### Recording Responses
1. **Start Recording**
   - Click "Start Recording" when ready to answer
   - The microphone indicator will show recording status
   - Speak clearly and at a normal pace

2. **During Recording**
   - The interface shows recording time
   - Maximum recording time is 5 minutes per question
   - You can see the audio level indicator

3. **Stop Recording**
   - Click "Stop Recording" when finished answering
   - The system automatically saves your response
   - Audio is uploaded and processed

4. **Next Question**
   - After recording, the next question appears automatically
   - Repeat the process for all questions

### 3. Review Phase

#### Automatic Processing
After completing all questions:
1. **Transcription**: Audio responses are converted to text using MLX-Whisper
2. **Scoring**: AI evaluates responses using structured rubrics
3. **Results**: Comprehensive feedback is generated

#### Viewing Results
- **Overall Score**: Total score out of 10
- **Category Breakdown**: 
  - Linguistic Competence (50%)
  - Behavioral Competence (50%)
- **Detailed Feedback**: Specific strengths and improvement areas
- **Response Transcripts**: Text versions of your audio answers

## Understanding Your Scores

### Scoring Rubric

The AI evaluates responses across six key areas:

#### Linguistic Competence (50% of total score)
1. **Clarity & Structure (20%)**
   - Logical organization of thoughts
   - Clear beginning, middle, and end
   - Easy to follow narrative

2. **Grammar & Vocabulary (15%)**
   - Proper grammar usage
   - Appropriate vocabulary for the context
   - Professional language

3. **Conciseness & Relevance (15%)**
   - Stays on topic
   - Avoids unnecessary rambling
   - Directly addresses the question

#### Behavioral Competence (50% of total score)
1. **Professionalism (20%)**
   - Appropriate tone and demeanor
   - Professional communication style
   - Respectful and courteous language

2. **Confidence & Delivery (15%)**
   - Clear and confident speaking
   - Appropriate pace and volume
   - Minimal hesitation or filler words

3. **Engagement & Adaptability (15%)**
   - Shows enthusiasm and interest
   - Demonstrates flexibility in thinking
   - Engaging communication style

### Score Interpretation
- **9-10**: Excellent - Professional-level response
- **7-8**: Good - Above-average with minor improvements needed
- **5-6**: Average - Adequate but with notable areas for improvement
- **3-4**: Below Average - Significant improvements needed
- **1-2**: Poor - Major issues requiring attention

## Tips for Better Results

### Before the Interview
1. **Test Your Setup**
   - Verify microphone is working
   - Check audio levels
   - Ensure stable internet connection

2. **Environment Preparation**
   - Find a quiet space
   - Minimize background noise
   - Good lighting if using video (future feature)

3. **Technical Preparation**
   - Close unnecessary applications
   - Ensure sufficient battery/power
   - Have water nearby for dry mouth

### During Recording
1. **Audio Quality**
   - Speak 6-12 inches from microphone
   - Maintain consistent volume
   - Avoid background noise

2. **Speaking Tips**
   - Speak clearly and at normal pace
   - Use the STAR method (Situation, Task, Action, Result)
   - Provide specific examples

3. **Content Structure**
   - Start with a clear opening statement
   - Organize thoughts logically
   - Conclude with a summary if appropriate

### Interview Best Practices
1. **Preparation**
   - Review the job description
   - Prepare relevant examples
   - Practice common interview questions

2. **Response Strategy**
   - Answer the question directly
   - Provide specific examples
   - Keep responses 1-3 minutes long

3. **Professional Demeanor**
   - Maintain professional tone
   - Show enthusiasm for the role
   - Be honest and authentic

## Troubleshooting

### Common Issues

#### Microphone Problems
**Issue**: "Microphone access is permanently blocked"
**Solution**:
- Click the microphone/lock icon in browser address bar
- Select "Allow" for microphone access
- Refresh the page
- On macOS: System Settings → Privacy & Security → Microphone

#### Audio Quality Issues
**Issue**: Poor transcription accuracy
**Solutions**:
- Use an external microphone
- Record in a quiet environment
- Speak clearly and at normal pace
- Check microphone levels in system settings

#### AI Model Issues
**Issue**: "Ollama connection failed"
**Solutions**:
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Restart Ollama if needed
ollama serve

# Verify Gemma model is installed
ollama list
```

#### Performance Issues
**Issue**: Slow processing or timeouts
**Solutions**:
- Ensure sufficient RAM (16GB+ recommended)
- Close other applications
- Use Apple Silicon Mac for best performance
- Check internet connection for model downloads

#### Browser Issues
**Issue**: Interface not loading or errors
**Solutions**:
- Try a different browser (Chrome, Safari, Firefox)
- Clear browser cache and cookies
- Disable browser extensions
- Check browser console for errors (F12)

### Getting Help

#### Check System Status
Visit http://localhost:8000/health to see system status:
- Overall health status
- AI model availability
- Component status

#### Log Files
Check `server.log` for detailed error information:
```bash
tail -f server.log
```

#### Reset Session
If stuck in an interview:
1. Refresh the browser page
2. Start a new interview session
3. Previous sessions are automatically saved

## Advanced Features

### Manual Scoring
- Click "Score Responses" to re-run AI evaluation
- Useful if initial scoring fails
- Results update automatically

### Session Management
- Each interview creates a unique session
- Sessions are automatically saved
- Audio files are stored locally for privacy

### Multiple Job Types
- System adapts questions to job descriptions
- Examples: "software engineer", "mechanical engineer", "registered nurse"
- More specific descriptions generate better questions

### Audio Playback
- Listen to your recorded responses
- Review transcriptions for accuracy
- Compare original audio with transcribed text

## Privacy and Data

### Local Processing
- All data stays on your computer
- No information sent to external services
- Audio files stored locally in encrypted format

### Data Storage
- Interview sessions: `hr_agent/data/sessions/`
- Audio recordings: `hr_agent/uploads/`
- Voice models: `piper_voices/`

### Data Retention
- Sessions persist until manually deleted
- Audio files automatically cleaned up after processing
- No automatic data transmission or backup