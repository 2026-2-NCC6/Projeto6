# Entregas do PI
### **DECLARAÇÃO DE USO DE INTELIGÊNCIA ARTIFICIAL**

## Entrega 1
<br><br>

### Módulo do sistema 1 — Firmware do ESP32 (`src/Entrega01/`)

| **Aluno(s) Responsável(veis)** | **[A CONFIRMAR: integrante(s) que usaram a ferramenta]** |
| :--- | :--- |
| **Ferramenta utilizada** | Gemini |
| **Versão/modelo** | Gemini 3.8 Flash |
| **Disciplina / Trabalho** | PI: IoT e Robótica — Entrega 01 (firmware do ESP32) |
| **Finalidade de uso** | Geração de código do firmware do ESP32 (controle dos dois motores, ponto de acesso Wi-Fi e página de controle por voz). |
| ***Prompts* principais utilizados** | Não preservados: a equipe não guardou os comandos usados com esta ferramenta. |
| **Trechos ou entregas afetadas** | src/Entrega01/main.ino (versão original do firmware, antes das mitigações de segurança). |

<br>

| **Aluno(s) Responsável(veis)** | **[A CONFIRMAR: integrante(s) que usaram a ferramenta]** |
| :--- | :--- |
| **Ferramenta utilizada** | Gemini |
| **Versão/modelo** | Gemini 3.8 Flash |
| **Disciplina / Trabalho** | Sistemas Embarcados — Entrega 01 (montagem e testes de circuitos básicos) |
| **Finalidade de uso** | Geração de código para o Arduino IDE: firmware do ESP32 e sketch de varredura de PWM. |
| ***Prompts* principais utilizados** | Não preservados: a equipe não guardou os comandos usados com esta ferramenta. |
| **Trechos ou entregas afetadas** | src/Entrega01/main.ino e o sketch de varredura de PWM (pwm_sweep_test.ino, arquivo de bancada, não versionado neste repositório). |

<br>

| **Aluno(s) Responsável(veis)** | Pedro Henrique Nascimento Lemos |
| :--- | :--- |
| **Ferramenta utilizada** | Claude (Claude Code) |
| **Versão/modelo** | Claude Opus 5.5 (claude-opus-5-5) |
| **Disciplina / Trabalho** | Redes e Cibersegurança — Entrega 01 (publicação das mitigações no repositório) |
| **Finalidade de uso** | Preparação do firmware da Entrega 01 para o repositório público: senha do ponto de acesso e token saem do código versionado e passam a ficar em segredos.h (fora do git), com segredos.exemplo.h como modelo, e o .gitignore passa a barrar chaves e certificados. As mitigações em si (senha forte, token exigido em /ligar e /desligar, HTTP 401 sem token) foram implementadas em 22/09/2026; **[A CONFIRMAR: ferramenta usada nessa implementação.]** |
| ***Prompts* principais utilizados** | “Pode fazer o commit e push antes. Confira se nenhuma key/credencial/secret/etc, estará nos commits, altere o .gitignore se necessário” (29/10/2026). |
| **Trechos ou entregas afetadas** | src/Entrega01/main.ino, src/Entrega01/segredos.exemplo.h e .gitignore (commit fde1170, com trailer Co-Authored-By: Claude Opus 5.5). |

## Entrega 2
<br><br>

### Módulo do sistema 1 — Firmware v2 do ESP32 (`src/Entrega02/main.ino`)

| **Aluno(s) Responsável(veis)** | Pedro Henrique Nascimento Lemos |
| :--- | :--- |
| **Ferramenta utilizada** | Claude (Claude Code) |
| **Versão/modelo** | Claude Opus 5.5 (claude-opus-5-5) |
| **Disciplina / Trabalho** | PI: IoT e Robótica — Entrega 02 (aplicativo e firmware v2) |
| **Finalidade de uso** | Implementação e revisão do firmware v2 do ESP32 (até a versão 2.3.0), com apoio à depuração com o ESP32. |
| ***Prompts* principais utilizados** | “Design aprovado. Pode começar o firmware v2 e o app.” (23/10). “Usando skills de design, impeccable, claude motion, animations […] melhore TODAS as telas do meu app, sem exceção.” (29/10, com a paleta de cores definida pelo grupo). “Eu havia pedido para uma LLM implementar novas funcionalidades e corrigir outras pré-existentes, porém, não gostei do resultado […]. Revise tudo que foi feito e garanta agora que será de fato implementado.” (30/10, com a lista de 8 ajustes do grupo). “Agora substitua o template padrão que ta no README.md do repositorio […]” (29/10). |
| **Trechos ou entregas afetadas** | src/Entrega02/main.ino (firmware v2, até a versão 2.3.0). Commits 8f601d8 e fde1170 (trailer Co-Authored-By: Claude Opus 5.5). |

<br>

| **Aluno(s) Responsável(veis)** | **[A CONFIRMAR: integrante(s) que usaram a ferramenta]** |
| :--- | :--- |
| **Ferramenta utilizada** | DeepSeek |
| **Versão/modelo** | DeepSeek V4.1 Flash |
| **Disciplina / Trabalho** | PI: IoT e Robótica — Entrega 02 (firmware v2 e aplicativo) |
| **Finalidade de uso** | Apoio na escrita e na revisão do código do firmware v2 e do aplicativo. |
| ***Prompts* principais utilizados** | Não preservados: a equipe não guardou os comandos usados com esta ferramenta. |
| **Trechos ou entregas afetadas** | **[A CONFIRMAR: quais arquivos ou trechos de src/Entrega02/ foram afetados.]** |

<br>

| **Aluno(s) Responsável(veis)** | Pedro Henrique Nascimento Lemos (Claude). **[A CONFIRMAR: integrante(s) que usaram o DeepSeek]** |
| :--- | :--- |
| **Ferramenta utilizada** | Claude (Claude Code) e DeepSeek |
| **Versão/modelo** | Claude Opus 5.5 (claude-opus-5-5) e DeepSeek V4.1 Flash |
| **Disciplina / Trabalho** | Sistemas Embarcados — Entrega 02 (firmware v2) |
| **Finalidade de uso** | Apoio na escrita e na revisão do código do firmware v2 do ESP32 (máquina de estados, Wi-Fi e Bluetooth, watchdog, calibração). |
| ***Prompts* principais utilizados** | Claude Opus 5.5: ver o registro em PI: IoT e Robótica, Entrega 02. DeepSeek V4.1 Flash: comandos não preservados. |
| **Trechos ou entregas afetadas** | src/Entrega02/main.ino e Apêndice A do relatório (código comentado). |

<br>

| **Aluno(s) Responsável(veis)** | **[A CONFIRMAR: integrante(s) que usaram a ferramenta]** |
| :--- | :--- |
| **Ferramenta utilizada** | Cursor |
| **Versão/modelo** | Grok 4.7 |
| **Disciplina / Trabalho** | Redes e Cibersegurança — Entrega 02 (firmware 2.4.0) |
| **Finalidade de uso** | Implementação do firmware 2.4.0 a partir do plano de respostas: limite de comandos por segundo, respostas 401 e 429 sem efeito nos motores, contadores de negação e nomes de rede Quadra-Local e Quadra-XXXX. |
| ***Prompts* principais utilizados** | **[A CONFIRMAR: prompt principal. O histórico do chat no Cursor guarda os comandos.]** |
| **Trechos ou entregas afetadas** | src/Entrega02/main.ino (versão 2.4.0). |

### Módulo do sistema 2 — Aplicativo móvel (`src/Entrega02/app/`)

| **Aluno(s) Responsável(veis)** | Pedro Henrique Nascimento Lemos |
| :--- | :--- |
| **Ferramenta utilizada** | Claude (Claude Code) |
| **Versão/modelo** | Claude Opus 5.5 (claude-opus-5-5) |
| **Disciplina / Trabalho** | PI: IoT e Robótica — Entrega 02 (aplicativo e firmware v2) |
| **Finalidade de uso** | Implementação e revisão do aplicativo móvel (telas, voz, Wi-Fi e Bluetooth, sessão, gamificação, testes automatizados, módulo nativo de escuta com a tela apagada) e da identidade visual; apoio à depuração nos celulares. |
| ***Prompts* principais utilizados** | “Design aprovado. Pode começar o firmware v2 e o app.” (23/10). “Usando skills de design, impeccable, claude motion, animations […] melhore TODAS as telas do meu app, sem exceção.” (29/10, com a paleta de cores definida pelo grupo). “Eu havia pedido para uma LLM implementar novas funcionalidades e corrigir outras pré-existentes, porém, não gostei do resultado […]. Revise tudo que foi feito e garanta agora que será de fato implementado.” (30/10, com a lista de 8 ajustes do grupo). “Agora substitua o template padrão que ta no README.md do repositorio […]” (29/10). |
| **Trechos ou entregas afetadas** | src/Entrega02/app/ (aplicativo completo e módulo nockhug-nativo). Commits 8f601d8 e fde1170 (trailer Co-Authored-By: Claude Opus 5.5). |

<br>

| **Aluno(s) Responsável(veis)** | **[A CONFIRMAR: integrante(s) que usaram a ferramenta]** |
| :--- | :--- |
| **Ferramenta utilizada** | DeepSeek |
| **Versão/modelo** | DeepSeek V4.1 Flash |
| **Disciplina / Trabalho** | PI: IoT e Robótica — Entrega 02 (firmware v2 e aplicativo) |
| **Finalidade de uso** | Apoio na escrita e na revisão do código do firmware v2 e do aplicativo. |
| ***Prompts* principais utilizados** | Não preservados: a equipe não guardou os comandos usados com esta ferramenta. |
| **Trechos ou entregas afetadas** | **[A CONFIRMAR: quais arquivos ou trechos de src/Entrega02/ foram afetados.]** |

<br>

| **Aluno(s) Responsável(veis)** | **[A CONFIRMAR: integrante(s) que usaram a ferramenta]** |
| :--- | :--- |
| **Ferramenta utilizada** | **[A CONFIRMAR PELA EQUIPE]** |
| **Versão/modelo** | **[A CONFIRMAR]** |
| **Disciplina / Trabalho** | PI: IoT e Robótica — Entrega 02 (primeira implementação dos 8 ajustes do aplicativo, 30/10/2026) |
| **Finalidade de uso** | O grupo pediu a outra LLM que implementasse oito ajustes no aplicativo (descanso editável, retomada automática, mensagens de erro e reset, bips antes dos motores, voz com a tela apagada, criação de treino por botão, velocidade do treino). O resultado foi considerado incompleto e foi refeito e revisado pelo Claude Opus 5.5 (registro anterior). |
| ***Prompts* principais utilizados** | Lista de 8 ajustes redigida pelo grupo. **[A CONFIRMAR: ferramenta e versão usadas.]** |
| **Trechos ou entregas afetadas** | src/Entrega02/app/ (parte substituída pela revisão do Claude Opus 5.5). |

### Módulo do sistema 3 — Plataforma mãe (site e API) (`src/Entrega02/plataforma/`)

| **Aluno(s) Responsável(veis)** | **[A CONFIRMAR: integrante(s) que usaram a ferramenta]** |
| :--- | :--- |
| **Ferramenta utilizada** | Cursor |
| **Versão/modelo** | Grok 4.7 |
| **Disciplina / Trabalho** | PI: IoT e Robótica — Entrega 02 (plataforma mãe: site, API e banco) |
| **Finalidade de uso** | Criação da plataforma mãe (site e API de publicação de treinos e de sincronização das sessões) e da especificação correspondente. |
| ***Prompts* principais utilizados** | **[A CONFIRMAR: prompt principal. O histórico do chat no Cursor guarda os comandos.]** |
| **Trechos ou entregas afetadas** | src/Entrega02/plataforma/ (site e API); especificação e ADR 0006 (arquivos de bancada, não versionados neste repositório). |

***Declaro que o uso acima descrito está em conformidade com o GUIA PARA O USO RESPONSÁVEL DE
INTELIGÊNCIA ARTIFICIAL NA FECAP e que o conteúdo final é de minha plena responsabilidade
autoral.***
