# Panel de Voz

[![Panel de Voz](guia/assets/banner-es.jpg)](https://inematds.github.io/painel-de-voz/guia/es/)

**[Português](README.md) · [English](README.en.md) · Español**

## Qué es

El Panel de Voz es una interfaz para quienes usan o quieren crear un asistente personal como Intelecto. Reúne un micrófono, texto que puedes corregir, conversación y un núcleo holográfico que muestra el estado del asistente. En la demostración, escuchas un briefing, un resumen hablado con datos ficticios. Para conversar con tu propio asistente, instala el puente local, el programa que conecta el panel con el asistente de tu computadora. La idea surgió de Mark-LVII, de FatihMakes.

[Abrir panel](https://inematds.github.io/painel-de-voz/app/) · [Guía](https://inematds.github.io/painel-de-voz/guia/es/) · [Análisis de plugins](docs/ANALISE-MARK-LVII.md)

> Lee el README de este proyecto y averigua qué asistente uso. Explica cómo conectar el Panel de Voz con él y cómo probar la grabación local. Muéstrame qué planeas cambiar y espera mi aprobación antes de modificar mi sistema.

---

## Instalación técnica

### Prueba la demostración

La página pública incluye un briefing ficticio narrado, un holograma en Canvas y envío de texto en modo de demostración. Haz clic en **Ligar som** y, luego, en **Mostrar briefing de exemplo**. La captura en el sitio público requiere un navegador con reconocimiento local en portugués instalado. El puente de abajo usa su propio reconocimiento local y permite revisar la transcripción antes de enviarla.

### Conecta el puente local

Usa Python 3.10+, Git y un navegador actual. Descarga el proyecto, abre la carpeta y ejecuta:

```bash
git clone https://github.com/inematds/painel-de-voz.git
cd painel-de-voz
python3 bridge.py
```

Abre `http://127.0.0.1:8765/app/`. En este modo, el puente devuelve el texto recibido. Para escuchar y transcribir localmente, instala `faster-whisper` y `piper-tts` en tu entorno de Python y guarda en el disco un modelo multilingüe de faster-whisper y una voz Piper en portugués. Los comandos de abajo instalan los paquetes y descargan una vez el modelo multilingüe `base` para transcribir y la voz brasileña Faber. Después, el puente lee los archivos del disco. Detén el puente anterior con Ctrl+C antes de iniciar la versión con voz.

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install faster-whisper piper-tts
python -c "from faster_whisper.utils import download_model; download_model('base')"
python -m piper.download_voices pt_BR-faber-medium
python bridge.py --whisper-model base --piper-model pt_BR-faber-medium.onnx
```

Si ya tienes el entorno de inemavox con faster-whisper, puedes usar ese Python y el modelo en caché, por ejemplo `--whisper-model base`. En Windows, activa el entorno con `.venv\Scripts\Activate.ps1`. El sistema de prueba fue Linux.

## El proceso, de principio a fin

1. **Conecta Intelecto v2**. Con el puente detenido, descarga Intelecto v2 junto al proyecto. Usa la línea con los parámetros de voz si descargaste los modelos de arriba.

   ```bash
   git clone https://github.com/inematds/intelecto-v2.git ../intelecto-v2
   python3 bridge.py --intelecto ../intelecto-v2 --whisper-model base --piper-model pt_BR-faber-medium.onnx
   ```

   El comando usa el motor simulado de Intelecto. Para conversar con un modelo de IA, añade `--intelecto-model NOME-DO-MODELO-LOCAL`. La conversación pasa por Ollama en `127.0.0.1:11434` y necesita un modelo que ya esté disponible. El adaptador mantiene su propio estado en `~/.painel-de-voz/intelecto` e inicia la conversación con un registro vacío de herramientas. La memoria directa de Intelecto puede guardar solicitudes como “recuerda que…”.

2. **Prueba la voz**. Abre el panel local, haz clic en **Gravar pergunta**, permite el acceso al micrófono, habla y haz clic en **Parar e transcrever**. Revisa el texto y envíalo. Con el sonido activado, Piper lee la respuesta en portugués. Graba comandos de hasta 30 segundos. El puente reproduce hasta 3.000 caracteres por respuesta.

3. **Conecta otro asistente**. La opción `--adapter` va al final y recibe el ejecutable y sus argumentos fijos. En cada turno, el proceso recibe un JSON por stdin y devuelve un JSON por stdout. Usa stderr para el diagnóstico y trata `session` como el identificador para reutilizar el historial. El puente impone un límite de 85 segundos por turno.

   ```bash
   python3 bridge.py --adapter python3 adapters/briefing.py adapters/agenda-exemplo.json
   ```

   Pide “dame el briefing de la agenda”. Luego cambia la hora en `adapters/agenda-exemplo.json` y repite. Este es un ejemplo de plugin independiente que lee un archivo.

   | Entrada | Salida |
   |---|---|
   | `{"session":"uuid","text":"me dê o briefing"}` | `{"reply":"Bom dia. Sua agenda tem dois compromissos."}` |

El proceso del adaptador se ejecuta con los permisos de quien inicia el puente. Configura solo un ejecutable que ya conozcas. El panel público no envía audio al servicio local. El puente acepta conexiones solo en loopback y exige el origen local en las solicitudes. El núcleo y la onda representan estados de la conversación. Los movimientos no miden la amplitud del audio.

## Basado en Mark-LVII

[Mark-LVII de FatihMakes](https://github.com/FatihMakes/Mark-LVII) es la fuente de inspiración y análisis. El panel se implementó por separado. El [estudio de los componentes que se pueden aislar](docs/ANALISE-MARK-LVII.md) incluye briefing, rutinas, verificación de citas, tareas que se reanudan, confirmaciones y consejos para conectar nuevos adaptadores.