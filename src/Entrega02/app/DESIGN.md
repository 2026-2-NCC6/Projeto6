# Design — NockHug

Registro do sistema visual como ele foi construído (29/10/2026; atualizado com a velocidade por treino, o sheet de treino e a retomada do descanso). Os valores vivem em `src/ui/tema.ts`, `src/ui/movimento.ts` e `src/ui/componentes.tsx`; este arquivo explica o porquê.

## Ideia

**Quadra à noite sob refletores.** O verde profundo é a quadra e ocupa regiões inteiras (o componente `Quadra`); o limão óptico é a bola e só aparece no que se move e importa: a ação principal, o estado ao vivo, o progresso. Bege e amarelo são a recompensa (XP, nível, medalhas). A logo (bola que se abraça, ondas de som, sublinhado limão) empresta três assinaturas: a bola de tênis desenhada (`Icone.Bola`), as ondas de som do botão de voz (`OrbeVoz`) e o traço limão sob o título em destaque (`TituloDestaque`).

## Cor

| Papel | Claro | Escuro |
|---|---|---|
| Fundo | `#F2F1E8` | `#0A1607` |
| Cartão | `#FFFFFF` + sombra verde suave | `#12230E` + borda `#223A1C` |
| Texto / suave / fraco | `#11240D` / `#4A5D44` / `#66785F` | `#F1F5E3` / `#B2C1A9` / `#8A9B83` |
| Quadra (superfície verde) | `#15370D` com luz radial `#204A16` | igual |
| Destaque de texto | verde `#15370D` | limão `#DFFF4F` |
| Ação principal | limão `#DFFF4F` com tinta verde | igual |
| Recompensa | bege `#E5CD82`, amarelo `#FFF2B4` | igual |
| Perigo | `#D7332E` (tela de parada `#5C1311`) | `#EE4D45` (`#4A0F0D`) |

Regra dura: **limão nunca é texto sobre fundo claro** (contraste ~1:1). No claro ele é preenchimento sob tinta verde ou aparece dentro de uma Quadra.

O tema segue o celular por padrão (`config.tema = 'sistema'`), com opção de forçar claro ou escuro em Configurações › Aparência.

## Tipografia

- **Bricolage Grotesque** (600/700/800) nos títulos e em todo número de placar (`Numero`, algarismos tabulares). Caixa de frase, entrelinha 1,08, tracking −2,5%.
- **Fonte do sistema** (SF / Roboto) no texto corrido, para acompanhar o tamanho de leitura do celular.

## Forma

Raios grandes e macios (cartões 22, quadra 26, botões até 22, chips em pílula). Alvos de toque ≥ 44 pt. Ícones de traço próprios em grade 24, traço 2, pontas redondas (`src/ui/icones.tsx`) — sem emoji nem glifos Unicode no lugar de ícone.

## Velocidade do treino

As três combinações (Forte, Médio, Fraco) são cartões de três colunas com o nome em Bricolage, o par `60/30` em `Numero` e duas barras finas — verde para o lançador, bege para o alimentador. A escolhida fica em limão com tinta verde, a mesma regra do botão principal: a cor não decora, ela diz qual está ativa. O Personalizado é uma linha calma abaixo, com dois passos de 5% e uma barra por motor; o piso de 15% do alimentador e o teto de 40% aparecem na legenda, e o lançador abaixo de 10% ganha um aviso bege, nunca vermelho (é uma escolha, não um erro).

No sheet de treino, a velocidade é uma seção obrigatória: o botão Salvar fica desabilitado e a linha de pendências diz o que falta. O sheet é uma página modal (page sheet no iOS, slide-up no Android) com Cancelar em 44 pt, sem swipe de descarte; o botão voltar do Android passa pelo mesmo aviso de alterações não salvas.

## Partida, descanso e retomada

Nenhum motor liga sem aviso. Todo “liga”, “retoma”, fim de descanso e disparo de calibração passa por uma contagem de 5 s: na quadra, o anel limão se fecha em 5 s, o número (Bricolage 72) entra com um zoom curto a cada segundo e um bip seco acompanha cada número; no zero, um bip mais longo e agudo, e só então o comando sai. “Cancelar” é o maior alvo da quadra, um botão de vidro de 58 pt, e a frase abaixo do número lembra que “Nock, desliga” cancela sem as mãos. Durante a contagem os botões de Ligar/Pausar somem: a única ação é cancelar.

O anel do descanso continua esvaziando na thread de UI. Nos últimos 5 segundos ele vira limão, o número pulsa devagar (`Pulso`, desligado com Reduzir Movimento) e a mesma contagem de bips toca. “Pular descanso” é um link limão discreto e leva à contagem, não aos motores. O ajuste de ±5 s (`AjusteDescanso`) é uma linha fixa no pé da quadra, durante a série e no descanso, com o passo no tema escuro da quadra. Se a retomada for cancelada, o botão principal vira “Ligar” e o texto explica por quê.

## Emergência fora da sessão

Quando a sessão está ativa com motores possíveis, qualquer tela que não seja a própria sessão mostra uma barra de "Parar tudo" no rodapé (`EmergenciaFlutuante`): o diagnóstico, as configurações e o checklist não podem deixar o único controle de parada uma tela atrás. No checklist o botão entra no rodapé, junto do Armar, porque a barra flutuante cobriria a ação principal. Ao encerrar, o app só grava e navega depois de confirmar `ARMADO`/`REPOUSO`/`PARADA_SEGURA`; sem confirmação, fica na sessão com o cartão "Não confirmei a parada" e o botão vermelho à mão.

## Erros da lançadora

O cartão de falha tem borda vermelha, um selo com o código (`409`, `401`, `sem resposta`), o que aconteceu em uma frase e o que fazer em outra. As ações são empilhadas e largas (luvas, sol): Reparar, Reconectar, Rearmar. O detalhe técnico (`op · estado · motivo · resultado · erro · fw · latência`) fica atrás de “Detalhes técnicos”, em texto selecionável de 11 pt; é o que responde “por que não armou?” sem abrir o monitor serial. O diagnóstico da lançadora é uma lista de linhas rótulo/valor, sem cartões decorativos.

## Voz e som

O teste de microfone põe a bola da marca grande sobre a quadra, com uma barra de volume, a transcrição ao vivo e o comando entendido. Os bips são curtos e secos: um por segundo na contagem de 5 s (Dó6, 160 ms), um mais longo e agudo na partida (Sol6, 450 ms) e um toque na ativação. A contagem é aviso de segurança e toca sempre; o interruptor das Configurações cala só o toque de ativação. Sem o módulo de áudio, a voz diz “Atenção, cinco segundos”. O som nunca é o único retorno — o anel, o número, o texto e um impacto háptico por segundo (mais forte nos dois últimos) contam a mesma história. O cartão do microfone diz por onde o app está ouvindo (“pelo fone Bluetooth …”).

## Movimento

- Toque: tudo afunda 3% em 100 ms (`Toque`), volta em 220 ms com ease-out forte.
- Troca de abas e controles frequentes: sem animação (abas) ou transição curta de cor/posição (segmentos, chips, checklist).
- Entradas escalonadas só nos momentos raros: onboarding, parada segura, resultado (`entrada`, `pouso`).
- Assinaturas: a lançadora dispara com rastro e clarão; o botão de voz respira em espera e emite as ondas da marca ao ouvir; o anel do descanso esvazia contínuo na thread de UI; o XP do resultado sobe sem re-render.
- "Reduzir movimento" do sistema é respeitado em todas as animações.
- Háptico: seleção nos controles, sucesso/erro nos desfechos, impacto forte na parada de emergência. Nunca é o único retorno.

## Marca

`assets/marca.png` (selo da logo) aparece no topo do onboarding e como adesivo na primeira tela. Ícone, ícone adaptativo do Android e splash foram gerados a partir de `logo-nockhug.png` da bancada.
