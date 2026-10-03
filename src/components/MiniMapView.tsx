import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Dimensions, StyleSheet } from 'react-native';
import { useThemeColors } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { spacing, radius } from '../theme/colors';
import { cardinalOf, formatAzimuth, formatCoord } from '../utils/compass';
import { formatDistance, haversine } from '../utils/geo';
import {
  niceScaleBar,
  polylineSegments,
  projectTrack,
  type GeoPoint,
} from '../utils/trackProjection';
import type { LocationFix } from '../services/locationService';

/**
 * Mini mapa que funciona sem rede nenhuma.
 *
 * Não há tiles, não há `react-native-maps`, não há pedidos: o desenho é uma
 * função pura das coordenadas em `utils/trackProjection`, a mesma que a página
 * `web/live.html` traz escrita em JavaScript. Sem um basemap não há ruas nem
 * nomes de Rua — o que há é a sua posição, o rumo, o círculo de precisão, a
 * escala e obreadcrumb do que andou desde que abriu o ecrã.
 *
 * A janela é centrada na posição e tem largura fixa (`spanMeters`): o mapa
 * segue a pessoa em vez de se ajustar ao caminho, que é o que se quer quando
 * se está a tentar orientação no sitio.
 */

const MIN_STEP_METERS = 5;
const MIN_GAP_MS = 2000;
const MAX_BREADCRUMBS = 500;

/** Zoom inicial: janela de 400 m, com três níveis. */
const SPAN_LEVELS = [400, 150, 50];

export const mapSideFor = (windowWidth: number): number =>
  Math.max(200, Math.min(windowWidth - spacing.lg * 2, 360));

type Props = {
  active: boolean;
  location: LocationFix;
  heading?: number;
};

const MiniMapView = ({ active, location, heading }: Props) => {
  const colors = useThemeColors();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(), []);

  const side = useMemo(() => mapSideFor(Dimensions.get('window').width), []);

  const [spanIndex, setSpanIndex] = useState(0);
  const spanMeters = SPAN_LEVELS[spanIndex];
  const zoomIn = () => setSpanIndex(i => Math.min(i + 1, SPAN_LEVELS.length - 1));
  const zoomOut = () => setSpanIndex(i => Math.max(i - 1, 0));

  const [crumbs, setCrumbs] = useState<GeoPoint[]>([]);
  const lastRef = useRef<{ lat: number; lon: number; ts: number } | null>(null);

  const hasFix = location.latitude !== 0 || location.longitude !== 0;

  /**
   * O breadcrumb só aceita um ponto novo quando a pessoa andou `MIN_STEP_METERS`
   * e passou `MIN_GAP_MS`. Sem isto, um GPS parado a oscilar um metro enchia
   * a lista de 500 pontos em minutos e o desenho deixava de servir.
   */
  useEffect(() => {
    if (!active || !hasFix) return;
    const now = Date.now();
    const here = { lat: location.latitude, lon: location.longitude };
    const last = lastRef.current;

    if (last) {
      const moved = haversine(last.lat, last.lon, here.lat, here.lon);
      if (moved < MIN_STEP_METERS || now - last.ts < MIN_GAP_MS) return;
    }

    lastRef.current = { ...here, ts: now };
    setCrumbs(prev => {
      const next = [...prev, here];
      return next.length > MAX_BREADCRUMBS ? next.slice(next.length - MAX_BREADCRUMBS) : next;
    });
  }, [active, hasFix, location.latitude, location.longitude]);

  useEffect(() => {
    if (active) return;
    lastRef.current = null;
    setCrumbs([]);
  }, [active]);

  // A posição entra na projeção como dois primitivos, não como um objecto: o
  // `useMemo` dependia de `me?.lat`/`me?.lon` com o objecto `me` fechado no
  // dentro, o que o eslint marca como dependência em falta — e tê-lo
  // dependente do objecto recalcula a projeção em cada render, já que `me` é
  // novo de cada vez.
  const meLat = hasFix ? location.latitude : null;
  const meLon = hasFix ? location.longitude : null;
  const me: GeoPoint | null = meLat == null || meLon == null ? null : { lat: meLat, lon: meLon };

  const projection = useMemo(() => {
    const here = meLat == null || meLon == null ? null : { lat: meLat, lon: meLon };
    const path = here ? [...crumbs, here] : [];
    return projectTrack(path, {
      width: side,
      height: side,
      padding: 14,
      center: here ?? undefined,
      spanMeters,
    });
  }, [crumbs, meLat, meLon, side, spanMeters]);

  const trail = useMemo(
    () => polylineSegments(projection.points.slice(0, -1)),
    [projection.points],
  );
  const here = me ? projection.points[projection.points.length - 1] : null;
  const bar = useMemo(() => niceScaleBar(projection, side, 0.25), [projection, side]);

  const accuracyRadius =
    location.accuracy != null && location.accuracy > 0
      ? Math.max(4, Math.min(location.accuracy * projection.scale, side / 2))
      : null;

  const walked = useMemo(() => {
    let total = 0;
    for (let i = 1; i < crumbs.length; i++) {
      total += haversine(crumbs[i - 1].lat, crumbs[i - 1].lon, crumbs[i].lat, crumbs[i].lon);
    }
    return total;
  }, [crumbs]);

  // `cardinalOf` devolve `{ short, full }`: sem o `.short` o template
  // interpolava "[object Object]" no lugar da direção.
  const headingText =
    heading == null
      ? t('map_heading_none')
      : `${formatAzimuth(heading, false)} ${cardinalOf(heading).short}`;

  return (
    <View style={styles.wrap}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={styles.emoji}>🧭</Text>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text }]}>{t('map_title')}</Text>
          <Text style={[styles.hint, { color: colors.textMuted }]}>{t('map_hint')}</Text>
        </View>
      </View>

      <View
        style={[
          styles.canvas,
          {
            width: side,
            height: side,
            backgroundColor: colors.surfaceAlt,
            borderColor: colors.border,
          },
        ]}>
        {hasFix && projection.scale > 0 ? (
          <>
            {trail.map((seg, i) => (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  left: seg.x,
                  top: seg.y,
                  width: seg.w,
                  height: 2,
                  borderRadius: 1,
                  backgroundColor: colors.primary,
                  transform: [{ rotate: `${seg.a}deg` }],
                }}
              />
            ))}

            {accuracyRadius != null && here && (
              <View
                style={{
                  position: 'absolute',
                  left: here.x - accuracyRadius,
                  top: here.y - accuracyRadius,
                  width: accuracyRadius * 2,
                  height: accuracyRadius * 2,
                  borderRadius: accuracyRadius,
                  borderWidth: 1,
                  borderColor: colors.textMuted,
                  opacity: 0.5,
                }}
              />
            )}

            {heading != null && here && (
              <View
                style={{
                  position: 'absolute',
                  left: here.x - 26,
                  top: here.y - 26,
                  width: 52,
                  height: 52,
                  transform: [{ rotate: `${heading}deg` }],
                }}>
                <View
                  style={{
                    position: 'absolute',
                    left: 25,
                    top: 0,
                    width: 2,
                    height: 14,
                    backgroundColor: colors.north,
                  }}
                />
              </View>
            )}

            {here && (
              <View
                style={{
                  position: 'absolute',
                  left: here.x - 5,
                  top: here.y - 5,
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: colors.success,
                  borderWidth: 2,
                  borderColor: colors.surfaceAlt,
                }}
              />
            )}

            <Text style={[styles.north, { color: colors.textMuted }]}>N</Text>

            {bar && (
              <View style={[styles.scaleBar, { bottom: 10, left: 12 }]}>
                <View
                  style={[styles.scaleLine, { width: bar.pixels, borderColor: colors.text }]}
                />
                <Text style={[styles.scaleText, { color: colors.text }]}>
                  {formatDistance(bar.meters)}
                </Text>
              </View>
            )}
          </>
        ) : (
          <Text style={[styles.noFix, { color: colors.textMuted }]}>{t('map_no_fix')}</Text>
        )}
      </View>

      <View style={styles.zoomRow}>
        <Pressable
          accessibilityRole="button"
          onPress={zoomOut}
          style={[styles.zoomBtn, { borderColor: colors.border }]}>
          <Text style={[styles.zoomGlyph, { color: colors.text }]}>−</Text>
        </Pressable>
        <Text style={[styles.zoomLabel, { color: colors.textMuted }]}>
          {formatDistance(spanMeters)}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={zoomIn}
          style={[
            styles.zoomBtn,
            {
              borderColor: colors.border,
              opacity: spanIndex === SPAN_LEVELS.length - 1 ? 0.35 : 1,
            },
          ]}>
          <Text style={[styles.zoomGlyph, { color: colors.text }]}>+</Text>
        </Pressable>
      </View>

      {/*
       * Sem fix não há bloco de leitura. Mostrar `0.000000 N 0.000000 E` seria
       * inventar uma posição — e a Null Island é um sítio real no Atlântico,
       * não um "desconhecido". Quem não tem GPS lê a linha "à espera do GPS…"
       * acima e não recebe coordenadas inventadas.
       */}
      {hasFix && me ? (
        <View style={[styles.readout, { borderColor: colors.border }]}>
          <Row
            label={t('map_coords')}
            value={formatCoord(me.lat, true)}
            second={formatCoord(me.lon, false)}
          />
          <Row
            label={t('map_accuracy')}
            value={
              location.accuracy != null ? `±${Math.round(location.accuracy)} m` : t('map_unknown')
            }
          />
          <Row label={t('map_heading')} value={headingText} />
          <Row
            label={t('map_walked')}
            value={walked > 0 ? formatDistance(walked) : t('map_no_track')}
          />
        </View>
      ) : null}

      <Text style={[styles.offline, { color: colors.textMuted }]}>{t('map_offline')}</Text>
    </View>
  );
};

const Row = ({
  label,
  value,
  second,
}: {
  label: string;
  value: string;
  second?: string;
}) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(), []);
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.text }]}>
        {value}
        {second ? `  ${second}` : ''}
      </Text>
    </View>
  );
};

const createStyles = () =>
  StyleSheet.create({
    wrap: {
      paddingBottom: spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingBottom: spacing.sm,
      marginBottom: spacing.md,
      borderBottomWidth: 1,
    },
    headerText: {
      flex: 1,
      marginLeft: spacing.sm,
    },
    emoji: {
      fontSize: 26,
    },
    title: {
      fontSize: 16,
      fontWeight: '800',
    },
    hint: {
      fontSize: 12,
      marginTop: 2,
    },
    canvas: {
      alignSelf: 'center',
      borderRadius: radius.md,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    north: {
      position: 'absolute',
      top: 6,
      left: 10,
      fontSize: 11,
      fontWeight: '800',
    },
    scaleBar: {
      position: 'absolute',
    },
    scaleLine: {
      height: 5,
      borderBottomWidth: 2,
      borderLeftWidth: 2,
      borderRightWidth: 2,
    },
    scaleText: {
      fontSize: 10,
      fontWeight: '700',
      marginTop: 1,
    },
    noFix: {
      fontSize: 13,
      fontWeight: '600',
    },
    zoomRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.sm,
    },
    zoomBtn: {
      width: 38,
      height: 38,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderRadius: radius.full,
    },
    zoomGlyph: {
      fontSize: 22,
      fontWeight: '800',
    },
    zoomLabel: {
      marginHorizontal: spacing.md,
      fontSize: 12,
      fontWeight: '700',
      minWidth: 64,
      textAlign: 'center',
    },
    readout: {
      marginTop: spacing.md,
      borderTopWidth: 1,
      paddingTop: spacing.sm,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 4,
    },
    rowLabel: {
      fontSize: 12,
      fontWeight: '700',
    },
    rowValue: {
      fontSize: 13,
      fontWeight: '800',
    },
    offline: {
      fontSize: 11,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
  });

export default MiniMapView;