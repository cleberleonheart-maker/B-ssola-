import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import {
  accelerometer,
  magnetometer,
  setUpdateIntervalForType,
  SensorTypes,
} from 'react-native-sensors';
import { useTheme } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { spacing, radius } from '../theme/colors';
import { circularMeanHeading, getHeading, viewElevationDeg } from '../utils/compass';
import { hasLocationFix } from '../utils/geo';
import {
  bestTarget,
  calibrationTargets,
  declinationFromStar,
  isDaytime,
  starAim,
  TARGET_MAX_ELEVATION,
  TARGET_MIN_ELEVATION,
  type CalibrationTarget,
} from '../utils/starCalibration';
import { applyCalibration, type MagCalibration } from '../services/calibrationService';

const SENSOR_INTERVAL = 100;
const MEASURE_N = 12;
const MEASURE_STEP_MS = 250;
/** Meia-amplitude da mira, em graus (o círculo cobre esta largura). */
const RETICLE_SPAN = 30;
/**
 * Amostras válidas (a estrela no centro) que a medição precisa, no mínimo.
 * Se o telefone mexeu a meio, o número não vale — é melhor avisar do que
 * gravar uma declinação errada.
 */
const MEASURE_MIN_VALID = 6;

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Recebe a declinação medida (leste positivo). */
  onSave: (degrees: number) => void;
  latitude: number;
  longitude: number;
  calibration: MagCalibration | null;
  /** A declinação que a app está a usar agora, para comparação. */
  currentDegrees: number;
};

/**
 * Calibração da declinação por uma estrela do céu (ideia #13).
 *
 * À noite, aponta-se a câmara a uma das estrelas que a app lista. A app sabe
 * onde cada uma está (o catálogo dá o azimute e a altura com precisão de
 * segundos de arco), por isso a mira diz quanto falta para virar e para
 * levantar o telefone. Quando a estrela está no centro, o telefone aponta a
 * um rumo verdadeiro — e a diferença entre esse rumo e o que o magnetómetro lê
 * é a declinação, medida no sítio, em vez de tirada da tabela de cidades.
 *
 * A Polaris (hemisfério norte) e a Cruz do Sul (hemisfério sul) entram na
 * lista como mais uma opção: são os alvos mais fáceis de reconhecer.
 */
const StarCalibrationModal = ({
  visible,
  onClose,
  onSave,
  latitude,
  longitude,
  calibration,
  currentDegrees,
}: Props) => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(), []);
  const { width, height } = useWindowDimensions();

  const magSubRef = useRef<ReturnType<typeof magnetometer.subscribe> | null>(null);
  const accSubRef = useRef<ReturnType<typeof accelerometer.subscribe> | null>(null);
  const accelRef = useRef({ x: 0, y: 0, z: 1 });
  const calibrationRef = useRef<MagCalibration | null>(calibration);
  calibrationRef.current = calibration;
  /**
   * O último rumo e a última elevação lidos dos sensores. A medição lê estes
   * refs e não o estado: o `state` só chega ao ecrã a cada render, e um
   * `setInterval` fechado sobre ele mediria sempre o mesmo valor.
   */
  const headingRef = useRef(0);
  const elevationRef = useRef(0);

  const [heading, setHeading] = useState(0);
  const [elevation, setElevation] = useState(0);
  const [measuring, setMeasuring] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [lost, setLost] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const measureIvRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(
    () => () => {
      if (measureIvRef.current) clearInterval(measureIvRef.current);
    },
    [],
  );

  const hasFix = hasLocationFix({ latitude, longitude });
  const portrait = height >= width;
  const daytime = useMemo(
    () => (hasFix ? isDaytime(new Date(), latitude, longitude) : false),
    [hasFix, latitude, longitude],
  );

  const targets = useMemo<CalibrationTarget[]>(() => {
    if (!hasFix) return [];
    return calibrationTargets(new Date(), latitude, longitude);
  }, [hasFix, latitude, longitude]);

  const target = useMemo(() => {
    if (targets.length === 0) return null;
    const chosen = targets.find(tg => tg.id === selectedId);
    return chosen ?? bestTarget(targets);
  }, [targets, selectedId]);

  const aim = useMemo(() => {
    if (!target) return null;
    return starAim(heading, elevation, target.position);
  }, [target, heading, elevation]);

  useEffect(() => {
    if (!visible) return;
    setUpdateIntervalForType(SensorTypes.magnetometer, SENSOR_INTERVAL);
    setUpdateIntervalForType(SensorTypes.accelerometer, SENSOR_INTERVAL);

    accSubRef.current = accelerometer.subscribe({
      next: ({ x, y, z }: { x: number; y: number; z: number }) => {
        accelRef.current = { x, y, z };
      },
      error: () => {},
    });

    magSubRef.current = magnetometer.subscribe({
      next: (sample: { x: number; y: number; z: number }) => {
        const accel = accelRef.current;
        const field = applyCalibration(sample, calibrationRef.current);
        // `getHeading` devolve null quando o acelerómetro não diz nada (o
        // telefone parado, sem gravidade legível): nesse caso o último rumo
        // fica no ecrã, que é melhor do que um zero a fingir ser norte.
        const next = getHeading(accel, field);
        if (next != null) {
          headingRef.current = next;
          setHeading(next);
        }
        const el = viewElevationDeg(accel);
        elevationRef.current = el;
        setElevation(el);
      },
      error: () => {},
    });

    return () => {
      magSubRef.current?.unsubscribe();
      magSubRef.current = null;
      accSubRef.current?.unsubscribe();
      accSubRef.current = null;
      setUpdateIntervalForType(SensorTypes.magnetometer, 200);
      setUpdateIntervalForType(SensorTypes.accelerometer, 200);
    };
  }, [visible]);

  const measure = useCallback(() => {
    if (!target || !aim || measuring) return;
    // Uma estrela fora da faixa boa (muito alta ou muito baixa) faz o
    // telefone ler mal o azimute: melhor recusar do que gravar um número
    // errado.
    if (!aim.onTarget || !target.usable) return;
    setResult(null);
    setLost(false);
    setMeasuring(true);
    setProgress(0);
    const samples: number[] = [];
    let i = 0;
    measureIvRef.current = setInterval(() => {
      // O rumo e a elevação saem dos refs, não do estado: o estado só chega ao
      // ecrã a cada render e a medição ficava com o valor do clique.
      const live = starAim(headingRef.current, elevationRef.current, target.position);
      if (live.onTarget) samples.push(headingRef.current);
      i += 1;
      setProgress(i);
      if (i >= MEASURE_N) {
        if (measureIvRef.current) clearInterval(measureIvRef.current);
        measureIvRef.current = null;
        if (samples.length < MEASURE_MIN_VALID) {
          setLost(true);
          setMeasuring(false);
          setProgress(0);
          return;
        }
        const avg = circularMeanHeading(samples);
        setResult(declinationFromStar(target.position.azimuth, avg));
        setMeasuring(false);
        setProgress(0);
      }
    }, MEASURE_STEP_MS);
  }, [aim, measuring, target]);

  const save = useCallback(async () => {
    if (result == null) return;
    setSaving(true);
    onSave(result);
    setSaving(false);
    onClose();
  }, [onClose, onSave, result]);

  const pick = useCallback((id: string) => {
    setSelectedId(id);
    setResult(null);
    setLost(false);
  }, []);

  // A mira: a estrela aparece deslocada do centro conforme o erro. O erro
  // de azimute vai para a direita, o de elevação para cima.
  const offsetX = aim ? (aim.azimuthError / RETICLE_SPAN) * 100 : 0;
  const offsetY = aim ? (-aim.elevationError / RETICLE_SPAN) * 100 : 0;

  const targetName = target
    ? target.labelKey
      ? t(target.labelKey)
      : target.name
    : '';

  /** A estrela está fora da faixa em que o telefone lê bem o azimute. */
  const tooHigh = target ? target.position.elevation > TARGET_MAX_ELEVATION : false;
  /** Só se mede com a estrela no centro e bem colocada. */
  const canMeasure = !!aim?.onTarget && !!target?.usable && !measuring;

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
            ⭐ {t('cal_title')}
          </Text>
          <Text style={[styles.instruction, { color: colors.textMuted }]}>
            {t('cal_hint')}
          </Text>

          {!hasFix ? (
            <Text style={[styles.warn, { color: colors.warning }]}>
              {t('cal_no_gps')}
            </Text>
          ) : targets.length === 0 ? (
            <Text style={[styles.warn, { color: colors.warning }]}>
              {t('cal_no_target')}
            </Text>
          ) : !portrait ? (
            <Text style={[styles.warn, { color: colors.warning }]}>
              {t('cal_portrait')}
            </Text>
          ) : (
            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
              <Text style={[styles.pickLabel, { color: colors.textMuted }]}>
                {t('cal_pick')}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.chipsRow}
                contentContainerStyle={styles.chipsContent}>
                {targets.map(tg => {
                  const active = target?.id === tg.id;
                  return (
                    <Pressable
                      key={tg.id}
                      onPress={() => pick(tg.id)}
                      style={[
                        styles.chip,
                        {
                          borderColor: active ? colors.accent : colors.border,
                          backgroundColor: active ? colors.accent : 'transparent',
                        },
                      ]}>
                      <Text
                        style={[
                          styles.chipText,
                          { color: active ? colors.background : colors.text },
                        ]}>
                        {tg.labelKey ? t(tg.labelKey) : tg.name}
                      </Text>
                      <Text
                        style={[
                          styles.chipAlt,
                          { color: active ? colors.background : colors.textMuted },
                        ]}>
                        {tg.position.elevation.toFixed(0)}°
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {daytime && (
                <Text style={[styles.warn, { color: colors.warning }]}>
                  {t('cal_day')}
                </Text>
              )}

              {target && !target.usable && (
                <Text style={[styles.warn, { color: colors.warning }]}>
                  {tooHigh
                    ? t('cal_too_high', {
                        alt: target.position.elevation.toFixed(0),
                        max: TARGET_MAX_ELEVATION,
                      })
                    : t('cal_too_low', {
                        alt: target.position.elevation.toFixed(0),
                        min: TARGET_MIN_ELEVATION,
                      })}
                </Text>
              )}

              <View style={[styles.reticle, { borderColor: colors.border }]}>
                <View
                  style={[
                    styles.target,
                    {
                      left: `${50 + offsetX}%`,
                      top: `${50 + offsetY}%`,
                      borderColor: aim?.onTarget ? colors.success : colors.accent,
                      backgroundColor:
                        aim?.onTarget ? colors.success : 'transparent',
                    },
                  ]}
                />
                <View style={[styles.crossH, { backgroundColor: colors.border }]} />
                <View style={[styles.crossV, { backgroundColor: colors.border }]} />
              </View>

              {target && aim && (
                <>
                  <Text style={[styles.readout, { color: colors.text }]}>
                    {t('cal_position', {
                      name: targetName,
                      alt: target.position.elevation.toFixed(1),
                      az: target.position.azimuth.toFixed(1),
                    })}
                  </Text>
                  <Text style={[styles.readoutMuted, { color: colors.textMuted }]}>
                    {t('cal_error', {
                      az: aim.azimuthError.toFixed(1),
                      alt: aim.elevationError.toFixed(1),
                    })}
                  </Text>
                  <Text style={[styles.readoutMuted, { color: colors.textMuted }]}>
                    {t('cal_expected', {
                      deg: `${currentDegrees > 0 ? '+' : ''}${currentDegrees}°`,
                    })}
                  </Text>
                </>
              )}

              <Pressable
                onPress={measure}
                disabled={!canMeasure}
                style={[
                  styles.measureButton,
                  {
                    backgroundColor: canMeasure ? colors.accent : colors.surfaceAlt,
                  },
                ]}>
                <Text
                  style={[
                    styles.measureText,
                    { color: canMeasure ? colors.background : colors.textMuted },
                  ]}>
                  {measuring
                    ? t('cal_measuring', { n: progress, N: MEASURE_N })
                    : t('cal_measure')}
                </Text>
              </Pressable>

              {lost && (
                <Text style={[styles.warn, { color: colors.warning }]}>
                  {t('cal_lost')}
                </Text>
              )}

              {result != null && (
                <>
                  <Text style={[styles.result, { color: colors.success }]}>
                    {t('cal_result', {
                      deg: `${result > 0 ? '+' : ''}${result}°`,
                    })}
                  </Text>
                  <Text style={[styles.readoutMuted, { color: colors.textMuted }]}>
                    {t('cal_result_note')}
                  </Text>
                </>
              )}
            </ScrollView>
          )}

          <View style={styles.actions}>
            <Pressable onPress={onClose} style={styles.cancelButton}>
              <Text style={[styles.cancelText, { color: colors.textMuted }]}>
                {t('backup_cancel')}
              </Text>
            </Pressable>
            <Pressable
              onPress={save}
              disabled={result == null || saving}
              style={[
                styles.saveButton,
                {
                  backgroundColor:
                    result == null ? colors.surfaceAlt : colors.primary,
                },
              ]}>
              {saving ? (
                <ActivityIndicator color={colors.background} size="small" />
              ) : (
                <Text
                  style={[
                    styles.saveText,
                    { color: result == null ? colors.textMuted : colors.background },
                  ]}>
                  {t('cal_save')}
                </Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const createStyles = () =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    card: {
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      padding: spacing.lg,
      paddingBottom: spacing.xl,
      maxHeight: '92%',
    },
    title: {
      fontSize: 20,
      fontWeight: '800',
      marginBottom: spacing.sm,
    },
    instruction: {
      fontSize: 14,
      lineHeight: 20,
      marginBottom: spacing.md,
    },
    warn: {
      fontSize: 13,
      fontWeight: '700',
      marginBottom: spacing.md,
    },
    scroll: {
      flexGrow: 0,
    },
    pickLabel: {
      fontSize: 12,
      fontWeight: '800',
      marginBottom: spacing.xs,
    },
    chipsRow: {
      flexGrow: 0,
      marginBottom: spacing.md,
    },
    chipsContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingRight: spacing.md,
    },
    chip: {
      borderWidth: 1,
      borderRadius: radius.md,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      alignItems: 'center',
      minWidth: 72,
    },
    chipText: {
      fontSize: 12,
      fontWeight: '800',
    },
    chipAlt: {
      fontSize: 11,
      fontWeight: '700',
    },
    reticle: {
      alignSelf: 'center',
      width: 220,
      height: 220,
      borderRadius: 110,
      borderWidth: 1,
      marginBottom: spacing.md,
      overflow: 'hidden',
    },
    target: {
      position: 'absolute',
      width: 28,
      height: 28,
      marginLeft: -14,
      marginTop: -14,
      borderRadius: 14,
      borderWidth: 2,
    },
    crossH: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: '50%',
      height: 1,
    },
    crossV: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: '50%',
      width: 1,
    },
    readout: {
      fontSize: 15,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
      textAlign: 'center',
    },
    readoutMuted: {
      fontSize: 12,
      fontWeight: '700',
      textAlign: 'center',
      marginTop: 2,
    },
    measureButton: {
      alignSelf: 'center',
      borderRadius: radius.full,
      paddingHorizontal: spacing.lg,
      paddingVertical: 10,
      marginTop: spacing.md,
    },
    measureText: {
      fontSize: 14,
      fontWeight: '800',
    },
    result: {
      fontSize: 20,
      fontWeight: '900',
      textAlign: 'center',
      marginTop: spacing.md,
      fontVariant: ['tabular-nums'],
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.lg,
    },
    cancelButton: {
      padding: spacing.md,
      marginRight: spacing.sm,
    },
    cancelText: {
      fontSize: 15,
      fontWeight: '700',
    },
    saveButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
      borderRadius: radius.md,
    },
    saveText: {
      fontSize: 16,
      fontWeight: '800',
    },
  });

export default StarCalibrationModal;
