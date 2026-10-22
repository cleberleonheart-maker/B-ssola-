import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { ChevronRow, GroupCard, SectionLabel } from './primitives';

type Props = {
  exporting: boolean;
  onExport: () => void;
  onOpenImport: () => void;
  onOpenWaypoints: () => void;
  onShareLocation: () => void;
};

/**
 * Dados e partilha: o que a app guarda e o que dela sai.
 *
 * Waypoints e partilha de posição são o mesmo assunto — marcar um sítio e
 * mandá-lo a alguém — e o backup é o que garante que nada se perde. O
 * histórico de partilhas entra na mesma secção, no ecrã.
 */
const DataSection = ({
  exporting,
  onExport,
  onOpenImport,
  onOpenWaypoints,
  onShareLocation,
}: Props) => {
  const { t } = useLanguage();

  return (
    <>
      <SectionLabel label={t('set_section_data')} />
      <GroupCard>
        <ChevronRow
          icon="📍"
          label={t('set_wp_title')}
          sub={t('set_wp_sub')}
          onPress={onOpenWaypoints}
        />
        <ChevronRow
          divider
          icon="📤"
          label={t('set_share_title')}
          sub={t('set_share_sub')}
          onPress={onShareLocation}
        />
        <ChevronRow
          divider
          icon="💾"
          label={t('set_backup_export')}
          sub={t('backup_notes_hint')}
          lines={3}
          onPress={onExport}
          disabled={exporting}
          chevronText={exporting ? '…' : '›'}
        />
        <ChevronRow
          divider
          icon="📥"
          label={t('set_backup_import')}
          sub={t('backup_import_sub')}
          lines={2}
          onPress={onOpenImport}
        />
      </GroupCard>
    </>
  );
};

export default DataSection;
