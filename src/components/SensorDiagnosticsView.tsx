import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  accelerometer,
  magnetometer,
  SensorTypes,
  setUpdateIntervalForType,
} from 'react-native-sensors';
import { useLanguage } from '../i18n/LanguageContext';
import { useThemeColors } from '../theme/ThemeContext';
import { spacing, radius } from '../theme/colors';
import type { MagCalibration } from '../services/calibrationService';
import {
  loadAxisConfirmed,
  saveAxisConfirmed,
} from '../services/preferencesService';
import {
  AXES,
  calibrationQuality,
  dominantAxis,
  magnitude,
  type Axis,
} from '../utils/sensorDiagnostics';

const SAMPLE_MS = 200;
const DEFAULT_RATE = 200;

type Vec3 = { x: number; y: number; z: number };

type Props = {
  active: boolean;
  calibration: MagCalibration | null;
  onOpenCalibration: () => void;
};

/**
 * Painel de diagnóstico dos sensores (ideia #64).
 *
 * A app assume a convenção de eixos do telemóvel, e cada aparelho pode ter
 * outra. Em vez de o programador adivinhar, o painel mostra os valores crus
 * do acelerómetro e do magnetómetro, o eixo dominante de cada um e o estado
 * da calibração — e o utilizador confirma qual é o eixo vertical do seu
 * aparelho, que fica gravado.
 */
const SensorDiagnosticsView = ({
  active,
  calibration,
  onOpenCalibration,
}: Props) => {
  const colors = useThemeColors();
  const { t } = useLanguage();
  const styles = createStyles();

  const [accel, setAccel] = useState<Vec3 | null>(null);
  const [mag, setMag] = useState<Vec3 | null>(null);
  const [confirmed, setConfirmed] = useState<Axis | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAxisConfirmed()
      .then(axis => setConfirmed(axis))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!active) return;
    setError(null);
    setUpdateIntervalForType(SensorTypes.accelerometer, SAMPLE_MS);
    setUpdateIntervalForType(SensorTypes.magnetometer, SAMPLE_MS);

    const accelSub = accelerometer.subscribe({
      next: ({ x, y, z }: Vec3) => {
        if (![x, y, z].every(Number.isFinite)) return;
        setAccel({ x, y, z });
      },
      error: () => setError(t('diag_accel_error')),
    });

    const magSub = magnetometer.subscribe({
      next: ({ x, y, z }: Vec3) => {
        if (![x, y, z].every(Number.isFinite)) return;
        setMag({ x, y, z });
      },
      error: () => setError(t('diag_mag_error')),
    });

    return () => {
      accelSub.unsubscribe();
      magSub.unsubscribe();
      setUpdateIntervalForType(SensorTypes.accelerometer, DEFAULT_RATE);
      setUpdateIntervalForType(SensorTypes.magnetometer, DEFAULT_RATE);
    };
  }, [active, t]);

  const quality = calibrationQuality(calibration);
  const accelAxis = accel ? dominantAxis(accel) : null;
  const magAxis = mag ? dominantAxis(mag) : null;

  const confirmAxis = (axis: Axis) => {
    const next = confirmed === axis ? null : axis;
    setConfirmed(next);
    void saveAxisConfirmed(next);
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>{t('diag_title')}</Text>
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        {t('diag_hint')}
      </Text>

      {error ? (
        <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
      ) : null}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollInner}>
        <SensorCard
          title={t('diag_accel')}
          vector={accel}
          axis={accelAxis}
          axisLabel={t('diag_dominant_axis')}
          colors={colors}
        />
        <SensorCard
          title={t('diag_mag')}
          vector={mag}
          axis={magAxis}
          axisLabel={t('diag_dominant_axis')}
          colors={colors}
        />

        <View style={[styles.row, { borderColor: colors.border }]}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>
            {t('diag_calibration')}
          </Text>
          <Text style={[styles.rowValue, { color: colors.textMuted }]}>
            {quality.calibrated
              ? `${t('diag_calibrated')} · ${t('diag_hard_iron')}: ${quality.hardIron.toFixed(1)} µT · ${t('diag_soft_iron')}: ${quality.softIron.toFixed(2)}`
              : t('diag_not_calibrated')}
          </Text>
          <Pressable
            onPress={onOpenCalibration}
            style={[styles.button, { borderColor: colors.accent }]}>
            <Text style={[styles.buttonText, { color: colors.accent }]}>
              {quality.calibrated ? t('diag_calibrate_again') : t('diag_calibrate')}
            </Text>
          </Pressable>
        </View>

        <View style={[styles.row, { borderColor: colors.border }]}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>
            {t('diag_confirm_axis')}
          </Text>
          <Text style={[styles.rowValue, { color: colors.textMuted }]}>
            {t('diag_confirm_axis_hint')}
          </Text>
          <View style={styles.axisRow}>
            {AXES.map(axis => {
              const picked = confirmed === axis;
              return (
                <Pressable
                  key={axis}
                  onPress={() => confirmAxis(axis)}
                  style={[
                    styles.axisButton,
                    {
                      borderColor: picked ? colors.primary : colors.border,
                      backgroundColor: picked ? colors.primary : 'transparent',
                    },
                  ]}>
                  <Text
                    style={[
                      styles.axisText,
                      { color: picked ? colors.background : colors.text },
                    ]}>
                    {axis.toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {confirmed ? (
            <Text style={[styles.confirmed, { color: colors.success }]}>
              {t('diag_axis_confirmed', { axis: confirmed.toUpperCase() })}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
};

type CardProps = {
  title: string;
  vector: Vec3 | null;
  axis: Axis | null;
  axisLabel: string;
  colors: ReturnType<typeof useThemeColors>;
};

const SensorCard = ({ title, vector, axis, axisLabel, colors }: CardProps) => {
  const styles = createStyles();
  return (
    <View style={[styles.row, { borderColor: colors.border }]}>
      <Text style={[styles.rowLabel, { color: colors.text }]}>{title}</Text>
      {vector ? (
        <>
          <Text style={[styles.rowValue, { color: colors.textMuted }]}>
            {`X ${vector.x.toFixed(2)}  ·  Y ${vector.y.toFixed(2)}  ·  Z ${vector.z.toFixed(2)}`}
          </Text>
          <Text style={[styles.rowValue, { color: colors.textMuted }]}>
            {`|v| ${magnitude(vector).toFixed(2)}`}
          </Text>
          <Text style={[styles.rowValue, { color: colors.text }]}>
            {axis ? `${axisLabel}: ${axis.toUpperCase()}` : axisLabel}
          </Text>
        </>
      ) : (
        <Text style={[styles.rowValue, { color: colors.textMuted }]}>—</Text>
      )}
    </View>
  );
};

const createStyles = () =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      padding: spacing.lg,
    },
    title: {
      fontSize: 20,
      fontWeight: '800',
    },
    hint: {
      fontSize: 12,
      textAlign: 'center',
      marginTop: spacing.sm,
      lineHeight: 18,
      maxWidth: 320,
    },
    error: {
      fontSize: 12,
      marginTop: spacing.sm,
      textAlign: 'center',
    },
    scroll: {
      marginTop: spacing.md,
      alignSelf: 'stretch',
      maxWidth: 360,
      maxHeight: 360,
    },
    scrollInner: {
      paddingBottom: spacing.sm,
    },
    row: {
      borderWidth: 1,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    rowLabel: {
      fontSize: 13,
      fontWeight: '700',
    },
    rowValue: {
      fontSize: 12,
      marginTop: 4,
    },
    button: {
      marginTop: spacing.sm,
      alignSelf: 'flex-start',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.full,
      borderWidth: 1,
    },
    buttonText: {
      fontSize: 12,
      fontWeight: '800',
    },
    axisRow: {
      flexDirection: 'row',
      marginTop: spacing.sm,
      gap: spacing.sm,
    },
    axisButton: {
      width: 44,
      height: 36,
      borderRadius: radius.sm,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    axisText: {
      fontSize: 14,
      fontWeight: '800',
    },
    confirmed: {
      fontSize: 12,
      fontWeight: '700',
      marginTop: spacing.sm,
    },
  });

export default SensorDiagnosticsView;
