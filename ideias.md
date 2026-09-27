# Ideias — Próximos recursos da Bússola

> Atualizado em 27/09/2026. Backlog antigo **concluído** (v7.3). Novas ideias (v7.4+)
> listadas abaixo —**GPX** e **retorno pela trilha** já implementados em v7.4.

## ✅ Feitos (v7.4)
1. **Exportar trilhas em GPX** — botão `GPX` nas trilhas salvas gera arquivo `.gpx`
   (GPX 1.1, com elevação e timestamp) via módulo nativo `TrackShare` (FileProvider +
   compartilhar) e fallback de texto. Abre no Google Maps, Komoot, Gaia, etc.
2. **Retorno pela trilha** — botão `← Voltar` na trilha salva (ou `← Voltar ao início`
   durante a gravação) ativa a navegação inversa: o `TargetNavBar` aponta o próximo
   ponto do trajeto em direção ao início (distância, ângulo e chegada ≤15 m),
   pulando os pontos da trilha já percorridos.

## ✅ Feitos (v7.3)
1. **Marco virtual no AR** — em Waypoints, o botão 📌 fixa um ponto salvo como *marco
   virtual*: a seta ◆ no AR (`CameraARView` e `AROverlay`) aponta sempre para ele, com
   nome e distância reais (antes: placeholder fixo "Marco N · 0°" sem sentido). A escolha
   é persistida por usuário (`saveVirtualWp`).
2. **Backlog concluído** — os itens abaixo, antes no backlog, foram verificado/finalizados:
   trilha gravada, coords DMS/UTM + Maps/Waze, caderneta de campo, widget, geofence,
   comandos de voz da Kefera, seta AR para o destino, tema noturno e calibração do
   detector de metais.
3. **Notificações de chegada** (geofence) — confirmação de que o modo já notifica ao
   chegar perto de waypoints salvos (150 m).

## ✅ Feitos (v7.2)
1. **Índice de vento** — novo modo `🍃 Vento` em `WindView`: mede a turbulência do vento
   pelo microfone (RMS nativo em `MicLevelModule`), exibe **índice relativo 0–100%**, com
   calibração simples (gravar "zero" e "vento forte"), min/máx de sessão, histórico,
   bipes proporcionais e aviso honesto de que é um índice relativo (sem km/h).
2. **Seta até o waypoint** — `TargetNavBar` no modo Bússola com seta girando conforme o
   rumo, distância e ângulo; vibra e avisa ao chegar (≤15 m).
3. **Compasso falado** — toggle em Configurações > Bússola; anuncia rumo e distância
   (a cada ~9 s) via `assistant/voice.ts`.
4. **SOS com localização real** — `EmergencyModal` ganhou botões diretos de **WhatsApp** e
   **SMS** com a posição pré-preenchida, além do compartilhamento do sistema.

## ✅ Feitos (v7.1)
1. **Relógio de sol** — novo modo `☀️ Sol` em `SunWatchView`: nascer/pôr do sol, zênite
   solar, duração do dia, janela de "melhor luz" (≥15° de elevação) e gauge do arco solar.
2. **Som nos sensores** — módulo nativo de bips (AudioTrack) para o detector de metais,
   nível e EMF com tom **proporcional à leitura**; toggle "Sons dos sensores" em
   Configurações.
3. **Históricos e tendência** — `TrendChart` para o histórico do EMF e do barômetro
   (classificação de tendência: subindo / caindo / estável).
4. **Visual futurista** — novo tema **Neon**, cara nova para a **Kefera** (orbe pulsante,
   waveform, brilho neon) e ajustes de glow na interface.

## ✅ Backlog concluído (tudo implementado até v7.3)

### Navegação / outdoor
- ✅ Rota / trilha gravada: registrar o caminho percorrido (track), salvar localmente e no
  Supabase por usuário, desenhar o trajeto, mostrar distância percorrida + elevação.
  (`TrackView` + `trackService` + `cloud.pushTracks`.)
- ✅ Coordenadas em múltiplos formatos: DMS, decimal, UTM + link pra abrir no Google
  Maps/Waze. (`CoordModal` + `utils/coords.ts`.)
- ✅ Caderneta de campo: anotar observações amarradas ao ponto (foto + nota + coords).
  (`FieldNotesSheet` + `notesService`.)
- ✅ Widget / atalho rápido: temperatura, pressão e rumo na tela inicial.
  (`widgetService` → `WidgetBridge` no Android.)

### Segurança
- ✅ Chegada no destino: notificação automática ao chegar num waypoint (geofence, 150 m).
  (`geofenceService`.)

### Assistente Kefera (voz)
- ✅ Falar coordenadas/altitude sob comando ("Kefera, qual a coordenada?"), julgar distância
  até o waypoint. (`assistant/skills.ts` — `locationSkill`, `altitudeSkill`,
  `coordsDmsSkill`, `coordsUtmSkill`, `waypointDistanceSkill`.)

### AR
- ✅ Ver distância até um waypoint sobreposto na cena (`CameraARView`) — marcador 📍 no
  modo Visão e ✨ AR com nome e distância.
- ✅ Marco virtual: cravar uma seta ◆ no AR num ponto salvo (v7.3).
- ✅ Tela preta da Visão (`CameraARView`) corrigida em v7.2: nunca fica preta — marcadores
  N/S/E/W + rumo sempre visíveis, chip compacto "iniciando câmera" no warm-up e fallback
  gráfico com conteúdo + botão "tentar novamente" (antes: cover opaco de tela cheia).

### Sensores / astronomia / extras
- ✅ Modo noturno: tema **Noturno** disponível em Configurações (tons quentes, suaves).
- ✅ Calibração do detector de metais (ajuste fino de sensibilidade) via linha de base com
  re-calibração. (`metalCalibrationService` + `MetalDetectorView`.)
- ✅ Anemômetro/som de vento (briza lida pelo microfone) — feito em v7.2 como **índice de
  vento** relativo com calibração (celulares sem barômetro precisam de uma referência).

## Ideias novas (por avaliar)
- ✅ **1. Exportar trilhas em GPX** — ✅ feito em v7.4.
- ✅ **2. Retorno pela trilha** — ✅ feito em v7.4.
- [ ] **3. POIs na trilha** — marcar pontos de interesse durante a gravação (foto + nota)
      que aparecem desenhados sobre o trajeto.
- [ ] **4. Waypoint por voz** — "Kefera, marca este ponto como *casa*" cria waypoint sem
      tirar a mão do aparelho.
- [ ] **5. Odômetro histórico** — distância acumulada por dia/semana, salva por usuário.
- [ ] **6. Beacon de emergência** — a cada X min envia posição por SMS para contato
      configurado (funciona sem dados móveis, só SMS).
- [ ] **7. Detecção de queda** — acelerômetro detecta impacto + imobilidade e oferece
      envio automático do SOS.
- [ ] **8. Contexto no SOS** — incluir rede/carrier e % de bateria no alerta.
- [ ] **9. Kefera troca modos** — ✅ feito em v7.5: "Kefera, abre o detector de metais" / "modo sol".
- [ ] **10. Kefera conta o histórico** — "quanto andei hoje?", "qual a trilha mais longa?".
- [ ] **11. Alarme de chegada por voz** — Kefera lembra ao chegar perto de ponto.
- [ ] **12. Elevação no AR** — além do azimute, indicar se o alvo está acima/abaixo do
      horizonte (usando `accel` no `CameraARView`).
- [ ] **13. Calibração pela Estrela Polar** — usar Polaris para o norte geográfico quando
      visível.
- [ ] **14. Tiles Android** — quick-settings tile para abrir direto num modo.
- [ ] **15. Tema automático** — seguir horário (dia/noite) com transição suave.
- [ ] **16. Brilho/keep-awake outdoor** — opção para não dormir durante Bússola/AR/trilha.

## Ideias novas (23/09/2026)
- [ ] **17. AR sobre a câmera real** — marcar sol/lua/destino com o fundo da câmera
      viva (a camada de marcadores do `CameraARView` já existe; falta unir os dois).
- [ ] **18. Backup e sincronização de notas/waypoints** — revisar o `cloud.ts`
      (`Supabase`): garantir que caderneta e pontos realmente sincronizam por usuário,
      com tratamento de conflito e aviso de offline.
- [ ] **19. Nível em graus** — além do nível de bolha, mostrar inclinação exata
      (pitch/roll em °) e cruzar com o teodolito para leituras mais precisas.
- [ ] **20. Widget do rumo — publicar/validar** — o `widgetService` existe; confirmar se
      o widget está publicado na Play e polir (rumo, pressão, temperatura).
- [ ] **21. FOV calibrado por aparelho** — o campo de visão da Visão está fixo em 110°;
      permitir ajuste fino por aparelho para os marcadores casarem com a lente real.
- [ ] **22. Cadência GPS econômica** — pausar/alongar o intervalo do GPS quando o
      usuário está parado para economizar bateria (ver também a ideia nova abaixo).

## ✅ Feitos (v7.9 e v7.10)
1. **AR sem giroscópio (v7.9)** — removido o bloqueio pelo sensor de orientação; o AR
   agora funciona só pelo rumo (heading), mesmo sem giroscópio.
2. **GPS econômico (v7.9)** — quando o usuário fica parado (4 leituras seguidas sem
   movimento), o watch do GPS relaxa (intervalo 20–40 s, filtro 20–50 m) e volta ao fino
   ao andar de novo.
3. **FOV ajustável na Visão (v7.9)** — botões −/+ (60°–140°, passo 10) salvam por
   aparelho (novidade #21 adiantada).
4. **⌖ Altura (v7.10)** — novo modo: mira no topo e na base com a inclinação + distância
   (manual ou de um waypoint ativo) → altura = D × (tan topo − tan base).
5. **🚗 Meu carro (v7.10)** — novo modo: 1 toque marca onde parou; seta, distância e
   "chegou" guiam de volta; ponto fica salvo no aparelho.

## Ideias novas (23/09/2026, 2ª leva)
- [ ] **23. "Volte antes do escuro"** — com a trilha gravando, estimar o ritmo e avisar a
      hora-limite de retorno antes do pôr do sol (junta trilha + relógio de sol).
- [ ] **24. Rastreio ao vivo por link** — gerar link (WhatsApp/família) com a posição em
      tempo real por X minutos, expira sozinho.
- [ ] **25. Foto com rumo** — na caderneta, guardar junto da foto a direção da bússola
      apontada no momento.
- [ ] **26. Metrônomo de passo** — bipes de cadência (~120/min) para caminhada no ritmo.
- [ ] **27. Triangulação offline por rumos** — estimar a posição mirando 2 marcos
      conhecidos, sem GPS.

## ✅ Feitos (v7.11)
1. **Bússola adaptativa** — a suavização do rumo agora muda de intensidade: rápida
   quando você caminha/vira (α 0.45) e forte quando está parado (α 0.08), reduzindo a
   tremedeira.
2. **Visão: zoom e lanterna** — pinch (gesto) + botão de zoom (×1…×6, multiplica o
   neutral) e lanterna liga/desliga 🔦.
3. **Trilha: GPX podado** — antes de exportar, os pontos passam pelo Douglas–Peucker
   (tol. 0.00002° ≈ 2,2 m) → arquivo menor e linha mais limpa; e o ganho/perda de
   elevação ignora variações < 1,5 m (barulho do altímetro).

## ✅ Feitos (v7.12)
1. **Rumo de volta sempre visível** (ideia #40) — abaixo do rumo atual aparece a
   direção inversa (graus + ponto cardeal), sem precisar calcular nada.

## ✅ Feitos (v7.13)
1. **Atalho em linha reta na trilha** (ideia #34) — no retorno, ative "⚡ Ver atalho" e
   veja a distância e o rumo direto ao início (e o rumo de volta) para cortar caminho.

## ✅ Feitos (v7.14)
1. **Verificação pelo Sol** (ideia #45) — na calibração, aponte o topo do aparelho ao
   sol e o app compara a leitura média com o azimute solar real (±6° de tolerância) e
   diz se o norte está deslocado para a esquerda/direita.

## ✅ Feitos (v7.15)
1. **Novo modo: Triangulação** (ideia #33) — aviste o mesmo alvo distante de 2 lugares
   (topo do aparelho apontado ao alvo + toque em Avistar); o app cruza os rumos
   geográficos, estima a coordenada do alvo e permite adicioná-lo como waypoint.
   (A estimativa de posição própria por 2 marcos — #27 — continua pendente.)

## ✅ Feitos (v7.16)
1. **EMF: ambiente, vibração e ponto quente** — botão "🍃 Ambiente" fixa a referência e
   a barra passa a escalar pelo Δ (variação fica visível); vibração a cada pulso mesmo
   sem som; "📌 Ponto quente" guarda um waypoint na sua posição com a leitura atual.

## ✅ Feitos (v7.17 · code 148)
1. **Ponto por voz** (#4) — "marca este ponto como X" salva a posição atual sem tirar
   as mãos do caminho.
2. **Odômetro** (#5) — distância de hoje, da semana e dos últimos 7 dias.
3. **Kefera conta o histórico** (#10) — a assistente responde sobre hoje, ontem, a semana
   e a trilha mais longa já percorrida.
4. **Bloqueio por PIN** (#31) — PIN de 4 dígitos ao abrir o app (criar, trocar, remover).
5. **Backup completo** (#38) — exportar/restaurar pontos, trilhas, notas, declinação e
   configurações em um JSON.
6. **Leitura em mil** (#32) — azimute também em milésimos (6400).

## ✅ Feitos (v7.18 · code 149)
1. **Aviso de atualização corrigido** — `versionService.ts` volta a identificar a build
   corrente; o `version.generated.ts` passa a ser sincronizado no commit, então o
   "prompt de update" funciona.
2. **Dial mais compacto** — mostrador menor e cabeçalho com mais espaço, para o link do
   Painel não cobrir a tela.
3. **Infra de CI/CD** (sem mudança visível no app) — RLS do Supabase para
   `virgin_memory`/`tracks`/`notes`/`app_version`, gate de lint+teste no build do APK e
   gravação automática de `app_version` no Supabase ao publicar.

## ✅ Feitos (v7.19 · code 150)
1. **Rastreio ao vivo por link** (#24) — botão 📡 no SOS abre uma sessão de 30 min e gera
   um link que qualquer pessoa abre no navegador para acompanhar a posição. O app faz
   push da posição a cada 10 s para a tabela `live_shares`; o viewer
   (`web/live.html`, publicado no GitHub Pages) consulta a RPC `get_live_position` a
   cada 5 s. Sem websocket: é polling.

## ✅ Feitos (v7.20 · code 151)
1. **Controle único de sessão** — botão para **parar** o rastreio, retomada da sessão ao
   reabrir o app e primeiro fix enviado antes de o timer começar (falha de upsert aborta).
2. **Viewer com estado do sinal** — `● AO VIVO`, `● SEM SINAL` (fix > 25 s), `🛑`
   encerrado, `⏳` expirado, `⌛` aguardando o primeiro fix e `📡` offline, com backoff
   exponencial até 30 s e pausa quando a aba fica em segundo plano.

## ✅ Feitos (v7.21 · code 152)
1. **Assinatura de release sem fallback** — o `build.gradle` não cai mais no keystore de
   debug: se `ANDROID_KEYSTORE_FILE`/`PASSWORD`/`KEY_ALIAS`/`KEY_PASSWORD` faltarem, o
   `assembleRelease` aborta com a lista do que falta. `publicar.sh` passa a carregar o
   keystore de `~/.bussola-keystore/`. Motivo: build local e CI assinavam com chaves
   diferentes, e um APK assinado com a chave errada não atualiza por cima do instalado.
2. **Typecheck no CI** — `npm run typecheck` (`tsc --noEmit`) entra no gate junto com
   lint e testes.
3. **Refatoração de telas** — `CompassScreen` (2058 → 1293 linhas) e `SettingsModal`
   (1328 → 449) foram quebrados em componentes e estilos, eliminando ~8 blocos de
   switch/radio repetidos à mão. Sem mudança visual: os 115 blocos de estilo extraídos
   são idênticos aos originais.
4. **Limpeza** — APIs duplicadas de live-share e 2 scripts SQL abandonedos removidos;
   changelog das versões 149–151 escrito.

## ✅ Feitos (v7.22 · code 153)
1. **Rumo no rastreio ao vivo** — o `LocationFix` passou a carregar o rumo sobre o solo
   (`coords.heading`) e o `pushLiveFix` o repassa. O viewer já mostrava "rumo NN°"
   quando `p.heading != null` (`web/live.html:137`), mas o app mandava `null` fixo: o
   recurso existia na tabela, na RPC e no viewer sem nunca poder aparecer. Parado, o
   Android não fornece *bearing* e o campo vai `null` — omitido de propósito.
2. **`LiveSession.userId` removido** — o campo saía sempre como `''` e só era lido com
   fallback para `ensureCloudUser()`. Era armadilha: com um id na sessão, o insert usaria
   um usuário e o `stopLiveShare` outro, e a linha ficaria órfã na tabela. Agora a
   identidade tem fonte única, a mesma no push e na remoção. 3 testes novos, todos
   verificados por mutação.

## Ideias novas (27/09/2026, 6ª leva — outras ideias e melhorias)
Saem de uma revisão de código feita na v7.22. As três primeiras fecham riscos que
foram encontrados de verdade, não ideias soltas.

### Risco / processo
- [x] **50. 🔏 O CI confere a assinatura do APK** — feito. O `assembleRelease` passava
      porque as env vars existiam, não porque a chave era a certa. Agora há um passo
      "Confere a assinatura do APK" **antes** de publicar, e o mesmo gate no
      `publicar.sh`: `apksigner verify --print-certs` compara o SHA-256 com
      `android/app/release-cert.sha256` e aborta se não bater. O fingerprint esperado
      entrou no filtro de paths do CI, então trocar o valor também dispara build.
      Testado nos três caminhos: APK de produção passa, APK assinado com outra chave
      aborta, SDK ausente aborta.
- [x] **51. 🔗 `version.properties` × `version.generated.ts` podem divergir** — feito. Um
      passo "Confere coerencia da versao" compara os dois no CI, antes de qualquer build.
      O arquivo gerado é reescrito a cada build pelo Gradle, mas é versionado: o valor
      commitado podia divergir do `version.properties` e o app anunciaria uma versão que
      não corresponde ao que foi compilado. Também entrou no filtro de paths o próprio
      workflow, para que mudar o pipeline dispare build em vez de ficar sem teste.
- [ ] **52. 🔐 Assinar só no CI** — o aparelho é `f2fs` e não aplica bits de permissão
      (testado: um arquivo `600` de root é legível por `nobody`), então a senha do
      keystore fica exposta a qualquer processo no aparelho. Movendo o keystore para
      fora — o `--clobber` e os secrets já funcionam — o aparelho nunca vê a chave.

### Produto
- [ ] **53. 📜 Changelog acumulado** — o `changelogFor` mostra só a entrada da versão
      atual. Quem salta do cod 80 para o 153 vê uma linha e não sabe o que houve no
      meio. Acumular as entradas entre a última versão vista (guardada no
      AsyncStorage) e a atual.
- [ ] **54. 🧭 Rumo magnético como reserva** — o `heading` do GPS só vem quando há
      deslocamento. O `EmergencyModal` já recebe o rumo magnético da bússola; usar como
      fallback quando o GPS não tem *bearing* deixa o viewer com rumo quase sempre.
- [ ] **55. ⏱️ Tirar o "SEM SINAL" piscando** — o app empurra a cada 10 s e o viewer
      considera stale acima de 25 s, mas o Android estrangula timers em background, então
      o "SEM SINAL" pisca. Ou o viewer considera stale com folga maior, ou o app manda
      um keep-alive.
- [ ] **56. 💥 Relatório de crash** — hoje um erro em produção é invisível; o usuário
      simplesmente vê o app fechar. Sentry daria o stack real.
- [ ] **57. 🧪 Testes dos componentes extraídos** — as primitivas de
      `settings/primitives.tsx` (`SwitchRow`, `RadioRow`, `ChevronRow`, `GridOption`) são
      puras e seria trivial testar, o que dá uma rede real para as próximas refatorações
      de tela.
- [ ] **58. 🧪 Teste do `live.html`** — a lógica de stale/expirado/backoff do viewer é JS
      puro e não tem teste nenhum. É a peça que o link público mostra, sem rede de
      proteção.
- [ ] **59. 🏗️ Build local do Android** — hoje o `assembleRelease` local não roda (o
      `io.invertase.gradle.build:1.5` não resolve offline) e o CI é o único caminho, o
      que torna todo ciclo de release lento e opaco. Se funcionar local, o debug de
      build para de custar 6 min por tentativa.

## Ideias novas (23/09/2026, 3ª leva — melhorias em modos existentes)
- [ ] **28. Teodolito com altura direta** — usar a distância do waypoint ativo/marco na
      fórmula de altura (sem digitar) + média de N leituras para estabilizar o ângulo.
- [ ] **29. SOS com contexto** — incluir % de bateria e operadora/rede no alerta
      (adianta a ideia #8).
- [ ] **30. Aviso de desvio de rota** — durante o retorno pela trilha, se sair X metros
      do trajeto, avisar com o rumo para voltar.

## Ideias novas (23/09/2026, 4ª leva)
- [ ] **31. 🔐 PIN/biometria no app** — trancar o app (privacidade, útil ao compartilhar
      o telefone). Configurável em Configurações.
- [ ] **32. 🧭 Leitura em mil (militar)** — alternar azimute entre graus e **milésimos**
      (mrad/"mils", 6400/6000). Bom pra quem usa bússola tática.
- [x] **33. 📸 Waypoint pela câmera** — marcar um ponto distante sem chegar perto: 2+
      avistagens de lugares diferentes cruzam os rumos e **estimam a coordenada**
      (complemento da triangulação #27, usando teodolito + AR).
- [x] **34. 🗺️ Atalho de volta (linha reta)** — na trilha, além do retorno pelo trajeto,
      mostrar o rumo direto ao início ("em linha reta") para encurtar quando dá.
- [ ] **35. 🔲 QR de localização** — gerar QR com as coordenadas para outro aparelho
      escanear e navegar até ali (boneco de rastreio offline).
- [ ] **36. 🌡️ Heatmap "onde estive"** — registrar posições ao longo do dia e desenhar um
      mapa de calor do dia/semana (junta GPS + trilhas salvas).
- [ ] **37. 🔗 GPX por link** — além do arquivo, gerar link curto da trilha salva na
      nuvem para compartilhar (email/WhatsApp).
- [ ] **38. 💾 Backup completo** — exportar tudo (notas, waypoints, trilhas, calibrações,
      declinação, FOV) como um JSON/PDF para restaurar/transferir.
- [ ] **39. ⚠️ Aviso de bateria do sistema** — alertar se o Android estiver restringindo
      o app em segundo plano (afeta GPS e câmera contínuos).
- [x] **40. 🧭 Melhoria: rumo inverso sempre visível** — mostrar o rumo de volta em tempo
      real (não só no retorno de trilha), útil em navegação de retorno simples.
- [ ] **41. 🛠️ Gesture de pinch na Visão** — o vision-camera v5 não expõe pinch; fazer
      zoom por gesto com react-native-gesture-handler (além do botão ×1–×6).
- [ ] **42. 🎨 Tema "sol forte"** — tema de alto contraste para leitura outdoor sob sol
      direto (além do Noturno e Neon).
- [ ] **43. ⚡ Performance: memoizar marcos** — evitar recálculo de distância/rumo de
      waypoints a cada fix (já há useMemo parcial; revisar).
- [ ] **44. 🧾 Caderneta: exportar relatório** — gerar PDF/GPX com notas + fotos
      (geo-relato do dia de campo).
- [x] **45. 🧪 Verificação cruzada da calibração** — comparar o norte do app com o
      azimute do sol naquele horário/local (didático, combina Sol + bússola).

## Ideias novas (23/09/2026, 5ª leva — EMF)
- [ ] **46. 🧲 EMF com calibração magnética** — aplicar o hard/soft-iron da calibração
      da bússola no cálculo da magnitude (hoje usa o magnetômetro cru).
- [ ] **47. 🧭 EMF: direção da fonte** — mostrar qual eixo (X/Y/Z) domina o pico para
      apontar onde a fonte está.
- [ ] **48. 🗺️ EMF: levantamento geolocalizado** — marcar leituras num mini-mapa
      (heatmap) para mapear fontes numa área.
- [ ] **49. ❄️ EMF: travar leitura** — congelar o valor na tela ao caminhar em direção
      à fonte (pico mantido).