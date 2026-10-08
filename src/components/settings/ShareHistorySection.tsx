import React, { useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  ensureCloudUser,
  fetchLiveShareHistory,
  type LiveShareHistoryRow,
} from '../../services/cloud';
import {
  shareDurationLabel,
  shareDurationMs,
  shareState,
  shareWhenLabel,
} from '../../utils/shareHistory';
import { useThemeColors } from '../../theme/ThemeContext';
import {
  ChevronRow,
  GroupCard,
  GroupRow,
  IconChip,
  RowBody,
  SectionLabel,
} from './primitives';

type Estado = 'fechado' | 'a-carregar' | 'aberto' | 'erro';

/**
 * Histórico de partilhas em Configurações (ideia #100).
 *
 * Responde à pergunta que vem depois de um SOS — "foi esta sessão que eu
 * mandei, ou outra?" — e à outra, mais banal mas mais frequente: "quando foi
 * a última vez que partilhei a posição?". Lê só os carimbos de tempo das
 * linhas do próprio (a RLS garante o resto): a coordenada de uma sessão que
 * já acabou não vem de volta ao aparelho, e não faria sentido aparecer num
 * ecrã de configurações.
 *
 * Carrega no primeiro toque e não em cada abertura do modal: é uma lista que
 * não muda a cada segundo, e um pedido em cada montagem seria mais uma forma
 * de o Configurações ficar lento sem que ninguém tenha pedido.
 */
const ShareHistorySection = () => {
  const { t } = useLanguage();
  const colors = useThemeColors();
  const [estado, setEstado] = useState<Estado>('fechado');
  const [linhas, setLinhas] = useState<LiveShareHistoryRow[]>([]);

  const carregar = async () => {
    setEstado('a-carregar');
    const userId = await ensureCloudUser();
    if (!userId) {
      setEstado('erro');
      return;
    }
    const hist = await fetchLiveShareHistory(userId);
    setLinhas(hist);
    setEstado('aberto');
  };

  const abrir = () => {
    if (estado === 'fechado') void carregar();
    else setEstado('fechado');
  };

  const legenda = (r: LiveShareHistoryRow): string => {
    const agora = Date.now();
    const s = shareState(r, agora);
    const estadoTxt =
      s === 'running'
        ? t('shares_running')
        : s === 'stopped'
          ? t('shares_stopped')
          : t('shares_expired');
    return `${shareDurationLabel(shareDurationMs(r, agora))} · ${estadoTxt}`;
  };

  const aberto = estado === 'a-carregar' || estado === 'aberto' || estado === 'erro';

  return (
    <>
      <SectionLabel label={t('set_section_shares')} />
      <GroupCard>
        <ChevronRow
          icon="📡"
          label={t('shares_history')}
          sub={t('shares_history_sub')}
          chevronText={aberto ? '▾' : '›'}
          onPress={abrir}
        />
        {estado === 'a-carregar' ? (
          <GroupRow divider>
            <IconChip icon="⏳" />
            <RowBody label={t('shares_loading')} sub="" />
          </GroupRow>
        ) : null}
        {estado === 'erro' ? (
          <GroupRow divider>
            <IconChip icon="⚠️" />
            <RowBody label={t('shares_error')} sub="" subColor={colors.danger} />
          </GroupRow>
        ) : null}
        {estado === 'aberto' && linhas.length === 0 ? (
          <GroupRow divider>
            <IconChip icon="📭" />
            <RowBody label={t('shares_empty')} sub="" />
          </GroupRow>
        ) : null}
        {estado === 'aberto'
          ? linhas.map((r, i) => (
              <GroupRow key={r.token} divider={i < linhas.length - 1}>
                <IconChip
                  icon={shareState(r, Date.now()) === 'running' ? '📍' : '🔗'}
                />
                <RowBody
                  label={shareWhenLabel(r.started_at)}
                  sub={legenda(r)}
                  lines={2}
                />
              </GroupRow>
            ))
          : null}
      </GroupCard>
    </>
  );
};

export default ShareHistorySection;
