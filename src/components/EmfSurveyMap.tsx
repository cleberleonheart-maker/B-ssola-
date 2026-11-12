import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemeColors } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { spacing, radius } from '../theme/colors';
import { emfLevel } from '../utils/emf';
import {
  niceScaleBar,
  polylineSegments,
  projectTrack,
  type GeoPoint,
} from '../utils/trackProjection';
import { formatDistance, hasLocationFix } from '../utils/geo';
import type { LocationFix } from '../services/locationService';
import type { EmfSurveyPoint } from '../services/emfSurveyService';

/**
 * Mapa do levantamento de EMF (ideia #48).
 *
 * É o mini-mapa do `MiniMapView` em versão compacta e com um objectivo
 * diferente: não mostra o trajecto de quem anda, mostra *onde* foram marcadas
 * as leituras. Cada ponto é uma leitura, a cor é o nível que a leitura tinha
 * (a mesma escala da barra do leitor) e o número ao lado é a magnitude em µT.
 *
 * A matemática é a de `utils/trackProjection`, a mesma do mini-mapa e da
 * página `web/live.html`: equirrectangular com a correcção `cos(latitude)`.
 * Sem tiles, sem rede, sem pedidos — o desenho é uma função das coordenadas.
 */

type Props = {
  points: EmfSurveyPoint[];
  location: LocationFix;
  size: number;
};

const PADDING = 20;

const EmfSurveyMap = ({ points, location, size }: Props) => {
  const colors = useThemeColors();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(), []);

  const hasFix = hasLocationFix(location);

  const projection = useMemo(() => {
    const path: GeoPoint[] = points.map(p => ({ lat: p.lat, lon: p.lon }));
    if (hasFix) {
      path.push({ lat: location.latitude, lon: location.longitude });
    }
    return projectTrack(path, { width: size, height: size, padding: PADDING });
  }, [points, hasFix, location.latitude, location.longitude, size]);

  const surveyPixels = projection.points.slice(0, points.length);
  const here = hasFix ? projection.points[projection.points.length - 1] : null;

  const trail = useMemo(
    () => polylineSegments(surveyPixels.slice(0, -1)),
    [surveyPixels],
  );

  const bar = useMemo(() => niceScaleBar(projection, size, 0.25), [projection, size]);

  if (points.length === 0) {
    return (
      <View
        style={[
          styles.empty,
          {
            width: size,
            height: size,
            backgroundColor: colors.surfaceAlt,
            borderColor: colors.border,
          },
        ]}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          {t('emf_survey_empty')}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.canvas,
        {
          width: size,
          height: size,
          backgroundColor: colors.surfaceAlt,
          borderColor: colors.border,
        },
      ]}>
      {trail.map((seg, i) => (
        <View
          key={i}
          style={[
            styles.segment,
            {
              left: seg.x,
              top: seg.y,
              width: seg.w,
              backgroundColor: colors.textMuted,
              transform: [{ rotate: `${seg.a}deg` }],
            },
          ]}
        />
      ))}

      {surveyPixels.map((pixel, i) => {
        const point = points[i];
        const level = point.ratio == null ? 'low' : emfLevel(point.ratio);
        const color =
          level === 'high'
            ? colors.danger
            : level === 'medium'
              ? colors.warning
              : colors.success;
        return (
          <React.Fragment key={point.id}>
            <View
              style={[
                styles.point,
                {
                  left: pixel.x - 5,
                  top: pixel.y - 5,
                  backgroundColor: color,
                  borderColor: colors.surfaceAlt,
                },
              ]}
            />
            <Text
              style={[
                styles.pointLabel,
                { color: colors.text, top: pixel.y - 22, left: pixel.x - 12 },
              ]}>
              {point.value.toFixed(0)}
            </Text>
          </React.Fragment>
        );
      })}

      {here && (
        <View
          style={[
            styles.hereMarker,
            { left: here.x - 7, top: here.y - 7, borderColor: colors.accent },
          ]}
        />
      )}

      <Text style={[styles.north, { color: colors.textMuted }]}>N</Text>

      {bar && (
        <View style={[styles.scaleBar, styles.scaleBarOffset]}>
          <View
            style={[styles.scaleLine, { width: bar.pixels, borderColor: colors.text }]}
          />
          <Text style={[styles.scaleText, { color: colors.text }]}>
            {formatDistance(bar.meters)}
          </Text>
        </View>
      )}
    </View>
  );
};

const createStyles = () =>
  StyleSheet.create({
    canvas: {
      alignSelf: 'center',
      borderRadius: radius.md,
      borderWidth: 1,
      overflow: 'hidden',
    },
    empty: {
      alignSelf: 'center',
      borderRadius: radius.md,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
    },
    emptyText: {
      fontSize: 12,
      fontWeight: '700',
      textAlign: 'center',
    },
    pointLabel: {
      position: 'absolute',
      fontSize: 9,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
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
    scaleBarOffset: {
      bottom: 8,
      left: 10,
    },
    segment: {
      position: 'absolute',
      height: 2,
      borderRadius: 1,
      opacity: 0.6,
    },
    point: {
      position: 'absolute',
      width: 10,
      height: 10,
      borderRadius: 5,
      borderWidth: 2,
    },
    hereMarker: {
      position: 'absolute',
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: 2,
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
  });

export default EmfSurveyMap;
