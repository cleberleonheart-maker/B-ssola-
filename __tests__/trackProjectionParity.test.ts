import fs from 'fs';
import path from 'path';
import vm from 'vm';

import {
  niceScaleBar,
  polylinePath,
  projectTrack,
  type GeoPoint,
  type Viewport,
} from '../src/utils/trackProjection';

/**
 * A geometria do mapa está escrita duas vezes: em TypeScript para o app
 * (`src/utils/trackProjection.ts`) e em ES5 dentro de `web/live.html`, para a
 * página de rastreio não precisar de build nem de dependências.
 *
 * Duas cópias divergem em silêncio: o app passa os testes, a página continua a
 * desenhar qualquer coisa, e ninguém sabe qual das duas está certa. Este
 * ficheiro corre as duas no mesmo fixture e compara os números.
 *
 * O que fica de fora de propósito: a formatação das distâncias. O app diz
 * "1.23 km" (`formatDistance` em `utils/geo.ts`, usada em vários ecrãs) e a
 * página diz "1.2 km" (`fmtDistance` no `live.html`). Mexer numa delas para
 * combinar com a outra mudaria o texto de sítios que nada têm a ver com o mapa;
 * aqui o que se compara é a matemática, que é o que faz o desenho bater certo.
 */

const html = fs.readFileSync(path.join(__dirname, '..', 'web', 'live.html'), 'utf8');
const script = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));

/** A cópia ES5 começa no comentário da geometria e acaba em `function $(id)`. */
const BLOCK_START = '// Geometria do mini mapa';
const BLOCK_END = 'function $(id)';

type Geometry = {
  projectTrack: (points: GeoPoint[], viewport: Viewport) => ReturnType<typeof projectTrack>;
  niceScaleBar: typeof niceScaleBar;
  polylinePath: typeof polylinePath;
};

const readWebGeometry = (): Geometry => {
  const from = script.indexOf(BLOCK_START);
  const to = script.indexOf(BLOCK_END);
  expect(from).toBeGreaterThan(-1);
  expect(to).toBeGreaterThan(from);

  const block = script.slice(from, to);
  const sandbox: Record<string, unknown> = { Math };
  vm.createContext(sandbox);
  vm.runInContext(
    `${block}
     __geometry = { projectTrack: projectTrack, niceScaleBar: niceScaleBar, polylinePath: polylinePath };`,
    sandbox,
  );

  const geometry = sandbox.__geometry as Geometry;
  expect(typeof geometry.projectTrack).toBe('function');
  expect(typeof geometry.niceScaleBar).toBe('function');
  expect(typeof geometry.polylinePath).toBe('function');
  return geometry;
};

const web = readWebGeometry();

const LISBOA: GeoPoint = { lat: 38.7223, lon: -9.1393 };
const TROPEIRO: GeoPoint = { lat: 78.2232, lon: 15.6469 };

/** Deslocamento em metros, para fixtures com distâncias conhecidas. */
const offset = (origin: GeoPoint, northM: number, eastM: number): GeoPoint => ({
  lat: origin.lat + northM / 111320,
  lon: origin.lon + eastM / (111320 * Math.cos((origin.lat * Math.PI) / 180)),
});

const WALK = [
  LISBOA,
  offset(LISBOA, 40, 15),
  offset(LISBOA, 90, -20),
  offset(LISBOA, 140, 30),
];

const FIXTURES: { nome: string; points: GeoPoint[]; viewport: Viewport }[] = [
  {
    nome: 'a caixa real da pré-visualização de trilhos',
    points: WALK,
    viewport: { width: 280, height: 168, padding: 16 },
  },
  {
    nome: 'a caixa do mini mapa do app, com zoom',
    points: WALK,
    viewport: { width: 352, height: 352, padding: 14, center: WALK[3], spanMeters: 400 },
  },
  {
    nome: 'a janela de 300 m da página de rastreio',
    points: WALK,
    viewport: { width: 300, height: 300, padding: 16, center: WALK[3], spanMeters: 300 },
  },
  {
    nome: 'sem margem pedida, para apanhar o valor por omissão',
    points: WALK,
    viewport: { width: 300, height: 300 },
  },
  {
    nome: 'um ponto só, sem centro',
    points: [LISBOA],
    viewport: { width: 300, height: 300, padding: 16 },
  },
  {
    nome: 'uma janela sem `spanMeters`, que cai no mínimo',
    points: [LISBOA],
    viewport: { width: 300, height: 300, padding: 16, center: LISBOA },
  },
  {
    nome: 'perto do polo, onde o cos(latitude) encolhe a longitude',
    points: [TROPEIRO, offset(TROPEIRO, 300, 120), offset(TROPEIRO, -50, 400)],
    viewport: { width: 300, height: 300, padding: 16, center: TROPEIRO, spanMeters: 600 },
  },
  {
    nome: 'uma caixa mais larga que alta, onde o eixo apertado manda',
    points: [offset(LISBOA, 0, 0), offset(LISBOA, 10, 1000)],
    viewport: { width: 300, height: 120, padding: 16 },
  },
  {
    nome: 'pontos coincidentes, que não dão extensão',
    points: [LISBOA, LISBOA, LISBOA],
    viewport: { width: 300, height: 300, padding: 16 },
  },
];

describe('projectTrack — a cópia do live.html dá os mesmos números', () => {
  it.each(FIXTURES)('$nome', ({ points, viewport }) => {
    const app = projectTrack(points, viewport);
    const page = web.projectTrack(points, viewport);

    expect(page.points.length).toBe(app.points.length);
    app.points.forEach((q, i) => {
      expect(page.points[i].x).toBeCloseTo(q.x, 9);
      expect(page.points[i].y).toBeCloseTo(q.y, 9);
    });
    expect(page.scale).toBeCloseTo(app.scale, 9);
    expect(page.atMinimumSpan).toBe(app.atMinimumSpan);
    expect(page.spanMeters.width).toBeCloseTo(app.spanMeters.width, 9);
    expect(page.spanMeters.height).toBeCloseTo(app.spanMeters.height, 9);

    if (app.center === null) {
      expect(page.center).toBeNull();
    } else {
      expect(page.center!.lat).toBeCloseTo(app.center.lat, 9);
      expect(page.center!.lon).toBeCloseTo(app.center.lon, 9);
    }
  });

  it('sem pontos as duas dão o mesmo vazio', () => {
    const page = web.projectTrack([], { width: 300, height: 300 });

    expect(page.points).toEqual([]);
    expect(page.center).toBeNull();
    expect(page.scale).toBe(0);
  });
});

describe('niceScaleBar — a barra de escala é a mesma nos dois lados', () => {
  const CASES: { nome: string; viewport: Viewport; width: number; fraction?: number }[] = [
    {
      nome: 'a janela de 300 m da página',
      viewport: { width: 300, height: 300, padding: 16, center: LISBOA, spanMeters: 300 },
      width: 300,
      fraction: 0.25,
    },
    {
      nome: 'a janela mais fechada do app, onde a barra desce a decimos',
      viewport: { width: 352, height: 352, padding: 14, center: LISBOA, spanMeters: 50 },
      width: 352,
      fraction: 0.25,
    },
    { nome: 'a pré-visualização, com a fracção por omissão', viewport: { width: 280, height: 168, padding: 16 }, width: 280 },
    {
      nome: 'uma janela estreita demais, que tem de dizer pelo menos um metro',
      viewport: { width: 300, height: 300, padding: 16, center: LISBOA, spanMeters: 2 },
      width: 300,
    },
    {
      nome: 'uma janela enorme, onde a barra sobe a quilómetros',
      viewport: { width: 300, height: 300, padding: 16, center: LISBOA, spanMeters: 20000 },
      width: 300,
    },
  ];

  it.each(CASES)('$nome', ({ viewport, width, fraction }) => {
    const app = niceScaleBar(projectTrack(WALK, viewport), width, fraction ?? 0.3);
    const page = web.niceScaleBar(web.projectTrack(WALK, viewport), width, fraction ?? 0.3);

    expect(page).not.toBeNull();
    expect(app).not.toBeNull();
    expect(page!.meters).toBe(app!.meters);
    expect(page!.pixels).toBeCloseTo(app!.pixels, 9);
  });

  it('sem projeção não há barra, nos dois lados', () => {
    const viewport: Viewport = { width: 300, height: 300 };
    expect(niceScaleBar(projectTrack([], viewport), 300)).toBeNull();
    expect(web.niceScaleBar(web.projectTrack([], viewport), 300)).toBeNull();
  });
});

describe('polylinePath — o caminho SVG é a mesma string', () => {
  it.each(FIXTURES)('$nome', ({ points, viewport }) => {
    const app = polylinePath(projectTrack(points, viewport).points);
    const page = web.polylinePath(web.projectTrack(points, viewport).points);

    expect(page).toBe(app);
  });

  it('sem pontos dá string vazia, e não "M undefined"', () => {
    expect(polylinePath([])).toBe('');
    expect(web.polylinePath([])).toBe('');
  });
});