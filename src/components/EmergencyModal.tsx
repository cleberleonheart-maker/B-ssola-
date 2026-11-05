import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Share,
  Linking,
  Platform,
  Alert,
  Vibration,
} from 'react-native';
import {
  startLiveShare,
  stopLiveShare,
  pushLiveFix,
  livePushError,
  livePushCredentials,
  liveLink,
  liveCountdown,
  liveDurationLabel,
  getActiveLiveSession,
  type LiveSession,
} from '../services/liveShareService';
import {
  LIVE_DURATION_OPTIONS,
  DEFAULT_LIVE_DURATION,
  loadLiveDuration,
  saveLiveDuration,
  type LiveDuration,
} from '../services/preferencesService';
import {
  startLiveTracking,
  stopLiveTracking,
  hasBackgroundLocation,
  type LiveTrackingOwner,
} from '../services/liveTracking';
import { useTheme } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { spacing, radius } from '../theme/colors';
import { cardinalOf, formatCoord, formatTime } from '../utils/compass';
import { hasLocationFix } from '../utils/geo';
import { formatAltitude, formatAccuracy } from '../utils/units';
import { getBatteryLevel } from '../services/battery';
import { getNetworkInfo } from '../services/network';
import { setWidgetShareState } from '../services/widgetService';
import { loadEmergencyContact } from '../services/preferencesService';
import {
  buildMessage,
  normalizeBeaconContact,
  sendBeaconSms,
} from '../services/emergencyBeacon';
import { hasCountryCode, phoneForWhatsApp } from '../utils/beacon';
import { buildSosMessage, sosCountdownTick, SOS_COUNTDOWN_SECONDS } from '../utils/sos';
import { sendSmsSilently } from '../services/sosSender';
import type { LocationFix } from '../services/locationService';

type Props = {
  visible: boolean;
  onClose: () => void;
  location: LocationFix;
  heading: number;
  place: { name: string; cep: string | null } | null;
  /** Chamado quando o beacon é disparado, para o ciclo recomeçar. */
  onBeaconSent?: () => void;
};

const EmergencyModal = ({
  visible,
  onClose,
  location,
  heading,
  place,
  onBeaconSent,
}: Props) => {
  const { colors } = useTheme();
  const { t } = useLanguage();

  // "Sem fix" é latitude E longitude zeradas; usar `&&` desabilitaria o SOS
  // para quem está exatamente no equador (latitude 0).
  const hasFix = hasLocationFix(location);
  const locationRef = useRef(location);
  const headingRef = useRef(heading);

  /**
   * Bateria no alerta (#29): quem recebe um SOS precisa de saber se o aparelho
   * de quem pediu ajuda está a chegar ao fim — muda o que fazer com a
   * informação. Lida na montagem e a cada minuto; um valor nulo (iOS, ou
   * aparelho sem a API) simplesmente não entra no texto.
   */
  const [battery, setBattery] = useState<number | null>(null);
  const [network, setNetwork] = useState<{ operator: string | null; type: string | null }>({
    operator: null,
    type: null,
  });
  /**
   * Contato do beacon (ideia #6). Carregado quando o modal abre: o número
   * guardado em Configurações > SOS é o destino do SMS.
   */
  const [beaconContact, setBeaconContact] = useState('');

  useEffect(() => {
    if (!visible) return;
    let mounted = true;
    loadEmergencyContact()
      .then(async contact => {
        // O contacto guardado pode estar em formato local; ao abrir o modal
        // passa-se ao internacional (e grava-se), para o WhatsApp e o SMS
        // chegarem ao número certo.
        const { contact: normalizado } = await normalizeBeaconContact(contact || '');
        if (mounted) setBeaconContact(normalizado);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [visible]);
  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      const level = await getBatteryLevel();
      if (mounted) setBattery(level);
      const ni = await getNetworkInfo();
      if (mounted) setNetwork(ni);
    };
    refresh();
    const id = setInterval(refresh, 60000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  useEffect(() => {
    headingRef.current = heading;
  }, [heading]);

  const shareText = useMemo(() => {
    if (!hasFix) return '🆘';
    const phoneLine =
      `https://maps.google.com/?q=${location.latitude.toFixed(6)},${location.longitude.toFixed(6)}`;
    const rawLines = [
      `🆘 ${t('em_message')}`,
      '',
      `• ${t('em_position')}: ` +
        `${formatCoord(location.latitude, true)}, ${formatCoord(location.longitude, false)}`,
      `• ${phoneLine}`,
    ];
    if (place) {
      rawLines.push(`• ${place.name}`);
    }
    if (location.accuracy != null) {
      rawLines.push(`• ${t('em_accuracy')}: ±${formatAccuracy(location.accuracy)}`);
    }
    if (location.altitude != null) {
      rawLines.push(`• ${t('em_altitude')}: ${formatAltitude(location.altitude)}`);
    }
    rawLines.push(`• ${t('em_heading')}: ${Math.round(heading)}° ${cardinalOf(heading).full}`);
    if (battery != null) {
      rawLines.push(`• ${t('em_battery')}: ${battery}%`);
    }
    if (network.operator) {
      rawLines.push(`• ${t('em_network')}: ${network.operator}${network.type ? ` (${network.type})` : ''}`);
    } else if (network.type) {
      rawLines.push(`• ${t('em_network')}: ${network.type}`);
    }
    if (location.updatedAt) {
      rawLines.push(`• ${formatTime(location.updatedAt)}`);
    }
    return rawLines.join('\n');
  }, [t, location, heading, place, hasFix, battery, network]);

  const share = async () => {
    if (!hasFix) return;
    try {
      await Share.share(
        {
          message: shareText,
          url: `https://maps.google.com/?q=${location.latitude.toFixed(6)},${location.longitude.toFixed(6)}`,
        },
        { dialogTitle: t('em_share_title') },
      );
    } catch {
      // compartilhamento cancelado ou indisponível
    }
  };

  /**
   * Abre o WhatsApp a falar com o contacto de emergência.
   *
   * O número vai em formato internacional (só dígitos), que é o que o
   * WhatsApp resolve: com o número local, o WhatsApp responde que o número
   * não está no WhatsApp — e está; o formato é que não bate.
   *
   * Sem contacto guardado, o WhatsApp abre para se escolher a quem escrever.
   */
  const openWhatsApp = async () => {
    if (!hasFix) return;
    const text = encodeURIComponent(shareText);
    const contact = beaconContact?.trim();
    if (!contact) {
      try {
        await Linking.openURL(`whatsapp://send?text=${text}`);
      } catch {
        try {
          await Linking.openURL(`https://wa.me/?text=${text}`);
        } catch {
          Alert.alert(t('em_title'), t('em_direct_unavailable'));
        }
      }
      return;
    }

    if (!hasCountryCode(contact)) {
      Alert.alert(t('em_title'), t('em_whatsapp_no_country', { number: contact }), [
        { text: t('em_close'), style: 'cancel' },
        {
          text: t('em_whatsapp_fix'),
          onPress: () => {
            Linking.openSettings().catch(() => {});
          },
        },
      ]);
      return;
    }

    const number = phoneForWhatsApp(contact);
    try {
      await Linking.openURL(`whatsapp://send?phone=${number}&text=${text}`);
    } catch {
      try {
        await Linking.openURL(`https://wa.me/${number}?text=${text}`);
      } catch {
        Alert.alert(t('em_title'), t('em_direct_unavailable'));
      }
    }
  };

  const [liveSession, setLiveSession] = useState<LiveSession | null>(null);
  const [liveBusy, setLiveBusy] = useState(false);
  const [liveMinutes, setLiveMinutes] = useState<LiveDuration>(
    DEFAULT_LIVE_DURATION,
  );
  const [, setTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionRef = useRef<LiveSession | null>(null);
  /**
   * Quem esta gravando a posicao. Com o servico no ar, ele e o dono e este
   * `setInterval` vira so a contagem regressiva: dois autores na mesma linha
   * fariam o `updated_at` oscilar e o viewer a piscar entre eles.
   */
  const ownerRef = useRef<LiveTrackingOwner>('js');

  const clearTicker = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const endSession = useCallback(
    (s: LiveSession) => {
      clearTicker();
      sessionRef.current = null;
      setLiveSession(null);
      void stopLiveTracking();
      void stopLiveShare(s.token);
    },
    [clearTicker],
  );

  const startTicker = useCallback(
    (s: LiveSession, owner: LiveTrackingOwner) => {
      clearTicker();
      sessionRef.current = s;
      ownerRef.current = owner;
      setLiveSession(s);
      timerRef.current = setInterval(() => {
        if (Date.now() > s.expiresAt) {
          endSession(s);
          return;
        }
        setTick(v => v + 1);
        if (ownerRef.current === 'js') {
          void pushLiveFix(s, locationRef.current, headingRef.current);
        }
      }, 10000);
    },
    [clearTicker, endSession],
  );

  /**
   * Sobe o servico que assume o push e devolve quem ficou com a posicao.
   *
   * `prompt` e `false` na retomada: reabrir o app e abrir o modal do SOS nao
   * pode arrancar um dialogo de permissao na cara de quem so esta olhando a
   * tela. Sem permissao o dono volta a ser o JS e o rastreio segue valendo com
   * o app aberto, que e o que o aviso abaixo diz.
   */
  const ensureService = useCallback(
    async (
      s: LiveSession,
      prompt: boolean,
    ): Promise<LiveTrackingOwner> => {
      if (!prompt && !(await hasBackgroundLocation())) return 'js';
      const credentials = await livePushCredentials(s);
      if (!credentials) return 'js';
      const tracking = await startLiveTracking({
        ...credentials,
        expiresAt: s.expiresAt,
      });
      if (tracking.owner === 'service' && !tracking.backgroundLocation) {
        Alert.alert(t('live_title'), t('live_bg_denied'));
      }
      return tracking.owner;
    },
    [t],
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      const active = await getActiveLiveSession();
      if (!mounted || !active) return;
      const owner = await ensureService(active, false);
      if (mounted) startTicker(active, owner);
    })();
    return () => {
      mounted = false;
      clearTicker();
    };
  }, [clearTicker, ensureService, startTicker]);

  /**
   * A duração escolhida da última vez é o default.
   *
   * Num SOS, escolher minutos com o dedo é mais um passo entre a decisão e o
   * link a ser enviado. Guarda-se o valor para o seletor já vir com o que a
   * pessoa costuma usar, e um valor gravado fora da lista (ou lixo) cai no
   * default em vez de fazer o rastreio durar uma duración que ninguém escolheu.
   */
  useEffect(() => {
    let mounted = true;
    (async () => {
      const saved = await loadLiveDuration();
      if (mounted) setLiveMinutes(saved);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const chooseDuration = (minutes: LiveDuration) => {
    setLiveMinutes(minutes);
    void saveLiveDuration(minutes);
  };

  /**
   * Arranca o rastreio ao vivo e devolve a sessão.
   *
   * Separado do `startLive` porque o modo de assalto (ideia #107) não pode
   * abrir o menu de partilha do sistema: quem está a ser assaltado não pode
   * ter um ecrã com a lista de apps à vista. O link vai no SMS, em silêncio.
   */
  const startLiveSession = useCallback(
    async (quiet = false): Promise<LiveSession | null> => {
      if (!hasFix || liveBusy) return sessionRef.current;
      setLiveBusy(true);
      try {
        const s = await startLiveShare(liveMinutes);
        if (!s) {
          if (!quiet) Alert.alert(t('live_title'), t('live_need_cloud'));
          return null;
        }
        // O primeiro fix continua sendo do JS: e o que aborta a sessao se o
        // upsert falhar, em vez de mandar um link que ninguem vai ver.
        const sent = await pushLiveFix(s, locationRef.current, headingRef.current);
        if (!sent) {
          // Ler a causa ANTES do `stopLiveShare`: a limpeza volta a chamar
          // `ensureCloudUser` e, se voltar a falhar, sobrescreve a razao original
          // com a dela.
          const cause = livePushError();
          await stopLiveShare(s.token);
          // A causa entra no diálogo: "não foi possível" sem dizer o quê obriga a
          // eliminar por tentativa, e quem está a tentar arrancar o rastreio pode
          // estar numa emergência.
          if (!quiet) {
            Alert.alert(
              t('live_title'),
              t('live_error') + (cause ? `\n\n${cause}` : ''),
            );
          }
          return null;
        }
        const owner = await ensureService(s, true);
        startTicker(s, owner);
        // O widget passa a dizer "Parar" (ideia #105): quem o tiver no ecrã
        // principal pode cortar o rastreio sem abrir a app.
        setWidgetShareState(true, Date.now());
        return s;
      } catch {
        if (!quiet) Alert.alert(t('live_title'), t('live_error'));
        return null;
      } finally {
        setLiveBusy(false);
      }
    },
    [hasFix, liveBusy, liveMinutes, t, ensureService, startTicker],
  );

  const startLive = async () => {
    if (!hasFix || liveBusy || sessionRef.current) return;
    const s = await startLiveSession();
    if (!s) return;
    try {
      await Share.share({
        message:
          t('live_shared', { time: liveDurationLabel(liveMinutes) }) + ' ' + liveLink(s),
      });
    } catch {}
  };

  const stopLive = async () => {
    const s = sessionRef.current;
    if (!s) return;
    setLiveBusy(true);
    try {
      await stopLiveShare(s.token);
      clearTicker();
      void stopLiveTracking();
      sessionRef.current = null;
      setLiveSession(null);
      setWidgetShareState(false, 0);
    } finally {
      setLiveBusy(false);
    }
  };

  const openSms = async () => {
    if (!hasFix) return;
    const text = encodeURIComponent(shareText);
    const url = Platform.OS === 'ios' ? `sms:&body=${text}` : `sms:?body=${text}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(t('em_title'), t('em_direct_unavailable'));
    }
  };

  /**
   * Beacon de emergência (ideia #6): a posição, a bateria e a rede vão por
   * SMS ao contacto guardado. Sem contacto guardado não há para onde ir, e
   * o aviso diz isso em vez de falhar em silêncio.
   */
  const sendBeacon = async () => {
    if (!beaconContact) {
      Alert.alert(t('sos_beacon_send'), t('sos_beacon_no_contact'));
      return;
    }
    const message = buildMessage({
      latitude: hasFix ? location.latitude : null,
      longitude: hasFix ? location.longitude : null,
      accuracy: location.accuracy ?? null,
      altitude: location.altitude ?? null,
      battery,
      network: network.operator ?? network.type ?? null,
    });
    const opened = await sendBeaconSms(beaconContact, message);
    if (!opened) {
      Alert.alert(t('sos_beacon_send'), t('sos_beacon_fail'));
      return;
    }
    onBeaconSent?.();
    Alert.alert(t('sos_beacon_send'), t('sos_beacon_ready'));
  };

  /**
   * Modo de assalto (ideia #107).
   *
   * Um botão só: manda o aviso ao contacto guardado em silêncio e liga o
   * rastreio ao vivo, para que quem recebe o SMS veja por onde a pessoa vai
   * e não só onde ela estava.
   *
   * A contagem de 5 segundos é o que separa "discreto" de "acidente": um
   * toque no bolso não pode disparar o SOS. Cancelar está sempre à vista.
   */
  const [sosCountdown, setSosCountdown] = useState<number | null>(null);
  const [sosBusy, setSosBusy] = useState(false);

  const cancelarSos = useCallback(() => {
    setSosCountdown(null);
  }, []);

  const dispararSos = useCallback(async () => {
    setSosCountdown(null);
    setSosBusy(true);
    try {
      if (!beaconContact) {
        Alert.alert(t('sos_attack_title'), t('sos_attack_no_contact'));
        return;
      }
      const fix = locationRef.current;
      const temFix = hasLocationFix(fix);
      // A sessão do rastreio pode já estar a correr (a pessoa carregou no
      // "Iniciar" antes); se não, arranca-se agora — o link é o que dá o
      // movimento, e é o que vai no SMS.
      // Em silêncio: um diálogo de erro no meio de uma agressão é pior do que
      // o rastreio não arrancar — o aviso sai na mesma, com a posição.
      const s = sessionRef.current ?? (await startLiveSession(true));
      const message = buildSosMessage({
        latitude: temFix ? fix.latitude : null,
        longitude: temFix ? fix.longitude : null,
        accuracy: fix.accuracy ?? null,
        altitude: fix.altitude ?? null,
        battery,
        network: network.operator ?? network.type ?? null,
        liveLink: s ? liveLink(s) : null,
      });
      const result = await sendSmsSilently(beaconContact, message);
      if (result === 'sent') {
        onBeaconSent?.();
        Alert.alert(t('sos_attack_title'), t('sos_attack_sent'));
        return;
      }
      // Sem a permissão de SMS (ou sem módulo nativo): o caminho antigo, o
      // compositor com o aviso escrito. Menos discreto, mas melhor do que
      // não avisar.
      const opened = await sendBeaconSms(beaconContact, message);
      Alert.alert(
        t('sos_attack_title'),
        opened ? t('sos_attack_composer') : t('sos_attack_failed'),
      );
    } catch {
      Alert.alert(t('sos_attack_title'), t('sos_attack_failed'));
    } finally {
      setSosBusy(false);
    }
  }, [beaconContact, battery, network, t, startLiveSession, onBeaconSent]);

  useEffect(() => {
    if (sosCountdown == null) return;
    if (sosCountdown <= 0) {
      void dispararSos();
      return;
    }
    const id = setTimeout(() => {
      setSosCountdown(n => sosCountdownTick(n));
    }, 1000);
    return () => clearTimeout(id);
  }, [sosCountdown, dispararSos]);

  const iniciarSos = useCallback(() => {
    if (sosBusy) return;
    // Uma vibração curta: confirma o toque sem barulho — quem está a ser
    // assaltado não pode ter o telemóvel a tocar.
    Vibration.vibrate(60);
    setSosCountdown(SOS_COUNTDOWN_SECONDS);
  }, [sosBusy]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.card, { backgroundColor: colors.surface }]}
          onPress={() => {}}>
          <Text style={[styles.title, { color: colors.text }]}>🆘 {t('em_title')}</Text>

          <Pressable
            onPress={sosCountdown == null ? iniciarSos : cancelarSos}
            disabled={sosBusy}
            style={[styles.sosButton, sosCountdown != null && styles.sosButtonCancel]}>
            <Text style={styles.sosButtonText}>
              {sosCountdown == null
                ? `🚨 ${t('sos_attack_btn')}`
                : `🚨 ${t('sos_attack_countdown', { seconds: sosCountdown })}`}
            </Text>
            {sosCountdown != null && (
              <Text style={styles.sosCancelText}>{t('sos_attack_cancel')}</Text>
            )}
          </Pressable>

          {hasFix ? (
            <>
              <View style={[styles.fixBox, { backgroundColor: colors.surfaceAlt }]}>
                <Text style={[styles.coords, { color: colors.text }]}>
                  {formatCoord(location.latitude, true)},{' '}
                  {formatCoord(location.longitude, false)}
                </Text>
                {place && (
                  <Text style={[styles.placeLabel, { color: colors.textMuted }]}>
                    {place.name}
                  </Text>
                )}
                <Text style={[styles.metaText, { color: colors.textMuted }]}>
                  {[
                    location.accuracy != null ? `±${formatAccuracy(location.accuracy)}` : null,
                    location.altitude != null
                      ? `${t('em_altitude')}: ${formatAltitude(location.altitude)}`
                      : null,
                    battery != null ? `🔋 ${battery}%` : null,
                    network.operator
                      ? `📶 ${network.operator}${network.type ? ` (${network.type})` : ''}`
                      : network.type
                        ? `📶 ${network.type}`
                        : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>

              <Pressable onPress={share} style={styles.shareButton}>
                <Text style={styles.shareEmoji}>📤</Text>
                <Text style={[styles.shareText, { color: colors.background }]}>
                  {t('em_share_btn')}
                </Text>
              </Pressable>

              {!liveSession && (
                <View style={styles.durationBlock}>
                  <Text style={[styles.durationLabel, { color: colors.textMuted }]}>
                    {t('live_duration')}
                  </Text>
                  <View style={styles.durationRow}>
                    {LIVE_DURATION_OPTIONS.map(minutes => {
                      const picked = minutes === liveMinutes;
                      return (
                        <Pressable
                          key={minutes}
                          onPress={() => chooseDuration(minutes)}
                          style={[
                            styles.durationChip,
                            {
                              backgroundColor: picked
                                ? colors.primary
                                : colors.surfaceAlt,
                            },
                          ]}>
                          <Text
                            style={[
                              styles.durationChipText,
                              {
                                color: picked
                                  ? colors.background
                                  : colors.text,
                              },
                            ]}>
                            {liveDurationLabel(minutes)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              {liveSession ? (
                <>
                  <Text style={[styles.liveActive, { color: colors.textMuted }]}>
                    {t('live_active', { time: liveCountdown(liveSession) })}
                  </Text>
                  <Text style={[styles.shareHint, { color: colors.textMuted }]}>
                    {liveLink(liveSession)}
                  </Text>
                  <Pressable
                    onPress={stopLive}
                    disabled={liveBusy}
                    style={[styles.shareButton, styles.stopButton]}>
                    <Text style={styles.shareEmoji}>🛑</Text>
                    <Text style={[styles.shareText, { color: colors.background }]}>
                      {t('live_stop_btn')}
                    </Text>
                  </Pressable>
                </>
              ) : (
                <Pressable
                  onPress={startLive}
                  disabled={liveBusy}
                  style={styles.shareButton}>
                  <Text style={styles.shareEmoji}>📡</Text>
                  <Text style={[styles.shareText, { color: colors.background }]}>
                    {t('live_btn')}
                  </Text>
                </Pressable>
              )}

              <Text style={[styles.directLabel, { color: colors.textMuted }]}>
                {t('em_send_direct')}
              </Text>
              <View style={styles.directRow}>
                <Pressable onPress={openWhatsApp} style={[styles.directButton, styles.directWhatsApp]}>
                  <Text style={styles.directEmoji}>💬</Text>
                  <Text style={[styles.directText, { color: colors.background }]}>
                    {t('em_whatsapp')}
                  </Text>
                </Pressable>
                <Pressable onPress={openSms} style={[styles.directButton, { backgroundColor: colors.primary }]}>
                  <Text style={styles.directEmoji}>✉️</Text>
                  <Text style={[styles.directText, { color: colors.background }]}>
                    {t('em_sms')}
                  </Text>
                </Pressable>
              </View>

              <Pressable onPress={sendBeacon} style={[styles.shareButton, styles.beaconButton]}>
                <Text style={styles.shareEmoji}>🆘</Text>
                <Text style={[styles.shareText, { color: colors.text }]}>
                  {t('sos_beacon_send')}
                </Text>
              </Pressable>

              <Text style={[styles.shareHint, { color: colors.textMuted }]}>
                {t('em_share_hint')}
              </Text>
            </>
          ) : (
            <Text style={[styles.noFix, { color: colors.textMuted }]}>
              {t('em_no_fix')}
            </Text>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  card: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: spacing.lg,
    alignSelf: 'flex-start',
  },
  sosButton: {
    width: '100%',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
    backgroundColor: '#c0392b',
  },
  sosButtonCancel: {
    backgroundColor: '#7f1d1d',
  },
  sosButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
  },
  sosCancelText: {
    color: '#ffd9d4',
    fontSize: 12,
    marginTop: 4,
  },
  fixBox: {
    width: '100%',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  coords: {
    fontSize: 16,
    fontWeight: '800',
  },
  placeLabel: {
    fontSize: 13,
    marginTop: spacing.xs,
  },
  metaText: {
    fontSize: 12,
    marginTop: spacing.xs,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    borderRadius: radius.full,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    width: '100%',
    justifyContent: 'center',
  },
  shareEmoji: {
    fontSize: 18,
    marginRight: spacing.sm,
  },
  stopButton: {
    backgroundColor: '#334155',
  },
  beaconButton: {
    marginTop: spacing.md,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  liveActive: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: spacing.md,
  },
  durationBlock: {
    width: '100%',
    marginTop: spacing.md,
  },
  durationLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  durationRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  durationChip: {
    flex: 1,
    borderRadius: radius.full,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  durationChipText: {
    fontSize: 13,
    fontWeight: '800',
  },
  shareText: {
    fontSize: 16,
    fontWeight: '800',
  },
  shareHint: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  directLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  directRow: {
    flexDirection: 'row',
    width: '100%',
    gap: spacing.sm,
  },
  directButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    paddingVertical: spacing.md,
  },
  directWhatsApp: {
    backgroundColor: '#25D366',
  },
  directEmoji: {
    fontSize: 16,
    marginRight: spacing.xs,
  },
  directText: {
    fontSize: 15,
    fontWeight: '800',
  },
  noFix: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
});

export default EmergencyModal;
