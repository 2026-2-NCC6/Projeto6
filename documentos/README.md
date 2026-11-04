# Entregas do PI
### **DECLARAÇÃO DE USO DE INTELIGÊNCIA ARTIFICIAL**

## Entrega 1
<br><br>

### Disciplina 1 — Projeto Interdisciplinar: IoT e Robótica

| **Aluno(s) Responsável(veis)** | Pedro Henrique Nascimento Lemos |
| :--- | :--- |
| **Ferramenta utilizada** | Claude, Gemini e DeepSeek |
| **Versão/modelo** | Claude Sonnet 5; Gemini 3.8 Flash; DeepSeek V4.1 Flash |
| **Disciplina / Trabalho** | Projeto Interdisciplinar: IoT e Robótica — Entrega 01 |
| **Finalidade de uso** | Claude: redação e diagramação do relatório, com revisão humana, e derivação do Product Backlog (5 épicos e 21 histórias) a partir dos requisitos RF01 a RF23. Gemini: geração do firmware do ESP32 (controle dos dois motores, ponto de acesso Wi-Fi e página de controle por voz). DeepSeek: geração das imagens do circuito virtual. As decisões de arquitetura, escopo e priorização são da equipe. |
| ***Prompts* principais utilizados** | Claude: o registro das sessões de setembro não está disponível; o pedido foi redigir o relatório a partir da especificação da equipe e transformar os requisitos do enunciado em histórias de usuário. Gemini e DeepSeek: os comandos não foram preservados. |
| **Trechos ou entregas afetadas** | Claude: Entrega01_PI_IoT_Robotica.pdf (texto) e backlog.csv. As figuras 1 a 4 foram geradas por script do grupo (generate_pi_diagrams.py), a partir de especificação da equipe. Gemini: src/Entrega01/main.ino (versão original do firmware). DeepSeek: imagens do circuito da Entrega 01, exceto a Figura 3 do relatório de Sistemas Embarcados, criada com o Gemini 3.8 Flash. |

### Disciplina 2 — Sistemas Embarcados e Robótica

| **Aluno(s) Responsável(veis)** | Pedro Henrique Nascimento Lemos |
| :--- | :--- |
| **Ferramenta utilizada** | Gemini, Claude e DeepSeek |
| **Versão/modelo** | Gemini 3.8 Flash; Claude Sonnet 5; DeepSeek V4.1 Flash |
| **Disciplina / Trabalho** | Sistemas Embarcados e Robótica — Entrega 01 |
| **Finalidade de uso** | Gemini: geração de código para o Arduino IDE (firmware do ESP32 e sketch de varredura de PWM). Claude: redação do relatório, com revisão humana. DeepSeek: geração das imagens e dos demais detalhes do circuito virtual. |
| ***Prompts* principais utilizados** | Gemini e DeepSeek: os comandos não foram preservados. Claude: o registro das sessões de setembro não está disponível; o pedido foi redigir o relatório a partir do circuito e dos testes da equipe. |
| **Trechos ou entregas afetadas** | Gemini: src/Entrega01/main.ino, o sketch pwm_sweep_test.ino (arquivo de bancada) e a Figura 3 do relatório. Claude: Entrega01_Sistemas_Embarcados_NockHug.pdf (texto). DeepSeek: imagens e detalhes do circuito virtual, exceto a Figura 3, criada com o Gemini 3.8 Flash. |

### Disciplina 3 — Teoria da Computação e Linguagens Formais

| **Aluno(s) Responsável(veis)** | [preencher] |
| :--- | :--- |
| **Ferramenta utilizada** | [preencher] |
| **Versão/modelo** | [preencher] |
| **Disciplina / Trabalho** | [preencher] |
| **Finalidade de uso** | [preencher] |
| ***Prompts* principais utilizados** | [preencher] |
| **Trechos ou entregas afetadas** | [preencher] |


### Disciplina 4 — Redes de Computadores e Cibersegurança

| **Aluno(s) Responsável(veis)** | Yan Ramos Cezareto |
| :--- | :--- |
| **Ferramenta utilizada** | Claude (Claude Code) e ChatGPT (OpenAI) |
| **Versão/modelo** | Claude Opus 5.5 (claude-opus-5-5); ChatGPT GPT-6 |
| **Disciplina / Trabalho** | Redes de Computadores e Cibersegurança — Entrega 01 |
| **Finalidade de uso** | **Claude Opus 5.5:** preparação do firmware da Entrega 01 para publicação no repositório público, separando a senha do Access Point e o token em `segredos.h` (fora do Git), criando `segredos.exemplo.h` e ajustando o `.gitignore` para impedir o versionamento de credenciais. As mitigações iniciais de segurança foram implementadas em 22/09/2026, mas a ferramenta utilizada nessa implementação não foi confirmada. **ChatGPT GPT-6:** apoio à redação e revisão de partes do Relatório de Vulnerabilidades, abrangendo a descrição da arquitetura do ESP32, a identificação e análise dos riscos V1–V8, a classificação de probabilidade e impacto e a documentação dos controles iniciais de segurança, com revisão humana. |
| ***Prompts* principais utilizados** | **Claude Opus 5.5:** "Pode fazer o commit e push antes. Confira se nenhuma key/credencial/secret/etc, estará nos commits, altere o .gitignore se necessário" (29/10/2026). **ChatGPT GPT-6:** solicitações para auxiliar na redação e revisão do relatório, descrever a arquitetura do protótipo, organizar as vulnerabilidades V1–V8 e apresentar os controles de segurança iniciais. Os pedidos do ChatGPT estão sintetizados, não transcritos literalmente. |
| **Trechos ou entregas afetadas** | **Claude Opus 5.5:** `src/Entrega01/main.ino`, `src/Entrega01/segredos.exemplo.h` e `.gitignore` (commit `fde1170`). **ChatGPT GPT-6:** `Entrega01_Redes_Ciberseguranca.pdf`, incluindo trechos sobre a arquitetura do sistema, metodologia de análise, registro das vulnerabilidades V1–V8, matriz de probabilidade e impacto e controles de segurança iniciais. |


### Disciplina 5 — Inovação e Empreendedorismo

| **Aluno(s) Responsável(veis)** | [preencher] |
| :--- | :--- |
| **Ferramenta utilizada** | [preencher] |
| **Versão/modelo** | [preencher] |
| **Disciplina / Trabalho** | [preencher] |
| **Finalidade de uso** | [preencher] |
| ***Prompts* principais utilizados** | [preencher] |
| **Trechos ou entregas afetadas** | [preencher] |

## Entrega 2
<br><br>

### Disciplina 1 — Projeto Interdisciplinar: IoT e Robótica

| **Aluno(s) Responsável(veis)** | Pedro Henrique Nascimento Lemos |
| :--- | :--- |
| **Ferramenta utilizada** | Claude (Claude Code), DeepSeek e Cursor |
| **Versão/modelo** | Claude Opus 5.5 (claude-opus-5-5); Claude Sonnet 5.5 (claude-sonnet-5-5); DeepSeek V4.1 Flash; Grok 4.7 (Cursor) |
| **Disciplina / Trabalho** | Projeto Interdisciplinar: IoT e Robótica — Entrega 02 |
| **Finalidade de uso** | Claude: levantamento de requisitos e registro em PRD, glossário e registros de decisão, com as decisões tomadas pelo grupo; implementação e revisão do aplicativo móvel (telas, voz, Wi-Fi e Bluetooth, sessão, gamificação, testes automatizados e escuta com a tela apagada), do firmware v2 do ESP32 e da identidade visual, com apoio à depuração; atualização do README do repositório; preenchimento do Documento de Projeto de Extensão e elaboração desta declaração e dos README de documentos/ e src/. DeepSeek: apoio na escrita e na revisão do firmware v2 e do aplicativo. Cursor: criação da plataforma mãe (site, API e banco) e da especificação correspondente. O grupo leu, testou e ajustou o material antes de incorporá-lo às entregas. |
| ***Prompts* principais utilizados** | Claude: “PRD do produto todo. Não precisa mais do site, será apenas app mobile.” (22/10/2026, seguido das respostas do grupo). “Design aprovado. Pode começar o firmware v2 e o app.” (23/10/2026). “Usando skills de design, impeccable, claude motion, animations […] melhore TODAS as telas do meu app, sem exceção.” (29/10/2026, com a paleta de cores definida pelo grupo). “Eu havia pedido para uma LLM implementar novas funcionalidades e corrigir outras pré-existentes, porém, não gostei do resultado […]. Revise tudo que foi feito e garanta agora que será de fato implementado.” (30/10/2026, com a lista de 8 ajustes do grupo). “Agora substitua o template padrão que ta no README.md do repositorio […]” (29/10/2026). “Preciso que com base no projeto aqui desse semestre meu e de meus colegas da faculdade, voce preencha esse documento: Projeto_Extensão.docx” (03/11/2026), junto com o comunicado dos professores sobre a Declaração de Uso de IA e o Guia FECAP. DeepSeek: os comandos não foram preservados. Cursor (Grok 4.7): os comandos estão preservados no histórico do chat da ferramenta. |
| **Trechos ou entregas afetadas** | Claude: PRD, glossário e ADRs 0001 a 0005 (arquivos de bancada); src/Entrega02/main.ino (firmware v2, até a versão 2.3.0); src/Entrega02/app/; README.md do repositório (commits 8f601d8 e fde1170, com trailer Co-Authored-By: Claude Opus 5.5); Projeto_Extensão_NockHug.docx; Declaracao_de_Uso_de_IA.docx; README.md de documentos/ e de src/. DeepSeek: firmware v2 e aplicativo em src/Entrega02/. Cursor: src/Entrega02/plataforma/ (site e API); especificação e ADR 0006 (arquivos de bancada). |

### Disciplina 2 — Sistemas Embarcados e Robótica

| **Aluno(s) Responsável(veis)** | Pedro Henrique Nascimento Lemos |
| :--- | :--- |
| **Ferramenta utilizada** | Claude (Claude Code) e DeepSeek |
| **Versão/modelo** | Claude Sonnet 5.5 (claude-sonnet-5-5); Claude Opus 5.5 (claude-opus-5-5); DeepSeek V4.1 Flash |
| **Disciplina / Trabalho** | Sistemas Embarcados e Robótica — Entrega 02 |
| **Finalidade de uso** | Claude Sonnet 5.5: redação do relatório a partir do código-fonte e da documentação do projeto, com revisão humana, e geração das figuras por script. Claude Opus 5.5 e DeepSeek: apoio na escrita e na revisão do firmware v2 do ESP32 (máquina de estados, Wi-Fi e Bluetooth, watchdog e calibração). |
| ***Prompts* principais utilizados** | Claude Sonnet 5.5: “Para a entrega 2 de Sistemas Embarcado e Robótica, o que eu preciso fazer?” (01/11/2026). “[…] conversei com o professor e ele disse que não precisa necessariamente de um sensor. Mas que quer um relatório bem completo, com detalhes do sistema, dos motores, da protoboard, do esp, de tudo. Você consegue me ajudar com isso?” (01/11/2026, com as fotos do grupo). Claude Opus 5.5: os prompts do firmware v2 constam na tabela de Projeto Interdisciplinar: IoT e Robótica. DeepSeek: os comandos não foram preservados. |
| **Trechos ou entregas afetadas** | Claude Sonnet 5.5: Entrega02_Sistemas_Embarcados_NockHug.pdf e .docx (texto e quadros); figuras 1 a 4 e 7 a 9, geradas por script (generate_se_figuras.py); a numeração das Figuras 5 e 6 foi sobreposta por script às fotos do grupo. Claude Opus 5.5 e DeepSeek: src/Entrega02/main.ino e o Apêndice A do relatório. |

### Disciplina 3 — Teoria da Computação e Linguagens Formais

| **Aluno(s) Responsável(veis)** | [preencher] |
| :--- | :--- |
| **Ferramenta utilizada** | [preencher] |
| **Versão/modelo** | [preencher] |
| **Disciplina / Trabalho** | [preencher] |
| **Finalidade de uso** | [preencher] |
| ***Prompts* principais utilizados** | [preencher] |
| **Trechos ou entregas afetadas** | [preencher] |


### Disciplina 4 — Redes de Computadores e Cibersegurança

| **Aluno(s) Responsável(veis)** | Yan Ramos Cezareto |
| :--- | :--- |
| **Ferramenta utilizada** | Claude (Claude Code), Cursor e ChatGPT (OpenAI) |
| **Versão/modelo** | Claude Sonnet 5.5 (claude-sonnet-5-5); Cursor (Grok 4.7); ChatGPT GPT-6 |
| **Disciplina / Trabalho** | Redes de Computadores e Cibersegurança — Entrega 02 |
| **Finalidade de uso** | **Claude Sonnet 5.5:** revisão crítica do Plano de Respostas aos Riscos, verificando a coerência do conteúdo, o atendimento ao enunciado e possíveis inconsistências em relação ao código-fonte, produzindo um parecer separado sem alterar diretamente o relatório. **Cursor (Grok 4.7):** apoio à implementação do firmware 2.4.0 do ESP32, incluindo limitação de comandos, respostas HTTP 401 e 429, contadores de comandos recusados e configurações de identificação da rede. **ChatGPT GPT-6:** auxílio na elaboração, estruturação e revisão do Plano de Respostas aos Riscos com base no Relatório de Vulnerabilidades da Entrega 01 e no modelo disponibilizado pelo professor, abrangendo introdução, tabela de riscos V1–V8, oportunidade OPP-001, estratégias de resposta e monitoramento. As informações foram revisadas para distinguir controles implementados de ações planejadas. |
| ***Prompts* principais utilizados** | **Claude Sonnet 5.5:** "Preciso revisar a entrega do meu colega, revise para mim." (02/11/2026); solicitação de avaliação do documento conforme o enunciado da disciplina, verificando escrita, coerência e atendimento às exigências do professor. **Cursor (Grok 4.7):** prompt principal não confirmado no histórico disponível. **ChatGPT GPT-6:** solicitações para estruturar o Plano de Respostas aos Riscos, revisar a classificação e o tratamento das vulnerabilidades, organizar ações, responsáveis, prazos e status, incluir a oportunidade OPP-001 e aprimorar a redação e a apresentação do relatório sem apresentar ações planejadas como testes concluídos. Os pedidos do ChatGPT estão sintetizados, não transcritos literalmente. |
| **Trechos ou entregas afetadas** | **Claude Sonnet 5.5:** parecer de revisão e mensagem de retorno ao colega, sem edição direta do relatório. **Cursor (Grok 4.7):** `src/Entrega02/main.ino` (firmware 2.4.0). **ChatGPT GPT-6:** `NockHug_Plano_de_Riscos_Entrega_2_Revisado.pdf`, incluindo as seções 1 (Introdução), 2 (Tabela de Respostas aos Riscos), 2.1 (Oportunidade de Melhoria), 3 (Detalhamento das Estratégias de Resposta) e 4 (Monitoramento e Revisão), com apoio à redação, organização das tabelas e revisão do conteúdo. |


### Disciplina 5 — Inovação e Empreendedorismo

| **Aluno(s) Responsável(veis)** | [preencher] |
| :--- | :--- |
| **Ferramenta utilizada** | [preencher] |
| **Versão/modelo** | [preencher] |
| **Disciplina / Trabalho** | [preencher] |
| **Finalidade de uso** | [preencher] |
| ***Prompts* principais utilizados** | [preencher] |
| **Trechos ou entregas afetadas** | [preencher] |

***Declaro que o uso acima descrito está em conformidade com o GUIA PARA O USO RESPONSÁVEL DE
INTELIGÊNCIA ARTIFICIAL NA FECAP e que o conteúdo final é de minha plena responsabilidade
autoral.***
