# Panel de Voz

[![Panel de Voz](guia/assets/banner-es.jpg)](https://inematds.github.io/painel-de-voz/guia/es/)

[Português](README.md) · [English](README.en.md) · **Español**

## Qué es

El Panel de Voz es una interfaz para quienes ya usan o quieren crear un asistente personal como Intelecto. Reúne un micrófono, transcripción editable, conversación y un núcleo holográfico que sigue el estado de la atención. Puedes abrir el briefing de ejemplo en el navegador o instalar el puente local para conversar con tu agente. La idea se inspiró en Mark-LVII, de FatihMakes.

[Abrir panel](https://inematds.github.io/painel-de-voz/app/) · [Guía](https://inematds.github.io/painel-de-voz/guia/es/) · [Análisis de plugins](docs/ANALISE-MARK-LVII.md)

> Lee el README de este proyecto y descubre qué asistente uso ya. Explica cómo conectar el Panel de Voz con él y cómo probar la grabación local. Muestra qué piensas cambiar y espera mi aprobación antes de modificar mi sistema.

---

## Instalación técnica

### Prueba la demostración

La página pública incluye un briefing ficticio narrado, holograma en Canvas y envío de texto en modo de demostración. Activa **Sonido desactivado** y, a continuación, **Mostrar briefing de ejemplo**. La captura en el sitio público requiere un navegador con reconocimiento local en portugués instalado. El puente de abajo usa su propio reconocimiento local y permite revisar la transcripción antes de enviarla.

### Conecta el puente local

Usa Python 3.10+ y un navegador actualizado. Clona el proyecto, abre la carpeta y ejecuta:

```bash
python3 bridge.py
```

Abre `http://127.0.0.1:8765/app/`. En este modo, el puente devuelve el texto recibido. Para escuchar y transcribir localmente, instala `faster-whisper` y `piper-tts` en tu entorno Python y ten en el disco un modelo multilingüe de faster-whisper y una voz Piper en portugués. El puente carga Whisper solo desde la caché o desde la ruta indicada. El archivo ONNX de Piper necesita su correspondiente `.onnx.json` al lado.

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install faster-whisper piper-tts
python bridge.py --whisper-model /caminho/whisper --piper-model /caminho/voz.onnx
```

Quienes ya tienen el entorno de inemavox con faster-whisper pueden usar ese Python y el modelo en caché, por ejemplo `--whisper-model base`. En Windows, activa el entorno con `.venv\Scripts\Activate.ps1`. Linux fue el sistema de prueba.

## El proceso, de principio a fin

1. **Conecta Intelecto v2**. Ten su checkout al lado y añade los parámetros de voz anteriores cuando quieras grabar y escuchar.

   ```bash
   python3 bridge.py --intelecto ../intelecto-v2
   python3 bridge.py --intelecto ../intelecto-v2 --intelecto-model NOME-DO-MODELO-LOCAL
   ```

   Usa uno de los comandos. El primero usa el motor simulado de Intelecto. El segundo conversa mediante Ollama en `127.0.0.1:11434` y necesita un modelo que ya esté disponible. El adaptador mantiene su propio estado en `~/.painel-de-voz/intelecto` y abre la conversación con un registro vacío de herramientas. La memoria directa de Intelecto puede guardar solicitudes como “recuerda que…”.

2. **Prueba la voz**. Abre el panel local, haz clic en **Gravar pergunta**, permite el acceso al micrófono, habla y haz clic en **Parar e transcrever**. Revisa y envía. Con el sonido activado, Piper lee la respuesta en portugués. Graba comandos de hasta 30 segundos. El puente reproduce hasta 3.000 caracteres por respuesta.

3. **Conecta otro asistente**. La opción `--adapter` va al final y recibe el ejecutable y sus argumentos fijos. En cada turno, el proceso recibe un JSON por stdin y devuelve un JSON por stdout. Usa stderr para el diagnóstico y trata `session` como identificador para reutilizar el historial. El puente impone un límite de 85 segundos por turno.

   ```bash
   python3 bridge.py --adapter python3 adapters/briefing.py adapters/agenda-exemplo.json
   ```

   Pide “dame el briefing de la agenda”. Después cambia la hora en `adapters/agenda-exemplo.json` y repite. Este es un ejemplo de plugin independiente que lee un archivo.

   | Entrada | Salida |
   |---|---|
   | `{"session":"uuid","text":"me dê o briefing"}` | `{"reply":"Bom dia. Sua agenda tem dois compromissos."}` |

El proceso del adaptador se ejecuta con los permisos de quien inicia el puente. Configura solo un ejecutable que ya conozcas. El panel público no envía audio al servicio local. El puente acepta conexiones solo en loopback y exige el origen local en las solicitudes. El núcleo y la onda representan estados de la conversación. Los movimientos no miden la amplitud del audio.

## Basado en Mark-LVII

[Mark-LVII, de FatihMakes](https://github.com/FatihMakes/Mark-LVII) es la fuente de inspiración y análisis. El panel se implementó por separado. El [estudio de las piezas aislables](docs/ANALISE-MARK-LVII.md) incluye briefing, rutinas, verificación de citas, tareas que se reanudan, confirmaciones y consejos para conectar nuevos adaptadores.