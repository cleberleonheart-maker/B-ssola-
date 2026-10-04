import type { Translator } from '../i18n/strings';

export type ChangelogEntry = { icon: string; title: string; desc: string };

export type ChangelogBuild = { code: number; entries: ChangelogEntry[] };

/**
 * Uma entrada por build (o `versionCode`, que é o número que o Android
 * incrementa). A chave é o código e não o nome da versão porque só o build
 * atual é escrito no APK: os nomes antigos (`v7.4`, `v7.9`) existem apenas no
 * histórico do git e na tabela `app_version` da nuvem.
 */
const CHANGELOG: Record<number, (t: Translator) => ChangelogEntry[]> = {
  164: t => [
    { icon: '🔐', title: t('wn_apkhash_title'), desc: t('wn_apkhash_desc') },
  ],
  163: t => [
    { icon: '🧭', title: t('wn_liveheadingfix_title'), desc: t('wn_liveheadingfix_desc') },
    { icon: '📷', title: t('wn_zoomtext_title'), desc: t('wn_zoomtext_desc') },
  ],
  162: t => [
    { icon: '🗺️', title: t('wn_livetrack_title'), desc: t('wn_livetrack_desc') },
  ],
  161: t => [
    { icon: '⏱', title: t('wn_liveduration_title'), desc: t('wn_liveduration_desc') },
  ],
  160: t => [
    { icon: '📡', title: t('wn_cloudreason_title'), desc: t('wn_cloudreason_desc') },
  ],
  159: t => [
    { icon: '🔧', title: t('wn_cloudsilent_title'), desc: t('wn_cloudsilent_desc') },
    { icon: '🗺️', title: t('wn_minimap_title'), desc: t('wn_minimap_desc') },
  ],
  158: t => [
    { icon: '📡', title: t('wn_livenative_title'), desc: t('wn_livenative_desc') },
    { icon: '⏰', title: t('wn_liveexpired_title'), desc: t('wn_liveexpired_desc') },
    { icon: '📝', title: t('wn_whatsnew_title'), desc: t('wn_whatsnew_desc') },
    { icon: '⛔', title: t('wn_apkcancel_title'), desc: t('wn_apkcancel_desc') },
  ],
  157: t => [
    { icon: '🧪', title: t('wn_selftestfix_title'), desc: t('wn_selftestfix_desc') },
  ],
  156: t => [
    { icon: '🧪', title: t('wn_selftest_title'), desc: t('wn_selftest_desc') },
  ],
  155: t => [
    { icon: '📡', title: t('wn_livebg_title'), desc: t('wn_livebg_desc') },
  ],
  154: t => [
    { icon: '☀️', title: t('wn_calverify_title'), desc: t('wn_calverify_desc') },
  ],
  153: t => [
    { icon: '🧭', title: t('wn_livesrumo_title'), desc: t('wn_livesrumo_desc') },
  ],
  152: t => [
    { icon: '🛡️', title: t('wn_updatefix_title'), desc: t('wn_updatefix_desc') },
    { icon: '🧹', title: t('wn_tidy_title'), desc: t('wn_tidy_desc') },
  ],
  151: t => [
    { icon: '📡', title: t('wn_live_title'), desc: t('wn_live_desc') },
    { icon: '🛑', title: t('wn_livestop_title'), desc: t('wn_livestop_desc') },
    { icon: '🗺️', title: t('wn_liveview_title'), desc: t('wn_liveview_desc') },
  ],
  150: t => [
    { icon: '📡', title: t('wn_live_title'), desc: t('wn_live_desc') },
  ],
  149: t => [
    { icon: '🔄', title: t('wn_updcheck_title'), desc: t('wn_updcheck_desc') },
    { icon: '🧭', title: t('wn_dialcompact_title'), desc: t('wn_dialcompact_desc') },
  ],
  148: t => [
    { icon: '🗣', title: t('wn_voz_title'), desc: t('wn_voz_desc') },
    { icon: '📏', title: t('wn_odo_title'), desc: t('wn_odo_desc') },
    { icon: '🤖', title: t('wn_hist_title'), desc: t('wn_hist_desc') },
    { icon: '🔐', title: t('wn_pin_title'), desc: t('wn_pin_desc') },
    { icon: '💾', title: t('wn_backup_title'), desc: t('wn_backup_desc') },
    { icon: '🎯', title: t('wn_mils_title'), desc: t('wn_mils_desc') },
  ],
  147: t => [
    { icon: '📡', title: t('wn_emf_title'), desc: t('wn_emf_desc') },
  ],
  146: t => [
    { icon: '📐', title: t('wn_tri_title'), desc: t('wn_tri_desc') },
  ],
  145: t => [
    { icon: '☀️', title: t('wn_sun_title'), desc: t('wn_sun_desc') },
  ],
  144: t => [
    { icon: '⚡', title: t('wn_short_title'), desc: t('wn_short_desc') },
  ],
  143: t => [
    { icon: '↩️', title: t('wn_return_title'), desc: t('wn_return_desc') },
  ],
  142: t => [
    { icon: '🧭', title: t('wn_steady_title'), desc: t('wn_steady_desc') },
    { icon: '📷', title: t('wn_campro_title'), desc: t('wn_campro_desc') },
    { icon: '🗺️', title: t('wn_gpx_title'), desc: t('wn_gpx_desc') },
  ],
  141: t => [
    { icon: '⌖', title: t('wn_height_title'), desc: t('wn_height_desc') },
    { icon: '🚗', title: t('wn_car_title'), desc: t('wn_car_desc') },
  ],
  140: t => [
    { icon: '🧭', title: t('wn_arflat_title'), desc: t('wn_arflat_desc') },
    { icon: '🔋', title: t('wn_bat_title'), desc: t('wn_bat_desc') },
    { icon: '🎥', title: t('wn_fov_title'), desc: t('wn_fov_desc') },
  ],
  139: t => [
    { icon: '📷', title: t('wn_cam2_title'), desc: t('wn_cam2_desc') },
  ],
  138: t => [
    { icon: '📷', title: t('wn_cam2_title'), desc: t('wn_cam2_desc') },
  ],
  137: t => [
    { icon: '📷', title: t('wn_cam2_title'), desc: t('wn_cam2_desc') },
  ],
  136: t => [
    { icon: '📷', title: t('wn_cam2_title'), desc: t('wn_cam2_desc') },
  ],
  135: t => [
    { icon: '📷', title: t('wn_cam_title'), desc: t('wn_cam_desc') },
    { icon: '↩️', title: t('wn_back_title'), desc: t('wn_back_desc') },
    { icon: '🚨', title: t('wn_inmet_title'), desc: t('wn_inmet_desc') },
    { icon: '🔔', title: t('wn_notify_title'), desc: t('wn_notify_desc') },
  ],
};

const knownCodes = (): number[] =>
  Object.keys(CHANGELOG)
    .map(Number)
    .sort((a, b) => a - b);

/**
 * Entradas de um build só. Se o código não tem entrada escrita — build novo
 * cujo changelog ainda não foi redigido, ou downgrade para um código antigo —
 * cai na entrada conhecida imediatamente abaixo: é melhor mostrar o que houve
 * por último do que uma lista vazia.
 */
export const changelogFor = (code: number, t: Translator): ChangelogEntry[] => {
  const build = CHANGELOG[code];
  if (build) {
    return build(t);
  }
  const nearest = knownCodes().filter(known => known < code).pop();
  return nearest ? CHANGELOG[nearest](t) : [];
};

/**
 * Entradas acumuladas entre a última versão vista e a atual, do build mais
 * novo para o mais antigo.
 *
 * Três decisões:
 *
 * - `lastSeen` nulo (instalação nova) ou maior que `code` (downgrade) devolve
 *   só a versão atual. Quem acabou de instalar não tem 20 builds de atraso para
 *   ler, e quem desinstalou algo do nada não deve ver um retrocesso como se
 *   fosse novidade.
 * - O build atual entra sempre na lista, mesmo sem entrada própria: se a
 *   próxima build subir o código antes de o changelog ser escrito, o grupo
 *   mais novo continua sendo o que o usuário está usando.
 * - Repetição é removida pelo título, mantendo a ocorrência mais recente. Os
 *   builds 135–138 anunciam a mesma correção de câmera, e quem salta do 134
 *   para o 138 veria a mesma frase quatro vezes seguidas.
 */
export const changelogBetween = (
  lastSeen: number | null,
  code: number,
  t: Translator,
): ChangelogBuild[] => {
  const inRange =
    lastSeen == null
      ? []
      : knownCodes().filter(known => known > lastSeen && known <= code);

  const targets = Array.from(new Set([...inRange, code])).sort((a, b) => b - a);
  const current = changelogFor(code, t);
  const seenTitles = new Set<string>();
  const builds: ChangelogBuild[] = [];

  for (const target of targets) {
    const entries = (target === code ? current : CHANGELOG[target](t)).filter(
      entry => {
        if (seenTitles.has(entry.title)) return false;
        seenTitles.add(entry.title);
        return true;
      },
    );
    if (entries.length > 0) {
      builds.push({ code: target, entries });
    }
  }

  return builds;
};
