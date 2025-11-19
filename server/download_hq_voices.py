#!/usr/bin/env python3
"""
Download high-quality TTS voices for Piper
"""
import os
import requests
import tarfile
import json
from pathlib import Path

# High-quality voice download URLs from the correct Piper repository
VOICES = {
    "lessac_high": {
        "url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/high/en_US-lessac-high.onnx",
        "config_url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/high/en_US-lessac-high.onnx.json",
        "size": "~63MB",
        "quality": "High"
    },
    "ryan_high": {
        "url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/high/en_US-ryan-high.onnx",
        "config_url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/high/en_US-ryan-high.onnx.json",
        "size": "~63MB",
        "quality": "High"
    },
    "joe_high": {
        "url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/joe/high/en_US-joe-high.onnx",
        "config_url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/joe/high/en_US-joe-high.onnx.json",
        "size": "~63MB",
        "quality": "High"
    },
    "bryce_high": {
        "url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/bryce/high/en_US-bryce-high.onnx",
        "config_url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/bryce/high/en_US-bryce-high.onnx.json",
        "size": "~63MB",
        "quality": "High"
    }
}

def download_file(url, filepath):
    """Download a file with progress indication"""
    print(f"Downloading {filepath.name}...")
    response = requests.get(url, stream=True)
    response.raise_for_status()
    
    total_size = int(response.headers.get('content-length', 0))
    downloaded = 0
    
    with open(filepath, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            if chunk:
                f.write(chunk)
                downloaded += len(chunk)
                if total_size > 0:
                    percent = (downloaded / total_size) * 100
                    print(f"\rProgress: {percent:.1f}%", end="", flush=True)
    
    print(f"\n✅ Downloaded {filepath.name}")

def download_voice(voice_name, voice_info):
    """Download a voice model and its config"""
    voices_dir = Path(__file__).parent / "piper_voices"
    voices_dir.mkdir(exist_ok=True)
    
    # Extract filename from URL
    model_filename = voice_info["url"].split('/')[-1]
    config_filename = voice_info["config_url"].split('/')[-1]
    
    model_path = voices_dir / model_filename
    config_path = voices_dir / config_filename
    
    print(f"\n🎙️  Downloading {voice_name} ({voice_info['quality']} quality, {voice_info['size']})")
    
    # Download model file
    download_file(voice_info["url"], model_path)
    
    # Download config file
    download_file(voice_info["config_url"], config_path)
    
    return model_path, config_path

def main():
    print("🎙️  High-Quality TTS Voice Downloader")
    print("=" * 50)
    
    print("\nAvailable voices:")
    for i, (name, info) in enumerate(VOICES.items(), 1):
        print(f"{i}. {name}: {info['quality']} quality ({info['size']})")
    
    print(f"{len(VOICES) + 1}. Download all voices")
    print("0. Cancel")
    
    try:
        choice = input(f"\nSelect voice to download (1-{len(VOICES) + 1}): ").strip()
        
        if choice == "0":
            print("Cancelled.")
            return
        
        if choice == str(len(VOICES) + 1):
            # Download all voices
            for name, info in VOICES.items():
                try:
                    download_voice(name, info)
                except Exception as e:
                    print(f"❌ Failed to download {name}: {e}")
        else:
            # Download specific voice
            voice_names = list(VOICES.keys())
            selected_voice = voice_names[int(choice) - 1]
            download_voice(selected_voice, VOICES[selected_voice])
        
        print(f"\n🎉 Download complete!")
        print(f"📁 Voices saved to: {Path(__file__).parent / 'piper_voices'}")
        print(f"\n💡 To use the new voice, update your TTS configuration to point to the new .onnx file")
        
    except (ValueError, IndexError):
        print("❌ Invalid selection")
    except KeyboardInterrupt:
        print("\n❌ Cancelled by user")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()