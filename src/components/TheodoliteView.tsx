import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useThemeColors } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { spacing, radius } from '../theme/colors';
import { normalizeHeading, cardinalOf } from '../utils/compass';

type Props = {
  heading: number;
  declination: { enabled: boolean; degrees: number };
  accel: { x: number; y: number; z: number };
};

const RETICLE_R = 110;
const G = 9.80665;

const TheodoliteView = ({ heading, declination, accel }: Props) => {
  const colors = useThemeColors();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [mode, setMode] = useState<'simple' | 'advanced'>('simple');
  const [held, setHeld] = useState<{ hr: number; vr: number } | null>(null);
  const [markA, setMarkA] = useState<{ hr: number; vr: number } | null>(null);
  const [markB, setMarkB] = useState<{ hr: number; vr: number } | null>(null);

  const useTrue = declination.enabled;
  const magHeading = declination.enabled
    ? normalizeHeading(heading - declination.degrees)
    : normalizeHeading(heading);
  const trueHeading = declination.enabled
    ? normalizeHeading(heading)
    : normalizeHeading(heading + declination.degrees);
  const hr = useTrue ? trueHeading : magHeading;

  const vrRaw = Math.asin(Math.max(-1, Math.min(1, -accel.x / G))) * (180 / Math.PI);
  const vr = Math.round(vrRaw * 10) / 10;

  const displayHr = held ? held.hr : hr;
  const displayVr = held ? held.vr : vr;

  const deltaHr =
    markA && markB
      ? Math.round(
          Math.min(
            Math.abs(normalizeHeading(markB.hr - markA.hr)),
            360 - Math.abs(normalizeHeading(markB.hr - markA.hr)),
          ) * 10,
        ) / 10
      : null;
  const deltaVr =
    markA && markB ? Math.round(Math.abs(markB.vr - markA.vr) * 10) / 10 : null;

  const toggleHold = useCallback(() => {
    setHeld(prev => (prev ? null : { hr, vr }));
  }, [hr, vr]);

  const mark = useCallback(() => {
    if (markA && !markB) {
      setMarkB({ hr, vr });
    } else {
      setMarkA({ hr, vr });
      setMarkB(null);
    }
  }, [hr, vr, markA, markB]);

  const clearMarks = useCallback(() => {
    setMarkA(null);
    setMarkB(null);
  }, []);

  const ticks = useMemo(() => {
    const result: { key: number; angle: number }[] = [];
    for (let a = 0; a < 360; a += 30) result.push({ key: a, angle: a });
    return result;
  }, []);

  const cardinal = cardinalOf(displayHr);

  return (
    <View style={styles.container}>
      <View style={styles.modeToggle}>
        <Pressable
          onPress={() => setMode('simple')}
          style={[styles.modeChip, mode === 'simple' && { backgroundColor: colors.primary }]}>
          <Text
            style={[styles.modeChipText, mode === 'simple' && { color: colors.background }]}>
            {t('th_mode_simple')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMode('advanced')}
          style={[styles.modeChip, mode === 'advanced' && { backgroundColor: colors.primary }]}>
          <Text
            style={[styles.modeChipText, mode === 'advanced' && { color: colors.background }]}>
            {t('th_mode_advanced')}
          </Text>
        </Pressable>
      </View>

      <View style={styles.reticleArea}>
        <View style={[styles.reticleOuter, { borderColor: colors.border }]}>
          {mode === 'advanced' && (
            <>
              <View style={[styles.reticleInner, { borderColor: colors.border }]} />
              {ticks.map(tick => (
                <View
                  key={tick.key}
                  style={[
                    styles.tick,
                    tick.angle % 90 === 0 && styles.tickMajor,
                    {
                      transform: [
                        { rotate: `${tick.angle}deg` },
                        { translateY: -RETICLE_R + 10 },
                        { rotate: `-${tick.angle}deg` },
                      ],
                    },
                  ]}
                />
              ))}
            </>
          )}
          <View
            style={[
              styles.reticleH,
              { backgroundColor: colors.border },
            ]}
          />
          <View
            style={[
              styles.reticleV,
              { backgroundColor: colors.border },
            ]}
          />
          <View style={[styles.reticleDot, { backgroundColor: colors.accent }]} />

          {!held && (
            <View style={styles.aimBox}>
              <Text style={[styles.aimText, { color: colors.text }]}>◎</Text>
            </View>
          )}
        </View>

        <View style={styles.readout}>
          <View style={styles.hrBox}>
            <Text style={[styles.unitLabel, { color: colors.textMuted }]}>HR</Text>
            <Text style={[styles.bigNumber, { color: colors.text }]}>
              {displayHr.toFixed(1)}°
            </Text>
            <Text style={[styles.subLabel, { color: colors.textMuted }]}>
              {cardinal.short} · {useTrue ? t('ui_geo_north') : t('ui_mag_north')} {hr.toFixed(1)}°
            </Text>
          </View>
          <View style={[styles.vSep, { backgroundColor: colors.border }]} />
          <View style={styles.vrBox}>
            <Text style={[styles.unitLabel, { color: colors.textMuted }]}>VR</Text>
            <Text style={[styles.bigNumber, { color: colors.text }]}>
              {displayVr.toFixed(1)}°
            </Text>
            <Text style={[styles.subLabel, { color: colors.textMuted }]}>
              {displayVr > 0.5 ? '▲' : displayVr < -0.5 ? '▼' : '●'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.controls}>
        <Pressable
          onPress={toggleHold}
          style={[
            styles.ctlButton,
            held && { backgroundColor: colors.warning },
          ]}>
          <Text style={styles.ctlEmoji}>{held ? '🔓' : '🔒'}</Text>
          <Text style={[styles.ctlLabel, { color: colors.text }]}>
            {held ? t('th_release') : t('th_hold')}
          </Text>
        </Pressable>

        <Pressable onPress={mark} style={[styles.ctlButton, { backgroundColor: colors.primary + '22' }]}>
          <Text style={styles.ctlEmoji}>📌</Text>
          <Text style={[styles.ctlLabel, { color: colors.text }]}>
            {markA ? (markB ? t('th_add_mark') : t('th_second_mark')) : t('th_first_mark')}
          </Text>
        </Pressable>
      </View>

      <View style={[styles.marksBox, { backgroundColor: colors.surfaceAlt }]}>
        <View style={styles.markRow}>
          <Text style={[styles.markLabel, { color: colors.textMuted }]}>A</Text>
          <Text style={[styles.markValue, { color: colors.text }]}>
            {markA ? `${markA.hr.toFixed(1)}° / ${markA.vr.toFixed(1)}°` : '—'}
          </Text>
          <Text style={[styles.markLabel, { color: colors.textMuted }]}>B</Text>
          <Text style={[styles.markValue, { color: colors.text }]}>
            {markB ? `${markB.hr.toFixed(1)}° / ${markB.vr.toFixed(1)}°` : '—'}
          </Text>
        </View>
        <View style={styles.markRow}>
          <Text style={[styles.deltaValue, { color: colors.accent }]}>
            ΔHR {deltaHr != null ? `${deltaHr}°` : '—'}
          </Text>
          <Text style={[styles.deltaValue, { color: colors.accent }]}>
            ΔVR {deltaVr != null ? `${deltaVr}°` : '—'}
          </Text>
          {(markA || markB) && (
            <Pressable onPress={clearMarks} style={styles.clearButton}>
              <Text style={[styles.clearText, { color: colors.textMuted }]}>
                {t('th_clear')}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
};

const createStyles = (colors: {
  background: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  primary: string;
  warning: string;
  surfaceAlt: string;
  success: string;
}) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
    },
    modeToggle: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.full,
      padding: 3,
    },
    modeChip: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xs + 2,
      borderRadius: radius.full,
    },
    modeChipText: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.textMuted,
    },
    reticleArea: {
      alignItems: 'center',
    },
    reticleOuter: {
      width: RETICLE_R * 2,
      height: RETICLE_R * 2,
      borderRadius: RETICLE_R,
      borderWidth: 3,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    reticleInner: {
      position: 'absolute',
      width: RETICLE_R * 1.4,
      height: RETICLE_R * 1.4,
      borderRadius: RETICLE_R * 0.7,
      borderWidth: 1,
    },
    tick: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      width: 2,
      height: 8,
      backgroundColor: colors.border,
      marginTop: -4,
      marginLeft: -1,
    },
    tickMajor: {
      height: 12,
      backgroundColor: colors.accent,
    },
    reticleH: {
      position: 'absolute',
      width: '100%',
      height: 1.5,
    },
    reticleV: {
      position: 'absolute',
      height: '100%',
      width: 1.5,
    },
    reticleDot: {
      position: 'absolute',
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    aimBox: {
      position: 'absolute',
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 2,
      borderColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    aimText: {
      fontSize: 16,
    },
    readout: {
      flexDirection: 'row',
      alignItems: 'stretch',
      marginTop: spacing.lg,
      width: '100%',
      maxWidth: 320,
    },
    hrBox: {
      flex: 2,
      alignItems: 'center',
    },
    vrBox: {
      flex: 1,
      alignItems: 'center',
    },
    vSep: {
      width: 1,
      marginHorizontal: spacing.md,
    },
    unitLabel: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1,
    },
    bigNumber: {
      fontSize: 32,
      fontWeight: '900',
      marginTop: spacing.xs,
      fontVariant: ['tabular-nums'],
    },
    subLabel: {
      fontSize: 11,
      marginTop: spacing.xs,
    },
    controls: {
      flexDirection: 'row',
      width: '100%',
      maxWidth: 320,
    },
    ctlButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      marginHorizontal: spacing.xs,
    },
    ctlEmoji: {
      fontSize: 22,
    },
    ctlLabel: {
      fontSize: 12,
      fontWeight: '700',
      marginTop: spacing.xs,
    },
    marksBox: {
      width: '100%',
      maxWidth: 320,
      borderRadius: radius.md,
      padding: spacing.sm,
    },
    markRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.xs,
    },
    markLabel: {
      fontSize: 12,
      fontWeight: '800',
      width: 18,
    },
    markValue: {
      fontSize: 13,
      fontWeight: '700',
      flex: 1,
      fontVariant: ['tabular-nums'],
    },
    deltaValue: {
      fontSize: 13,
      fontWeight: '800',
      flex: 1,
      fontVariant: ['tabular-nums'],
    },
    clearButton: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    clearText: {
      fontSize: 12,
      fontWeight: '700',
    },
  });

export default TheodoliteView;