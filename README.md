# Painel de Voz

[![Painel de Voz](guia/assets/banner.jpg)](https://inematds.github.io/painel-de-voz/guia/)

**Português · [English](README.en.md) · [Español](README.es.md)**

## O que é

O Painel de Voz é uma interface para quem usa ou quer montar um assistente pessoal como o Intelecto. Ele reúne microfone, texto que você pode corrigir, conversa e um núcleo holográfico que mostra o estado do assistente. Na demonstração, você ouve um briefing, um resumo falado com dados fictícios. Para conversar com seu próprio assistente, instale a ponte local, o programa que liga o painel ao assistente no seu computador. A ideia veio do Mark-LVII, de FatihMakes.

[Abrir painel](https://inematds.github.io/painel-de-voz/app/) · [Guia](https://inematds.github.io/painel-de-voz/guia/) · [Análise de plugins](docs/ANALISE-MARK-LVII.md)

> Leia o README deste projeto e descubra qual assistente eu já uso. Explique como ligar o Painel de Voz a ele e como testar a gravação local. Mostre o que pretende alterar e aguarde minha aprovação antes de mexer no meu sistema.

---

## Instalação técnica

### Experimente a demonstração

A página pública tem briefing fictício narrado, holograma em Canvas e envio de texto em modo demonstrativo. Clique em **Ligar som** e, em seguida, em **Mostrar briefing de exemplo**. No site público, **Gravar pergunta** verifica se o navegador reconhece português no dispositivo. Se ele oferecer o idioma, use **Baixar português para o microfone** e tente novamente. Permita o acesso ao microfone, fale e clique em **Parar e transcrever**. Se o recurso não estiver disponível, use a instalação local ou digite. A ponte abaixo usa reconhecimento local próprio e permite revisar a transcrição antes de enviar.

### Ligue a ponte local

Use [Python 3.10 ou mais recente](https://www.python.org/downloads/), [Git](https://git-scm.com/install/) e um navegador atual. Abra um terminal (PowerShell no Windows, Terminal no macOS ou Linux), vá até a pasta onde guarda seus projetos e cole o bloco abaixo. No Windows, troque `python3` por `py -3` se necessário.

```bash
git clone https://github.com/inematds/painel-de-voz.git
cd painel-de-voz
python3 bridge.py
```

Abra `http://127.0.0.1:8765/app/`. A faixa abaixo do título deve dizer “Ponte local · respostas de demonstração”. Digite “Olá” e envie. Nesse modo a ponte devolve o texto recebido. Para ouvir e transcrever localmente, instale `faster-whisper` e `piper-tts` no seu ambiente Python e tenha um modelo multilíngue do faster-whisper e uma voz Piper em português no disco. Os comandos abaixo instalam os pacotes e baixam, uma vez, o modelo multilíngue `base` para transcrição e a voz brasileira Faber. Depois disso, a ponte lê os arquivos no disco. Pare a ponte anterior com Ctrl+C antes de iniciar a versão com voz.

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install faster-whisper piper-tts
python -c "from faster_whisper.utils import download_model; download_model('base')"
python -m piper.download_voices pt_BR-faber-medium
python bridge.py --whisper-model base --piper-model pt_BR-faber-medium.onnx
```

Quem já tem o ambiente do inemavox com faster-whisper pode usar aquele Python e o modelo em cache, por exemplo `--whisper-model base`. No Windows, crie o ambiente com `py -3 -m venv .venv` e ative-o com `.venv\Scripts\Activate.ps1`. Linux foi o sistema de teste.

## O processo, do início ao fim

1. **Conecte o Intelecto v2**. Com a ponte parada, baixe o Intelecto v2 ao lado do projeto. Use a linha com os parâmetros de voz se você baixou os modelos acima.

   ```bash
   git clone https://github.com/inematds/intelecto-v2.git ../intelecto-v2
   python3 bridge.py --intelecto ../intelecto-v2
   python3 bridge.py --intelecto ../intelecto-v2 --whisper-model base --piper-model pt_BR-faber-medium.onnx
   ```

   O comando usa o motor simulado do Intelecto. Para conversar com um modelo de IA, abra o Ollama, rode `ollama list` em outro terminal e copie um nome da coluna `NAME`. Pare a ponte com Ctrl+C e execute a mesma linha acrescentando `--intelecto-model NOME-DO-MODELO-LOCAL`, com o nome copiado no lugar do marcador. A conversa passa pelo Ollama em `127.0.0.1:11434`. O adaptador mantém estado próprio em `~/.painel-de-voz/intelecto` e abre a conversa com um registro vazio de ferramentas. A memória direta do Intelecto pode guardar pedidos como “lembre que…”.

2. **Experimente voz**. Abra o painel local, clique em **Gravar pergunta**, permita o microfone, fale e clique em **Parar e transcrever**. Revise e envie. Com o som ligado, o Piper lê a resposta em português. A ponte toca até 3.000 caracteres por resposta.
   Ative “Enviar automaticamente após transcrever” para enviar a fala assim que o texto estiver pronto. Com a opção desligada, você pode revisar o texto e clicar em Enviar. No seletor Visual, escolha Robô, Mulher-robô ou Rosto 3D. O Rosto 3D é uma malha humana iluminada que muda de perspectiva ao virar a cabeça. A onda e o núcleo também estão no mesmo seletor. A onda mostra o sinal real do microfone e do áudio reproduzido pelo painel. O núcleo pulsa com o áudio. A boca dos avatares só se move quando o assistente responde com áudio reproduzido pelo painel.

   No Rosto 3D, o texto da resposta sugere formatos para os lábios e o áudio reproduzido guia a abertura. O encaixe das formas no tempo da fala é aproximado.

   Escolha quem fala no seletor Voz e clique em Ouvir amostra. A demonstração oferece Faber e Edresson. Na ponte local, aparecem as vozes Piper que você configurou e as vozes em português instaladas no navegador.

   Para fazer um pedido longo, clique em Gravar pergunta e encerre em Parar e transcrever. Cada pedido pode durar até três minutos. Pausas curtas não encerram a gravação manual.

   Para conversar sem apertar o botão a cada pedido, ligue a Escuta contínua e o envio automático. Após cerca de três segundos de silêncio, o painel envia o pedido e volta a ouvir depois de responder. Com envio automático desligado, ele aguarda a revisão. Use Desligar escuta contínua para fechar o microfone.

   Para oferecer duas vozes Piper, baixe Faber e Edresson e repita a opção --piper-model na linha que inicia a ponte. Consulte o exemplo abaixo.

   ```bash
   python -m piper.download_voices pt_BR-faber-medium pt_BR-edresson-low
   python bridge.py --whisper-model base --piper-model pt_BR-faber-medium.onnx --piper-model pt_BR-edresson-low.onnx
   ```

   [Piper · Faber](https://huggingface.co/rhasspy/piper-voices/tree/main/pt/pt_BR/faber) · [Piper · Edresson](https://huggingface.co/rhasspy/piper-voices/blob/main/pt/pt_BR/edresson/low/MODEL_CARD)

3. **Conecte outro assistente**. A opção `--adapter` vem por último e recebe o executável e seus argumentos fixos. A cada turno, o processo recebe um JSON em stdin e devolve um JSON em stdout. Use stderr para diagnóstico e trate `session` como identificador para reusar o histórico. A ponte impõe 85 segundos por turno.

   ```bash
   python3 bridge.py --adapter python3 adapters/briefing.py adapters/agenda-exemplo.json
   ```

   Peça “me dê o briefing da agenda”. Depois troque o horário em `adapters/agenda-exemplo.json` e repita. Esse é um exemplo de plugin independente, com leitura de arquivo.

   | Entrada | Saída |
   |---|---|
   | `{"session":"uuid","text":"me dê o briefing"}` | `{"reply":"Bom dia. Sua agenda tem dois compromissos."}` |

O processo do adaptador roda com as permissões de quem inicia a ponte. Configure apenas um executável que você já conhece. O painel público não encaminha áudio ao serviço local. A ponte aceita conexões apenas em loopback e exige a origem local nos pedidos. O painel mede o áudio do briefing e das respostas reproduzidas pela ponte local. A leitura pela voz do navegador pode tocar sem que o painel tenha acesso ao sinal.

## Baseado em Mark-LVII

O [Mark-LVII de FatihMakes](https://github.com/FatihMakes/Mark-LVII) é a fonte de inspiração e análise. O painel foi implementado separadamente. O [estudo das peças isoláveis](docs/ANALISE-MARK-LVII.md) inclui briefing, rotinas, verificação de citações, tarefas que retomam, confirmações e dicas para ligar novos adaptadores.

[MediaPipe canonical face model](https://github.com/google-ai-edge/mediapipe/blob/61827c737472301b00078c3a70bf0815c2964a33/mediapipe/modules/face_geometry/data/canonical_face_model.obj) · [Apache License 2.0](docs/LICENSE-MEDIAPIPE.txt)
