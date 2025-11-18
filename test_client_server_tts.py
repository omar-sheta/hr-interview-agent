#!/usr/bin/env python3
"""
Test the hr_agent high-quality TTS
"""
import requests
import json
import os
from pathlib import Path

def test_client_server_tts():
    """Test the TTS with high-quality voice on `hr_agent`"""

    # Test text
    test_text = "Hello! This is a test of the high-quality Lessac voice in the client-server setup. Can you hear the improved audio quality?"

    # TTS request payload
    payload = {
        "text": test_text,
        "voice": "en_US-lessac-high"
    }

    print("🎙️  Testing Client-Server High-Quality TTS")
    print("=" * 50)
    print(f"Text: {test_text}")
    print(f"Voice: {payload['voice']}")
    print("\n🔄 Generating audio...")

    try:
        # Make request to the hr_agent TTS endpoint
        response = requests.post(
            "http://localhost:8001/synthesize",
            json=payload,
            headers={"Content-Type": "application/json"}
        )

        if response.status_code == 200:
            # Save audio file
            output_file = Path("hr_agent_test_high_quality_tts.wav")
            with open(output_file, "wb") as f:
                f.write(response.content)

            print(f"✅ Success!")
            print(f"📁 Audio saved to: {output_file.absolute()}")
            print(f"📊 File size: {len(response.content)} bytes")

            # Try to play the audio (macOS)
            try:
                os.system(f"afplay '{output_file}'")
                print("🔊 Audio played successfully!")
            except:
                print("💡 Could not auto-play audio. You can manually play: " + str(output_file))

        else:
            print(f"❌ Error: {response.status_code}")
            print(f"Response: {response.text}")

    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to hr_agent.")
        print("💡 Make sure the client_server is running on http://localhost:8001")
        print("   Run: cd hr_agent && ./start_client_server.sh")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_client_server_tts()