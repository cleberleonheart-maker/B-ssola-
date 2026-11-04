import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
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
import { polarisPosition } from '../utils/astro';
import {
  declinationFromPolaris,
  polarisAim,
  polarisUsable,
} from '../utils/polaris';
import { applyCalibration, type MagCalibration } from '../services/calibrationService';

const SENSOR_INTERVAL = 100;
const MEASURE_N = 12;
const MEASURE_STEP_MS = 250;
/** Meia-amplitude da mira, em graus (o círculo cobre esta largura). */
const RETICLE_SPAN = 30;

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
 * Calibração da declinação pela Estrela Polar (ideia #13).
 *
 * À noite, aponta a câmara do telefone para a Polaris — a estrela que está
 * quase parada no céu, junto ao polo. A app diz a altura a que ela está (que
 * é a latitude) e mostra uma mira: quando a estrela está no centro, o
 * telefone está apontado ao norte verdadeiro, e a diferença entre esse norte
 * e o norte que o magnetómetro lê é a declinação — medida no sitio, em vez de
 * tirada da tabela de cidades.
 */
const PolarisCalibrationModal = ({
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

  const [heading, setHeading] = useState(0);
  const [elevation, setElevation] = useState(0);
  const [measuring, setMeasuring] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const measureIvRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(
    () => () => {
      if (measureIvRef.current) clearInterval(measureIvRef.current);
    },
    [],
  );

  const hasFix = hasLocationFix({ latitude, longitude });
  const usable = polarisUsable(latitude);
  const portrait = height >= width;

  const polaris = useMemo(() => {
    if (!hasFix) return null;
    return polarisPosition(new Date(), latitude, longitude);
  }, [hasFix, latitude, longitude]);

  const aim = useMemo(() => {
    if (!polaris) return null;
    return polarisAim(heading, elevation, polaris);
  }, [polaris, heading, elevation]);

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
        if (next != null) setHeading(next);
        setElevation(viewElevationDeg(accel));
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
    if (!polaris || !aim || measuring) return;
    if (!aim.onTarget) return;
    setResult(null);
    setMeasuring(true);
    setProgress(0);
    const samples: number[] = [];
    let i = 0;
    measureIvRef.current = setInterval(() => {
      samples.push(heading);
      i += 1;
      setProgress(i);
      if (i >= MEASURE_N) {
        if (measureIvRef.current) clearInterval(measureIvRef.current);
        const avg = circularMeanHeading(samples);
        const p = polarisPosition(new Date(), latitude, longitude);
        setResult(declinationFromPolaris(p.azimuth, avg));
        setMeasuring(false);
        setProgress(0);
      }
    }, MEASURE_STEP_MS);
  }, [aim, heading, latitude, longitude, measuring, polaris]);

  const save = useCallback(async () => {
    if (result == null) return;
    setSaving(true);
    onSave(result);
    setSaving(false);
    onClose();
  }, [onClose, onSave, result]);

  // A mira: a estrela aparece deslocada do centro conforme o erro. O erro
  // de azimute vai para a direita, o de elevação para cima.
  const offsetX = aim ? (aim.azimuthError / RETICLE_SPAN) * 100 : 0;
  const offsetY = aim ? (-aim.elevationError / RETICLE_SPAN) * 100 : 0;

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
            ⭐ {t('pol_title')}
          </Text>
          <Text style={[styles.instruction, { color: colors.textMuted }]}>
            {t('pol_hint')}
          </Text>

          {!hasFix ? (
            <Text style={[styles.warn, { color: colors.warning }]}>
              {t('pol_no_gps')}
            </Text>
          ) : !usable ? (
            <Text style={[styles.warn, { color: colors.warning }]}>
              {t('pol_high_lat')}
            </Text>
          ) : !portrait ? (
            <Text style={[styles.warn, { color: colors.warning }]}>
              {t('pol_portrait')}
            </Text>
          ) : (
            <>
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

              {polaris && aim && (
                <>
                  <Text style={[styles.readout, { color: colors.text }]}>
                    {t('pol_position', {
                      alt: polaris.elevation.toFixed(1),
                      az: polaris.azimuth.toFixed(1),
                    })}
                  </Text>
                  <Text style={[styles.readoutMuted, { color: colors.textMuted }]}>
                    {t('pol_error', {
                      az: aim.azimuthError.toFixed(1),
                      alt: aim.elevationError.toFixed(1),
                    })}
                  </Text>
                  <Text style={[styles.readoutMuted, { color: colors.textMuted }]}>
                    {t('pol_expected', {
                      deg: `${currentDegrees > 0 ? '+' : ''}${currentDegrees}°`,
                    })}
                  </Text>
                </>
              )}

              <Pressable
                onPress={measure}
                disabled={measuring || !aim?.onTarget}
                style={[
                  styles.measureButton,
                  {
                    backgroundColor:
                      measuring || !aim?.onTarget ? colors.surfaceAlt : colors.accent,
                  },
                ]}>
                <Text
                  style={[
                    styles.measureText,
                    {
                      color:
                        measuring || !aim?.onTarget ? colors.textMuted : colors.background,
                    },
                  ]}>
                  {measuring
                    ? t('pol_measuring', { n: progress, N: MEASURE_N })
                    : t('pol_measure')}
                </Text>
              </Pressable>

              {result != null && (
                <>
                  <Text style={[styles.result, { color: colors.success }]}>
                    {t('pol_result', {
                      deg: `${result > 0 ? '+' : ''}${result}°`,
                    })}
                  </Text>
                  <Text style={[styles.readoutMuted, { color: colors.textMuted }]}>
                    {t('pol_result_note')}
                  </Text>
                </>
              )}
            </>
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
                  {t('pol_save')}
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

export default PolarisCalibrationModal;
