import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  accelerometer,
  magnetometer,
  SensorTypes,
  setUpdateIntervalForType,
} from 'react-native-sensors';
import { useLanguage } from '../i18n/LanguageContext';
import { useThemeColors } from '../theme/ThemeContext';
import { spacing, radius } from '../theme/colors';
import { verticalAngle } from './HeightView';
import {
  analyzeRest,
  dropWarmup,
  headingSpread,
  tiltResponse,
  REST_MAX_G,
  REST_MIN_G,
  STABILITY_MAX_DEG,
  WARMUP,
} from '../services/sensorSelfTest';

const SAMPLE_MS = 200;
/** 25 amostras a 200 ms dão uma janela de 5 s. */
const WINDOW = 25;
/**
 * Total de amostras coletadas: janela útil + acomodação. `evaluate` só roda
 * depois de WARMUP + WINDOW, senão o corte de `dropWarmup` tiraria parte da
 * janela de dentro.
 */
const TOTAL = WINDOW + WARMUP;
const DEFAULT_RATE = 200;

type Vec3 = { x: number; y: number; z: number };

type Props = {
  active: boolean;
  /** Heading já filtrado pela tela, para não depender do estado de cá. */
  heading: number;
  calibrationApplied: boolean;
};

type Results = {
  rest: ReturnType<typeof analyzeRest>;
  spread: number | null;
  tilt: ReturnType<typeof tiltResponse>;
};

type Samples = { accel: number[]; heading: number[]; tilt: number[] };

const SensorSelfTestView = ({
  active,
  heading,
  calibrationApplied,
}: Props) => {
  const colors = useThemeColors();
  const { t } = useLanguage();
  const styles = createStyles(colors);

  const [results, setResults] = useState<Results | null>(null);
  const [sampled, setSampled] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [landscape, setLandscape] = useState(
    (() => {
      const { width, height } = Dimensions.get('window');
      return width > height;
    })(),
  );

  const accelRef = useRef<Vec3>({ x: 0, y: 0, z: 9.81 });
  const samplesRef = useRef<Samples>({ accel: [], heading: [], tilt: [] });
  const headingRef = useRef(heading);
  const landscapeRef = useRef(landscape);

  headingRef.current = heading;
  landscapeRef.current = landscape;

  useEffect(() => {
    const sub = Dimensions.addEventListener(
      'change',
      ({ window }: { window: { width: number; height: number } }) => {
        setLandscape(window.width > window.height);
      },
    );
    return () => sub.remove();
  }, []);

  const evaluate = useCallback(() => {
    const s = samplesRef.current;
    setResults({
      rest: analyzeRest(dropWarmup(s.accel)),
      spread: headingSpread(s.heading),
      tilt: tiltResponse(s.tilt),
    });
    s.accel = [];
    s.heading = [];
    s.tilt = [];
    setSampled(0);
  }, []);

  const restart = useCallback(() => {
    samplesRef.current = { accel: [], heading: [], tilt: [] };
    setResults(null);
    setSampled(0);
  }, []);

  // Assina os sensores só enquanto o painel está aberto e devolve a taxa global
  // ao sair: setUpdateIntervalForType é global por tipo e o observable é
  // singleton, então sem restaurar a bússola leria na taxa do autoteste até o
  // app reiniciar (mesmo cuidado de MetalDetectorView).
  useEffect(() => {
    if (!active) {
      return;
    }
    setError(null);
    restart();

    setUpdateIntervalForType(SensorTypes.accelerometer, SAMPLE_MS);
    setUpdateIntervalForType(SensorTypes.magnetometer, SAMPLE_MS);

    const magSub = magnetometer.subscribe({
      next: () => {
        const h = headingRef.current;
        if (Number.isFinite(h)) {
          samplesRef.current.heading.push(h);
        }
      },
      error: () => setError(t('sd_mag_error')),
    });

    const accelSub = accelerometer.subscribe({
      next: ({ x, y, z }: Vec3) => {
        if (![x, y, z].every(Number.isFinite)) {
          return;
        }
        accelRef.current = { x, y, z };
        const s = samplesRef.current;
        s.accel.push(Math.sqrt(x * x + y * y + z * z));
        s.tilt.push(verticalAngle({ x, y, z }, landscapeRef.current));
        if (s.accel.length >= TOTAL) {
          setSampled(n => n + 1);
          evaluate();
        }
      },
      error: () => setError(t('sd_accel_error')),
    });

    return () => {
      magSub.unsubscribe();
      accelSub.unsubscribe();
      setUpdateIntervalForType(SensorTypes.accelerometer, DEFAULT_RATE);
      setUpdateIntervalForType(SensorTypes.magnetometer, DEFAULT_RATE);
    };
  }, [active, evaluate, restart, t]);

  const rows = results
    ? [
        {
          label: t('sd_rest'),
          value: results.rest
            ? `${results.rest.min.toFixed(2)}–${results.rest.max.toFixed(2)} g`
            : '—',
          expect: `${REST_MIN_G}–${REST_MAX_G} g`,
          // `moved` não reprova: reprovar puniria o sensor por um toque do
          // usuário. O teste do repouso exige o aparelho quieto, e o painel
          // diz que não ficou quieto em vez de accuse o sensor.
          ok: results.rest ? results.rest.verdict === 'ok' : false,
        },
        {
          label: t('sd_stable'),
          value:
            results.spread !== null ? `${results.spread.toFixed(1)}°` : '—',
          expect: `≤ ${STABILITY_MAX_DEG}°`,
          ok:
            results.spread !== null &&
            results.spread <= STABILITY_MAX_DEG,
        },
        {
          label: t('sd_tilt'),
          value: results.tilt
            ? `${results.tilt.min.toFixed(0)}°…${results.tilt.max.toFixed(0)}°`
            : '—',
          expect: t('sd_tilt_expect'),
          ok: results.tilt ? results.tilt.responded : false,
        },
      ]
    : [];

  const failed = rows.filter(r => !r.ok);
  const restVerdict = results?.rest?.verdict;
  const moved = restVerdict === 'moved';

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>
        {t('sd_title')}
      </Text>
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        {t('sd_hint')}
      </Text>

      {error ? (
        <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
      ) : null}

      {!results && (
        <Text style={[styles.progress, { color: colors.accent }]}>
          {t('sd_collecting')} {sampled}
        </Text>
      )}

      {rows.length > 0 && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollInner}>
          {rows.map(row => (
            <View
              key={row.label}
              style={[styles.row, { borderColor: colors.border }]}>
              <View style={styles.rowTop}>
                <Text style={[styles.rowLabel, { color: colors.text }]}>
                  {row.label}
                </Text>
                <Text
                  style={[
                    styles.badge,
                    { color: row.ok ? colors.success : colors.danger },
                  ]}>
                  {row.ok ? '✓' : '✕'}
                </Text>
              </View>
              <Text style={[styles.rowValue, { color: colors.textMuted }]}>
                {row.value} · {t('sd_expect')}: {row.expect}
              </Text>
            </View>
          ))}

          <Text
            style={[
              styles.verdict,
              {
                color: failed.length === 0
                  ? colors.success
                  : moved
                    ? colors.warning
                    : colors.danger,
              },
            ]}>
            {failed.length === 0
              ? t('sd_all_pass')
              : moved
                ? t('sd_moved')
                : t('sd_some_fail', {
                    list: failed.map(r => r.label).join(', '),
                  })}
          </Text>
        </ScrollView>
      )}

      <Pressable
        onPress={restart}
        style={[styles.button, { borderColor: colors.accent }]}>
        <Text style={[styles.buttonText, { color: colors.accent }]}>
          {t('sd_restart')}
        </Text>
      </Pressable>

      {!calibrationApplied && (
        <Text style={[styles.hint, { color: colors.warning }]}>
          {t('sd_uncalibrated')}
        </Text>
      )}
    </View>
  );
};

const createStyles = (_colors: {
  background: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  danger: string;
  success: string;
  warning: string;
}) =>
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
    progress: {
      fontSize: 13,
      fontWeight: '700',
      marginTop: spacing.lg,
    },
    scroll: {
      marginTop: spacing.md,
      alignSelf: 'stretch',
      maxWidth: 360,
      maxHeight: 340,
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
    rowTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    rowLabel: {
      fontSize: 13,
      fontWeight: '700',
    },
    badge: {
      fontSize: 14,
      fontWeight: '900',
    },
    rowValue: {
      fontSize: 12,
      marginTop: 4,
    },
    verdict: {
      fontSize: 12,
      fontWeight: '800',
      marginTop: spacing.sm,
      lineHeight: 18,
    },
    button: {
      marginTop: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radius.full,
      borderWidth: 1,
    },
    buttonText: {
      fontSize: 12,
      fontWeight: '800',
    },
  });

export default SensorSelfTestView;
