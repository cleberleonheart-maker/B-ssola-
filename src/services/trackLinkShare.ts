import { Share } from 'react-native';

import { createTrackShare, ensureCloudUser, pushTracks } from './cloud';
import { trackCloudPayload, type RecordedTrack } from './trackService';

/**
 * Partilha de trilha por link (ideia #37).
 *
 * O GPX exportado e um ficheiro: quem o recebe tem de o ter no telefone para
 * o abrir. Com o link, a pessoa abre a pagina no navegador, ve o percurso e
 * descarrega o GPX de la -- sem instalar nada.
 *
 * O link nao tem os dados dentro: tem um token, e o token aponta para a
 * trilha na nuvem. O token vai no hash (`#tkn=...`) e nao na query, para nao
 * ficar no historico do navegador nem nos registos do servidor.
 *
 * O link expira (30 dias) e a pessoa pode deixar de o mandar: o token so
 * serve enquanto a linha da nuvem estiver viva. O dono ve e apaga as suas
 * partilhas pela RLS da tabela `track_shares`.
 */

const PAGE_URL = 'https://cleberleonheart-maker.github.io/B-ssola-/gpx.html';

/** Dias que o link aguenta. Passado isso, a pagina diz que expirou. */
export const TRACK_LINK_DAYS = 30;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** O link que a pessoa manda. */
export const trackLinkUrl = (token: string): string =>
  `${PAGE_URL}#tkn=${encodeURIComponent(token)}`;

/**
 * Token da partilha. O prefixo `trk` distingue-o do token do rastreio ao
 * vivo (`lnv`) quando se olha para a base de dados, e o resto e aleatorio.
 */
export const newTrackToken = (): string =>
  'trk' +
  Date.now().toString(36) +
  Math.random().toString(36).slice(2, 10);

export type TrackLinkResult =
  | { ok: true; url: string }
  | { ok: false; reason: 'cloud' | 'error' };

/**
 * Cria o link. Antes de dar o link, garante que a trilha esta na nuvem: um
 * link para uma trilha que o servidor nao tem abre uma pagina vazia do
 * outro lado, e isso parece um bug do link e nao e.
 */
export const createTrackLink = async (
  track: RecordedTrack,
): Promise<TrackLinkResult> => {
  const userId = await ensureCloudUser();
  if (!userId) return { ok: false, reason: 'cloud' };

  const naNuvem = await pushTracks(userId, [
    { id: track.id, data: trackCloudPayload(track) },
  ]);
  if (!naNuvem) return { ok: false, reason: 'error' };

  const token = newTrackToken();
  const expiresAt = Date.now() + TRACK_LINK_DAYS * MS_PER_DAY;
  const criada = await createTrackShare(userId, token, track.id, expiresAt);
  if (!criada) return { ok: false, reason: 'error' };

  return { ok: true, url: trackLinkUrl(token) };
};

/** Cria o link e manda-o para o menu de partilha do sistema. */
export const shareTrackLink = async (
  track: RecordedTrack,
): Promise<TrackLinkResult> => {
  const result = await createTrackLink(track);
  if (!result.ok) return result;
  try {
    await Share.share({
      message:
        `Trilha "${track.name}" partilhada pela app Bussola:\n${result.url}`,
    });
  } catch {}
  return result;
};
