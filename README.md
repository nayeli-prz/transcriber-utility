# Transcription Workflow

A local tool for transcribing audio and analyzing transcripts with Claude.

**How it works:** Drop an audio file into the app → Whisper transcribes it locally → Claude analyzes it using one of your saved guidelines → results appear in the app.

---

## Prerequisites

Install these once on any machine you use this on:

- **[Node.js](https://nodejs.org/)** (v18 or later)
- **Python 3.9+**
- **[FFmpeg](https://ffmpeg.org/)** — required by Whisper for audio processing
  - Mac: `brew install ffmpeg`
  - Windows: download from ffmpeg.org and add to PATH
- **An Anthropic API key** — get one at [console.anthropic.com](https://console.anthropic.com)

---

## Setup

### 1. Install Node dependencies
```bash
npm install
```

### 2. Set up Python environment
```bash
python3 -m venv venv
source venv/bin/activate        # Mac/Linux
# venv\Scripts\activate         # Windows

pip install -r requirements.txt
```

This installs **openai-whisper** (OpenAI's open-source speech recognition library) and its dependencies. If you run into issues, you can also install it directly:

```bash
pip install openai-whisper
```

On some machines you may also need to install `setuptools-rust` or update pip first:

```bash
pip install --upgrade pip setuptools wheel
pip install openai-whisper
```

**Verify Whisper is working:**
```bash
whisper --help
```

> **First run:** When the watcher runs Whisper for the first time, it will automatically download the model weights (~140 MB for `base`) from the internet. This is a one-time download per model size. Subsequent runs use the cached model.

---

## Running

You need two things running at the same time — open two terminal windows:

**Terminal 1 — Start the watcher (transcribes audio automatically):**
```bash
source venv/bin/activate
python watch_transcriptions.py
```

**Terminal 2 — Start the server:**
```bash
node server.js
```

Then open `transcription-app.html` in your browser.

On first use, click **Settings** (bottom-left) and enter your Anthropic API key. It's saved in your browser only.

---

## Usage

1. Click **+ New** and upload an audio file (mp3, m4a, wav, webm, ogg)
2. The file is saved to `audio/`, Whisper transcribes it, and the transcript appears automatically
3. Select a **Guideline** (Braindump Notes, Message Draft, etc.) and click **Analyze**
4. You can also click **"paste transcript manually"** to skip audio upload entirely

---

## Project structure

```
transcription-app.html   — the app (open this in your browser)
server.js                — local server for file uploads + Claude API proxy
watch_transcriptions.py  — watches audio/ and runs Whisper automatically
audio/                   — drop audio files here (ignored by git)
output/                  — Whisper saves transcripts here (ignored by git)
```

---

## Whisper model options

In `watch_transcriptions.py`, you can change the model:

| Model  | Speed  | Accuracy | Download size |
|--------|--------|----------|---------------|
| tiny   | fast   | low      | ~75 MB        |
| base   | medium | medium   | ~140 MB       |
| small  | slow   | good     | ~460 MB       |
| medium | slower | better   | ~1.5 GB       |

```python
WHISPER_MODEL = "base"  # change this line
```
