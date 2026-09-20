# Ideias — Próximos recursos da Bússola

> Atualizado em 20/09/2026. Duas seções: o que foi **escolhido para agora** e o **backlog**.

## ✅ Feitos (v7.2)
1. **Índice de vento** — novo modo `🍃 Vento` em `WindView`: mede a turbulência do vento
   pelo microfone (RMS nativo em `MicLevelModule`), exibe **índice relativo 0–100%**, com
   calibração simples (gravar "zero" e "vento forte"), min/máx de sessão, histórico,
   bipes proporcionais e aviso honesto de que é um índice relativo (sem km/h).

## ✅ Feitos (v99)
1. **Seta até o waypoint** — `TargetNavBar` no modo Bússola com seta girando conforme o
   rumo, distância e ângulo; vibra e avisa ao chegar (≤15 m).
2. **Compasso falado** — toggle em Configurações > Bússola; anuncia rumo e distância
   (a cada ~9 s) via `assistant/voice.ts`.
3. **SOS com localização real** — `EmergencyModal` ganhou botões diretos de **WhatsApp** e
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

## Backlog

### Navegação / outdoor
- Rota / trilha gravada: registrar o caminho percorrido (track), salvar no Supabase por
  usuário, desenhar no mapa, mostrar distância percorrida + elevação.
- Coordenadas em múltiplos formatos: DMS, decimal, UTM + link pra abrir no Google Maps/Waze.
- Caderneta de campo: anotar observações amarradas ao ponto (foto + nota + coords).
- Widget / atalho rápido: temperatura, pressão e rumo na tela inicial.

### Segurança
- Chegada no destino: notificação automática ao chegar num waypoint (geofence).

### Assistente Kefera (voz)
- Falar coordenadas/altitude sob comando ("Kefera, qual a coordenada?"), julgar distância
  até o waypoint.

### AR
- Ver distância até um waypoint sobreposto na cena (já tem `CameraARView`) — seta no AR.
- Marco virtual: cravar uma seta no AR num ponto salvo.
- ✅ Tela preta da Visão (`CameraARView`) corrigida em v7.2: nunca fica preta — marcadores
  N/S/E/W + rumo sempre visíveis, chip compacto "iniciando câmera" no warm-up e fallback
  gráfico com conteúdo + botão "tentar novamente" (antes: cover opaco de tela cheia).

### Sensores / astronomia / extras
- Modo noturno: ajustar brilho da tela e glows nas tramas escuras.
- Calibração do detector de metais (ajuste fino de sensibilidade).
- Anemômetro/som de vento (briza lida pelo microfone) — ✅ feito em v7.2 como **índice de
  vento** relativo com calibração (celulares sem barômetro precisam de uma referência).