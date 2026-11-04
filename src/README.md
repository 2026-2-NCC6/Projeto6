# Entregas do PI
### **DECLARAÇÃO DE USO DE INTELIGÊNCIA ARTIFICIAL**

## Entrega 1
<br><br>

### Módulo do sistema 1 — Firmware do ESP32 (`src/Entrega01/`)

| **Aluno(s) Responsável(veis)** | Pedro Henrique Nascimento Lemos |
| :--- | :--- |
| **Ferramenta utilizada** | Gemini |
| **Versão/modelo** | Gemini 3.8 Flash |
| **Disciplina / Trabalho** | Firmware do ESP32 — Entrega 01 (Projeto Interdisciplinar: IoT e Robótica e Sistemas Embarcados e Robótica) |
| **Finalidade de uso** | Geração do firmware do ESP32 para o Arduino IDE: controle dos dois motores, ponto de acesso Wi-Fi e página de controle por voz. O mesmo código atende às duas disciplinas. Também foi gerado o sketch de varredura de PWM, usado na bancada. |
| ***Prompts* principais utilizados** | Os comandos não foram preservados. |
| **Trechos ou entregas afetadas** | src/Entrega01/main.ino. O sketch pwm_sweep_test.ino ficou na bancada e não está versionado neste repositório. |

## Entrega 2
<br><br>

### Módulo do sistema 1 — Firmware v2 do ESP32 (`src/Entrega02/main.ino`)

| **Aluno(s) Responsável(veis)** | Pedro Henrique Nascimento Lemos |
| :--- | :--- |
| **Ferramenta utilizada** | Claude (Claude Code) e DeepSeek |
| **Versão/modelo** | Claude Opus 5.5 (claude-opus-5-5) e DeepSeek V4.1 Flash |
| **Disciplina / Trabalho** | Firmware v2 do ESP32 — Entrega 02 (Projeto Interdisciplinar: IoT e Robótica e Sistemas Embarcados e Robótica) |
| **Finalidade de uso** | Implementação e revisão do firmware v2 (máquina de estados, Wi-Fi e Bluetooth, watchdog e calibração), com apoio à depuração no ESP32. O DeepSeek apoiou a escrita e a revisão do mesmo código. |
| ***Prompts* principais utilizados** | Claude: “Design aprovado. Pode começar o firmware v2 e o app.” (23/10/2026). DeepSeek: os comandos não foram preservados. |
| **Trechos ou entregas afetadas** | src/Entrega02/main.ino (firmware v2, até a versão 2.3.0). Commits 8f601d8 e fde1170, com trailer Co-Authored-By: Claude Opus 5.5. |

### Módulo do sistema 2 — Aplicativo móvel (`src/Entrega02/app/`)

| **Aluno(s) Responsável(veis)** | Pedro Henrique Nascimento Lemos |
| :--- | :--- |
| **Ferramenta utilizada** | Claude (Claude Code) e DeepSeek |
| **Versão/modelo** | Claude Opus 5.5 (claude-opus-5-5) e DeepSeek V4.1 Flash |
| **Disciplina / Trabalho** | Aplicativo móvel — Entrega 02 (Projeto Interdisciplinar: IoT e Robótica) |
| **Finalidade de uso** | Implementação e revisão do aplicativo (telas, voz, Wi-Fi e Bluetooth, sessão, gamificação, testes automatizados, módulo nativo de escuta com a tela apagada) e da identidade visual, com apoio à depuração nos celulares. O DeepSeek apoiou a escrita e a revisão do mesmo código. |
| ***Prompts* principais utilizados** | “Design aprovado. Pode começar o firmware v2 e o app.” (23/10/2026). “Usando skills de design, impeccable, claude motion, animations […] melhore TODAS as telas do meu app, sem exceção.” (29/10/2026, com a paleta de cores definida pelo grupo). “Eu havia pedido para uma LLM implementar novas funcionalidades e corrigir outras pré-existentes, porém, não gostei do resultado […]. Revise tudo que foi feito e garanta agora que será de fato implementado.” (30/10/2026, com a lista de 8 ajustes do grupo). DeepSeek: os comandos não foram preservados. |
| **Trechos ou entregas afetadas** | src/Entrega02/app/ (aplicativo completo e módulo nockhug-nativo). Commits 8f601d8 e fde1170, com trailer Co-Authored-By: Claude Opus 5.5. |

### Módulo do sistema 3 — Plataforma mãe (site e API) (`src/Entrega02/plataforma/`)

| **Aluno(s) Responsável(veis)** | Pedro Henrique Nascimento Lemos |
| :--- | :--- |
| **Ferramenta utilizada** | Cursor |
| **Versão/modelo** | Grok 4.7 |
| **Disciplina / Trabalho** | Plataforma mãe (site e API) — Entrega 02 (Projeto Interdisciplinar: IoT e Robótica) |
| **Finalidade de uso** | Criação da plataforma mãe, com o site e a API de publicação de treinos e de sincronização das sessões, e da especificação correspondente. |
| ***Prompts* principais utilizados** | Os comandos estão preservados no histórico do chat do Cursor. |
| **Trechos ou entregas afetadas** | src/Entrega02/plataforma/ (site e API). A especificação e o ADR 0006 ficaram na bancada e não estão versionados neste repositório. |

***Declaro que o uso acima descrito está em conformidade com o GUIA PARA O USO RESPONSÁVEL DE
INTELIGÊNCIA ARTIFICIAL NA FECAP e que o conteúdo final é de minha plena responsabilidade
autoral.***
