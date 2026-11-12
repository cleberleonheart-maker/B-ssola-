/**
 * Os endereços das páginas que o app publica no GitHub Pages.
 *
 * Duas cópias de um endereço divergem em silêncio — e o link partido só se vê
 * quando alguém o abre, que é tarde demais. A página do rastreio ao vivo é
 * precisa em três sítios (o link que o app partilha, o cache nativo do modo de
 * assalto e o `live.html` que a serve) e a da trilha em mais dois, por isso
 * moram todas aqui: o Kotlin não tem cópia nenhuma, recebe a do JavaScript.
 */
export const SITE_BASE_URL = 'https://cleberleonheart-maker.github.io/B-ssola-';

/** A página que mostra a posição de quem está a ser seguido. */
export const LIVE_PAGE_URL = `${SITE_BASE_URL}/live.html`;

/** A página que mostra a trilha partilhada e deixa descarregar o GPX. */
export const GPX_PAGE_URL = `${SITE_BASE_URL}/gpx.html`;
