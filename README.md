# Painel de Voz

[![Painel de Voz](guia/assets/banner.jpg)](https://inematds.github.io/painel-de-voz/guia/)

**Português · [English](README.en.md) · [Español](README.es.md)**

## O que é

O Painel de Voz é uma interface para quem já usa ou quer montar um assistente pessoal como o Intelecto. Ele reúne microfone, transcrição editável, conversa e um núcleo holográfico que acompanha o estado do atendimento. Você pode abrir o briefing de exemplo no navegador ou instalar a ponte local para conversar com seu agente. A ideia foi inspirada no Mark-LVII, de FatihMakes.

[Abrir painel](https://inematds.github.io/painel-de-voz/app/) · [Guia](https://inematds.github.io/painel-de-voz/guia/) · [Análise de plugins](docs/ANALISE-MARK-LVII.md)

> Leia o README deste projeto e descubra qual assistente eu já uso. Explique como ligar o Painel de Voz a ele e como testar a gravação local. Mostre o que pretende alterar e aguarde minha aprovação antes de mexer no meu sistema.

---

## Instalação técnica

### Experimente a demonstração

A página pública tem briefing fictício narrado, holograma em Canvas e envio de texto em modo demonstrativo. Ative **Som desligado** e, em seguida, **Mostrar briefing de exemplo**. A captura no site público exige um navegador com reconhecimento local em português instalado. A ponte abaixo usa reconhecimento local próprio e permite revisar a transcrição antes de enviar.

### Ligue a ponte local

Use Python 3.10+ e um navegador atual. Clone o projeto, abra a pasta e execute:

```bash
python3 bridge.py
```

Abra `http://127.0.0.1:8765/app/`. Nesse modo a ponte devolve o texto recebido. Para ouvir e transcrever localmente, instale `faster-whisper` e `piper-tts` no seu ambiente Python e tenha um modelo multilíngue do faster-whisper e uma voz Piper em português no disco. A ponte carrega o Whisper apenas do cache ou do caminho indicado. O arquivo ONNX do Piper precisa do respectivo `.onnx.json` ao lado.

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install faster-whisper piper-tts
python bridge.py --whisper-model /caminho/whisper --piper-model /caminho/voz.onnx
```

Quem já tem o ambiente do inemavox com faster-whisper pode usar aquele Python e o modelo em cache, por exemplo `--whisper-model base`. Em Windows, ative o ambiente com `.venv\Scripts\Activate.ps1`. Linux foi o sistema de teste.

## O processo, do início ao fim

1. **Conecte o Intelecto v2**. Tenha o checkout dele ao lado e acrescente os parâmetros de voz acima quando quiser gravar e ouvir.

   ```bash
   python3 bridge.py --intelecto ../intelecto-v2
   python3 bridge.py --intelecto ../intelecto-v2 --intelecto-model NOME-DO-MODELO-LOCAL
   ```

   Use um dos comandos. O primeiro usa o motor simulado do Intelecto. O segundo conversa pelo Ollama em `127.0.0.1:11434` e precisa de um modelo já disponível. O adaptador mantém estado próprio em `~/.painel-de-voz/intelecto` e abre a conversa com um registro vazio de ferramentas. A memória direta do Intelecto pode guardar pedidos como “lembre que…”.

2. **Experimente voz**. Abra o painel local, clique em **Gravar pergunta**, permita o microfone, fale e clique em **Parar e transcrever**. Revise e envie. Com o som ligado, o Piper lê a resposta em português. Grave comandos de até 30 segundos. A ponte toca até 3.000 caracteres por resposta.

3. **Conecte outro assistente**. A opção `--adapter` vem por último e recebe o executável e seus argumentos fixos. A cada turno, o processo recebe um JSON em stdin e devolve um JSON em stdout. Use stderr para diagnóstico e trate `session` como identificador para reusar o histórico. A ponte impõe 85 segundos por turno.

   ```bash
   python3 bridge.py --adapter python3 adapters/briefing.py adapters/agenda-exemplo.json
   ```

   Peça “me dê o briefing da agenda”. Depois troque o horário em `adapters/agenda-exemplo.json` e repita. Esse é um exemplo de plugin independente, com leitura de arquivo.

   | Entrada | Saída |
   |---|---|
   | `{"session":"uuid","text":"me dê o briefing"}` | `{"reply":"Bom dia. Sua agenda tem dois compromissos."}` |

O processo do adaptador roda com as permissões de quem inicia a ponte. Configure apenas um executável que você já conhece. O painel público não encaminha áudio ao serviço local. A ponte aceita conexões apenas em loopback e exige a origem local nos pedidos. O núcleo e a onda representam estados da conversa. Os movimentos não são uma medição da amplitude do áudio.

## Baseado em Mark-LVII

O [Mark-LVII de FatihMakes](https://github.com/FatihMakes/Mark-LVII) é a fonte de inspiração e análise. O painel foi implementado separadamente. O [estudo das peças isoláveis](docs/ANALISE-MARK-LVII.md) inclui briefing, rotinas, verificação de citações, tarefas que retomam, confirmações e dicas para ligar novos adaptadores.
