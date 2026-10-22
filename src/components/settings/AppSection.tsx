import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useThemeColors } from '../../theme/ThemeContext';
import { APP_VERSION, APP_VERSION_CODE } from '../../version.generated';
import {
  ChevronRow,
  GroupCard,
  GroupRow,
  IconChip,
  RowBody,
  SectionLabel,
} from './primitives';

type Props = {
  onCheckUpdate: () => void;
  checking: boolean;
  onOpenWhatsNew: () => void;
  onOpenReportProblem: () => void;
};

/**
 * Aplicação: a própria app — versão, novidades e problema.
 *
 * Estas três coisas estavam antes espalhadas: a atualização no meio da secção
 * da bússola e o relato de problema numa secção "Ajuda" no fim. Junta-as com a
 * versão, que é o que responde a "de que versão é isto?" sem sair do ecrã.
 */
const AppSection = ({
  onCheckUpdate,
  checking,
  onOpenWhatsNew,
  onOpenReportProblem,
}: Props) => {
  const { t } = useLanguage();
  const colors = useThemeColors();

  return (
    <>
      <SectionLabel label={t('set_section_app')} />
      <GroupCard>
        <GroupRow>
          <IconChip icon="📦" />
          <RowBody
            label={t('ui_app_title')}
            sub={`v${APP_VERSION} (${APP_VERSION_CODE})`}
            subColor={colors.textMuted}
          />
        </GroupRow>

        <ChevronRow
          divider
          icon="📲"
          label={t('set_check_update')}
          sub={t('set_check_update_sub')}
          onPress={onCheckUpdate}
          disabled={checking}
          chevronText={checking ? '…' : '›'}
        />

        <ChevronRow
          divider
          icon="🎉"
          label={t('wn_title', { version: APP_VERSION })}
          sub={t('wn_subtitle')}
          onPress={onOpenWhatsNew}
        />

        <ChevronRow
          divider
          icon="📝"
          label={t('set_report_problem')}
          sub={t('set_report_problem_sub')}
          lines={2}
          onPress={onOpenReportProblem}
        />
      </GroupCard>
    </>
  );
};

export default AppSection;
