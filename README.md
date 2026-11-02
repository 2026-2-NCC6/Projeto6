# Projeto Interdisciplinar (IoT e Robótica) - 🫂 NockHug
---

## 🏫 FECAP - Fundação Escola de Comércio Álvares Penteado

<p align="center">
<a href= "https://www.fecap.br/"><img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRhZPrRa89Kma0ZZogxm0pi-tCn_TLKeHGVxywp-LXAFGR3B1DPouAJYHgKZGV0XTEf4AE&usqp=CAU" alt="FECAP - Fundação de Comércio Álvares Penteado" border="25.0px"></a>
</p>

---

## 👨‍💻 Integrantes: [André dos Santos](https://www.linkedin.com/in/andr%C3%A9-dos-santos-greg%C3%B3rio-025a402ba/), [Guilherme Fogolin](https://www.linkedin.com/in/guilhermefogolin/), [Pedro Lemos](https://www.linkedin.com/in/pedrohnlemos/) e [Yan Cezareto](https://www.linkedin.com/in/yan-cezareto-792ba22b8/)

## 👨‍🏫 Professores orientadores: [Edson Barbero](https://www.linkedin.com/in/edsonbarbero/), [João Trencher](https://www.linkedin.com/in/trencher/), [Kátia Bossi](https://www.linkedin.com/in/katia-bossi/), [Rodnil Lisboa](https://www.linkedin.com/in/professorrodnil/) e [Victor Rosetti](https://www.linkedin.com/in/victorbarq/)

---

## Descrição

<p align="center">
  <img src="imagens/logo-nockhug.png" alt="Logo do NockHug: uma bola de tênis sorrindo que abraça a si mesma" width="240">
</p>

O **NockHug** é uma lançadora de bolas controlada **pela voz do praticante**, pelo celular. Quem treina com uma lançadora está em quadra, com a raquete na mão, e para pausar ou ajustar a máquina precisa largar o treino e atravessar a quadra. Com o NockHug, basta dizer a palavra de ativação seguida do comando: *"Nock, liga"*, *"Nock, pausa"*, *"Nock, retoma"*, *"desliga"*. A palavra de emergência *"Para!"* funciona a qualquer momento, sem palavra de ativação.

O projeto é parte do tema **Smart Tennis Arena** (treinos gamificados de tênis com IoT, robótica e integração), em parceria com a Smart Tennis. Ele tem duas partes:

- **A lançadora**: um ESP32 que comanda dois motores, a roda que arremessa a bola (14 000 RPM) e a base giratória que alimenta o cano (20 RPM). Ela recebe comandos por **Wi-Fi** (Access Point próprio) ou **Bluetooth Low Energy**, e para os motores sozinha se ficar 3 segundos sem notícias do app.
- **O app mobile** (Android e iOS): prepara cada sessão com um checklist de segurança, reconhece a voz, conta as bolas estimadas de cada série, mantém um botão de parada de emergência sempre à mão e transforma cada treino em progresso visível (XP, níveis, sequência de dias e conquistas). Funciona sem internet e guarda tudo no próprio aparelho.

A segurança vem antes de tudo: a lançadora só aceita "liga" depois que o checklist a **arma**, e parar é sempre mais fácil que ligar.

## 📦 Entregas

| Unidade curricular | Entrega 01 | Entrega 02 |
|--------------------|------------|------------|
| Projeto Interdisciplinar: IoT e Robótica | [Proposta técnica e backlog](documentos/Entrega01/PI_IoT_Robotica/Entrega01_PI_IoT_Robotica.pdf) | [Em andamento](documentos/Entrega02/PI_IoT_Robotica) |
| Sistemas Embarcados e Robótica | [Montagem e testes do circuito](documentos/Entrega01/Sistemas_Embarcados_Robotica/Entrega01_Sistemas_Embarcados_Robotica.pdf) | [Em andamento](documentos/Entrega02/Sistemas_Embarcados_Robotica) |
| Teoria da Computação e Linguagens Formais | [Modelagem formal do controle por voz](documentos/Entrega01/Teoria_Computacao/Entrega01_Teoria_da_Computa%C3%A7%C3%A3o.pdf) | [Em andamento](documentos/Entrega02/Teoria_Computacao) |
| Redes de Computadores e Cibersegurança | [Relatório de vulnerabilidades](documentos/Entrega01/Redes_Ciberseguranca/Entrega01_Redes_Ciberseguranca.pdf) | [Em andamento](documentos/Entrega02/Redes_Ciberseguranca) |
| Inovação e Empreendedorismo | [Análise da oportunidade](documentos/Entrega01/Inovacao_Empreendedorismo/Entrega01_Inova%C3%A7%C3%A3o_Empreendedorismo.pdf) | [Em andamento](documentos/Entrega02/Inovacao_Empreendedorismo) |

Código-fonte por entrega:

- [**Entrega 01**](src/Entrega01): firmware do ESP32 com controle por voz no navegador, senha forte no Access Point e token exigido para acionar os motores.
- [**Entrega 02**](src/Entrega02): firmware v2 (máquina de estados com trava, Wi-Fi e Bluetooth ao mesmo tempo, watchdog e calibração) e o app mobile. O passo a passo detalhado está no [README da Entrega 02](src/Entrega02/README.md).

## 🛠 Estrutura de pastas

```
Projeto6/
├── README.md
├── documentos/                  entregas em PDF, por entrega e por unidade curricular
│   ├── Entrega01/
│   └── Entrega02/
├── imagens/                     imagens do projeto (logo)
└── src/
    ├── Entrega01/
    │   ├── main.ino             firmware da Entrega 01
    │   └── segredos.exemplo.h   modelo das credenciais da lançadora
    └── Entrega02/
        ├── README.md            como gravar o firmware, contrato HTTP/BLE e roteiro de testes
        ├── main.ino             firmware v2
        ├── segredos.exemplo.h   modelo das credenciais da lançadora
        └── app/                 app mobile (React Native + Expo)
```

Estrutura do app mobile:

```
app/
├── app.json             configuração do Expo (nome, ícones, permissões)
├── assets/              ícone, splash e logo
├── DESIGN.md            sistema visual: paleta, tipografia e movimento
└── src/
    ├── app/             telas e navegação (Expo Router)
    │   ├── onboarding/      primeiro acesso, em 7 passos
    │   ├── (abas)/          Início, Treinos, Histórico e Conquistas
    │   ├── sessao/          checklist de segurança e a sessão por voz
    │   ├── resultado/       resultado de cada sessão
    │   └── …                parada segura, configurações, perfil, calibração e conexão
    ├── dominio/         regras puras e testadas: vocabulário de voz, gamificação e treinos
    ├── lancadora/       contrato com a lançadora e os transportes Wi-Fi, Bluetooth e simulado
    ├── voz/             reconhecimento de fala e o fluxo de comandos da sessão
    ├── sessao/          a sessão em andamento: trava, séries, descanso e registro de comandos
    ├── dados/           banco local (SQLite) e token guardado no cofre seguro do aparelho
    ├── estado/          perfil, configurações e progresso em memória
    ├── telas/           partes de tela reaproveitadas
    └── ui/              tema claro e escuro, componentes, ícones e animações
```

## 🛠 Instalação

### Lançadora (ESP32)

1. Copie `segredos.exemplo.h` para `segredos.h`, na mesma pasta do `main.ino`, e defina a senha do Access Point e o token. O `segredos.h` não vai para o repositório.
2. Abra o `main.ino` na Arduino IDE com a placa **ESP32 Dev Module**.
3. O firmware v2 usa Wi-Fi e Bluetooth ao mesmo tempo e não cabe na partição padrão: em **Ferramentas → Partition Scheme**, escolha **Huge APP (3MB No OTA/1MB SPIFFS)**.
4. Grave na placa. A lançadora cria a rede `ESP32_Voz_Direta` e responde em `http://192.168.4.1`.

### App mobile

O app ainda não é distribuído pelas lojas. Para instalar, gere o app a partir do código (próxima seção). Para conhecer o app sem a lançadora, use **Conectar → Simulada**: uma lançadora de software com as mesmas regras, sem acionar motor nenhum.

## 💻 Configuração para Desenvolvimento

Ferramentas necessárias:

- [Node.js](https://nodejs.org/) 22.13 ou mais recente
- [Xcode](https://developer.apple.com/xcode/) e [CocoaPods](https://cocoapods.org/) para iOS
- [Android Studio](https://developer.android.com/studio) com JDK 17 ou 21 para Android
- [Arduino IDE](https://www.arduino.cc/en/software) ou [arduino-cli](https://arduino.github.io/arduino-cli/) com o core ESP32 da Espressif, para o firmware

O app usa Bluetooth e reconhecimento de fala nativos, por isso **não roda no Expo Go**: é preciso gerar um *development build*.

```sh
cd src/Entrega02/app
npm install
npx expo run:ios          # simulador ou iPhone conectado
npx expo run:android      # emulador ou Android com depuração USB
```

Testes e verificações:

```sh
npm test                  # regras de voz, gamificação e máquina de estados
npm run typecheck
npm run lint
```

## 📋 Licença

NockHug © 2026 by André Gregório dos Santos, Guilherme Reis Fogolin de Godoy, Pedro Henrique Nascimento Lemos, Yan Cezareto Ramos is licensed under CC BY-NC-ND 4.0

## 🎓 Referências

1. [Expo](https://docs.expo.dev/) e [Expo Router](https://docs.expo.dev/router/introduction/)
2. [React Native](https://reactnative.dev/)
3. [React Native Reanimated](https://docs.swmansion.com/react-native-reanimated/)
4. [expo-speech-recognition](https://github.com/jamsch/expo-speech-recognition)
5. [react-native-ble-plx](https://github.com/dotintent/react-native-ble-plx)
6. [Arduino core para ESP32 (Espressif)](https://docs.espressif.com/projects/arduino-esp32/)
7. [Bricolage Grotesque (Google Fonts)](https://fonts.google.com/specimen/Bricolage+Grotesque)
8. [Web Speech API (MDN)](https://developer.mozilla.org/docs/Web/API/Web_Speech_API), usada no controle por voz da Entrega 01
