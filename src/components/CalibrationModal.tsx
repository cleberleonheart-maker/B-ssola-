import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {
  magnetometer,
  setUpdateIntervalForType,
  SensorTypes,
} from 'react-native-sensors';
import { useTheme } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { spacing, radius } from '../theme/colors';
import {
  type MagCalibration,
  type Collector,
  createCollector,
  computeCalibration,
  saveCalibration,
  resetCalibration,
  saveVerification,
  solarDelta,
  solarOk,
} from '../services/calibrationService';
import { solarPosition } from '../utils/astro';
import { normalizeHeading, circularMeanHeading } from '../utils/compass';

const CAL_INTERVAL = 100;
const MIN_SAMPLES = 100;
const MIN_COVERAGE = 0.6;
const MEASURE_N = 12;
const MEASURE_STEP_MS = 250;

type Props = {
  visible: boolean;
  onClose: () => void;
  onSave: (cal: MagCalibration | null) => void;
  heading: number;
  latitude: number;
  longitude: number;
  declinationEnabled: boolean;
  declinationDegrees: number;
};

const CalibrationModal = ({
  visible,
  onClose,
  onSave,
  heading,
  latitude,
  longitude,
  declinationEnabled,
  declinationDegrees,
}: Props) => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const collectorRef = useRef<Collector>(createCollector());
  const subRef = useRef<ReturnType<typeof magnetometer.subscribe> | null>(null);
  const referenceRef = useRef(0);

  const [count, setCount] = useState(0);
  const [coverage, setCoverage] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const headingRef = useRef(heading);
  useEffect(() => {
    headingRef.current = heading;
  }, [heading]);

  const [measuring, setMeasuring] = useState(false);
  const [measureProgress, setMeasureProgress] = useState(0);
  const [measureResult, setMeasureResult] = useState<{
    avg: number;
    expected: number;
  } | null>(null);
  const measureIvRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (measureIvRef.current) clearInterval(measureIvRef.current);
    };
  }, []);

  const hasFix = latitude !== 0 || longitude !== 0;

  const sunLive = useMemo(() => {
    if (!hasFix) return null;
    return solarPosition(new Date(), latitude, longitude);
  }, [hasFix, latitude, longitude]);

  const expectedSolar = useMemo(() => {
    if (!sunLive) return null;
    return normalizeHeading(
      sunLive.azimuth - (declinationEnabled ? 0 : declinationDegrees),
    );
  }, [sunLive, declinationEnabled, declinationDegrees]);

  const measure = useCallback(() => {
    if (!sunLive || !expectedSolar || measuring) return;
    setMeasureResult(null);
    setMeasuring(true);
    setMeasureProgress(0);
    const acc: number[] = [];
    let i = 0;
    measureIvRef.current = setInterval(() => {
      acc.push(headingRef.current);
      i += 1;
      setMeasureProgress(i);
      if (i >= MEASURE_N) {
        if (measureIvRef.current) clearInterval(measureIvRef.current);
        const avg = circularMeanHeading(acc);
        const p = solarPosition(new Date(), latitude, longitude);
        const expected = normalizeHeading(
          p.azimuth - (declinationEnabled ? 0 : declinationDegrees),
        );
        setMeasureResult({ avg, expected });
        setMeasuring(false);
        setMeasureProgress(0);
      }
    }, MEASURE_STEP_MS);
  }, [sunLive, expectedSolar, measuring, latitude, longitude, declinationEnabled, declinationDegrees]);

  const start = useCallback(() => {
    const collector = createCollector();
    collectorRef.current = collector;
    referenceRef.current = 0;
    setCount(0);
    setCoverage(0);
    setSaving(false);
    setUpdateIntervalForType(SensorTypes.magnetometer, CAL_INTERVAL);

    subRef.current = magnetometer.subscribe({
      next: ({ x, y, z }: { x: number; y: number; z: number }) => {
        collector.push({ x, y, z });
        const r = collector.range();
        const ref = Math.max(r.x, r.y, r.z, 1);
        referenceRef.current = ref;
        const c = collector.coverage(ref);
        const n = collector.count;
        if (n % 10 === 0) {
          setCount(n);
          setCoverage(c);
        }
      },
      error: () => {},
    });
  }, []);

  const stop = useCallback(() => {
    subRef.current?.unsubscribe();
    setUpdateIntervalForType(SensorTypes.magnetometer, 200);
  }, []);

  useEffect(() => {
    if (visible) {
      start();
    } else {
      stop();
    }
  }, [visible, start, stop]);

  // Só uma conferência que deu certo conta. Marcar na tentativa faria o app
  // calar justamente quando o norte está torto, que é o caso que importa.
  useEffect(() => {
    if (!measureResult || !solarOk(measureResult)) return;
    saveVerification().catch(() => {});
  }, [measureResult]);

  const concluir = useCallback(async () => {
    setSaving(true);
    setSaveError(false);
    const cal = computeCalibration(collectorRef.current);
    try {
      await saveCalibration(cal);
      onSave(cal);
      onClose();
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }, [onSave, onClose]);

  const reset = useCallback(async () => {
    await resetCalibration();
    onSave(null);
    stop();
    start();
  }, [onSave, stop, start]);

  const canFinish = count >= MIN_SAMPLES && coverage >= MIN_COVERAGE;

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
          <Text style={[styles.title, { color: colors.text }]}>
            {t('cal_full_title')}
          </Text>
          <Text style={[styles.instruction, { color: colors.textMuted }]}>
            {t('ui_cal_hint')}
          </Text>

          <View style={styles.statsRow}>
            <View style={[styles.statBox, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('cal_samples')}</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {count}
              </Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('cal_coverage')}</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {Math.round(coverage * 100)}%
              </Text>
            </View>
          </View>

          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(100, (coverage / 1) * 100)}%`,
                  backgroundColor: canFinish ? colors.success : colors.primary,
                },
              ]}
            />
          </View>

          <View style={[styles.solarBox, { borderColor: colors.border }]}>
            <Text style={[styles.solarTitle, { color: colors.text }]}>
              {t('cal_sun_label')}
            </Text>
            {!hasFix ? (
              <Text style={[styles.solarText, { color: colors.textMuted }]}>
                {t('cal_sun_no_gps')}
              </Text>
            ) : !sunLive || !sunLive.visible ? (
              <Text style={[styles.solarText, { color: colors.textMuted }]}>
                {t('cal_sun_hidden')}
                {sunLive ? ` (${Math.round(sunLive.elevation)}°)` : ''}
              </Text>
            ) : (
              <>
                <Text style={[styles.solarText, { color: colors.textMuted }]}>
                  {t('cal_sun_now', {
                    deg: Math.round(expectedSolar ?? 0),
                    el: Math.round(sunLive.elevation),
                  })}
                </Text>
                <Text style={[styles.solarText, { color: colors.textMuted }]}>
                  {t('cal_sun_note')}
                </Text>
                <Pressable
                  disabled={measuring}
                  onPress={measure}
                  style={[
                    styles.solarButton,
                    { backgroundColor: measuring ? colors.surfaceAlt : colors.accent },
                  ]}>
                  <Text
                    style={[
                      styles.solarButtonText,
                      { color: measuring ? colors.textMuted : colors.background },
                    ]}>
                    {measuring
                      ? t('cal_sun_measuring', { n: measureProgress, N: MEASURE_N })
                      : t('cal_sun_measure')}
                  </Text>
                </Pressable>
                {measureResult &&
                  (() => {
                    const delta = Math.round(solarDelta(measureResult));
                    const ok = solarOk(measureResult);
                    const label = ok ? 'cal_sun_good' : 'cal_sun_bad';
                    const params = ok
                      ? undefined
                      : {
                          n: Math.abs(delta),
                          dir:
                            delta > 0
                              ? t('cal_sun_side_left')
                              : t('cal_sun_side_right'),
                          avg: Math.round(measureResult.avg),
                          expected: Math.round(measureResult.expected),
                        };
                    return (
                      <Text
                        style={[
                          styles.solarResult,
                          { color: ok ? colors.success : colors.warning },
                        ]}>
                        {t(label, params)}
                      </Text>
                    );
                  })()}
              </>
            )}
          </View>

          <View style={styles.actions}>
            <Pressable onPress={reset} style={styles.resetButton}>
              <Text style={[styles.resetText, { color: colors.textMuted }]}>
                {t('cal_reset_btn')}
              </Text>
            </Pressable>
            {saveError ? (
              <Text style={[styles.saveErrorText, { color: colors.warning }]}>
                {t('cal_save_fail')}
              </Text>
            ) : null}
            <Pressable
              disabled={!canFinish || saving}
              onPress={concluir}
              style={[
                styles.finishButton,
                canFinish && styles.finishButtonReady,
                {
                  backgroundColor: canFinish ? colors.primary : colors.surfaceAlt,
                },
              ]}>
              {saving ? (
                <ActivityIndicator color={colors.background} size="small" />
              ) : (
                <Text
                  style={[
                    styles.finishText,
                    { color: canFinish ? colors.background : colors.textMuted },
                  ]}>
                  {t('cal_done_btn')}
                </Text>
              )}
            </Pressable>
          </View>
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
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  instruction: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    marginRight: spacing.sm,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  saveErrorText: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  solarBox: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  solarTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  solarText: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  solarButton: {
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    marginTop: spacing.sm,
  },
  solarButtonText: {
    fontSize: 13,
    fontWeight: '800',
  },
  solarResult: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: spacing.sm,
  },
  resetButton: {
    padding: spacing.md,
    marginRight: spacing.sm,
  },
  resetText: {
    fontSize: 15,
    fontWeight: '700',
  },
  finishButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  finishButtonReady: {
    opacity: 1,
  },
  finishText: {
    fontSize: 16,
    fontWeight: '800',
  },
});

export default CalibrationModal;