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

A página pública tem briefing fictício narrado, holograma em Canvas e envio de texto em modo demonstrativo. Clique em **Ligar som** e, em seguida, em **Mostrar briefing de exemplo**. A captura no site público exige um navegador com reconhecimento local em português instalado. A ponte abaixo usa reconhecimento local próprio e permite revisar a transcrição antes de enviar.

### Ligue a ponte local

Use Python 3.10+, Git e um navegador atual. Baixe o projeto, abra a pasta e execute:

```bash
git clone https://github.com/inematds/painel-de-voz.git
cd painel-de-voz
python3 bridge.py
```

Abra `http://127.0.0.1:8765/app/`. Nesse modo a ponte devolve o texto recebido. Para ouvir e transcrever localmente, instale `faster-whisper` e `piper-tts` no seu ambiente Python e tenha um modelo multilíngue do faster-whisper e uma voz Piper em português no disco. Os comandos abaixo instalam os pacotes e baixam, uma vez, o modelo multilíngue `base` para transcrição e a voz brasileira Faber. Depois disso, a ponte lê os arquivos no disco. Pare a ponte anterior com Ctrl+C antes de iniciar a versão com voz.

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install faster-whisper piper-tts
python -c "from faster_whisper.utils import download_model; download_model('base')"
python -m piper.download_voices pt_BR-faber-medium
python bridge.py --whisper-model base --piper-model pt_BR-faber-medium.onnx
```

Quem já tem o ambiente do inemavox com faster-whisper pode usar aquele Python e o modelo em cache, por exemplo `--whisper-model base`. Em Windows, ative o ambiente com `.venv\Scripts\Activate.ps1`. Linux foi o sistema de teste.

## O processo, do início ao fim

1. **Conecte o Intelecto v2**. Com a ponte parada, baixe o Intelecto v2 ao lado do projeto. Use a linha com os parâmetros de voz se você baixou os modelos acima.

   ```bash
   git clone https://github.com/inematds/intelecto-v2.git ../intelecto-v2
   python3 bridge.py --intelecto ../intelecto-v2 --whisper-model base --piper-model pt_BR-faber-medium.onnx
   ```

   O comando usa o motor simulado do Intelecto. Para conversar com um modelo de IA, acrescente `--intelecto-model NOME-DO-MODELO-LOCAL`. A conversa passa pelo Ollama em `127.0.0.1:11434` e precisa de um modelo já disponível. O adaptador mantém estado próprio em `~/.painel-de-voz/intelecto` e abre a conversa com um registro vazio de ferramentas. A memória direta do Intelecto pode guardar pedidos como “lembre que…”.

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
