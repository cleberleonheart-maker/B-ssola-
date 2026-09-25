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
} from 'react-native';
import {
  startLiveShare,
  stopLiveShare,
  pushLiveFix,
  liveLink,
  liveCountdown,
  getActiveLiveSession,
  type LiveSession,
} from '../services/liveShareService';
import { useTheme } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { spacing, radius } from '../theme/colors';
import { cardinalOf, formatCoord, formatTime } from '../utils/compass';
import type { LocationFix } from '../services/locationService';

type Props = {
  visible: boolean;
  onClose: () => void;
  location: LocationFix;
  heading: number;
  place: { name: string; cep: string | null } | null;
};

const EmergencyModal = ({ visible, onClose, location, heading, place }: Props) => {
  const { colors } = useTheme();
  const { t } = useLanguage();

  const hasFix = location.latitude !== 0 && location.longitude !== 0;
  const locationRef = useRef(location);

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

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
      rawLines.push(`• ${t('em_accuracy')}: ±${Math.round(location.accuracy)} m`);
    }
    if (location.altitude != null) {
      rawLines.push(`• ${t('em_altitude')}: ${Math.round(location.altitude)} m`);
    }
    rawLines.push(`• ${t('em_heading')}: ${Math.round(heading)}° ${cardinalOf(heading).full}`);
    if (location.updatedAt) {
      rawLines.push(`• ${formatTime(location.updatedAt)}`);
    }
    return rawLines.join('\n');
  }, [t, location, heading, place, hasFix]);

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

  const openWhatsApp = async () => {
    if (!hasFix) return;
    const text = encodeURIComponent(shareText);
    try {
      await Linking.openURL(`whatsapp://send?text=${text}`);
    } catch {
      try {
        await Linking.openURL(`https://wa.me/?text=${text}`);
      } catch {
        Alert.alert(t('em_title'), t('em_direct_unavailable'));
      }
    }
  };

  const [liveSession, setLiveSession] = useState<LiveSession | null>(null);
  const [liveBusy, setLiveBusy] = useState(false);
  const [, setTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionRef = useRef<LiveSession | null>(null);

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
      void stopLiveShare(s.token);
    },
    [clearTicker],
  );

  const startTicker = useCallback(
    (s: LiveSession) => {
      clearTicker();
      sessionRef.current = s;
      setLiveSession(s);
      timerRef.current = setInterval(() => {
        if (Date.now() > s.expiresAt) {
          endSession(s);
          return;
        }
        setTick(v => v + 1);
        void pushLiveFix(s, locationRef.current);
      }, 10000);
    },
    [clearTicker, endSession],
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      const active = await getActiveLiveSession();
      if (mounted && active) startTicker(active);
    })();
    return () => {
      mounted = false;
      clearTicker();
    };
  }, [clearTicker, startTicker]);

  const startLive = async () => {
    if (!hasFix || liveBusy || sessionRef.current) return;
    setLiveBusy(true);
    try {
      const s = await startLiveShare('', 30);
      if (!s) {
        Alert.alert(t('live_title'), t('live_need_cloud'));
        return;
      }
      const url = liveLink(s);
      const sent = await pushLiveFix(s, locationRef.current);
      if (!sent) {
        await stopLiveShare(s.token);
        Alert.alert(t('live_title'), t('live_error'));
        return;
      }
      startTicker(s);
      try {
        await Share.share({ message: t('live_shared') + ' ' + url });
      } catch {}
    } catch {
      Alert.alert(t('live_title'), t('live_error'));
    } finally {
      setLiveBusy(false);
    }
  };

  const stopLive = async () => {
    const s = sessionRef.current;
    if (!s) return;
    setLiveBusy(true);
    try {
      await stopLiveShare(s.token);
      clearTicker();
      sessionRef.current = null;
      setLiveSession(null);
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
                    location.accuracy != null ? `±${Math.round(location.accuracy)} m` : null,
                    location.altitude != null
                      ? `${t('em_altitude')}: ${Math.round(location.altitude)} m`
                      : null,
                    null,
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
  liveActive: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: spacing.md,
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
