import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Vibration,
  ScrollView,
  Dimensions,
} from 'react-native';
import {
  magnetometer,
  setUpdateIntervalForType,
  SensorTypes,
} from 'react-native-sensors';
import { useThemeColors } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { spacing, radius } from '../theme/colors';
import type { ColorScheme } from '../theme/themes';
import TrendChart from './TrendChart';
import EmfSurveyMap from './EmfSurveyMap';
import { mapSideFor } from './MiniMapView';
import { useRepetitiveBeep, soundAvailable } from '../services/sound';
import {
  dominantAxis,
  emfLevel,
  EMF_LOW_RATIO,
  EMF_HIGH_RATIO,
  type AxisValues,
} from '../utils/emf';
import { formatTime } from '../utils/compass';
import { applyCalibration, type MagCalibration } from '../services/calibrationService';
import {
  addEmfSurveyPoint,
  clearEmfSurvey,
  createEmfSurveyId,
  loadEmfSurvey,
  removeEmfSurveyPoint,
  type EmfSurveyPoint,
} from '../services/emfSurveyService';
import type { LocationFix } from '../services/locationService';

const SAMPLE_INTERVAL = 200;
const FILTER_ALPHA = 0.82;
const SCALE_MAX = 200;
// limiares de severidade como fração do desvio do ambiente (ratio 0..1)
const LOW_THRESHOLD = EMF_LOW_RATIO;
const HIGH_THRESHOLD = EMF_HIGH_RATIO;
const HISTORY_MAX = 90;
/** Só as últimas leituras marcadas cabem na lista; o mapa mostra todas. */
const SURVEY_LIST_MAX = 5;
/** O mapa do levantamento é compacto: cabe ao lado do resto do painel. */
const SURVEY_MAP_MAX = 240;

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

type Props = {
  active: boolean;
  hasFix: boolean;
  onAdd: (name: string) => void;
  /**
   * Calibração magnética da bússola (hard/soft-iron). Sem ela a magnitude crua
   * carrega o offset do aparelho — um ferro que anda com o telemóvel — e as
   * leituras variam conforme a orientação, não só conforme a fonte. Aplicada,
   * a magnitude é comparável entre direções e a diferença para o ambiente diz
   * algo sobre o campo, não sobre como se segura o aparelho.
   */
  calibration: MagCalibration | null;
  /** Abre a tela de calibração, para quem ainda não tem uma. */
  onCalibrate: () => void;
  /** Posição actual: é onde fica marcada a leitura do levantamento. */
  location: LocationFix;
};

const EmfReaderView = ({
  active,
  hasFix,
  onAdd,
  calibration,
  onCalibrate,
  location,
}: Props) => {
  const colors = useThemeColors();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [value, setValue] = useState(0);
  const [min, setMin] = useState<number | null>(null);
  const [max, setMax] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const [history, setHistory] = useState<number[]>([]);
  const [ambient, setAmbient] = useState<number | null>(null);
  const [axes, setAxes] = useState<AxisValues | null>(null);
  const [ambientAxes, setAmbientAxes] = useState<AxisValues | null>(null);
  // congelado = a leitura parou de andar: ecrã, barra, histórico, bipes e
  // vibração ficam no último valor, para marcar o pico sem olhar o número o
  // tempo todo. `frozenRef` espelha `frozen` porque o subscribe captura o
  // closure de quando foi feito (o efeito só depende de `active`).
  const [frozen, setFrozen] = useState(false);
  // Levantamento de EMF com posição (ideia #48): as leituras marcadas ficam
  // guardadas com o sítio onde foram lidas, para se ver a mancha.
  const [survey, setSurvey] = useState<EmfSurveyPoint[]>([]);
  const [surveyOpen, setSurveyOpen] = useState(false);

  const filteredRef = useRef(0);
  const hasSampleRef = useRef(false);
  const subRef = useRef<ReturnType<typeof magnetometer.subscribe> | null>(null);
  const minRef = useRef<number | null>(null);
  const maxRef = useRef<number | null>(null);
  const historyRef = useRef<number[]>([]);
  const axesRef = useRef({ x: 0, y: 0, z: 0, init: false });
  const frozenRef = useRef(false);
  // O subscribe captura o closure de quando foi feito (o efeito só depende de
  // `active`), por isso a calibração chega por ref: trocá-la não reabre o
  // sensor, e a leitura seguinte já usa a nova.
  const calibrationRef = useRef<MagCalibration | null>(calibration);
  calibrationRef.current = calibration;

  useEffect(() => {
    frozenRef.current = false;
    setFrozen(false);
    if (!active) {
      subRef.current?.unsubscribe();
      subRef.current = null;
      return;
    }
    setError(false);
    filteredRef.current = 0;
    hasSampleRef.current = false;
    axesRef.current.init = false;
    setValue(0);
    setAxes(null);
    setUpdateIntervalForType(SensorTypes.magnetometer, SAMPLE_INTERVAL);
    subRef.current = magnetometer.subscribe({
      next: (sample: { x: number; y: number; z: number }) => {
        if (frozenRef.current) return;
        const { x, y, z } = applyCalibration(sample, calibrationRef.current);
        const raw = Math.sqrt(x * x + y * y + z * z);
        const ema =
          filteredRef.current === 0
            ? raw
            : filteredRef.current * FILTER_ALPHA + raw * (1 - FILTER_ALPHA);
        filteredRef.current = ema;
        hasSampleRef.current = true;
        const axesEma = axesRef.current;
        if (!axesEma.init) {
          axesEma.x = x;
          axesEma.y = y;
          axesEma.z = z;
          axesEma.init = true;
        } else {
          axesEma.x = axesEma.x * FILTER_ALPHA + x * (1 - FILTER_ALPHA);
          axesEma.y = axesEma.y * FILTER_ALPHA + y * (1 - FILTER_ALPHA);
          axesEma.z = axesEma.z * FILTER_ALPHA + z * (1 - FILTER_ALPHA);
        }
        setAxes({
          x: Math.round(axesEma.x * 10) / 10,
          y: Math.round(axesEma.y * 10) / 10,
          z: Math.round(axesEma.z * 10) / 10,
        });
        const rounded = Math.round(ema * 10) / 10;
        setValue(rounded);
        historyRef.current = [...historyRef.current.slice(-(HISTORY_MAX - 1)), rounded];
        setHistory(historyRef.current);
        minRef.current =
          minRef.current === null ? rounded : Math.min(minRef.current, rounded);
        maxRef.current =
          maxRef.current === null ? rounded : Math.max(maxRef.current, rounded);
        setMin(minRef.current);
        setMax(maxRef.current);
      },
      error: () => setError(true),
    });
    return () => {
      subRef.current?.unsubscribe();
      subRef.current = null;
    };
  }, [active]);

  // O levantamento vive no armazenamento local: carrega-se uma vez, quando o
  // ecrã abre, e só volta a mudar quando se marca ou apaga alguma coisa.
  useEffect(() => {
    let alive = true;
    loadEmfSurvey()
      .then(list => {
        if (alive) setSurvey(list);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const reset = useCallback(() => {
    minRef.current = null;
    maxRef.current = null;
    setMin(null);
    setMax(null);
    setAmbient(null);
    setAmbientAxes(null);
    historyRef.current = [];
    setHistory([]);
  }, []);

  const captureAmbient = useCallback(() => {
    // sem amostra real, filteredRef ainda é 0 e gravar isso travaria a escala
    // em 100%; espera a primeira leitura do magnetômetro. Congelado também não
    // pode gravar: a leitura em ecrã não é mais o ambiente.
    if (!hasSampleRef.current || frozenRef.current) {
      return;
    }
    setAmbient(Math.round(filteredRef.current * 10) / 10);
    const axesEma = axesRef.current;
    if (axesEma.init) {
      setAmbientAxes({
        x: Math.round(axesEma.x * 10) / 10,
        y: Math.round(axesEma.y * 10) / 10,
        z: Math.round(axesEma.z * 10) / 10,
      });
    }
  }, []);

  const toggleFreeze = useCallback(() => {
    frozenRef.current = !frozenRef.current;
    setFrozen(frozenRef.current);
  }, []);

  const markHotspot = useCallback(() => {
    if (!hasFix) return;
    onAdd(`⚡ ${value.toFixed(1)}µT`);
  }, [hasFix, onAdd, value]);

  const delta = ambient === null || min === null ? 0 : Math.max(0, value - ambient);
  const span =
    ambient === null || max === null ? SCALE_MAX : Math.max(max - ambient, 8);
  const ratio =
    ambient === null
      ? Math.max(0, Math.min(1, value / SCALE_MAX))
      : Math.max(0, Math.min(1, delta / span));
  // nível baseado no desvio do ambiente (mesma medida da barra, do bipe e da
  // vibração): comparar o valor absoluto com 40/90 µT marca "alto" o tempo
  // inteiro em regiões de campo magnético alto e nunca reage a anomalias reais
  const levelColor =
    ratio >= HIGH_THRESHOLD
      ? colors.danger
      : ratio >= LOW_THRESHOLD
        ? colors.warning
        : colors.success;
  const levelLabel =
    ratio >= HIGH_THRESHOLD
      ? t('emf_high')
      : ratio >= LOW_THRESHOLD
        ? t('emf_medium')
        : t('emf_low');
  const axis = axes === null ? null : dominantAxis(axes, ambientAxes);

  /**
   * Marca a leitura actual no levantamento (ideia #48). A posição vem do GPS
   * e a magnitude do sensor: o ponto fica com os dois, para o mapa mostrar
   * onde o campo sobe e não só o que se lia.
   */
  const markReading = useCallback(async () => {
    if (!hasFix) return;
    const lat = location.latitude;
    const lon = location.longitude;
    if (lat === 0 && lon === 0) return;
    const point: EmfSurveyPoint = {
      id: createEmfSurveyId(),
      lat,
      lon,
      value,
      delta: ambient === null ? null : Math.round(delta * 10) / 10,
      ratio: Math.round(ratio * 1000) / 1000,
      createdAt: Date.now(),
    };
    const next = await addEmfSurveyPoint(point);
    setSurvey(next);
    setSurveyOpen(true);
  }, [ambient, delta, hasFix, location.latitude, location.longitude, ratio, value]);

  const removeSurveyPoint = useCallback(async (id: string) => {
    const next = await removeEmfSurveyPoint(id);
    setSurvey(next);
  }, []);

  const clearSurvey = useCallback(async () => {
    const next = await clearEmfSurvey();
    setSurvey(next);
  }, []);

  const surveyMapSize = useMemo(
    () => Math.min(mapSideFor(Dimensions.get('window').width), SURVEY_MAP_MAX),
    [],
  );
  const surveyList = useMemo(
    () => survey.slice(-SURVEY_LIST_MAX).reverse(),
    [survey],
  );

  const beepActive = active && !frozen && ratio > 0.08;
  const beepFreq = 240 + Math.pow(ratio, 1.4) * 660;
  const beepInterval = 720 - Math.pow(ratio, 1.4) * 620;
  useRepetitiveBeep({
    intervalMs: beepInterval,
    frequency: beepFreq,
    enabled: beepActive && soundAvailable,
  });

  useEffect(() => {
    if (!active || !beepActive) return;
    const id = setInterval(() => Vibration.vibrate(45), 420);
    return () => clearInterval(id);
  }, [active, beepActive]);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}>
      <Text style={[styles.title, { color: colors.textMuted }]}>
        {t('emf_title')}
      </Text>

      {error ? (
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          {t('emf_unavailable')}
        </Text>
      ) : (
        <>
          <View style={styles.readout}>
            <Text style={[styles.value, { color: levelColor }]}>
              {value.toFixed(1)}
            </Text>
            <Text style={[styles.unit, { color: colors.textMuted }]}>µT</Text>
            <Pressable
              onPress={toggleFreeze}
              style={[
                styles.freezeChip,
                {
                  borderColor: frozen ? colors.accent : colors.border,
                  backgroundColor: frozen ? colors.surfaceAlt : 'transparent',
                },
              ]}>
              <Text
                style={[
                  styles.freezeChipText,
                  { color: frozen ? colors.accent : colors.textMuted },
                ]}>
                {frozen ? t('emf_unfreeze') : t('emf_freeze')}
              </Text>
            </Pressable>
          </View>

          <View style={styles.badge}>
            <View style={[styles.dot, { backgroundColor: levelColor }]} />
            <Text style={[styles.badgeText, { color: levelColor }]}>
              {levelLabel}
            </Text>
          </View>

          <Pressable
            onPress={onCalibrate}
            style={[styles.calChip, { borderColor: colors.border }]}>
            <Text
              style={[
                styles.calChipText,
                { color: calibration ? colors.textMuted : colors.warning },
              ]}>
              {calibration ? t('emf_cal_on') : t('emf_cal_off')}
            </Text>
          </Pressable>

          {frozen && (
            <Text style={[styles.frozenText, { color: colors.accent }]}>
              {t('emf_frozen')}
            </Text>
          )}

          {ambient !== null && (
            <View style={styles.deltaRow}>
              <Text style={[styles.deltaText, { color: levelColor }]}>
                +{delta.toFixed(1)} µT · {t('emf_delta')}
              </Text>
            </View>
          )}

          {axes !== null && (
            <>
              <View style={styles.axisRow}>
                {(['x', 'y', 'z'] as const).map((key) => {
                  const dominant = axis === key;
                  return (
                    <View
                      key={key}
                      style={[
                        styles.axisChip,
                        {
                          backgroundColor: colors.surfaceAlt,
                          borderColor: dominant ? levelColor : colors.border,
                        },
                      ]}>
                      <Text
                        style={[
                          styles.axisChipText,
                          { color: dominant ? levelColor : colors.textMuted },
                        ]}>
                        {key.toUpperCase()} {axes[key].toFixed(1)}
                      </Text>
                    </View>
                  );
                })}
              </View>
              <Text style={[styles.axisLegend, { color: colors.textMuted }]}>
                {t('emf_axis_dominant', { axis: axis ? axis.toUpperCase() : '--' })}
              </Text>
            </>
          )}

          <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
            <View
              style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: levelColor }]}
            />
          </View>

          <View style={styles.statsRow}>
            <View style={[styles.statBox, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                {t('emf_min')}
              </Text>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {min === null ? '--' : min.toFixed(1)}
              </Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                {t('emf_max')}
              </Text>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {max === null ? '--' : max.toFixed(1)}
              </Text>
            </View>
          </View>

          {history.length >= 2 && (
            <View style={[styles.historyBox, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.historyLabel, { color: colors.textMuted }]}>
                {t('emf_history')}
              </Text>
              <TrendChart
                data={history}
                color={levelColor}
                height={34}
              />
            </View>
          )}

          <View style={styles.actionRow}>
            <Pressable
              onPress={captureAmbient}
              disabled={frozen}
              style={[styles.resetButton, { borderColor: colors.border }]}>
              <Text
                style={[styles.resetText, { color: frozen ? colors.textMuted : colors.text }]}>
                {t('emf_ambient')}
              </Text>
            </Pressable>

            <Pressable
              onPress={markHotspot}
              disabled={!hasFix}
              style={[
                styles.resetButton,
                { borderColor: hasFix ? colors.primary : colors.border },
              ]}>
              <Text
                style={[styles.resetText, { color: hasFix ? colors.primary : colors.textMuted }]}>
                {t('emf_hotspot')}
              </Text>
            </Pressable>

            <Pressable
              onPress={markReading}
              disabled={!hasFix}
              style={[
                styles.resetButton,
                { borderColor: hasFix ? colors.primary : colors.border },
              ]}>
              <Text
                style={[styles.resetText, { color: hasFix ? colors.primary : colors.textMuted }]}>
                {t('emf_survey_mark')}
              </Text>
            </Pressable>

            <Pressable
              onPress={reset}
              style={[styles.resetButton, { borderColor: colors.border }]}>
              <Text style={[styles.resetText, { color: colors.text }]}>
                {t('emf_reset')}
              </Text>
            </Pressable>
          </View>

          <View style={styles.surveyBox}>
            <Pressable
              onPress={() => setSurveyOpen(open => !open)}
              style={styles.surveyHeader}>
              <Text style={[styles.surveyTitle, { color: colors.text }]}>
                {t('emf_survey_title')}
              </Text>
              <Text style={[styles.surveyCount, { color: colors.textMuted }]}>
                {survey.length}
              </Text>
              <Text style={[styles.surveyChevron, { color: colors.textMuted }]}>
                {surveyOpen ? '▲' : '▼'}
              </Text>
            </Pressable>

            {surveyOpen && (
              <>
                <EmfSurveyMap
                  points={survey}
                  location={location}
                  size={surveyMapSize}
                />

                {surveyList.map(point => (
                  <View key={point.id} style={styles.surveyRow}>
                    <View
                      style={[
                        styles.surveyDot,
                        {
                          backgroundColor:
                            point.ratio == null
                              ? colors.textMuted
                              : emfLevel(point.ratio) === 'high'
                                ? colors.danger
                                : emfLevel(point.ratio) === 'medium'
                                  ? colors.warning
                                  : colors.success,
                        },
                      ]}
                    />
                    <Text style={[styles.surveyValue, { color: colors.text }]}>
                      {point.value.toFixed(1)} µT
                    </Text>
                    <Text style={[styles.surveyTime, { color: colors.textMuted }]}>
                      {formatTime(point.createdAt)}
                    </Text>
                    <Pressable onPress={() => removeSurveyPoint(point.id)}>
                      <Text style={[styles.surveyRemove, { color: colors.textMuted }]}>
                        🗑
                      </Text>
                    </Pressable>
                  </View>
                ))}

                {survey.length > 0 && (
                  <Pressable
                    onPress={clearSurvey}
                    style={[styles.resetButton, { borderColor: colors.border }]}>
                    <Text style={[styles.resetText, { color: colors.text }]}>
                      {t('emf_survey_clear')}
                    </Text>
                  </Pressable>
                )}
              </>
            )}
          </View>

          <View style={styles.hintRow}>
            {!hasFix && (
              <Text style={[styles.hintSmall, { color: colors.warning }]}>
                {t('emf_hotspot_nofix')}
              </Text>
            )}
            <Text style={[styles.hint, { color: colors.textMuted }]}>
              {t('emf_hint')}
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );
};

const createStyles = (_colors: ColorScheme) =>
  StyleSheet.create({
    scroll: {
      flex: 1,
    },
    container: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    title: {
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: spacing.lg,
      textAlign: 'center',
    },
    readout: {
      flexDirection: 'row',
      alignItems: 'flex-end',
    },
    value: {
      fontFamily: MONO,
      fontSize: 72,
      fontWeight: '900',
      letterSpacing: 1,
      fontVariant: ['tabular-nums'],
    },
    unit: {
      fontSize: 20,
      fontWeight: '800',
      marginLeft: spacing.sm,
      marginBottom: spacing.md,
    },
    freezeChip: {
      marginLeft: spacing.sm,
      marginBottom: spacing.md,
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
      borderRadius: radius.full,
      borderWidth: 1,
      maxWidth: 140,
    },
    freezeChipText: {
      fontSize: 12,
      fontWeight: '800',
    },
    frozenText: {
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginTop: spacing.xs,
    },
    axisRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    axisChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.full,
      borderWidth: 1,
    },
    axisChipText: {
      fontSize: 13,
      fontWeight: '900',
      fontVariant: ['tabular-nums'],
    },
    axisLegend: {
      fontSize: 11,
      fontWeight: '700',
      marginTop: spacing.xs,
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: spacing.sm,
    },
    badgeText: {
      fontSize: 13,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    calChip: {
      marginTop: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.full,
      borderWidth: 1,
    },
    calChipText: {
      fontSize: 12,
      fontWeight: '700',
    },
    track: {
      width: '100%',
      maxWidth: 320,
      height: 10,
      borderRadius: 5,
      marginTop: spacing.lg,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
      borderRadius: 5,
    },
    statsRow: {
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: spacing.lg,
    },
    historyBox: {
      alignSelf: 'stretch',
      maxWidth: 320,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      marginTop: spacing.lg,
    },
    historyLabel: {
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: spacing.xs,
    },
    statBox: {
      minWidth: 96,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      alignItems: 'center',
    },
    statLabel: {
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    statValue: {
      fontSize: 22,
      fontWeight: '900',
      marginTop: spacing.xs,
      fontVariant: ['tabular-nums'],
    },
    resetButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.full,
      borderWidth: 1,
    },
    actionRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.lg,
      flexWrap: 'wrap',
      justifyContent: 'center',
    },
    resetText: {
      fontSize: 13,
      fontWeight: '800',
    },
    deltaRow: {
      marginTop: spacing.xs,
    },
    deltaText: {
      fontSize: 13,
      fontWeight: '900',
      fontVariant: ['tabular-nums'],
    },
    hintRow: {
      alignItems: 'center',
    },
    hintSmall: {
      fontSize: 11,
      fontWeight: '700',
      textAlign: 'center',
      marginTop: spacing.sm,
    },
    hint: {
      fontSize: 12,
      textAlign: 'center',
      marginTop: spacing.lg,
      lineHeight: 18,
      maxWidth: 320,
    },
    surveyBox: {
      alignSelf: 'stretch',
      maxWidth: 320,
      marginTop: spacing.lg,
    },
    surveyHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
    },
    surveyTitle: {
      flex: 1,
      fontSize: 13,
      fontWeight: '800',
    },
    surveyCount: {
      fontSize: 13,
      fontWeight: '800',
      marginRight: spacing.sm,
    },
    surveyChevron: {
      fontSize: 11,
      fontWeight: '800',
    },
    surveyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 3,
    },
    surveyDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: spacing.sm,
    },
    surveyValue: {
      flex: 1,
      fontSize: 12,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
    },
    surveyTime: {
      fontSize: 11,
      fontWeight: '700',
      marginRight: spacing.md,
    },
    surveyRemove: {
      fontSize: 13,
    },
  });

export default EmfReaderView;
