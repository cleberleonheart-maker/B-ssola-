import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { cloudStatus } from '../../services/cloud';
import { pendingCrashes } from '../../services/crashReporter';
import { useThemeColors } from '../../theme/ThemeContext';
import {
  GroupCard,
  GroupRow,
  IconChip,
  RowBody,
  SectionLabel,
  StatusDot,
} from './primitives';

const formatWhen = (ts: number): string => {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(
    d.getMinutes(),
  )}`;
};

/**
 * Estado da nuvem em Configurações (ideia #99).
 *
 * Só informa, não mexe em nada: sem botão de "testar ligação" nem de reenviar,
 * porque a app já tenta sozinha em cada arranque e um botão novo seria mais
 * uma forma de pressionar sem saber o que vai acontecer. Serve para responder,
 * no próprio aparelho, à pergunta que até agora só se respondia ligando o
 * debugger: "isto está a falar com o Supabase ou não?".
 */
const CloudSection = () => {
  const { t } = useLanguage();
  const colors = useThemeColors();
  const status = cloudStatus();
  const [fila, setFila] = useState(0);

  useEffect(() => {
    let vivo = true;
    void pendingCrashes().then(n => {
      if (vivo) setFila(n);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const estado = status.connected
    ? t('cloud_on')
    : status.enabled
      ? status.clientError
        ? t('cloud_off_reason', { reason: status.clientError })
        : t('cloud_off')
      : t('cloud_no_creds');

  return (
    <>
      <SectionLabel label={t('set_section_cloud')} />
      <GroupCard>
        <GroupRow>
          <IconChip icon="📡" />
          <RowBody
            label={t('cloud_state')}
            sub={estado}
            subColor={status.connected ? colors.success : colors.danger}
          />
          <StatusDot good={status.connected} />
        </GroupRow>

        <GroupRow divider>
          <IconChip icon="🕓" />
          <RowBody
            label={t('cloud_last_answer')}
            sub={
              status.lastSyncAt !== null
                ? formatWhen(status.lastSyncAt)
                : t('cloud_no_sync')
            }
          />
        </GroupRow>

        <GroupRow divider>
          <IconChip icon="⚠️" />
          <RowBody
            label={t('cloud_last_error')}
            sub={status.lastError ?? '—'}
            subColor={status.lastError ? colors.danger : colors.textMuted}
          />
        </GroupRow>

        <GroupRow divider>
          <IconChip icon="📨" />
          <RowBody label={t('cloud_queue')} sub={t('cloud_queue_sub', { n: fila })} />
        </GroupRow>
      </GroupCard>
    </>
  );
};

export default CloudSection;
