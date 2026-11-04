import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { useThemeColors } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { spacing, radius } from '../theme/colors';
import { mapSideFor } from './MiniMapView';
import { hasLocationFix } from '../utils/geo';
import {
  buildHeatGrid,
  DEFAULT_CELL_METERS,
  filterSince,
  heatColor,
  startOfDay,
} from '../utils/heatmap';
import {
  niceScaleBar,
  projectTrack,
  type GeoPoint,
} from '../utils/trackProjection';
import { formatDistance } from '../utils/geo';
import {
  clearWhereabouts,
  loadWhereabouts,
  type WhereaboutsPoint,
} from '../services/whereaboutsService';
import type { LocationFix } from '../services/locationService';

/**
 * Mapa de calor "onde estive" (ideia #36).
 *
 * Mostra a mancha do dia ou da semana: as posições por onde a app passou são
 * agrupadas numa grelha de 40 m e cada célula é desenhada com a cor do seu
 * peso — azul onde se passou, vermelho onde se esteve.
 *
 * Sem tiles e sem rede, como o resto do app (ideia #93): o desenho é uma
 * função das coordenadas, feita pela mesma projeção do mini-mapa.
 */

type Props = {
  location: LocationFix;
};

type Window = 'day' | 'week';

const RELOAD_MS = 30000;
const PADDING = 18;

const WhereaboutsHeatmap = ({ location }: Props) => {
  const colors = useThemeColors();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(), []);

  const [points, setPoints] = useState<WhereaboutsPoint[]>([]);
  const [window, setWindow] = useState<Window>('day');

  const reload = useCallback(() => {
    loadWhereabouts()
      .then(setPoints)
      .catch(() => {});
  }, []);

  useEffect(() => {
    reload();
    const id = setInterval(reload, RELOAD_MS);
    return () => clearInterval(id);
  }, [reload]);

  const visible = useMemo(() => {
    if (window === 'day') {
      return filterSince(points, startOfDay(Date.now()));
    }
    return points;
  }, [points, window]);

  const cells = useMemo(() => buildHeatGrid(visible), [visible]);

  const hasFix = hasLocationFix(location);
  const side = useMemo(
    () => mapSideFor(Dimensions.get('window').width),
    [],
  );

  const projection = useMemo(() => {
    const path: GeoPoint[] = cells.map(cell => ({ lat: cell.lat, lon: cell.lon }));
    if (hasFix) {
      path.push({ lat: location.latitude, lon: location.longitude });
    }
    return projectTrack(path, { width: side, height: side, padding: PADDING });
  }, [cells, hasFix, location.latitude, location.longitude, side]);

  const here = hasFix ? projection.points[projection.points.length - 1] : null;
  const bar = useMemo(() => niceScaleBar(projection, side, 0.25), [projection, side]);

  const clear = useCallback(async () => {
    await clearWhereabouts();
    setPoints([]);
  }, []);

  return (
    <View style={styles.wrap}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={styles.emoji}>🗺️</Text>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text }]}>
            {t('whereabouts_title')}
          </Text>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            {t('whereabouts_hint')}
          </Text>
        </View>
      </View>

      <View style={styles.tabs}>
        <Pressable
          onPress={() => setWindow('day')}
          style={[
            styles.tab,
            {
              borderColor: colors.border,
              backgroundColor: window === 'day' ? colors.surfaceAlt : 'transparent',
            },
          ]}>
          <Text
            style={[
              styles.tabText,
              { color: window === 'day' ? colors.text : colors.textMuted },
            ]}>
            {t('whereabouts_day')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setWindow('week')}
          style={[
            styles.tab,
            {
              borderColor: colors.border,
              backgroundColor: window === 'week' ? colors.surfaceAlt : 'transparent',
            },
          ]}>
          <Text
            style={[
              styles.tabText,
              { color: window === 'week' ? colors.text : colors.textMuted },
            ]}>
            {t('whereabouts_week')}
          </Text>
        </Pressable>
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
        {cells.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textMuted }]}>
            {t('whereabouts_empty')}
          </Text>
        ) : (
          <>
            {cells.map((cell, i) => {
              const pixel = projection.points[i];
              const radius = Math.max(3, (DEFAULT_CELL_METERS / 2) * projection.scale);
              return (
                <View
                  key={`${cell.lat}:${cell.lon}:${i}`}
                  style={{
                    position: 'absolute',
                    left: pixel.x - radius,
                    top: pixel.y - radius,
                    width: radius * 2,
                    height: radius * 2,
                    borderRadius: radius,
                    backgroundColor: heatColor(cell.weight),
                    opacity: 0.3 + 0.5 * cell.weight,
                  }}
                />
              );
            })}

            {here && (
              <View
                style={{
                  position: 'absolute',
                  left: here.x - 7,
                  top: here.y - 7,
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  borderWidth: 2,
                  borderColor: colors.accent,
                }}
              />
            )}

            <Text style={[styles.north, { color: colors.textMuted }]}>N</Text>

            {bar && (
              <View style={[styles.scaleBar, { bottom: 8, left: 10 }]}>
                <View
                  style={[styles.scaleLine, { width: bar.pixels, borderColor: colors.text }]}
                />
                <Text style={[styles.scaleText, { color: colors.text }]}>
                  {formatDistance(bar.meters)}
                </Text>
              </View>
            )}
          </>
        )}
      </View>

      <View style={styles.legend}>
        <Text style={[styles.legendText, { color: colors.textMuted }]}>
          {t('whereabouts_legend_low')}
        </Text>
        <View style={styles.legendBar}>
          {[0, 0.25, 0.5, 0.75, 1].map(step => (
            <View
              key={step}
              style={[styles.legendStep, { backgroundColor: heatColor(step) }]}
            />
          ))}
        </View>
        <Text style={[styles.legendText, { color: colors.textMuted }]}>
          {t('whereabouts_legend_high')}
        </Text>
      </View>

      <View style={styles.footer}>
        <Text style={[styles.count, { color: colors.textMuted }]}>
          {t('whereabouts_count', { n: visible.length })}
        </Text>
        {points.length > 0 && (
          <Pressable
            onPress={clear}
            style={[styles.clearButton, { borderColor: colors.border }]}>
            <Text style={[styles.clearText, { color: colors.text }]}>
              {t('whereabouts_clear')}
            </Text>
          </Pressable>
        )}
      </View>

      <Text style={[styles.offline, { color: colors.textMuted }]}>
        {t('map_offline')}
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
    tabs: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    tab: {
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.full,
      borderWidth: 1,
    },
    tabText: {
      fontSize: 12,
      fontWeight: '800',
    },
    canvas: {
      alignSelf: 'center',
      borderRadius: radius.md,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    empty: {
      fontSize: 12,
      fontWeight: '700',
      textAlign: 'center',
      paddingHorizontal: spacing.lg,
    },
    legend: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.md,
      gap: spacing.sm,
    },
    legendBar: {
      flexDirection: 'row',
      borderRadius: 3,
      overflow: 'hidden',
    },
    legendStep: {
      width: 14,
      height: 8,
    },
    legendText: {
      fontSize: 11,
      fontWeight: '700',
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.md,
    },
    count: {
      fontSize: 12,
      fontWeight: '700',
    },
    clearButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.full,
      borderWidth: 1,
    },
    clearText: {
      fontSize: 12,
      fontWeight: '800',
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
    offline: {
      fontSize: 11,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
  });

export default WhereaboutsHeatmap;
