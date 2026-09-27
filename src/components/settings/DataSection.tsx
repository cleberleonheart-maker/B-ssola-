import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { ChevronRow, GroupCard, SectionLabel } from './primitives';

type Props = {
  exporting: boolean;
  onExport: () => void;
  onOpenImport: () => void;
};

const DataSection = ({ exporting, onExport, onOpenImport }: Props) => {
  const { t } = useLanguage();

  return (
    <>
      <SectionLabel label={t('set_section_data')} />
      <GroupCard>
        <ChevronRow
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
