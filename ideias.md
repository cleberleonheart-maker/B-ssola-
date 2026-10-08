# Ideias — Próximos recursos da Bússola

> Atualizado em 06/10/2026. Backlog antigo **concluído** (v7.3). Novas ideias (v7.4+)
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
- [x] **3. POIs na trilha** — ✅ feito na v7.38: durante a gravação, o botão 📍
      marca o ponto atual com foto (câmera do sistema, mesma da caderneta) e
      nota opcional; os POIs aparecem desenhados sobre o trajeto na
      pré-visualização e na trilha salva, e o contador fica gravado no registro
      (`pois` em `RecordedTrack`, `toPixel` em `trackProjection.ts`).
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
- [x] **12. Elevação no AR** — ✅ feito: na Visão (câmera) o marcador do alvo
      move-se na vertical conforme a elevação real; usando `accel` no
      `CameraARView`, calcula-se a elevação do eixo de visão (via −z) e o FOV
      vertical (do horizontal calibrado × razão do ecrã). Sol/lua mostram `▲/▼`
      (sempre têm elevação); o waypoint ativo e o marco virtual mostram
      `· ▲N°` quando o waypoint e a posição têm altitude — senão ficam na
      altura fixa de sempre. Os cardeais N/E/S/O passam a desenhar-se na linha
      do horizonte. Helpers puros (e testados) em `utils/compass.ts`:
      `viewElevationDeg`, `verticalFovDeg`, `markerTopPct`.
- [ ] **13. Calibração pela Estrela Polar** — usar Polaris para o norte geográfico quando
      visível.
- [ ] **14. Tiles Android** — quick-settings tile para abrir direto num modo.
- [ ] **15. Tema automático** — seguir horário (dia/noite) com transição suave.
- [x] **16. Brilho/keep-awake outdoor** — ✅ feito na v7.36: toggle "Tela sempre
      acesa" em Configurações. Aplica `FLAG_KEEP_SCREEN_ON` na janela da Activity
      (`KeepAwakeModule`, módulo nativo) enquanto o app está aberto — ideal para
      Bússola/Visão/trilha — e relembra a preferência no arranque
      (`@bussola/keepAwake`).
      **Corrigido na v7.39 (code 170)**: ligar/desligar chamava `Window.setFlags`
      na thread do JavaScript, e o Android mata a app com
      `ViewRootImpl$CalledFromWrongThreadException` (`KeepAwakeModule.setEnabled`).
      Passou a correr em `activity.runOnUiThread`, que é a única thread com
      permissão para mexer na janela.

## Ideias novas (23/09/2026)
- [ ] **17. AR sobre a câmera real** — marcar sol/lua/destino com o fundo da câmera
      viva (a camada de marcadores do `CameraARView` já existe; falta unir os dois).
- [ ] **18. Backup e sincronização de notas/waypoints** — revisar o `cloud.ts`
      (`Supabase`): garantir que caderneta e pontos realmente sincronizam por usuário,
      com tratamento de conflito e aviso de offline.
      **Estado a 06/10/2026 — só metade existe.** O que há: `pushNotes` (chamado pelo
      `FieldNotesSheet` ao gravar) e `pushTracks` (chamado pelo `TrackView` ao guardar).
      O que falta: `fetchCloudNotes` e `fetchCloudTracks` existem **sem nenhum chamador**
      — ou seja, a escrita para a nuvem acontece e a leitura nunca; `waypointsService` não
      fala com a nuvem nenhuma; não há detenção de conflito nem aviso de offline. Trocar
      de telemóvel continua a perder os waypoints, e as notas de uma sessão anterior só
      existem onde foram escritas.
- [x] **19. Nível em graus** — ✅ feito: a leitura de bolha mostra agora
      `Pitch N° · Roll N°` no lugar do `X/Y` adimensional. Usa
      `pitchRollDeg(accel)` (novo, `utils/compass.ts`): pitch do eixo Y, roll
      do eixo X, correto em m/s² e em g. O cruzamento com o teodolito continua
      a ser manual: a altura já mostra o ângulo em tempo real. **Atenção:**
      `verticalAngle` do Rezarte tem sinal provavelmente invertido — ver nota
      na 65.
- [ ] **20. Widget do rumo — publicar/validar** — o `widgetService` existe; confirmar se
      o widget está publicado na Play e polir (rumo, pressão, temperatura).
- [x] **21. FOV calibrado por aparelho** — ✅ feito em v7.9: botões −/+ (60°–140°, passo
      10) que gravam por aparelho (`fovService`). A linha ficou por marcar desde 23/09.
- [x] **22. Cadência GPS econômica** — ✅ feito em v7.9: parado (4 leituras sem
      movimento) o watch relaxa para intervalo 20–40 s e filtro 20–50 m, e volta ao fino
      a andar. A linha ficou por marcar desde 23/09.

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
- [x] **26. Metrônomo de passo** — ✅ feito nos modos 👣 Cadência. Bipe agudo
      (1,2 kHz) + vibração por pulso. Dois gatilhos:
      - ⏱️ **No tempo**: BPM ajustável em −/+ de 5 entre 90 e 160 (default 120,
        persistido em `@bussola/cadenceBpm`), contagem de passos e pulso visual
        sincronizado.
      - 🦶 **No seu passo** (v7.35): o acelerômetro sente o impacto real do pé
        no chão e o bipe acompanha a caminhada; contagem de passos reais
        (modo persistido em `@bussola/cadenceMode`).
      Pausar não perde a contagem; sair do modo reinicia. "Kefera, abre o
      metrônomo" reconhece o modo.
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
- [x] **52. 🔐 Assinar só no CI** — o aparelho é `f2fs` e não aplica bits de permissão
      (testado: um arquivo `600` de root é legível por `nobody`), então a senha do
      keystore fica exposta a qualquer processo no aparelho. Movendo o keystore para
      fora — o `--clobber` e os secrets já funcionam — o aparelho nunca vê a chave.

      **Premissa reconfirmada a 2026-10-04**, e é exacta: `su nobody -c cat`
      leu um `600` de root em `/root`. O mount é mesmo `f2fs ... user_xattr,
      acl, ...`.

      **O que trava a ideia, e é o que este parágrafo existe para impedir**: o
      CI tem a chave certa, mas *não se consegue provar*. O secret
      `ANDROID_KEYSTORE_BASE64` é write-only — nem o `gh` nem ninguém o lê de
      volta. O que se confirma é o que já foi provado: três builds seguidos
      (161, 162, 163) saíram do CI e o gate "Confere a assinatura do APK"
      comparou o certificado com `android/app/release-cert.sha256`
      (`a793040…ae77`), batendo certo. O keystore local tem o mesmo
      certificado.

      Apagar `/root/.bussola-keystore/` sem uma cópia fora daqui deixa a chave
      num sítio só, desse sítio não se consegue recuperar, e o pior caso não é
      perder um build: é o Bússola deixar de poder ser actualizado para sempre,
      porque o Android exige a mesma chave e a fuga seria mudar o
      `applicationId` — cada utilizador a perder trilhas, notas e waypoints ao
      reinstalar. Hoje a chave está em dois sítios e um deles é fraco em
      permissões; isso é melhor do que num só e irrecuperável.

      O risco já não é o "segredo trocado em silêncio": o gate "Confere a
      assinatura do APK" compara o certificado com o que está no repositório, e
      uma chave diferente aborta o build antes de publicar seja o que for. O
      risco é só a chave **desaparecer** — aí não há build nenhum, e recuperar
      passa por ter cópia noutro sítio.

      **Feito a 2026-10-10**, nesta ordem:
      1. Backup cifrado (AES-256, PBKDF2 200k) e **verificado por ida e volta**:
         descifrei-o, abri o keystore com `keytool -list` e o certificado deu
         `A7:93…:AE:77`, igual ao de `release-cert.sha256`. Dentro vão o
         keystore, o `password.txt` e um `LEIA-ME.txt` com o alias e o
         certificado; o `ks.b64` ficou de fora por ser o mesmo keystore em
         base64. SHA-256 do `.enc`: `562ce813…d4a1a5`.
      2. `/root/.bussola-keystore/` apagado com `shred`, e varri o aparelho à
         procura de cópias — nenhuma em claro do Bússola sobrou.
      3. `publicar.sh` já não lê `~/.bussola-keystore/`: sem `ANDROID_KEYSTORE_*`
         aborta antes do build, e se o directório voltar a existir avisa que o
         arquivo já não é usado. Assim um `publicar.sh` a correr por engano já
         não assina nada com a chave que actualiza o app de toda a gente.
      4. `PUBLICACAO-ATUALIZACAO.md` actualizado.

      **Falta o dono passar a cópia cifrada para o pendrive** — e apagá-la da
      pasta `Download` depois, conferindo o SHA-256 no destino. A cópia actual
      está em `/sdcard/Download/bussola-chave-producao-2026-10-10.enc`, ou
      seja, ainda dentro do aparelho: mais segura do que a chave em claro, não
      mais segura do que o aparelho.

      Uma coisa que isto não resolve, e que é do mesmo feitio: este aparelho tem
      as chaves de produção de outros projectos na mesma postura fraca
      (`gps-pro/gpspro.keystore` está mesmo na pasta `Download`). Não são
      minhas para mexer, mas o `--clobber` do CI não protege ninguém lá.

### Produto
- [x] **53. 📜 Changelog acumulado** — o `changelogFor` mostra só a entrada da versão
      atual. Quem salta do cod 80 para o 153 vê uma linha e não sabe o que houve no
      meio. Acumular as entradas entre a última versão vista (guardada no
      AsyncStorage) e a atual.
      **Fechado na v7.27 (code 158)** com `changelogBetween()` em
      `services/changelog.ts`: acumula o intervalo, grava-se ao *fechar* o modal
      (a gravação ao abrir perdia o intervalo se o processo morresse com o modal
      na tela) e uma entrada repetida em vários builds aparece uma vez só.
- [x] **54. 🧭 Rumo magnético como reserva** — ✅ feito junto da auditoria pós-v7.26
      (bug nº 4 do commit `362b41b`). `resolveLiveHeading()` em `liveShareService.ts`
      prefere o bearing do GPS e cai na bússola magnética quando ele vem `null` — que é
      o caso do SOS com o aparelho parado no bolso, que é justamente onde o viewer
      ficava sem rumo. Normaliza para 0-360 e trata NaN/Infinity como ausente. O
      `EmergencyModal` passa o rumo num ref para o interval de 10 s. 4 testes em
      `bugfixes.test.ts` + 4 em `liveSession.test.ts`.
- [x] **55. ⏱️ Tirar o "SEM SINAL" piscando** — app empurra a cada 10 s e o viewer
      considera stale acima de 25 s. **Causa raiz confirmada: não era folga do viewer.**
      Com o app em background o Android estrangula o `setInterval` e o `LocationManager`
      para de entregar fix — o caso de uso real (aparelho no bolso durante uma emergência).
      Implementado na 155: `LiveTrackingService` (foreground service `location`) + módulo
      `LiveTracking` + `ACCESS_BACKGROUND_LOCATION`/`FOREGROUND_SERVICE_LOCATION`, com
      notificação persistente e ação "Parar"; sem a permissão o app avisa em vez de prometer
      que funciona. 9 testes em `__tests__/liveTracking.test.ts`.
      Não aumentar o stale do viewer — isso só mascara o sumiço.
      **Fechado em 2026-10-04**: verificado em campo no aparelho, e o `● AO VIVO`
      aguentou com a tela travada. Era o que faltava desde a 155 — o código estava
      pronto há 22 builds e nenhuma das suítes apanha *throttling* do Android, que
      só existe no aparelho. Uma dívida que só o campo fecha é uma dívida que
      nenhuma CI pode fechar; fica escrito para a próxima não a contar como feita
      só porque compila.

- [x] **55b. 💀 Processo morto ≠ timer estrangulado** — a #55 fecha o caso do
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
      **Fechado na v7.27 (code 158)**: o serviço passou a ser dono do push
      (`LiveTrackingSession.kt`), com `START_REDELIVER_INTENT` para o Intent
      voltar com o processo e `ownerRef` para dois autores não oscilarem o
      `updated_at`. **Teste de campo de 2026-10-04**: com a paragem forçada a
      partir das definições, o link passa a `● SEM SINAL` e deixa de actualizar
      — e está certo. A paragem forçada pelo utilizador põe o pacote em estado
      *stopped*, e o Android recusa-se a recomeçar serviço, alarme ou o que for
      até alguém abrir o app; nenhum `START_STICKY` sobrevive a isso, porque o
      sistema não está a matar o processo por falta de memória, está a dizer que
      não quer que corra.
      **O caso que este `START_REDELIVER_INTENT` cobre continua por verificar**
      e é o mais barato de todos: matar o processo por fora, sem marcar o
      pacote — `adb shell kill -9 $(adb shell pidof com.bussola.app)`. O
      `am force-stop` não serve (marca o pacote como *stopped*, o que é o
      teste de hoje) e o `am kill` também não (só mata processos em cache, e
      um serviço em primeiro plano não está). Com o `kill -9` o sistema tem de
      reerguer o serviço e redelregar o Intent; se o link continuar a andar, o
      `onStartCommand` está a fazer o que deve.

- [x] **56. 💥 Relatório de crash** — feito, e sem Sentry. A ideia sugeria o Sentry
      porque dá o stack real, mas o que se pede aqui é mandar o stack e o
      dispositivo de quem usa uma app de emergência para um serviço de terceiro —
      isso é uma decisão do dono, não uma conversa de implementação. A
      infraestrutura para receber já existia, e é o que torna a alternativa
      pequena: `scripts/crashes.sql` entra pelos seis ficheiros que o CI aplica
      sozinho, e o verificador passa a exigir que a tabela existe (que é o que
      impede que o ficheiro fique meses por correr, como aconteceu com o
      `rls.sql`). O que se guarda chega para fechar o bug — mensagem, stack,
      versão, quando, e um fingerprint para contar — e não chega para fazer uma
      lista de quem usa a app: sem device id, sem nome, sem coordenadas.
      O relatório sai no arranque seguinte, nunca durante o crash: uma app que
      acabou de partir não tem rede garantida, e um reporter que lança dentro do
      tratamento do erro é um crash que se reproduz sozinho. Se o Supabase
      recusar, o relatório fica na fila e desiste ao fim de três tentativas — um
      crash sem rede não pode ser um relatório perdido, que era o problema que
      veio resolver. `ErrorUtils` no `index.js` apanha o que o `try/catch` não
      apanha, e um `CrashBoundary` novo apanha o erro de render, que é o caso mais
      comum nesta app e não chegava a lado nenhum. Só JavaScript: um crash nativo
      é outro mecanismo e não é o que mais interessa, porque o bug mais caro e
      mais silencioso aqui não é uma exceção, é o `Log.w` e o link parado quando
      o push do serviço falha. Um reporter de crash não apanha isso.
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
- [x] **30. Aviso de desvio de rota** — ✅ feito na v7.37: no retorno pela trilha,
      a distância ao traço (polilinha, não só vértices) é medida sempre; a mais
      de 30 m entra um banner "⚠️ Fora da rota" com o rumo e a distância até o
      trajeto, mais uma vibração na transição
      (`distanceToTrackPath` em `trackProjection.ts`).

## Ideias novas (23/09/2026, 4ª leva)
- [ ] **31. 🔐 PIN/biometria no app** — trancar o app (privacidade, útil ao compartilhar
      o telefone). Configurável em Configurações.
      **PIN feito na v7.17** (`LOCK_PIN_KEY` em `preferencesService`): criar, trocar,
      remover. **Falta a biometria** — não há `BiometricPrompt` nem dependência nenhuma
      em `src`, portanto quem já destravou o telemóvel com o dedo tem de escrever o PIN
      à mesma. A linha fica aberta pelo que falta, como a #41.
- [x] **32. 🧭 Leitura em mil (militar)** — alternar azimute entre graus e **milésimos**
      (mrad/"mils", 6400/6000). Bom pra quem usa bússola tática.
      **Fechado na v7.23 (code 153)**: `MILS_PER_DEG` em `utils/compass.ts` e a
      opção que escreve o azimute em milésimos na `CompassScreen`. A linha ficou
      por fazer durante as versões todas; o código estava lá desde o primeiro
      backlog.
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
- [x] **38. 💾 Backup completo** — exportar tudo (notas, waypoints, trilhas, calibrações,
      declinação, FOV) como um JSON/PDF para restaurar/transferir.
      **Feito na v7.17** (JSON, com validação de `fileVersion` reforçada no commit
      `2d8b204`). O **PDF** é o que continua por fazer, e já está coberto pela #44
      (relatório da caderneta) — esta linha fecha pela parte que era exportar/restaurar.
- [ ] **39. ⚠️ Aviso de bateria do sistema** — alertar se o Android estiver restringindo
      o app em segundo plano (afeta GPS e câmera contínuos).
- [x] **40. 🧭 Melhoria: rumo inverso sempre visível** — mostrar o rumo de volta em tempo
      real (não só no retorno de trilha), útil em navegação de retorno simples.
- [ ] **41. 🛠️ Gesture de pinch na Visão** — a v7.11 anunciou "pinch (gesto) + botão de
      zoom", mas só o botão ×1–×6 existe: não há `pinch`/`gesture` em
      `CameraARView`. O texto da v7.11 está errado; falta de fato o gesto via
      react-native-gesture-handler (que hoje nem é dependência do projeto).
      **A mentira está corrigida (v7.32, code 163)**: o `wn_campro_desc` dizia
      "use pinça" nos três idiomas e era verdade em nenhum — passou a dizer só
      os botões. A linha continua aberta porque o que falta é o gesto, e isso é
      dependência nativa nova; com o texto certo, já não é promessa vazia.
- [x] **42. 🎨 Tema "sol forte"** — ✅ feito: novo tema `sun` (8º), contraste
      máximo para leitura sob o sol: branco puro e preto puro (21:1), bordas
      quase pretas, cores saturadas escuras o suficiente para passarem 4.5:1
      sobre branco, sem cinzentos nem transparências. Aparece na grelha de
      temas ao lado do Claro; persistência automaticamente válida (a lista de
      temas é a fonte da verdade).
- [ ] **43. ⚡ Performance: memoizar marcos** — evitar recálculo de distância/rumo de
      waypoints a cada fix (já há useMemo parcial; revisar).
- [ ] **44. 🧾 Caderneta: exportar relatório** — gerar PDF/GPX com notas + fotos
      (geo-relato do dia de campo).
- [x] **45. 🧪 Verificação cruzada da calibração** — comparar o norte do app com o
      azimute do sol naquele horário/local (didático, combina Sol + bússola).

## Ideias novas (23/09/2026, 5ª leva — EMF)
- [ ] **46. 🧲 EMF com calibração magnética** — aplicar o hard/soft-iron da calibração
      da bússola no cálculo da magnitude (hoje usa o magnetômetro cru).
- [x] **47. 🧭 EMF: direção da fonte** — ✅ feito: três pastilhas X/Y/Z com as
      componentes filtradas (EMA) e a dominante destacada. Com linha de base
      ("🍃 Ambiente") o dominante é o eixo que mais se afastou do ambiente —
      aponta para a anomalia enquanto caminha; sem ambiente, é o de maior
      magnitude (o que depende da orientação do aparelho). Legenda explicita:
      "Eixo dominante: X". Lógica pura e testada em `utils/emf.ts`.
- [ ] **48. 🗺️ EMF: levantamento geolocalizado** — marcar leituras num mini-mapa
      (heatmap) para mapear fontes numa área.
- [x] **49. ❄️ EMF: travar leitura** — ✅ feito: chip ❄️ Congelar ao lado do valor
      (torna-se ▶️ Retomar). Enquanto congelado o subscription é ignorado —
      ecrã, barra, histórico, min/máx, bipes e vibração ficam no último valor,
      e o 📌 Ponto quente marca o pico congelado. "🍃 Ambiente" fica
      desativado (o valor em ecrã já não é o ambiente). Ao sair do modo a
      leitura volta a correr.

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

      **Nota (implementação da 19/12/2026):** a análise sugere que a convenção
      é mesmo invertida. O fixture de `bugfixes.test.ts` aplica `rotX(rest,
      +deg)` a `rest={x:0,y:0,z:+9,8}` → `y = −9,8·sen deg, z = +9,8·cos deg` e
      chama a isto "topo elevado", mas a física documentada do Android (leitura
      em repouso = reação, aponta para cima) dá `y = +9,8·sen deg` quando o
      topo sobe — e o próprio repo usa esse pressuposto no `restMS`. Ou seja,
      em hardware o `verticalAngle` devolve **negativo** ao mirar para cima,
      invertendo a medição da altura e o ângulo do teodolito. Verificação de
      10 s em campo: na Visão/Altura, apontar o topo para o céu — se marcar
      positivo, está certo; se marcar negativo, trocar `-lateral` por
      `+lateral` em `verticalAngle` (HeightView) corrige, e os tests do
      `bugfixes.test.ts` passam a rodar com o fixture de sinal trocado.
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
      **Em 2026-10-05 descobriu-se que a RPC nunca foi criada na nuvem** — o
      código estava certo e o `resolveEnd()` continuava a cair no `catch` que
      escreve "encerrado". Ver o #87, que é onde ficou o que falta fazer.
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
- [x] **71b. 🔐 Verificar SHA-256 do APK antes de instalar** — a descarga passa a ser
      `https`, o que resolve servidor falso mas não o binário trocado no caminho.
      Falta `expectedHash` do release + `crypto` no nativo, e um ecrã de
      "verificando" para não parecer que a instalação falhou.

      **Código pronto a 2026-10-10**, a nada falta:
      - `ApkDownloaderModule.verify(uri, expected)` lê o ficheiro **já em disco**
        com `MessageDigest` e compara. Escolhi reler do disco em vez de hashear
        durante o download: o que vai ser instalado é o que ficou gravado, e
        reler dá um estado "a verificar" verdadeiro em vez de decorativo.
      - **Se não bater, o ficheiro é apagado.** Deixá-lo na pasta Download seria
        deixar um `.apk` com cara de atualização à espera de o utilizador tocar
        nele a seguir — que é o que ele faria.
      - `apkSha256` e `hashConflict` entram no `AvailableUpdate`; o modal tem
        estado `verifying` e dois erros distintos: `upd_error_hash` (o ficheiro
        não é o anunciado) e `upd_error_hash_conflict` (as fontes discordam, e
        não instalamos).

      **O truque é haver duas fontes, e nenhuma ser o app.** A GitHub calcula um
      `digest` SHA-256 por asset na sua própria infraestrutura, e o CI grava o
      hash na tabela `app_version`. Quem consiga mexer num dos dois esbarra na
      comparação. Confirmei com a v163 em mãos: o `digest` que a GitHub publica
      bate certo com o `sha256sum` do ficheiro descarregado
      (`962f9c3d…8fa881`).

      Um caso que deu a volta: se a release já tiver um asset **mais novo** do que
      a linha da nuvem, os dois hashes são de ficheiros diferentes e compará-los
      acusaria um conflito falso em todas as releases. Só se comparam quando
      `asset.code === cloud.version_code` — e há teste para isso.

      **Feito a 2026-10-10** (v7.33, code 164). A coluna `apk_sha256` já correu
      no SQL Editor e foi confirmada por REST (o `select apk_sha256` devolveu a
      linha em vez de reclamar da coluna), e o CI escreve o hash no mesmo PATCH
      que publica a release — com uma segunda tentativa sem o campo, para a
      coluna em falta nunca partir uma publicação.

- [x] **87. 🧨 As RPCs só chegam à nuvem coladas à mão** — o processo era o que
      ficava, e a ideia sugeria o caminho errado. DDL não passa pelo PostgREST:
      a `service_role` salta a RLS das linhas e continua a ser um cliente REST,
      portanto `./scripts/publicar-rls.sh` com a `service_role` nunca podia
      funcionar. O que corre DDL é a Management API
      (`POST /v1/projects/<ref>/database/query`, com um personal access token da
      conta) ou o `psql` a falar com o Postgres — que é o que o SQL Editor faz.

      **Feito a 2026-10-05**, com dois scripts e um workflow:
      - `scripts/publicar-sql.sh <ficheiro.sql>` — aplica pela Management API
        (ou `psql`, com `SUPABASE_DB_URL`), e **sai com erro** em vez de fingir
        que publicou quando não há chave. O `psql` vai com `ON_ERROR_STOP=1`
        porque sem isso devolve 0 depois de uma frase falhar — que é
        precisamente como se aplica metade de um ficheiro sem dar por isso.
      - `scripts/verificar-nuvem.sh` — o outro meio, e o mais barato: as seis
        tabelas, as três RPCs e a coluna `apk_sha256`, cada uma por uma chamada
        REST com a anon key (que é pública no `cloud.ts`, portanto não é
        segredo e o workflow não precisa de nenhum). Um 200 prova que o objeto
        existe *e* que o `anon` o pode usar. Sai com 1 em `--strict`.
      - `scripts/verificar-sql.mjs` — a metade local, e a que impede a próxima
        vez: corre cada `.sql` **duas vezes** contra um Postgres a sério
        (PGlite, o motor em WASM, 26 MB de devDependency) e depois pergunta ao
        catálogo se as tabelas, as funções — com o nome dos argumentos, que é
        como o PostgREST casa — e a coluna do hash existem. Está no `pretest`,
        portanto corre em cada `npm test` e em cada build do CI. Foi ele que
        apanhou o `melting scope` no minuto a seguir a ser escrito, e apanha-o
        em segundos contra os onze dias que ele lá ficou.
      - `.github/workflows/verificar-nuvem.yml` — repete a verificação em cada
        commit que toque em `scripts/**` ou no `web/live.html`, e põe o resultado
        no resumo do run. Fica num workflow à parte para não gastar sete minutos
        de APK num commit que só mexe em SQL, e para uma falha de rede não
        partir uma release. O job acaba a verde com `::warning::`: um X
        vermelho em todos os pushes até alguém aplicar o SQL treina o olho a
        ignorá-lo.

      **E ao construí-lo, apareceram as duas coisas que ele tinha de apanhar.**
      O `rls.sql` tinha ` melting scope` dentro de um `create table` e
      `oria persistente da assistente` solto no meio de um cabeçalho — o
      ficheiro **nunca correu**, e estava assim desde 2026-09-25 (commits
      `bde86c7` e `01e2a39`). E a `get_live_status` **não existe na nuvem**:
      o `POST /rest/v1/rpc/get_live_status` responde `PGRST202`, com
      `get_live_position` e `get_live_track` a responder 200. Ou seja, o #86
      estava marcado como feito com a RPC escrita no `live_rls.sql` e o
      `resolveEnd()` no `live.html` — e o `resolveEnd()` faz
      `.catch(function () { ended(); })`, ou seja, o 404 da RPC ausente
      escrevia **"🛑 encerrado pela pessoa"** num prazo que só cumpriu. Era a
      mentira que o #86 existia para acabar, outra vez, por causa de um
      ficheiro que ninguém confirmou ter corrido.

      **Fechado em 2026-10-05.** O secret `SUPABASE_ACCESS_TOKEN` existe (um
      token *scoped*, `sbp_fc…`, só deste projecto e com escrita na base de
      dados — um "classic" aparece como Legacy e leva o poder da conta toda,
      fatura incluída), e o workflow aplica os cinco ficheiros sozinho em cada
      commit que os toque. A `get_live_status` está na nuvem: a chamada de
      teste devolve 200 e o `--strict` passa. Já não há nada para colar no SQL
      Editor. Sem o secret, o workflow saltaria a aplicação com um
      `::warning::` que diz o que ficou por aplicar.

      Aplicar na nuvem foi o que apanhou o que o `pretest` não apanha: o
      `rls.sql` e o `app_version.sql` declaravam `version_name` e `update_url`
      como nullable, e na nuvem são NOT NULL — o `insert` de seeding morria com
      23502. O PGlite monta o schema com os mesmos ficheiros, portanto só
      prova que são coerentes consigo próprios; quem prova que batem certo com
      a nuvem é correr lá. Os ficheiros é que se ajustaram. E o primeiro run
     Automation apanhou o workflow ao contrário: `bash -e` com `pipefail` fazia
      o passo de verificação dar vermelho quando a nuvem estava bem.

      De passagem, o login anónimo está ligado (o passo de painel que o #95
      deixou escrito): o `--auth` do verificador confirma, e cada chamada cria
      um utilizador anónimo novo, por isso é opt-in.
- [x] **88. 🧪 Testes do serviço nativo** — o `compileDebugKotlin` garante que
      compila, não que `pushLivePosition` faz o upsert certo nem que
      `START_REDELIVER_INTENT` traz o Intent de volta.
      **Fechado em 2026-10-05** com `__tests__/liveNativeContract.test.ts`
      (15 testes). Não são testes do `Service` — isso exigiria um emulador, e o
      dono trabalha num celular — mas dos contratos de que o `Service` depende,
      que é onde a falha é silenciosa: `pushLivePosition` e `pushLivePoint`
      devolvem só um booleano e não lançam, portanto um payload com uma coluna
      errada dá 400 do PostgREST, o `post()` escreve um `Log.w` e o link congela
      a meio de uma emergência. O que se compara, extraindo as duas pontas dos
      ficheiros reais (nada reescrito à mão, que seria uma terceira cópia a
      divergir em silêncio, como o #89 descreve):

      - as chaves do `payload`/`pointPayload` têm de existir como colunas de
        `live_shares`/`live_points`, e tudo o que é `not null` sem `default` tem
        de ser mandado — `latitude`/`longitude` à força, por terem `default 0`;
      - as seis credenciais que `writeTo` grava no Intent são as mesmas seis
        que `readLiveSession` busca, o prazo é lido com `getLongExtra` (e não
        `getStringExtra`, que daria `null` e um serviço que não sobe), e o
        serviço devolve `START_REDELIVER_INTENT` e não `START_STICKY`;
      - as chaves que `liveTracking.ts` manda no `config` são as mesmas que
        `liveSessionConfig` lê do `ReadableMap`, e o `NativeTrackingConfig` que
        as documenta diz as mesmas que o objecto monta.

      Cada passo da extracção falha com uma mensagem a dizer que já não
      acompanha o ficheiro, em vez de devolver vazio e passar a testar o nada.

      **Dez mutações aplicadas ao fonte de propósito, dez derrubaram a suíte** —
      coluna renomeada no payload, `expires_at` removido do `pointPayload`,
      `anonKey` deixado de ler, `getLongExtra` trocado, `expires_at` tornado
      nullable no SQL, `expiresAt` fora do config, `accessToken: null`,
      `url: null`, guarda-corpo movido para depois do objecto, e `accessToken`
      passado a chamar `getCloudAccessToken()` sem o `.catch`. A sétima
      mutação — `accessToken: null` — é a que interessou: **não caía**, porque o
      teste comparava só nomes de chaves. É o modo de falha mais caro dos dois
      (`getString` → `?: ""` → `isUsable()` falso → `stopSelf`, e o link
      parado sem mensagem), pelo que o teste passou a comparar também os
      valores e de onde vêm.
- [x] **89. 🧭 Dois rumos para a mesma linha** — `resolveLiveHeading` do JS e o do
      Kotlin concordam por construção agora, mas nada impede que o próximo que
      mexer num mexa só num. Vale um teste de paridade sobre os dois.
      **Fechado em 2026-10-04** com `__tests__/liveHeadingParity.test.ts`, que
      translitera as duas funções do `LiveTrackingSession.kt` para JavaScript e
      corre ambas sobre o mesmo fixture — escrever o Kotlin à mão no teste seria
      uma terceira cópia, que divergiria sem ninguém ver. O teste apanhou logo
      quatro divergências, todas no ramo do GPS: o JS publicava o bearing como
      vinha, e o Kotlin normaliza e trata os negativos como sentinel, portanto em
      360° escrevia "360°" no viewer e num `-1` publicava um rumo que é o
      oposto do que o serviço publicava no fix seguinte. O JS passou a ter as
      duas regras do Kotlin (`>= 0` e normalizar). Cada passo da transliteração
      é conferido: se o Kotlin mudar de forma, o teste fica vermelho a pedir
      atenção em vez de comparar duas coisas sem relação.

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
- [ ] **93. 🗺️ Sem base cartográfica** — o mapa mostra a sua posição, o rumo, o
      círculo de precisão e a escala, mas não ruas nem nomes de rua. É uma
      decisão (zero pedidos, zero tiles, funciona sem rede), não um esquecimento;
      fica escrito para o próximo não tratar a ausência como bug.
- [x] **94. 🧪 Um bug que só os stubs apanharam** — o `svgNode` do `live.html`
      fazia `setAttribute.apply(node, [[...], [...]])`, e o `apply` com uma
      lista de pares punha o primeiro par como nome e o segundo como valor: o
      `fill` do traço saía `fill,none` e o caminho desenhava-se preenchido a
      preto, sem o traço azul. O `setAttribute` do browser erraria o mesmo,
      portanto isto nunca tinha sido visto em nenhum browser — o `document`
      falso do `liveViewer.test.js` foi que devolveu o erro.
      **Corrigido** — `web/live.html:404` passa a correr o `for` par a par, com o
      porquê no comentário. A linha continuava por fazer desde a v7.28.

## ✅ Feitos (v7.29 · code 160)
- [x] **95. 📡 O login anónimo dizia "sem user id na resposta"** — o
      `ensureCloudUser` destruturava só o `{ data }` de `signInAnonymously()` e
      descartava o `error`, por isso a razão verdadeira nunca chegava ao ecrã. O
      servidor respondia `422 anonymous_provider_disabled` ("Anonymous sign-ins
      are disabled") porque a entrada anónima estava desligada no projeto
      Supabase, e o alerta mandava procurar um defeito no parsing da resposta.
      Agora o `error` é lido e a frase do servidor aparece no diálogo. É o mesmo
      padrão do #91: a causa existe, só não estava a ser mostrada. Em paralelo,
      ligar "Anonymous sign-ins" no painel do Supabase é o que faz o rastreio
      ao vivo arrancar sem novo APK.


## ✅ Feitos (v7.30 · code 161)
- [x] **96. ⏱ O rastreio ao vivo durava sempre 30 minutos** — `startLiveShare(30)`
      estava com o número escrito à mão no `EmergencyModal`, e o mesmo 30
      aparecia também no rótulo do botão e na mensagem que se envia no
      WhatsApp. Quem traceja uma trilha longa ficava a repetir o link a cada
      meia hora; num recado rápido, pelo contrário, a posição continuava exposta
      muito depois de já não ser preciso. Agora há quatro opções (15 min, 30
      min, 1 h, 2 h) num seletor acima do botão, com a escolha memorizada — num
      SOS, escolher minutos com o dedo é mais um passo entre a decisão e o link
      sair. O texto partilhado deixou de ter a duração escrita dentro e passou
      a ser preenchido com a escolha, para não voltar a mentir quando a opção
      muda.


## ✅ Feitos (v7.31 · code 162)
- [x] **92. 📜 O trajecto do viewer vivia só na página** — `live_shares` é um
      `upsert` por token: uma linha, um ponto, sem histórico. O que a página
      desenhava era o que ela tinha visto desde que abriu, e confessava isso por
      baixo do mapa; quem abrisse o link vinte minutos depois do início via só
      uma recta do ponto actual, sem o caminho andado. Agora há uma segunda
      tabela, `live_points`, onde cada fix é uma linha nova em vez de uma
      sobrescrita: `live_shares` continua a ser a "posição agora" e a fonte da
      verdade sobre se a sessão está viva, `live_points` é a memória do percurso.
      O viewer lê o trajecto por uma RPC que devolve só o que apareceu depois do
      último ponto (`id > after`), pelo `id` e não pelo relógio — o `id` é denso
      e monotono, portanto "depois do ponto N" não tem buracos nem empates, ao
      passo que `recorded_at` pode vir repetido (o serviço e o JS gravam no mesmo
      segundo) e faria o viewer saltar pontos ou repetir o último. O preço é o
      ponto gravado depois da posição e nunca antes: publicar um ponto de uma
      sessão que não arrancou deixaria um trajecto no servidor sem linha que o
      justificasse, e perder um troço do caminho é melhor do que perder o link.
      O Android grava pela mesma via do `pushLivePosition` de sempre, e o mesmo
      filtro de 5 m da janela evita o trançado com o GPS parado a oscilar.
      O `scripts/live_points.sql` foi aplicado no SQL Editor (verificado a
      2026-10-04: a `get_live_track` responde), portanto a tabela e a RPC já
      estão na nuvem — o que resta é o processo do #87, que agora tem mais um
      ficheiro na fila.


## ✅ Feitos (v7.32 · code 163)
- [x] **89. 🧭 Dois rumos para a mesma linha** — fechado; ver a nota acima, onde
      ficou. Resumo: `__tests__/liveHeadingParity.test.ts` translitera as duas
      funções do `LiveTrackingSession.kt` e apanhou quatro divergências no ramo
      do GPS (360, 725, -1 e -90), porque o JS publicava o bearing como vinha e
      o Kotlin normaliza e trata os negativos como sentinel do `hasBearing()`.
      A agulha saltava no instante em que o serviço assumia.
- [x] **41. 📷 O texto da Visão prometia uma pinça que não existe** — o
      `wn_campro_desc` do build 142 diz "use pinça ou os botões ×1–×6" nos três
      idiomas, e não há pinça: o `CameraARView` só tem os botões e o
      `react-native-gesture-handler` nunca chegou a ser dependência. Toda a
      gente que actualizou desde a 7.11 leu uma promessa falsa. Passou a dizer
      o que existe. A #41 fica aberta pelo que falta (o gesto), que é
      dependência nativa nova — mas já não é falsa.
- [x] **55. ⏱️ Tirar o "SEM SINAL" piscando** — teste de campo verificado em
      2026-10-04 no aparelho: com a tela travada o `● AO VIVO` aguentou. Fica a
      nota onde está, com o porquê de só o campo fechar esta uma.
- [x] **55b. 💀 Processo morto ≠ timer estrangulado** — o código fechou na
      v7.27 (o serviço passou a ser dono do push). O teste de campo de
      2026-10-04 foi feito com a paragem forçada a partir das definições, e o
      `● SEM SINAL` que apareceu está certo: essa paragem põe o pacote em
      estado *stopped* e nenhum serviço se levanta até alguém abrir o app. O
      caminho que falta é o do sistema a matar o processo por memória
      (`adb shell kill -9`, não `force-stop`), que é o que o
      `START_REDELIVER_INTENT` deve suster — está anotado na nota do item.
- [x] **Limpeza de marcas erradas** — #94, #53 e #32 estavam por fazer com o
      código no sítio há várias versões: o `svgNode` do `live.html` tem o `for`
      correcto desde a v7.28, o `changelogBetween` existe desde a v7.27 e os
      mils estão na `CompassScreen` desde a v7.23. Uma lista de dívidas em que
      metade já não é dívida é pior do que nenhuma: faz o próximo duvidar das
      que são.

## Ideias novas (06/10/2026, 8ª leva)
Saem do trabalho da retenção de 90 dias (`deleteExpired*`), da revisão do
pipeline de crashes e de uma passagem pela lista para apanhar o que já estava
feito por engano por marcar. Não repetem as 46 linhas que continuam abertas —
a nota de cada uma diz o que a distingue da ideia vizinha.

### Risco / processo
- [x] **97. 🔄 Verificador de produção agendado** — o `verificar-crashes.mjs` já
      apanhou coisas, mas corre "quando se mexe em `crashes.sql` ou `cloud.ts`",
      ou seja, corre quando alguém se lembra. Um workflow semanal (cron) com o
      mesmo caminho — sessão anónima, insert, leitura, delete, limpeza do prazo,
      e limpeza total no fim — faria uma regressão de RLS ou uma coluna em
      falta aparecer numa segunda-feira e não quando o utilizador der por ela.
      É o mesmo argumento do `verificar-nuvem.yml`, que já existe e prova que o
      formato funciona; a diferença é que este escreve, portanto tem de garantir
      que não deixa lixo (já garante: o último passo conta os tokens
      `verificacao-%` e falha se sobrar algum).

      **Fechado em 06/10/2026** com `.github/workflows/verificar-crashes.yml`:
      `schedule` (segunda às 4h17 **de Brasília** — escrito `17 7 * * 1`,
      porque o `cron` do Actions é UTC; a mesma hora da purga comentada no
      `crashes.sql`), `push` pelos caminhos do crash (`crashes.sql`,
      `live_points.sql`, o script, o `cloud.ts` e o próprio workflow) e
      `workflow_dispatch`. Sem segredo nenhum — a URL e a anon key são do
      `cloud.ts`. Três decisões: **fala a vermelho**, ao contrário do schema,
      que avisa com `::warning::` (lá um X persistente treinava o olho;
      aqui uma falha é acção); o `-e` do shell default do GitHub matava o
      passo no primeiro exit 1 e levava o resumo do run consigo, portanto o
      código sai por `|| status=$?` e volta a sair no fim; e o `npm ci` com
      cache, porque o script só precisa do `@supabase/supabase-js`, mas o
      `postinstall` do `patch-package` quer os devDependencies.
- [x] **98. 🧹 Linhas sem dono** — feito. O `scripts/limpar-orfaos.mjs` apaga, com a
      `service_role`, as linhas com `expires_at` vencido de quem já não tem sessão
      nenhuma (conta apagada, sessão que morreu sem nunca mais abrir a app) — o
      caso que a limpeza do lado do utilizador (`deleteExpired*`) não alcança,
      porque o `auth.uid()` do DELETE já não é o dela. Lista branca de três
      tabelas (`crashes`, `live_points`, `live_shares`), cada uma com o seu corte
      escrito à mão; `live_shares` fica 90 dias além do prazo, que é o que
      permite ao viewer dizer "expirou" em vez de "encerrado". Corre de madrugada
      pelo `.github/workflows/limpar-orfaos.yml` (4h17 de Brasília, a mesma hora
      da purga comentada no `crashes.sql`) e, a cada commit que toque no script,
      corre em modo `--apenas-contar` — conta sem escrever. As `notes`, `tracks`
      e `virgin_memory` continuam fora: não expiram, e o órfão delas é a conta
      apagada sem apagar dados, que é a #101.

### Produto
- [x] **99. 🩺 Estado da nuvem em Configurações** — feito (`bb41d67`). Um painel com o que o
      código já sabe e hoje ninguém lê: se o cliente está ligado e com que
      razão não está (`clientError`, que o #91 passou a mostrar mas só quando
      algo rebenta), a última falha gravada pelo `noteCloudError` (que
      `takeCloudError` entrega e depois limpa — logo, desaparece), a fila de
      crashes por enviar e a última sincronização. Não é diagnóstico de
      sensores (a #64 é isso): é a resposta a "está a chegar à nuvem, ou não?".
      Baseia-se no #91 e no #95, que ambos acabaram por mostrar a causa ao
      utilizador — mas só no momento do erro.
- [x] **100. 🗂️ Histórico de partilhas** — feito (v7.40). `fetchLiveShareRow` lê uma sessão
      pelo token, e só a que estava viva; não havia ecrã que dissesse "ontem
      mandei um link às 21h04 que durou 30 min". Dois lados:
      **guardar** — parar deixou de apagar a linha e passa a escrever
      `stopped_at` (`markLiveShareStopped`), com o DELETE como reserva quando a
      marca não pegou: apagar era apagar a prova de que a sessão existiu. A RPC
      `get_live_position` e `get_live_track` passam a esconder as paradas
      (`stopped_at is null`), o `get_live_status` passa a devolver a coluna
      `stopped`, e o `web/live.html` distingue "a pessoa parou" de "expirou"
      mesmo com o prazo ainda por vencer. O trajecto dos pontos sai em
      `markLiveShareStopped`, como saía quando o Parar apagava tudo.
      **mostrar** — `ShareHistorySection` em Configurações, um toque a mais
      depois da secção da nuvem: lista as sessões do próprio (a RLS não deixa
      outras) por início, duração e estado, só com os carimbos de tempo — a
      coordenada de uma sessão que acabou não volta a entrar no aparelho. A
      lógica de estado fica em puro em `src/utils/shareHistory.ts` (parada
      ganha a expirada: dizer "expirou" a uma sessão que a pessoa parou seria
      mentir sobre a decisão dela).
- [x] **101. 🚪 Apagar a minha conta e os dados** — feito (v7.41). Um botão
      em Configurações (secção "Conta") com confirmação a dizer o que se perde,
      porque as tabelas já tinham política de DELETE com `user_id = auth.uid()`
      (`tracks`, `notes`, `virgin_memory`, `crashes`, `live_points`,
      `live_shares`) — o caminho existia e era só do utilizador; faltava o
      botão. Duas metades: **na base** (`scripts/account_delete.sql`), a RPC
      `delete_my_account()` com `SECURITY DEFINER` apaga as linhas das seis
      tabelas e a conta em `auth.users` numa transação; apagar o utilizador não
      é REST, o cliente do Supabase não se remove a si próprio, e a RLS por si
      só não alcançava `auth` — por isso a função corre com os poderes de quem
      a criou e confia só no `auth.uid()` do JWT (sem sessão, a anon key
      sozinha devolve `false` e não toca em nada). **no cliente**
      (`deleteMyAccount`) chama a RPC e faz `signOut` a seguir, e limpa o id em
      memória para a sincronização seguinte começar com conta nova. É também a
      resposta ao problema que o repositório tem mesmo: cada execução do
      `verificar-crashes.mjs` e cada aparelho novo criam uma conta anónima, e a
      única forma de a tirar era o Table Editor.
- [ ] **102. 🔗 Anónimo com conta real** — o `ensureCloudUser` cria uma
      sessão anónima e é o único caminho: perder o telemóvel é perder a nuvem
      toda (notas, trilhas, memória da assistente), porque o `auth.uid()` novo
      não lê as linhas do antigo. Um email com link mágico (o Supabase já
      traz `signInWithOtp`) ligaria a identidade a algo que sobrevive ao
      aparelho. **A parte difícil está escrita aqui para não se descobrir a
      meio**: migrar as linhas do utilizador anónimo para o novo exigiria
      mudar o `user_id` deles, e a própria RLS que os protege impede o cliente
      de o fazer — é trabalho para uma função com `security definer` ou para o
      `service_role`, com o risco que isso traz. Fica a ideia com o travão à
      vista.
- [ ] **103. 🔋 Quem vê o link precisa de saber que a bateria vai** — com o
      rastreio ativo, o telemóvel a morrer de bateria dá o mesmo que um
      aparelho desligado: `● SEM SINAL` para sempre, sem explicação. As
      ideias #8 e #29 põem a bateria **no SOS** (quem envia), e a #39 fala do
      Android a restringir o app; esta é a terceira face: pôr a % no payload
      que o viewer já lê, para quem recebe o link decidir telefonar em vez de
      esperar. O `live_shares` já tem colunas de sobra para isto e o push
      já passa por lá de 10 em 10 segundos.
- [ ] **104. 🌩️ Alarme de queda rápida da pressão** — o `TrendChart` do
      barômetro mostra a tendência, mas mostra a quem está a olhar para o
      ecrã. A regra clássica de campo (queda de ~4 hPa em 3 h, ou mais
      abrupta) é barata de calcular com o histórico que já existe no
      aparelho, e o caso de uso é justamente o em que ninguém está a olhar:
      dentro da tenda, à noite. Não depende de rede nem de API nenhuma.
- [ ] **105. 🧭 Partilhar a posição a partir do widget** — o widget mostra
      rumo, pressão e temperatura, e é só leitura. Um botão nele (ou um atalho
      no `quick settings`, que é a #14 — aqui é o widget da tela inicial) para
      arrancar/parar o rastreio é o que um SOS pede: o telemóvel está na mão,
      a app não. A infra já está toda do lado de dentro — `startLiveShare`,
      o serviço em primeiro plano e a notificação com "Parar" existem; o que
      falta é o `WidgetBridge` ganhar uma ação em vez de só texto.
