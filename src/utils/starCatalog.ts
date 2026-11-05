/**
 * Catálogo das estrelas mais brilhantes, para a calibração da declinação
 * (ideia #13).
 *
 * A ideia original era apontar a câmara à Polaris, que está junto ao polo
 * celeste norte. Mas a Polaris só se vê a norte do equador: no Brasil ela
 * está abaixo do horizonte, e a mesma coisa acontece a quase toda a Europa
 * de inverno. Por isso a calibração passou a aceitar qualquer estrela
 * brilhante — o que interessa é o *azimute verdadeiro* dela, que o catálogo
 * dá com precisão de poucos segundos de arco.
 *
 * Coordenadas J2000 (RA/Dec em graus), das mais brilhantes do céu. Os nomes
 * próprios são iguais em português, inglês e espanhol.
 */

export type CatalogStar = {
  id: string;
  /** Nome próprio da estrela (o mesmo nos três idiomas). */
  name: string;
  /** Ascensão reta J2000, em graus. */
  ra: number;
  /** Declinação J2000, em graus. */
  dec: number;
  /** Magnitude aparente (menor = mais brilhante). */
  magnitude: number;
};

export const BRIGHT_STARS: CatalogStar[] = [
  { id: 'sirius', name: 'Sirius', ra: 101.2872, dec: -16.7161, magnitude: -1.46 },
  { id: 'canopus', name: 'Canopus', ra: 95.988, dec: -52.6957, magnitude: -0.74 },
  { id: 'rigil_kentaurus', name: 'Rigil Kentaurus', ra: 219.9021, dec: -60.834, magnitude: -0.27 },
  { id: 'arcturus', name: 'Arcturus', ra: 213.9153, dec: 19.1824, magnitude: -0.05 },
  { id: 'vega', name: 'Vega', ra: 279.2347, dec: 38.7837, magnitude: 0.03 },
  { id: 'capella', name: 'Capella', ra: 79.1723, dec: 45.998, magnitude: 0.08 },
  { id: 'rigel', name: 'Rigel', ra: 78.6345, dec: -8.2016, magnitude: 0.13 },
  { id: 'procyon', name: 'Procyon', ra: 114.8255, dec: 5.225, magnitude: 0.34 },
  { id: 'achernar', name: 'Achernar', ra: 24.4285, dec: -57.2367, magnitude: 0.46 },
  { id: 'betelgeuse', name: 'Betelgeuse', ra: 88.7929, dec: 7.4071, magnitude: 0.5 },
  { id: 'hadar', name: 'Hadar', ra: 210.9559, dec: -60.373, magnitude: 0.61 },
  { id: 'altair', name: 'Altair', ra: 297.6958, dec: 8.8683, magnitude: 0.77 },
  { id: 'acrux', name: 'Acrux', ra: 186.6499, dec: -63.0992, magnitude: 0.77 },
  { id: 'aldebaran', name: 'Aldebaran', ra: 68.9802, dec: 16.5093, magnitude: 0.85 },
  { id: 'spica', name: 'Spica', ra: 201.2983, dec: -11.1614, magnitude: 0.98 },
  { id: 'antares', name: 'Antares', ra: 247.3519, dec: -26.432, magnitude: 1.09 },
  { id: 'fomalhaut', name: 'Fomalhaut', ra: 344.4127, dec: -29.6222, magnitude: 1.16 },
  { id: 'mimosa', name: 'Mimosa', ra: 191.9303, dec: -59.6888, magnitude: 1.25 },
  { id: 'deneb', name: 'Deneb', ra: 310.358, dec: 45.2803, magnitude: 1.25 },
  { id: 'adhara', name: 'Adhara', ra: 104.6565, dec: -28.9721, magnitude: 1.5 },
  { id: 'shaula', name: 'Shaula', ra: 263.4022, dec: -37.1038, magnitude: 1.62 },
  { id: 'bellatrix', name: 'Bellatrix', ra: 81.2828, dec: 6.3497, magnitude: 1.64 },
  { id: 'elnath', name: 'Elnath', ra: 81.573, dec: 28.6075, magnitude: 1.65 },
  { id: 'alnair', name: 'Alnair', ra: 332.0583, dec: -46.961, magnitude: 1.74 },
  { id: 'regor', name: 'Regor', ra: 122.3825, dec: -47.3367, magnitude: 1.78 },
  { id: 'mirfak', name: 'Mirfak', ra: 51.0807, dec: 49.8612, magnitude: 1.79 },
  { id: 'dubhe', name: 'Dubhe', ra: 165.9319, dec: 61.7511, magnitude: 1.79 },
  { id: 'kaus_australis', name: 'Kaus Australis', ra: 276.043, dec: -34.3846, magnitude: 1.85 },
  { id: 'sargas', name: 'Sargas', ra: 264.3297, dec: -42.9978, magnitude: 1.86 },
  { id: 'avior', name: 'Avior', ra: 125.6285, dec: -59.5095, magnitude: 1.86 },
  { id: 'wezen', name: 'Wezen', ra: 107.0979, dec: -26.3932, magnitude: 1.83 },
  { id: 'atria', name: 'Atria', ra: 252.1662, dec: -69.0277, magnitude: 1.91 },
  { id: 'menkalinan', name: 'Menkalinan', ra: 89.8822, dec: 44.9474, magnitude: 1.9 },
  { id: 'alhena', name: 'Alhena', ra: 99.4279, dec: 16.3993, magnitude: 1.93 },
  { id: 'alphard', name: 'Alphard', ra: 141.8968, dec: -8.6586, magnitude: 1.98 },
  { id: 'peacock', name: 'Peacock', ra: 306.4119, dec: -56.7351, magnitude: 1.94 },
  { id: 'alsephina', name: 'Alsephina', ra: 131.1769, dec: -54.7086, magnitude: 1.96 },
  { id: 'naos', name: 'Naos', ra: 120.8961, dec: -40.0031, magnitude: 2.21 },
  { id: 'kochab', name: 'Kochab', ra: 222.6764, dec: 74.1555, magnitude: 2.08 },
  { id: 'nunki', name: 'Nunki', ra: 283.8164, dec: -26.2967, magnitude: 2.05 },
  { id: 'acamar', name: 'Acamar', ra: 160.7393, dec: -64.3944, magnitude: 2.91 },
  { id: 'enif', name: 'Enif', ra: 326.0465, dec: 9.875, magnitude: 2.39 },
];

/** A Polaris: a estrela polar do hemisfério norte. */
export const POLARIS_STAR: CatalogStar = {
  id: 'polaris',
  name: 'Polaris',
  ra: 37.9545,
  dec: 89.2641,
  magnitude: 1.98,
};

/** A Cruz do Sul: o alvo mais fácil de reconhecer no céu do hemisfério sul. */
export const CRUX_CENTRE = {
  id: 'cross',
  /** O nome é traduzido na interface (não é um nome próprio de estrela). */
  name: 'Cruz do Sul',
  magnitude: 1.25,
};
