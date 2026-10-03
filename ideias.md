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
- [x] **4. Waypoint por voz** — ✅ feito na v7.17: "marca este ponto como X" salva a
      posição atual sem tirar as mãos do caminho.
- [x] **5. Odômetro histórico** — ✅ feito na v7.17 (hoje/semana/últimos 7 dias).
- [ ] **6. Beacon de emergência** — a cada X min envia posição por SMS para contato
      configurado (funciona sem dados móveis, só SMS).
- [ ] **7. Detecção de queda** — acelerômetro detecta impacto + imobilidade e oferece
      envio automático do SOS.
- [ ] **8. Contexto no SOS** — incluir rede/carrier e % de bateria no alerta.
- [x] **9. Kefera troca modos** — ✅ feito em v7.5: "Kefera, abre o detector de metais" / "modo sol".
- [x] **10. Kefera conta o histórico** — ✅ feito na v7.17 (hoje, ontem, semana, trilha
      mais longa).
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
- [x] **24. Rastreio ao vivo por link** — ✅ feito na v7.19 (30 min, expira sozinho).
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
- [x] **54. 🧭 Rumo magnético como reserva** — ✅ feito junto da auditoria pós-v7.26
      (bug nº 4 do commit `362b41b`). `resolveLiveHeading()` em `liveShareService.ts`
      prefere o bearing do GPS e cai na bússola magnética quando ele vem `null` — que é
      o caso do SOS com o aparelho parado no bolso, que é justamente onde o viewer
      ficava sem rumo. Normaliza para 0-360 e trata NaN/Infinity como ausente. O
      `EmergencyModal` passa o rumo num ref para o interval de 10 s. 4 testes em
      `bugfixes.test.ts` + 4 em `liveSession.test.ts`.
- [ ] **55. ⏱️ Tirar o "SEM SINAL" piscando** — app empurra a cada 10 s e o viewer
      considera stale acima de 25 s. **Causa raiz confirmada: não era folga do viewer.**
      Com o app em background o Android estrangula o `setInterval` e o `LocationManager`
      para de entregar fix — o caso de uso real (aparelho no bolso durante uma emergência).
      Implementado na 155: `LiveTrackingService` (foreground service `location`) + módulo
      `LiveTracking` + `ACCESS_BACKGROUND_LOCATION`/`FOREGROUND_SERVICE_LOCATION`, com
      notificação persistente e ação "Parar"; sem a permissão o app avisa em vez de prometer
      que funciona. 9 testes em `__tests__/liveTracking.test.ts`.
      **Falta: testar com a tela apagada no aparelho antes de fechar como concluída.**
      Não aumentar o stale do viewer — isso só mascara o sumiço.
      *Status: código pronto (155), ainda não verificado em campo. Protocolo: instalar o
      APK do CI, iniciar o rastreio, travar a tela, deixar 2–3 min e ver se a etiqueta
      fica `● AO VIVO` estável; repetir em segundo plano e com a economia de energia do
      sistema ligada. Não dá para buildar localmente (#59/#61).*

- [ ] **55b. 💀 Processo morto ≠ timer estrangulado** — a #55 fecha o caso do
      *throttling*: com o processo promovido, o `setInterval` do `EmergencyModal` volta
      a puxar. O serviço é `START_STICKY`, então o Android recria o processo se ele
      morrer — **mas quem faz o push continua sendo o JavaScript**, e o `setInterval`
      só nasce de novo quando o modal do SOS monta e chama `getActiveLiveSession()`.
      Ou seja: se o app for morto de vez (não estrangulado), o rastreio continua no
      `live_shares` com a última posição e o viewer marca `● SEM SINAL` de forma
      permanente, sem nenhum aviso de que a sessão ainda consta como ativa.
      **Diferente da #55 e mais grave:** lá o sumiço é temporário, aqui é definitiva
      enquanto ninguém reabrir o modal. O conserto é mover o push para dentro do
      `LiveTrackingService` (o serviço passa a ter a própria posição e a fazer o upsert),
      o que exige location no serviço e não só `startForeground`. Levanta também a
      questão de expiração: quem apaga a linha quando o prazo passa se o JS não
      volta? Teste de campo no mesmo roteiro da #55, com o app forçado a morrer
      (adb kill do processo).
- [ ] **56. 💥 Relatório de crash** — hoje um erro em produção é invisível; o usuário
      simplesmente vê o app fechar. Sentry daria o stack real.
- [x] **57. 🧪 Testes dos componentes extraídos** — feito. 12 testes para as primitivas de
      `settings/primitives.tsx`, cobrindo a fiação de `onPress` (que é onde a refatoração
      poderia ter quebrado em silêncio), a área clicável de cada linha, `disabled` e as
      cores Selected/unselected. Sete mutações foram aplicadas no fonte de propósito
      para conferir que os testes detectam: as sete derrubaram a suíte.
- [x] **58. 🧪 Teste do `live.html`** — já existia. `__tests__/liveViewer.test.js` tem 13
      casos cobrindo stale, expiração, erro de rede, polls sobrepostos e aba oculta. Este
      item foi anotado como pendência por engano e está encerrado.
- [x] **59. 🏗️ Build local do Android** — encerrado sem implementação, de propósito.
      O objetivo original era deixar o `assembleRelease` local funcional, mas o usuário
      trabalha **num celular, sem máquina potente**, e o diagnóstico de 29/09 selou a
      questão: o `assembleDebug` levou ~5 h, o `clang++` do NDK roda sob emulação
      `qemu-x86_64` e o próprio aparelho reiniciou no meio do build, que não é
      retomável (morrer no meio = trabalho perdido, e só o `.cxx/` já gravado
      escapa). Descartar o build local e deixar o CI compilar é mais rápido, mais
      barato e não consome a bateria de quem está no campo. **Regra: nunca buildar
      localmente neste setup** — commitar e deixar o `build-apk.yml` rodar.
- [x] **60. ☀️ Lembrar de conferir o norte pelo Sol** — feito na v7.23. A conferência
      exige apontar o aparelho para o Sol e segurar 12 leituras por 3 s, então não dá
      para rodá-la sozinha: o app só pode lembrar. Ele guarda quando foi a última
      conferência que deu certo e, passados 30 dias sem uma, mostra um banner
      dispensável com atalho para a calibração. Três decisões vieram do caso de um
      sensor ruim: (1) só conta a conferência que deu certo, senão o app cala justamente
      quando o norte está torto; (2) o banner só aparece com GPS e Sol acima do
      horizonte, senão volta sem que o usuário possa fazer nada; (3) quem nunca calibrou
      continua recebendo o modal de sempre — o banner é para quem já tem calibração.

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
- [ ] **41. 🛠️ Gesture de pinch na Visão** — a v7.11 anunciou "pinch (gesto) + botão de
      zoom", mas só o botão ×1–×6 existe: não há `pinch`/`gesture` em
      `CameraARView`. O texto da v7.11 está errado; falta de fato o gesto via
      react-native-gesture-handler (que hoje nem é dependência do projeto).
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

## Ideias novas (29/09/2026, 7ª leva — pós-auditoria)
Saem da auditoria dos bugs corrigidos (commit 8dc0c59). Não repetem ideias já
existentes e focam em reduzir riscos ou em usabilidade percebida pela Kefera.

### Risco / processo
- [x] **61. 🐢 Acelerar o build local** — encerrado junto com a 59, mesmo motivo: sem
      máquina potente, não há o que acelerar. Fica o registro do diagnóstico, porque
      ele explica a lentidão caso alguém tente de novo: o plugin
      `io.invertase.gradle.build:1.5` do
      notifee só resolve com rede (`--offline` falha) e o `clang++` do NDK roda sob
      emulação `qemu-x86_64` (o que explica ~5 h para o `assembleDebug`). O cache do
      CMake é válido — só o que muda o hash de configuração força recompilar tudo.
- [x] **62. 🧪 Autoteste de campo** — feito. Novo modo 🧪 no launcher que valida no
      próprio aparelho: (1) acelerômetro em repouso entre 0,98 g e 1,02 g, (2) norte
      parado com variação ≤ 2° numa janela de 5 s, (3) resposta do `verticalAngle` à
      inclinação. Mostra **✓/✕ com os números** e o que era esperado, não só um
      veredito. Lógica pura em `src/services/sensorSelfTest.ts` (testável sem mock) +
      painel `SensorSelfTestView`. Três decisões vindas do caso do sensor ruim:
      (1) a escala do acelerômetro é **detectada** (Android entrega m/s², iOS entrega
      g) e não assumida, senão o repouso reprovaria num aparelho correto; (2) o norte
      parado é medido com quebra de 0/360, senão o teste reprovaria justamente onde a
      bússola é mais estável; (3) sem calibração magnética o painel **avisa** em vez
      de reprovar, porque aí a culpa é da calibração e não do sensor. 23 testes,
      com 4 mutações confirmadas.

      **Correção em campo (v7.26, code 157):** o primeiro teste reprovou no
      aparelho do usuário com `1,05–1,4 g`. Duas coisas saíram disso. A boa:
      ler 1,05 e não 9,8 confirmou que a **detecção de escala funcionou** — é
      a parte que eu mais temia, porque errá-la reprovaria qualquer aparelho.
      A má: `1,4` é aceleração real, não sensor ruim, e o painelPuniu o
      sensor por um toque do usuário. Duas correções, ambas de projeto e não
      de número: (1) a janela passou a **descartar 1 s de acomodação**
      (`WARMUP`), porque a coleta começava no instante do toque; (2) o
      veredito deixou de ser booleano e virou `ok`/`moved`/`fault`. Reprovar
      "o aparelho mexeu" mandava o usuário atrás de um defeito que não
      existe. A classificação usa **mediana**, não média: um pico isolado de
      1,4 g numa janela de 8 amostras joga a média para 1,06 e acusaria um
      sensor perfeito — a mediana responde onde o aparelho estava parado, que
      é a pergunta certa. `MOVED_SPREAD_G` (0,5 g) existe para o caso de
      nível errado *e* dispersão larga, que é movimento, não ganho torto.
      10 testes novos, 4 mutações confirmadas.
- [ ] **63. 🔇 Relatório de bug com dados de sensores** — ao relatar um problema, o
      app pode anexar um trecho anônimo (30–60 s) dos últimos logs de sensores (mag/accel,
      GPS, heading). Dá reproduzibilidade sem vazar localização sensível (pode filtrar
      coordenadas). Ajuda muito nos bugs que acabei de corrigir.

### Produto
- [ ] **64. 📟 Painel de diagnóstico dos sensores** — mostra valores brutos X/Y/Z do
      acelerômetro e magnetômetro, o eixo dominante, magnitude, se está calibrado
      (hard/soft iron efetivo) e um botão "Confirmar eixo". Fecha a ressalva deixada
      no commit `8dc0c59`: em vez de assumir a convenção de eixos, o **aparelho** diz.
- [ ] **65. 🧭 Auto-detecção da convenção do teodolito** — ao mirar um ponto fixo e
      inclinar ~90°, se `verticalAngle` tender a 180° em vez de 0°, inverte
      silenciosamente com aviso ("Convenção de inclinação corrigida") e permite
      desfazer num toque. Barato, cobre o caso do usuário sem painel completo.
- [ ] **66. 🎙️ Pré-visualizar o que a Kefera ouviu** — exibe a transcrição (com
      confiança baixa) **antes** de executar: "Ouvi: *marcar waypoint*. Executar?
      [Sim] [Corrigir]". Evita execuções erradas e facilita o ajuste do wake word.
- [ ] **67. 🕵️ Segunda chance com confiança baixa** — reaproveita o fuzzy matcher:
      quando a pontuação ficar abaixo do limiar, oferece a alternativa mais próxima
      ("Você quis dizer *gravar trilha*?"). Reduz falhas silenciosas sem complicar
      o fluxo.
- [ ] **68. 📏 Unidades imperiais** — adicionar pés, milhas, pés-polegadas nas
      configurações (juntamente com a troca entre graus/mils já existente). Mantém
      coerência entre todos os painéis (distância, altura, vento).
- [ ] **69. 🔇 Silenciar Kefera por N minutos** — botão "Silenciar por 5/15/30 min"
      que desliga TTS/wake word temporariamente. Útil em acampamento, reuniões ou
      locais onde falar incomoda.
- [ ] **70. ♻️ Importar backup com pré-visualização** — além de exportar (#38),
      importar um ZIP/JSON com **preview**: "Vai importar: 3 waypoints, 1 trilha,
      declinação, calibrações. Substituir ou mesclar?". Evita sobrescrever dados
      bons por engano.

### Fechado no commit `2d8b204` (7 bugs P0/P1)
- [x] **71. 📦 Backup aceito sem `fileVersion` válido** — `applyBackup` exigia só
      `!parsed.fileVersion`, então um `0` ou uma string passavam. Passou a exigir
      inteiro igual a `BACKUP_FILE_VERSION` (1) e a distinguir `invalid`,
      `unsupported_version` e `write_failed`; o alerta passa a dizer a versão.
- [x] **77. 📏 Odómetro perdia leituras ao fechar o app** — a escrita é adiada por
      debounce e nada forçava o flush. Agora roda no `background`/`inactive` do
      `AppState`, no cleanup e ao parar ou descartar uma gravação.
- [x] **⬇️ Atualizador baixava o APK sozinho** — 700 ms depois de aparecer ele
      começava a usar internet sem o utilizador pedir. Passou a exigir toque, a
      aceitar só `https:` e a ter timeout de 5 min com cancelar e remoção do
      ficheiro parcial (idem no `ApkDownloaderModule.kt`).
- [x] **🌐 Paridade i18n testada por contagem** — `new Set(counts).size === 1`
      passa com uma chave a faltar em `en` e outra a sobrar em `es`, e como o
      tradutor cai no português sem aviso o bug é invisível na tela. O teste passa
      a comparar conjuntos de chaves e a varrer os `t()` usados no código.
- [x] **🛡️ Um crash no modo matava a tela toda** — o `ErrorBoundary` não existia
      fora da câmera e não tinha tradução nem "Tentar de novo". Agora envolve os
      17 modos em `ModeView` e diz que modo falhou.
- [x] **🧲 Sem forma de esquecer a linha de base do detector** — "Re-calibrar" refaz
      as 32 amostras, o que não ajuda quando o problema é o ambiente (dentro do
      carro, mesa com metal). `clearMetalCalibration()` existia sem chamador; ganhou
      botão próprio.
- [x] **📢 "Compartilhando sua local"** — typo numa notificação que fica meia hora
      na tela. Corrigido, e os textos de notificação foram para `strings.xml` com
      `values-en` e `values-es` novos, para saírem no idioma do aparelho.

### Fechadas do mesmo commit (v7.27)
- [x] **83. 📡 Push do rastreio ao vivo morria com o processo morto** — o
      foreground service só mantinha o processo vivo e quem enviava a posição era
      o `setInterval` do JS. Com `START_STICKY` o processo voltava, mas o timer
      só nasce de novo quando o modal do SOS monta, e até lá a linha ficava
      parada. Agora o serviço faz o push (`LiveTrackingSession.kt`), com
      `START_REDELIVER_INTENT` e sem Intent completo o serviço não sobe em vez
      de derrubar 401 a cada 10 s em silêncio. O JS só manda o primeiro fix e
      passa a contar a contagem decrescente — `ownerRef` evita dois autores a
      oscilar o `updated_at`.
- [x] **84. 🔐 Push nativo sem JWT e sem o par url/anon key** — a RLS de
      `live_shares` compara `user_id` com `auth.uid()`, que vem do token, não de
      um parâmetro. `getCloudAccessToken()` e `cloudEndpoint()` dão o par ao
      nativo a partir da mesma fonte do `supabase-js`, e sem credencial o
      rastreio cai para o JS, que pelo menos avisa.
- [x] **85. 📝 "Novidades" mostrava só a última versão** — quem ficava desatualizado
      nunca via o que tinha perdido, e o build visto era gravado ao *abrir* o
      app: matar o processo com o modal na tela perdia o intervalo para sempre.
      Agora `changelogBetween()` acumula o intervalo e grava-se ao fechar.
- [x] **86. ⏰ Fim de rastreio sem explicação** — a posição some por dois motivos e
      o viewer dizia "🛑 encerrado pela pessoa" nos dois, inclusive no prazo só
      cumprido. Nova RPC `get_live_status` (devolve carimbos, nunca coordenada)
      e `resolveEnd()` no `web/live.html`.
- [x] **78b. 🧪 Testes do cancelamento e do timeout** — fechado junto com o bug:
      o `downloadApk` agora rejeita por aqui quando o nativo resolve `false`, e o
      `UpdateAvailableModal` distingue `download_cancelled` de
      `download_timeout` para não mostrar um erro que o próprio utilizador
      provocou. Coberto por `__tests__/apkUpdate.test.ts`.
- [x] **81b. 🔨 Compilar o Kotlin** — fechado. `./gradlew compileDebugKotlin`
      acusou três coisas que o `tsc` nunca veria: `android.R.drawable.ic_stat_live`
      e `ic_stat_alert` nunca estiveram no SDK público (`android.R.drawable` tem
      174 campos e nenhum é `ic_stat_*`; são recursos `@hide`), e este código
      vinha deles — agora são `R.drawable.*` com dois vetores próprios; `val
      safeName` estava declarado dentro do `try` e usado no `catch`; e o
      `GeomagneticField` desta leva, que também é `@hide`, saiu — o
      `resolveLiveHeading` passou a seguir a mesma ordem de preferência do JS, senão
      a agulha saltava no instante em que o serviço assumia.
- [x] **82b. 🧪 Testes de `applyBackup`** — fechado: `__tests__/backupService.test.ts`
      cobre versão ausente, `0`, string, versão futura e a gravação.

### Dívidas abertas do mesmo commit
- [ ] **71b. 🔐 Verificar SHA-256 do APK antes de instalar** — a descarga passa a ser
      `https`, o que resolve servidor falso mas não o binário trocado no caminho.
      Falta `expectedHash` do release + `crypto` no nativo, e um ecrã de
      "verificando" para não parecer que a instalação falhou.
- [ ] **87. 🧨 `get_live_status` só funciona depois de aplicada no Supabase** —
      aplicada no SQL Editor a 2026-10-03. O que fica é o processo: o
      `publicar-supabase.sh` só mexe em `app_version` e nenhuma das RPCs chega à
      nuvem sozinha, e o `publicar.sh` local idem. Vale um `./scripts/publicar-rls.sh`
      com a service_role, ou um passo no `publicar.sh`, antes que a próxima RPC
      volta a ficar só no repositório.
- [ ] **88. 🧪 Testes do serviço nativo** — o `compileDebugKotlin` garante que
      compila, não que `pushLivePosition` faz o upsert certo nem que o
      `START_REDELIVER_INTENT` traz o Intent de volta. Nenhum dos dois é testável
      em JVM sem extrair o parsing e o payload, que já são funções fora da classe.
- [ ] **89. 🧭 Dois rumos para a mesma linha** — `resolveLiveHeading` do JS e o do
      Kotlin concordam por construção agora, mas nada impede que o próximo que
      mexer num mexa só num. Vale um teste de paridade sobre os dois.

## ✅ Feitos (v7.28 · code 159)
- [x] **90. 🗺️ Mapa novo, sem rede** — não havia forma nenhuma de ver onde se
      está. Entrou um modo "📍 Onde estou" (`MiniMapView`) com três níveis de
      ampliação (400/150/50 m), e a página `web/live.html` ganhou um mini-mapa
      para quem recebe o link do rastreio. Sem tiles e sem pedidos: a projeção é
      uma função pura das coordenadas (`utils/trackProjection.ts`), o que faz o
      desenho funcionar offline por construção. A janela segue a pessoa em vez de
      se ajustar ao percurso, e o breadcrumb só aceita um ponto novo depois de
      5 m — sem isso um GPS parado a oscilar um metro desenhava um trançado.
      Fecha a ideia #48 pela parte que é geolocalização sem base cartográfica.
- [x] **91. 🐛 A nuvem nunca chegou a ligar no telemóvel** — o `createClient` do
      `supabase-js` atirava "Invalid supabaseUrl: Provided URL is malformed."
      porque o Hermes não regista um `URL` global, e a excepção era engolida
      pelo `try/catch` de `cloud.ts`. O `client` ficava `null` e o sintoma era
      "Supabase não configurado" — que manda culpar o projeto e as credenciais.
      Agora a razão verdadeira chega ao diálogo. Este bug arrastava a memória da
      assistente, a procura de novidades e o rastreio ao vivo, e durante várias
      versões ninguém viu nada: o Node tem `URL`, portanto a suite de testes
      nunca o apanhou. O polyfill (`react-native-url-polyfill/auto`) tem de ser o
      primeiro import de `index.js`, e a ordem é verificada por teste — se alguém
      mexer, o aparelho volta a falhar em silêncio.

### Dívidas que ficaram do mesmo commit
- [ ] **92. 📜 O trajecto do viewer vive só na página** — `live_shares` é um
      `upsert` por token: uma linha, um ponto, sem histórico. O que a página
      desenha é o que ela viu desde que abriu, e diz isso por baixo do mapa.
      Quem precisar do percurso completo precisa de uma tabela de pontos.
- [ ] **93. 🗺️ Sem base cartográfica** — o mapa mostra a sua posição, o rumo, o
      círculo de precisão e a escala, mas não ruas nem nomes de rua. É uma
      decisão (zero pedidos, zero tiles, funciona sem rede), não um esquecimento;
      fica escrito para o próximo não tratar a ausência como bug.
- [ ] **94. 🧪 Um bug que só os stubs apanharam** — o `svgNode` do `live.html`
      fazia `setAttribute.apply(node, [[...], [...]])`, e o `apply` com uma
      lista de pares punha o primeiro par como nome e o segundo como valor: o
      `fill` do traço saía `fill,none` e o caminho desenhava-se preenchido a
      preto, sem o traço azul. O `setAttribute` do browser erraria o mesmo,
      portanto isto nunca tinha sido visto em nenhum browser — o `document`
      falso do `liveViewer.test.js` foi que devolveu o erro.
