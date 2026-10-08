import React from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import BarometerPanel from '../../components/BarometerPanel';
import { useLanguage } from '../../i18n/LanguageContext';
import { useThemeColors } from '../../theme/ThemeContext';
import type { ColorScheme } from '../../theme/themes';
import type { LocationFix, LocationMode } from '../../services/locationService';
import type { AppMode } from '../../services/preferencesService';
import type { Declination } from '../../utils/declination';
import type { CelestialPoint } from '../../utils/astro';
import {
  formatCoord,
  formatTime,
  formatAzimuth,
} from '../../utils/compass';
import { formatDistance } from '../../utils/geo';
import { createStyles } from './styles';

export type Celestial = {
  sun: CelestialPoint;
  moon: CelestialPoint;
  moonIcon: string;
};

export type ActiveTarget = {
  name: string;
  bearing: number;
  distance: number;
  elevation: number | null;
};

type Props = {
  showPanels: boolean;
  showInstrumentPanels: boolean;
  appMode: AppMode;
  celestial: Celestial | null;
  issueWarnings: string[];
  baroPressure: number | null;
  baroAlt: number | null;
  baroBaseline: number | null;
  baroAvailable: boolean;
  onSetBaseline: () => void;
  onResetBaseline: () => void;
  location: LocationFix;
  hasFix: boolean;
  locError: string | null;
  locLoading: boolean;
  locExpanded: boolean;
  onToggleLocExpanded: () => void;
  onOpenCoords: () => void;
  onRefreshLocation: () => void;
  locationMode: LocationMode;
  place: { name: string; cep: string | null } | null;
  odometer: number;
  onResetOdometer: () => void;
  activeTarget: ActiveTarget | null;
  useMils: boolean;
  declination: Declination;
};

const StatusPanels = (props: Props) => {
  const colors: ColorScheme = useThemeColors();
  const { t } = useLanguage();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const {
    showPanels,
    showInstrumentPanels,
    appMode,
    celestial,
    issueWarnings,
    baroPressure,
    baroAlt,
    baroBaseline,
    baroAvailable,
    onSetBaseline,
    onResetBaseline,
    location,
    hasFix,
    locError,
    locLoading,
    locExpanded,
    onToggleLocExpanded,
    onOpenCoords,
    onRefreshLocation,
    locationMode,
    place,
    odometer,
    onResetOdometer,
    activeTarget,
    useMils,
    declination,
  } = props;

  const providerLabel =
    locationMode === 'satellite'
      ? t('ui_provider_satellite')
      : locationMode === 'tower'
      ? t('ui_provider_tower')
      : t('ui_provider_wifi');
  const providerAccent =
    locationMode === 'satellite'
      ? colors.primary
      : locationMode === 'tower'
      ? colors.accent
      : colors.success;

  return (
    <>
      {showInstrumentPanels && celestial && (
        <View style={styles.celestialBar}>
          <View style={styles.celestialPill}>
            <Text style={styles.celestialText}>
              {t('ui_sun_item', {
                deg: Math.round(celestial.sun.azimuth),
                state: t(celestial.sun.elevation >= 0 ? 'ui_sun_high' : 'ui_sun_low'),
              })}
            </Text>
          </View>
          <View style={styles.celestialPill}>
            <Text style={styles.celestialText}>
              {t('ui_moon_item', {
                icon: celestial.moonIcon,
                deg: Math.round(celestial.moon.azimuth),
                state: t(celestial.moon.elevation >= 0 ? 'ui_sun_high' : 'ui_sun_low'),
              })}
            </Text>
          </View>
        </View>
      )}

      {showPanels &&
        issueWarnings.length > 0 && (
          <View style={styles.warningBox}>
            {issueWarnings.map((err, index) => (
              <Text key={index} style={styles.warningText}>
                {err}
              </Text>
            ))}
          </View>
        )}

      {showPanels &&
        appMode === 'full' &&
        (showInstrumentPanels ? (
          <BarometerPanel
            pressure={baroPressure}
            altitude={baroAlt}
            baseline={baroBaseline}
            available={baroAvailable}
            onSetBaseline={onSetBaseline}
            onResetBaseline={onResetBaseline}
          />
        ) : null)}

      {appMode === 'full' && showPanels && (
        <View style={styles.locationCard}>
          <Pressable
            style={styles.locationHeader}
            onPress={onToggleLocExpanded}>
            <View style={styles.locationHeaderLeft}>
              <Text style={styles.locationTitle}>{t('ui_loc_card')}</Text>
              <View
                style={[
                  styles.providerBadge,
                  { borderColor: providerAccent + '55' },
                ]}>
                <View style={[styles.providerDot, { backgroundColor: providerAccent }]} />
                <Text style={[styles.providerText, { color: providerAccent }]}>
                  {providerLabel}
                </Text>
              </View>
            </View>
            <View style={styles.locationActions}>
              <Pressable
                onPress={onOpenCoords}
                disabled={!hasFix}
                hitSlop={8}
                style={styles.refreshButton}>
                <Text style={styles.refreshText}>🧭</Text>
              </Pressable>
              <Pressable
                onPress={onRefreshLocation}
                disabled={locLoading}
                hitSlop={8}
                style={styles.refreshButton}>
                {locLoading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={styles.refreshText}>↻</Text>
                )}
              </Pressable>
              <Text style={[styles.chevron, { color: providerAccent }]}>
                {locExpanded ? '⌃' : '⌄'}
              </Text>
            </View>
          </Pressable>

          {locError ? (
            <Text style={styles.locationError}>{locError}</Text>
          ) : !hasFix ? (
            <View style={styles.locBar}>
              <ActivityIndicator size="small" color={providerAccent} />
              <Text style={styles.locWaiting}>{t('ui_loc_waiting')}</Text>
            </View>
          ) : locExpanded ? (
            <>
              {place && place.name ? (
                <View style={styles.placeRow}>
                  <Text style={styles.placeName} numberOfLines={2}>
                    {place.name}
                  </Text>
                  {place.cep ? (
                    <View style={styles.cepChip}>
                      <Text style={styles.cepChipText}>CEP {place.cep}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
              <View style={styles.coordGrid}>
                <View style={styles.coordCell}>
                  <Text style={styles.coordLabel}>{t('ui_lat')}</Text>
                  <Text style={styles.coordValue}>
                    {formatCoord(location.latitude, true)}
                  </Text>
                </View>
                <View style={[styles.coordCell, styles.coordCellDivider]}>
                  <Text style={styles.coordLabel}>{t('ui_lon')}</Text>
                  <Text style={styles.coordValue}>
                    {formatCoord(location.longitude, false)}
                  </Text>
                </View>
                <View style={styles.coordCell}>
                  <Text style={styles.coordLabel}>{t('ui_altitude')}</Text>
                  <Text style={styles.coordValue}>
                    {location.altitude != null
                      ? `${Math.round(location.altitude)} m`
                      : '—'}
                  </Text>
                </View>
                <View style={[styles.coordCell, styles.coordRowDivider]}>
                  <Text style={styles.coordLabel}>{t('ui_accuracy')}</Text>
                  <Text style={styles.coordValue}>
                    {location.accuracy != null
                      ? `± ${Math.round(location.accuracy)} m`
                      : '—'}
                  </Text>
                </View>
                <View style={[styles.coordCell, styles.coordCellDivider, styles.coordRowDivider]}>
                  <Text style={styles.coordLabel}>{t('ui_speed')}</Text>
                  <Text style={styles.coordValue}>
                    {location.speed != null && location.speed > 0
                      ? `${((location.speed ?? 0) * 3.6).toFixed(1)} km/h`
                      : '—'}
                  </Text>
                </View>
                <View style={[styles.coordCell, styles.coordRowDivider]}>
                  <Text style={styles.coordLabel}>{t('ui_odometer')}</Text>
                  <Pressable onPress={onResetOdometer}>
                    <Text style={[styles.coordValue, { color: colors.primary }]}>
                      {odometer > 0 ? formatDistance(odometer) : '0 m'}
                    </Text>
                  </Pressable>
                </View>
                <View style={[styles.coordCell, styles.coordRowDivider]}>
                  <Text style={styles.coordLabel}>{t('ui_updated')}</Text>
                  <Text style={styles.coordValue}>
                    {location.updatedAt != null
                      ? formatTime(location.updatedAt)
                      : '—'}
                  </Text>
                </View>
                <View style={[styles.coordCell, styles.coordCellDivider, styles.coordRowDivider]}>
                  <Text style={styles.coordLabel}>{t('ui_destination')}</Text>
                  <Text style={styles.coordValue}>
                    {activeTarget
                      ? `${formatAzimuth(activeTarget.bearing, useMils)} · ${formatDistance(activeTarget.distance)}`
                      : '—'}
                  </Text>
                </View>
                <View style={[styles.coordCell, styles.coordRowDivider]}>
                  <Text style={styles.coordLabel}>{t('ui_declination')}</Text>
                  <Text style={styles.coordValue}>
                    {declination.enabled ? `${declination.degrees}°` : t('ui_off')}
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <View style={styles.locSummary}>
              <Text style={styles.locSummaryMain} numberOfLines={1}>
                {place?.name ??
                  `${formatCoord(location.latitude, true)} · ${formatCoord(location.longitude, false)}`}
              </Text>
              <Text style={styles.locSummarySub} numberOfLines={1}>
                {(place?.cep ? `CEP ${place.cep}` : '') +
                  (location.accuracy != null
                    ? `${place?.cep ? '  ·  ' : ''}±${Math.round(location.accuracy)} m`
                    : '')}
              </Text>
            </View>
          )}
        </View>
      )}
    </>
  );
};

export default StatusPanels;
