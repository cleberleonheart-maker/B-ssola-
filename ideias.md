# Ideias — Próximos recursos da Bússola

> Atualizado em 21/09/2026. Backlog antigo **concluído** (v7.3). Novas ideias (v7.4+)
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
- [ ] **33. 📸 Waypoint pela câmera** — marcar um ponto distante sem chegar perto: 2+
      avistagens de lugares diferentes cruzam os rumos e **estimam a coordenada**
      (complemento da triangulação #27, usando teodolito + AR).
- [ ] **34. 🗺️ Atalho de volta (linha reta)** — na trilha, além do retorno pelo trajeto,
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
- [ ] **40. 🧭 Melhoria: rumo inverso sempre visível** — mostrar o rumo de volta em tempo
      real (não só no retorno de trilha), útil em navegação de retorno simples.
- [ ] **41. 🛠️ Gesture de pinch na Visão** — o vision-camera v5 não expõe pinch; fazer
      zoom por gesto com react-native-gesture-handler (além do botão ×1–×6).
- [ ] **42. 🎨 Tema "sol forte"** — tema de alto contraste para leitura outdoor sob sol
      direto (além do Noturno e Neon).
- [ ] **43. ⚡ Performance: memoizar marcos** — evitar recálculo de distância/rumo de
      waypoints a cada fix (já há useMemo parcial; revisar).
- [ ] **44. 🧾 Caderneta: exportar relatório** — gerar PDF/GPX com notas + fotos
      (geo-relato do dia de campo).
- [ ] **45. 🧪 Verificação cruzada da calibração** — comparar o norte do app com o
      azimute do sol naquele horário/local (didático, combina Sol + bússola).