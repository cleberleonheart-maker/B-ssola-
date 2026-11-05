import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useLanguage } from '../../i18n/LanguageContext';
import { useThemeColors } from '../../theme/ThemeContext';
import { getAddedTiles, TILE_MODES } from '../../services/tileService';
import type { DisplayMode } from '../../services/preferencesService';
import { buildModeCards } from '../../screens/parts/modeCards';
import { spacing, radius } from '../../theme/colors';

type Props = {
  onClose: () => void;
};

/**
 * Diálogo dos tiles das Definições Rápidas (ideia #14).
 *
 * Os tiles são do Android, não da app: o utilizador arrasta-os para o painel
 * de Definições Rápidas. O diálogo diz como (os passos mudam pouco de
 * telemóvel para telemóvel) e mostra quais já estão lá — o Android avisa o
 * serviço do tile quando ele entra ou sai do painel, e é essa marca que
 * aparece aqui.
 */
const TilesDialog = ({ onClose }: Props) => {
  const { t } = useLanguage();
  const colors = useThemeColors();
  const [added, setAdded] = useState<DisplayMode[]>([]);

  useEffect(() => {
    let alive = true;
    getAddedTiles().then(modes => {
      if (alive) setAdded(modes);
    });
    return () => {
      alive = false;
    };
  }, []);

  const cards = buildModeCards(t).filter(card => TILE_MODES.includes(card.key));

  return (
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text style={[styles.title, { color: colors.text }]}>🧩 {t('tiles_title')}</Text>
        <Text style={[styles.sub, { color: colors.textMuted }]}>{t('tiles_sub')}</Text>

        <ScrollView style={styles.list}>
          {cards.map(card => {
            const on = added.includes(card.key);
            return (
              <View key={card.key} style={styles.row}>
                <Text style={styles.icon}>{card.icon}</Text>
                <Text style={[styles.name, { color: colors.text }]}>{card.label}</Text>
                <Text
                  style={[
                    styles.state,
                    { color: on ? colors.success : colors.textMuted },
                  ]}>
                  {on ? t('tiles_added') : t('tiles_not_added')}
                </Text>
              </View>
            );
          })}
        </ScrollView>

        <Text style={[styles.steps, { color: colors.textMuted }]}>{t('tiles_steps')}</Text>

        <View style={styles.actions}>
          <Pressable onPress={onClose} style={styles.close}>
            <Text style={[styles.closeText, { color: colors.textMuted }]}>
              {t('backup_cancel')}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#00000018',
    padding: spacing.lg,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  sub: {
    fontSize: 12,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    textAlign: 'center',
    lineHeight: 16,
  },
  list: {
    maxHeight: 240,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  icon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  name: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  state: {
    fontSize: 12,
    fontWeight: '700',
  },
  steps: {
    fontSize: 12,
    marginTop: spacing.md,
    lineHeight: 17,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: spacing.sm,
  },
  close: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  closeText: {
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});

export default TilesDialog;
