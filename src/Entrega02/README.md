# Entrega 02 — NockHug: app mobile + firmware v2

Lançadora de bolas controlada por voz pelo celular. O app fala com o ESP32 por **Wi-Fi** (Access Point + HTTP) ou por **Bluetooth Low Energy**, e guarda perfil, histórico e progresso no próprio aparelho.

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
- **Watchdog:** com 3 s sem sinal do app durante o disparo, os motores param (`PAUSADO`, motivo `conexao_perdida`).
- **Rampa no `loop()`:** o servidor deixou de ficar bloqueado por 765 ms, e um "desligar" durante a aceleração é atendido na hora.
- **Calibração persistente:** `calibrar?msPorBola=M` grava na NVS (`Preferences`), junto com o duty do alimentador em que foi medida.
- **Velocidade por treino (2.1.0):** `ligar` aceita o duty de cada motor (`lancador`, `alimentador`, de 10 a 255). Sem eles, vale o duty da Entrega 01: lançador 100/255 no GPIO26 e alimentador 25/255 no GPIO25. Com o alimentador em outro duty, o tempo por bola escala na proporção inversa da calibração (aproximação: o motor com redução não é perfeitamente linear).
- **BLE:** serviço GATT `4e4f434b-4855-4700-8000-00000000a001`, com uma característica de comando (`…a002`, *write*, texto `token|operacao|argumento`) e uma de status (`…a003`, *read* + *notify*, JSON). No `ligar`, o argumento leva a velocidade: `10,l:100,a:25`.
- **Status em JSON** nos dois transportes, com `seq` e `resultado` para o app casar cada resposta com o comando enviado.

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

### Contrato HTTP (Access Point `ESP32_Voz_Direta`, `http://192.168.4.1`)

| Rota | Efeito |
|------|--------|
| `GET /status` | Status em JSON (sem token) |
| `GET /ping?token=` | Renova o watchdog |
| `GET /armar` · `/desarmar` | `REPOUSO ⇄ ARMADO` |
| `GET /ligar?bolas=N` · `?duracaoMs=M`, opcional `&lancador=D&alimentador=D` | `ARMADO → LANCANDO` (`N=0` = livre; duty de 10 a 255) |
| `GET /desligar` | `LANCANDO`/`PAUSADO → ARMADO` |
| `GET /pausar` · `/retomar` | `LANCANDO ⇄ PAUSADO` |
| `GET /emergencia` | Qualquer estado → `PARADA_SEGURA` |
| `GET /reiniciar` | `PARADA_SEGURA → REPOUSO` |
| `GET /calibrar?msPorBola=M` | Grava `msPorBola` (300 a 20 000) |

As respostas são **200** quando o comando é aceito, **401** com token errado, **409** quando o estado não aceita o comando e **400** para argumento inválido. Todas trazem o JSON de status.

Teste rápido no terminal, com o computador conectado ao AP:

```bash
TOKEN="o-token-do-seu-segredos.h"
curl "http://192.168.4.1/armar?token=$TOKEN"
curl "http://192.168.4.1/ligar?token=$TOKEN&bolas=3"
curl "http://192.168.4.1/status"
```

> Durante um `ligar` via `curl`, o watchdog para os motores em 3 s se nada mais chegar. Para testar mais tempo, mande `/ping?token=…` em laço.

---

## 2. App mobile

**Stack:** Expo SDK 58 (React Native 0.88, TypeScript), Expo Router, `expo-speech-recognition` (reconhecedor nativo; no aparelho quando falta internet), `expo-speech` (retorno falado), `react-native-ble-plx` (BLE), `expo-sqlite` (dados locais), `expo-secure-store` (token), Zustand, Reanimated e `react-native-svg`.

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
npm test             # domínio: voz, gamificação e máquina de estados (36 testes)
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

### Testes com a lançadora real

Roteiro para o Galaxy S25 e o iPhone 16 Pro, em cada transporte:

1. **Conectar:** Wi-Fi (celular na rede `ESP32_Voz_Direta`) e depois Bluetooth (busca → `NockHug-XXXX`).
2. **Trava:** sem checklist, "Nock, liga" é recusado; depois de armar, liga.
3. **N bolas:** no treino Aquecimento (10 bolas), a lançadora para sozinha e o app abre o descanso.
4. **Voz:** "Nock, liga" · "Nock" … "pausa" · "Nock, retoma" · "desliga" sem "Nock" (deve ser ignorado) · "Para!" (parada segura).
5. **Emergência:** o botão Parar tudo vai para `PARADA_SEGURA`; nada liga até segurar o reinício por 2 s.
6. **Watchdog:** com a série rodando, desligue o Wi-Fi/Bluetooth do celular. Os motores param em até 3 s.
7. **Offline:** em modo avião + Wi-Fi do ESP32, a voz deve cair para o reconhecimento no aparelho.
8. **Calibração:** Configurações → Calibrar. Conte as bolas em 30 s e grave.
