# Voice Panel

[![Voice Panel](guia/assets/banner-en.jpg)](https://inematds.github.io/painel-de-voz/guia/en/)

**[Português](README.md) · English · [Español](README.es.md)**

## What It Is

Voice Panel is an interface for people who already use or want to build a personal assistant like Intelecto. It brings together a microphone, editable transcription, conversation, and a holographic core that tracks the assistant’s state. You can open the sample briefing in your browser or install the local bridge to talk to your agent. The idea was inspired by FatihMakes’ Mark-LVII.

[Open panel](https://inematds.github.io/painel-de-voz/app/) · [Guide](https://inematds.github.io/painel-de-voz/guia/en/) · [Plugin analysis](docs/ANALISE-MARK-LVII.md)

> Read this project's README and find out which assistant I already use. Explain how to connect Voice Panel to it and how to test local recording. Show me what you plan to change and wait for my approval before modifying my system.

---

## Technical Installation

### Try the demo

The public page has a fictional narrated briefing, a Canvas hologram, and text submission in demo mode. Turn on **Sound off**, then select **Show sample briefing**. Capturing audio on the public site requires a browser with local Portuguese speech recognition installed. The bridge below uses its own local recognition and lets you review the transcription before sending it.

### Start the local bridge

Use Python 3.10+ and a current browser. Clone the project, open the folder, and run:

```bash
python3 bridge.py
```

Open `http://127.0.0.1:8765/app/`. In this mode, the bridge returns the received text. To listen and transcribe locally, install `faster-whisper` and `piper-tts` in your Python environment, and have a multilingual faster-whisper model and a Portuguese Piper voice on disk. The bridge loads Whisper only from the cache or the specified path. The Piper ONNX file needs its corresponding `.onnx.json` beside it.

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install faster-whisper piper-tts
python bridge.py --whisper-model /caminho/whisper --piper-model /caminho/voz.onnx
```

If you already have the inemavox environment with faster-whisper, you can use that Python and the model in its cache, for example `--whisper-model base`. On Windows, activate the environment with `.venv\Scripts\Activate.ps1`. Linux was used for testing.

## The Process, from Start to Finish

1. **Connect Intelecto v2**. Keep its checkout alongside this project and add the voice parameters above when you want to record and listen.

   ```bash
   python3 bridge.py --intelecto ../intelecto-v2
   python3 bridge.py --intelecto ../intelecto-v2 --intelecto-model NOME-DO-MODELO-LOCAL
   ```

   Use one of the commands. The first uses Intelecto's simulated engine. The second communicates through Ollama at `127.0.0.1:11434` and requires a model that is already available. The adapter keeps its own state in `~/.painel-de-voz/intelecto` and starts the conversation with an empty tool registry. Intelecto's direct memory can store requests like “remember that…”.

2. **Try voice**. Open the local panel, click **Record question**, allow microphone access, speak, and click **Stop and transcribe**. Review and send it. With sound on, Piper reads the response in Portuguese. Record commands up to 30 seconds long. The bridge plays up to 3,000 characters per response.

3. **Connect another assistant**. The `--adapter` option comes last and takes the executable and its fixed arguments. Each turn, the process receives JSON on stdin and returns JSON on stdout. Use stderr for diagnostics and treat `session` as an identifier for reusing the history. The bridge enforces an 85-second limit per turn.

   ```bash
   python3 bridge.py --adapter python3 adapters/briefing.py adapters/agenda-exemplo.json
   ```

   Ask “give me the agenda briefing.” Then change the time in `adapters/agenda-exemplo.json` and repeat. This is an example of an independent plugin that reads a file.

   | Input | Output |
   |---|---|
   | `{"session":"uuid","text":"me dê o briefing"}` | `{"reply":"Bom dia. Sua agenda tem dois compromissos."}` |

The adapter process runs with the permissions of whoever starts the bridge. Configure only an executable you already know. The public panel does not forward audio to the local service. The bridge accepts connections only on loopback and requires the local origin in requests. The core and wave represent conversation states. Their movements do not measure audio amplitude.

## Based on Mark-LVII

[FatihMakes’ Mark-LVII](https://github.com/FatihMakes/Mark-LVII) is the source of inspiration and analysis. The panel was implemented separately. The [study of independently isolatable components](docs/ANALISE-MARK-LVII.md) covers briefings, routines, citation checking, resumable tasks, confirmations, and tips for connecting new adapters.