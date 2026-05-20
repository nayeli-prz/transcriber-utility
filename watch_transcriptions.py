#!/usr/bin/env python3
"""
Transcription Watcher Script
Monitors ~/transcriber-utility/audio/ for new audio files and automatically
runs Whisper to transcribe them, saving output to ~/transcriber-utility/output/
"""

import os
import subprocess
import time
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# Configuration — paths are relative to this script's location
AUDIO_DIR = Path(__file__).parent / "audio"
OUTPUT_DIR = Path(__file__).parent / "output"
SUPPORTED_FORMATS = {".m4a", ".mp3", ".wav", ".webm", ".mp4", ".ogg", ".flac"}

# Whisper settings (adjust as needed)
WHISPER_MODEL = "base"  # Options: tiny, base, small, medium, large
WHISPER_LANGUAGE = "en"  # Set to None for auto-detect


def send_notification(title: str, message: str):
    """Send a macOS notification."""
    subprocess.run([
        "osascript", "-e",
        f'display notification "{message}" with title "{title}"'
    ])


def transcribe_file(audio_path: Path):
    """Run Whisper on the audio file and save the transcript."""
    print(f"\n🎙️  New audio file detected: {audio_path.name}")
    print(f"⏳ Starting transcription...")
    
    # Build the Whisper command
    cmd = [
        "whisper",
        str(audio_path),
        "--model", WHISPER_MODEL,
        "--output_dir", str(OUTPUT_DIR),
        "--output_format", "txt",
    ]
    
    if WHISPER_LANGUAGE:
        cmd.extend(["--language", WHISPER_LANGUAGE])
    
    try:
        # Run Whisper
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode == 0:
            output_file = OUTPUT_DIR / f"{audio_path.stem}.txt"
            print(f"✅ Transcription complete: {output_file.name}")
            send_notification(
                "Transcription Complete",
                f"{audio_path.name} → {output_file.name}"
            )
        else:
            print(f"❌ Transcription failed: {result.stderr}")
            send_notification(
                "Transcription Failed",
                f"Error processing {audio_path.name}"
            )
    except FileNotFoundError:
        print("❌ Error: Whisper not found. Make sure it's installed and in your PATH.")
        send_notification(
            "Transcription Error",
            "Whisper not found in PATH"
        )


class AudioFileHandler(FileSystemEventHandler):
    """Handles new audio files in the watched directory."""
    
    def __init__(self):
        self.processed_files = set()
    
    def on_created(self, event):
        if event.is_directory:
            return
        
        file_path = Path(event.src_path)
        
        # Check if it's a supported audio format
        if file_path.suffix.lower() not in SUPPORTED_FORMATS:
            return
        
        # Avoid processing the same file twice
        if file_path in self.processed_files:
            return
        
        self.processed_files.add(file_path)
        
        # Wait a moment for the file to finish copying
        time.sleep(1)
        
        transcribe_file(file_path)


def process_existing_files():
    """Check for any existing audio files that haven't been transcribed."""
    print("🔍 Checking for existing audio files...")
    
    for audio_file in AUDIO_DIR.iterdir():
        if audio_file.suffix.lower() not in SUPPORTED_FORMATS:
            continue
        
        # Check if transcript already exists
        transcript_file = OUTPUT_DIR / f"{audio_file.stem}.txt"
        if not transcript_file.exists():
            transcribe_file(audio_file)


def main():
    print("=" * 50)
    print("🎧 Transcription Watcher")
    print("=" * 50)
    print(f"📁 Watching: {AUDIO_DIR}")
    print(f"📄 Output:   {OUTPUT_DIR}")
    print(f"🤖 Model:    {WHISPER_MODEL}")
    print("=" * 50)
    print("Drop audio files into the audio folder to transcribe.")
    print("Press Ctrl+C to stop.\n")
    
    # Process any existing files first
    process_existing_files()
    
    # Set up the file watcher
    event_handler = AudioFileHandler()
    observer = Observer()
    observer.schedule(event_handler, str(AUDIO_DIR), recursive=False)
    observer.start()
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n\n👋 Stopping watcher...")
        observer.stop()
    
    observer.join()
    print("Done.")


if __name__ == "__main__":
    main()
