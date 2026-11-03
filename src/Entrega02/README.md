# Entrega 02 — NockHug: app mobile + firmware v2

Lançadora de bolas controlada por voz pelo celular. O app fala com o ESP32 por **Wi-Fi** (Access Point + HTTP) ou por **Bluetooth Low Energy**, e guarda perfil, histórico e progresso no próprio aparelho. A plataforma mãe (site, API e banco) está em [`plataforma/README.md`](plataforma/README.md): o autor publica o treino no site, o app baixa o catálogo quando tem internet e devolve a sessão encerrada. Na quadra, a sessão não espera a nuvem.

| Pasta / arquivo | O que é |
|-----------------|---------|
| `main.ino` | Firmware v2 do ESP32 (Wi-Fi + BLE, máquina de estados, watchdog, calibração) |
| `app/` | App mobile em React Native + Expo (Android e iOS) |

O comportamento esperado de ponta a ponta está no PRD da equipe (máquina de estados, vocabulário de voz e contrato app ↔ lançadora).

---

## 1. Firmware v2

### O que mudou em relação à Entrega 01

- **Estados com trava:** `REPOUSO → ARMADO → LANCANDO ⇄ PAUSADO`, e `PARADA_SEGURA` absorvente. `ligar` só é aceito em `ARMADO`, e a regra vale no firmware, não só no app.
- **N bolas:** `ligar?bolas=N`. A lançadora estima as bolas pelo tempo (`msPorBola`) e para sozinha ao chegar em N.
- **Watchdog (4 s):** sem sinal do app durante o disparo, os motores param (`PAUSADO`, motivo `conexao_perdida`). O app manda `ping` a cada 750 ms e não pula o heartbeat.
- **Rampa no `loop()`:** o servidor deixou de ficar bloqueado por 765 ms, e um "desligar" durante a aceleração é atendido na hora.
- **Calibração persistente:** `calibrar?msPorBola=M` grava na NVS (`Preferences`), junto com o duty do alimentador em que foi medida.
- **Velocidade por treino (2.1.0 / 2.2.0):** `ligar` aceita o duty de cada motor (`lancador`, `alimentador`). O app manda 0–255; o firmware aceita o lançador a partir de 0 (o app permite 0% como “só alimenta”, sem contar bolas) e prende o alimentador entre 10/255 e 102/255 (40%, o mesmo teto do app). O app trabalha em %: Forte = 60/30, Médio = 40/25, Fraco = 30/20; Personalizado vai de 0 a 100% no lançador e de 15 a 40% no alimentador. Com o alimentador em outro duty, o tempo por bola escala na proporção inversa da calibração (aproximação: o motor com redução não é perfeitamente linear).
- **Reset atômico (2.3.0):** `resetar` leva a lançadora de `ARMADO`, `LANCANDO` ou `PAUSADO` para `REPOUSO` com os motores zerados numa só requisição. É o “Resetar lançadora” do app: antes, o reparo dependia de três idas e voltas (`status`, `desligar`, `desarmar`), e qualquer uma que falhasse deixava a máquina no meio do caminho. Não sai de `PARADA_SEGURA` (isso continua exigindo o reinício de 2 s). Com firmware anterior, o app reconhece a recusa e faz o caminho longo. Rotas desconhecidas agora respondem 400 com o JSON de status (antes, um 404 em texto).
- **Limite por operação (2.4.0):** `armar`, `desarmar`, `ligar`, `retomar`, `calibrar`, `resetar` e `reiniciar` aceitam um comando por segundo, cada uma com o próprio relógio. A repetição em menos de 1 s responde **429**, com `resultado` e `erro` `"limite"`: sobe `seq` (senão o BLE não vê o ack) e não mexe em motor, NVS nem no instante do último aceite. `status`, `ping`, `emergencia`, `pausar` e `desligar` nunca tomam 429. Operação válida com token errado continua **401** e não altera `seq`, diagnóstico, estado nem relógio; operação inexistente sem token válido responde **400** com a mesma regra (rota desconhecida entra aqui). O status ganhou `negados`, `negadosJanela` (quantos nos últimos 60 s), `ultimoNegadoVia` e `ultimoNegadoMs`, só em RAM. O Access Point se chama `Quadra-Local` e o BLE anuncia `Quadra-XXXX`; o app segue filtrando a busca pelo UUID do serviço.
- **Diagnóstico de recusa (2.2.0):** o status ganhou `op` (último comando, sem contar `status`/`ping`) e `erro` (`token`, `estado:PAUSADO`, `parametro`). Esses campos não são apagados por um `ping`/`status`, então o app consegue dizer *por que* um `armar` foi recusado. `msPorBolaAtual()` ganhou proteção contra divisão por zero, a NVS é validada na abertura e o firmware escapa o JSON e recusa operações fora da lista conhecida. `calibrar` aceita `a:DUTY` explícito, para a calibração não depender do último `ligar`.
- **BLE:** serviço GATT `4e4f434b-4855-4700-8000-00000000a001`, com uma característica de comando (`…a002`, *write*, texto `token|operacao|argumento`) e uma de status (`…a003`, *read* + *notify*, JSON). No `ligar`, o argumento leva a velocidade: `10,l:100,a:25`. O MTU é 517 nos dois lados: com `op`/`erro` o JSON passa de 244 B e não caberia no MTU antigo. A emergência tem um caminho prioritário no `onWrite`, à frente de um comando pendente, e o app a confirma lendo `PARADA_SEGURA`.
- **Status em JSON** nos dois transportes, com `seq` para o app casar cada resposta, `resultado`, `op` e `erro` para o diagnóstico.

### Gravar no ESP32

**Credenciais:** a senha do Access Point e o token não ficam no repositório (ele é público). Antes de compilar, copie `segredos.exemplo.h` para `segredos.h`, na mesma pasta do `main.ino`, e preencha os valores. O `segredos.h` está no `.gitignore`. O token que você escolher é o mesmo que se digita no app.

O firmware usa Wi-Fi e BLE ao mesmo tempo e **não cabe na partição padrão** (1,69 MB). Use o esquema **Huge APP**.

**Arduino IDE:** Placa *ESP32 Dev Module* → Ferramentas → Partition Scheme → *Huge APP (3MB No OTA/1MB SPIFFS)*.

**arduino-cli** (o sketch precisa estar numa pasta com o mesmo nome do `.ino`):

```bash
mkdir -p /tmp/nockhug/main && cp main.ino segredos.h /tmp/nockhug/main/
arduino-cli compile --fqbn esp32:esp32:esp32:PartitionScheme=huge_app /tmp/nockhug/main
arduino-cli upload -p /dev/cu.usbserial-XXXX --fqbn esp32:esp32:esp32:PartitionScheme=huge_app /tmp/nockhug/main
arduino-cli monitor -p /dev/cu.usbserial-XXXX -c baudrate=115200
```

Testado com o core `esp32:esp32@3.3.12`.

### Contrato HTTP (Access Point `Quadra-Local`, `http://192.168.4.1`)

| Rota | Efeito |
|------|--------|
| `GET /status` | Status em JSON (sem token) |
| `GET /ping?token=` | Renova o watchdog |
| `GET /armar` · `/desarmar` | `REPOUSO ⇄ ARMADO` |
| `GET /ligar?bolas=N` · `?duracaoMs=M`, opcional `&lancador=D&alimentador=D` | `ARMADO → LANCANDO` (`N=0` = livre; duty do lançador 0–255 e do alimentador 10–255; o app usa 15–40% no alimentador) |
| `GET /desligar` | `LANCANDO`/`PAUSADO → ARMADO` |
| `GET /pausar` · `/retomar` | `LANCANDO ⇄ PAUSADO` |
| `GET /emergencia` | Qualquer estado → `PARADA_SEGURA` |
| `GET /reiniciar` | `PARADA_SEGURA → REPOUSO` |
| `GET /resetar` | `ARMADO`/`LANCANDO`/`PAUSADO → REPOUSO`, motores zerados (2.3+) |
| `GET /calibrar?msPorBola=M&alimentador=D` | Grava `msPorBola` (300 a 20 000) e o duty do alimentador em que foi medido |

As respostas são **200** quando o comando é aceito, **401** com token errado numa operação válida (o JSON continua o do último resultado legítimo; `seq` e o estado não mudam), **409** quando o estado não aceita o comando, **400** para argumento inválido ou operação inexistente sem token válido, e **429** quando a mesma operação limitada se repete em menos de 1 s. Todas trazem o JSON de status, inclusive `negados`, `negadosJanela`, `ultimoNegadoVia` e `ultimoNegadoMs` a partir do 2.4.0.

Teste rápido no terminal, com o computador conectado ao AP:

```bash
TOKEN="o-token-do-seu-segredos.h"
curl "http://192.168.4.1/armar?token=$TOKEN"
curl "http://192.168.4.1/ligar?token=$TOKEN&bolas=3&lancador=102&alimentador=64"
curl "http://192.168.4.1/status"
```

> Durante um `ligar` via `curl`, o watchdog para os motores em 4 s se nada mais chegar. Para testar mais tempo, mande `/ping?token=…` em laço.

---

## 2. App mobile

**Stack:** Expo SDK 58 (React Native 0.88, TypeScript), Expo Router, `expo-speech-recognition` (reconhecedor nativo; no aparelho quando falta internet), `expo-speech` (retorno falado), `expo-audio` (bips), `react-native-ble-plx` (BLE), `expo-sqlite` (dados locais), `expo-secure-store` (token), Zustand, Reanimated e `react-native-svg`.

O app **não roda no Expo Go**: BLE e reconhecimento de fala exigem *development build*.

Requisitos do ambiente:

- **Android:** JDK 17 ou 21. O Gradle não aceita JDK mais novo (erro `Unsupported class file major version`). O JDK que vem com o Android Studio serve: `export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"`.
- **iOS:** CocoaPods precisa de terminal em UTF-8 (`export LANG=en_US.UTF-8`).

```bash
cd app
npm install
npx expo run:ios                 # simulador ou iPhone conectado (Xcode)
npx expo run:android             # Galaxy com depuração USB ligada
npx expo run:ios --device        # escolhe o iPhone físico
```

Verificações:

```bash
npm test             # domínio, descanso, voz, falhas e máquina de estados (128 testes)
npm run typecheck
npx eslint src
```

### Estrutura

```
app/src/
├── app/            rotas (Expo Router): onboarding/, (abas)/, sessao/, parada, resultado/[id], configurações…
├── dominio/        regras puras e testadas: vocabulário de voz, gamificação, treinos, tipos
├── lancadora/      contrato, transportes Wi-Fi / BLE / simulado, cliente com heartbeat
├── voz/            reconhecedor trocável (nativo hoje) e o hook da sessão
├── sessao/         a sessão em andamento: trava, registro de comandos, séries e descanso
├── dados/          repositório SQLite (local-first) e token no cofre do aparelho
├── estado/         perfil, configurações, sessões e progresso em memória
├── telas/          partes de tela reaproveitadas
└── ui/             tema, componentes, ícones e a ilustração animada da lançadora
```

### Lançadora simulada

Em **Conectar → Simulada**, o app usa uma lançadora de software com a mesma máquina de estados do firmware: N bolas, watchdog, emergência e calibração. Serve para desenvolver sem o ESP32 e como reserva na apresentação. Nenhum motor é acionado.

### O que mudou nesta versão (pedidos da equipe)

| Pedido | Onde está |
|---|---|
| Alterar o descanso na sessão | `src/app/sessao/index.tsx` (`AjusteDescanso`) — ±5 s sempre visível na quadra, durante a série e no descanso; vale para a sessão |
| Editar treinos existentes | `src/app/(abas)/treinos.tsx` → lápis em cada linha → `src/app/treino/[id].tsx` |
| Retomar sozinho no fim do descanso | `src/sessao/sessao.ts` agenda a `partida` para o fim do descanso; `src/sessao/usePartida.ts` dispara. Cancela com “Nock, desliga”/“Nock, para” |
| Erros de “não armou” com motivo e reset | `src/lancadora/falhas.ts`, `src/telas/CartaoFalha.tsx`, `src/lancadora/manutencao.ts` (`resetar` do firmware 2.3), `src/telas/DiagnosticoLancadora.tsx`; no Android, `src/lancadora/wifi.ts` prende o app ao Wi-Fi da lançadora |
| Bips 5 s antes dos motores | **Toda** partida (“liga”, botão, “retoma”, fim do descanso, calibração) passa por uma contagem de 5 s com um bip por segundo e um bip longo no zero: `src/dominio/partida.ts`, `src/sessao/usePartida.ts`, `src/audio/` |
| Voz com a tela apagada e pelo fone | iOS: `UIBackgroundModes` `audio` + `bluetooth-central`. Android: módulo nativo `modules/nockhug-nativo` (serviço em primeiro plano do tipo microfone, wake lock, Wi-Fi em baixa latência, microfone do fone Bluetooth via SCO). Ligado em `src/voz/useVoz.ts` |
| Emergência em qualquer tela | `src/telas/EmergenciaFlutuante.tsx` (fora da sessão) + botão próprio no checklist |
| Encerrar só com motores parados | `src/sessao/sessao.ts` (`encerrar` confirma ARMADO/REPOUSO/PARADA_SEGURA; senão fica na sessão) |
| Velocidade Forte/Médio/Fraco/Personalizado | `src/dominio/velocidade.ts` + `src/telas/SeletorVelocidade.tsx` |
| Velocidade fora das Configurações e obrigatória nos prontos | `src/app/configuracoes.tsx` + `src/app/sessao/checklist.tsx` (define na primeira sessão de cada treino) |
| Criar treino num sheet | `src/app/treino/[id].tsx` + `src/telas/FormTreino.tsx` |

**Voz com a tela apagada:** no iPhone funciona com `UIBackgroundModes: audio` (a sessão `playAndRecord` do reconhecedor mantém o app vivo), `bluetooth-central` (BLE com o app em segundo plano) e o Wi-Fi persistente. No Android, desde a versão 11 o microfone só grava em segundo plano com um serviço em primeiro plano do tipo *microphone*; sem ele o reconhecedor recebia silêncio, o heartbeat parava e o watchdog pausava os motores (uma das origens do “não armou” na sessão seguinte). O módulo local `modules/nockhug-nativo` cria esse serviço quando o microfone liga na sessão (notificação “NockHug está ouvindo”), segura a CPU e o Wi-Fi em baixa latência e solta tudo ao desligar o microfone ou sair da sessão.

**Fone de ouvido:** com um fone Bluetooth, o iOS usa o microfone dele sozinho (`allowBluetooth`); no Android o app liga o canal SCO (`setCommunicationDevice`). Fone com fio ou USB-C vale nos dois. A sessão mostra por onde está ouvindo (“pelo fone Bluetooth …”).

**Wi-Fi no Android:** a rede `Quadra-Local` não tem internet; com os dados móveis ligados, o Android mandava as requisições do app pela rede celular e todas estouravam o tempo. O app agora se prende ao Wi-Fi enquanto a lançadora está conectada (`bindProcessToNetwork`). O reconhecimento de voz do Google roda em outro processo e continua com internet.

**Depois de puxar esta versão:** o `app.json` mudou e há um módulo nativo novo. Rode `npx expo prebuild --clean` e refaça o build (`npx expo run:ios`/`run:android`). Um reload do Metro não carrega o módulo novo. Depois do `prebuild --clean`, recrie `android/local.properties` (`sdk.dir=$HOME/Library/Android/sdk`) e, no iOS, rode o `pod install` com `LANG=en_US.UTF-8`.

### Testes com a lançadora real

Roteiro para o Galaxy S25 e o iPhone 16 Pro, em cada transporte:

1. **Conectar:** Wi-Fi (celular na rede `Quadra-Local`) e depois Bluetooth (busca → `Quadra-XXXX`).
2. **Trava:** sem checklist, "Nock, liga" é recusado; depois de armar, liga.
3. **Velocidade obrigatória:** na primeira sessão de Aquecimento/Resistência/Livre, o botão Armar fica travado até escolher Forte, Médio, Fraco ou Personalizado. A escolha persiste no treino.
4. **N bolas:** no treino Aquecimento (10 bolas), a lançadora para sozinha e o app abre o descanso.
5. **Contagem antes de ligar:** diga "Nock, liga" (ou toque em Ligar): a tela mostra 5 → 1 com um bip por segundo e só no bip longo os motores ligam. Durante a contagem, "Nock, desliga" cancela. Repita com "Nock, pausa" → "Nock, retoma".
5b. **Retomada automática:** no descanso, os 5 bips tocam nos últimos 5 s; no fim, os motores ligam sozinhos. Repita e, durante o descanso, diga "Nock, desliga" (ou "Nock, para"): a retomada é cancelada e nada liga. Diga só "Para!" sem a palavra: deve ser parada segura.
6. **Descanso ajustável:** durante a série, mude o descanso no −/+ da quadra; o próximo descanso usa o tempo novo. No descanso, o anel acompanha. "Pular descanso" leva direto à contagem de 5 s.
7. **Editar treino:** Treinos → lápis em Aquecimento → mude bolas/descanso/velocidade → Salvar. Toque no treino e confirme que a sessão usa os novos valores. Em um treino pronto, "Restaurar o padrão" devolve o original.
8. **Voz:** "Nock, liga" · "Nock" … "pausa" · "Nock, retoma" · "desliga" sem "Nock" (deve ser ignorado) · "Para!" (parada segura).
9. **Emergência:** o botão Parar tudo vai para `PARADA_SEGURA`; nada liga até segurar o reinício por 2 s.
10. **Watchdog:** com a série rodando, desligue o Wi-Fi/Bluetooth do celular. Os motores param em até 4 s.
11. **Erro e reset:** com a lançadora ligada/pausada de uma sessão anterior, toque em Armar. O app deve resetar sozinho e armar; em Configurações → Lançadora, "Resetar lançadora" faz o mesmo a qualquer momento; se não conseguir, o cartão mostra o motivo e o detalhe técnico. O diagnóstico em Configurações → Lançadora lista `op`, `resultado`, `erro`, `fw`, `seq` e latência.
12. **Offline:** em modo avião + Wi-Fi `Quadra-Local`, a voz deve cair para o reconhecimento no aparelho.
13. **Encerrar sem parada confirmada:** simule uma perda de conexão durante a série e toque em encerrar; o app deve permanecer na sessão com o cartão "Não confirmei a parada" e o botão vermelho, nunca ir para o resultado com os motores possivelmente girando.
14. **Tela apagada:** numa sessão armada, com o microfone ligado, bloqueie o celular e diga "Nock, liga": os bips tocam e os motores ligam. No Android, a notificação "NockHug está ouvindo" aparece; confira no log serial que o `ping` continua chegando (o watchdog não pode pausar). Repita com um fone Bluetooth: a sessão mostra "pelo fone Bluetooth".
15. **Calibração:** Configurações → Calibrar. Escolha a velocidade, conte as bolas em 30 s e grave; o duty escolhido vai junto no `calibrar`.
