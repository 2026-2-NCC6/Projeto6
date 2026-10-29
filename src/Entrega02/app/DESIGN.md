# Design — NockHug

Registro do sistema visual como ele foi construído (29/10/2026). Os valores vivem em `src/ui/tema.ts`, `src/ui/movimento.ts` e `src/ui/componentes.tsx`; este arquivo explica o porquê.

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

## Movimento

- Toque: tudo afunda 3% em 100 ms (`Toque`), volta em 220 ms com ease-out forte.
- Troca de abas e controles frequentes: sem animação (abas) ou transição curta de cor/posição (segmentos, chips, checklist).
- Entradas escalonadas só nos momentos raros: onboarding, parada segura, resultado (`entrada`, `pouso`).
- Assinaturas: a lançadora dispara com rastro e clarão; o botão de voz respira em espera e emite as ondas da marca ao ouvir; o anel do descanso esvazia contínuo na thread de UI; o XP do resultado sobe sem re-render.
- "Reduzir movimento" do sistema é respeitado em todas as animações.
- Háptico: seleção nos controles, sucesso/erro nos desfechos, impacto forte na parada de emergência. Nunca é o único retorno.

## Marca

`assets/marca.png` (selo da logo) aparece no topo do onboarding e como adesivo na primeira tela. Ícone, ícone adaptativo do Android e splash foram gerados a partir de `logo-nockhug.png` da bancada.
