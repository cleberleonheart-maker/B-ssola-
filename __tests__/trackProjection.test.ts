import {
  distanceToTrackPath,
  niceScaleBar,
  polylinePath,
  polylineSegments,
  projectTrack,
  type GeoPoint,
} from '../src/utils/trackProjection';

const LISBOA = { lat: 38.7223, lon: -9.1393 };

/** Deslocamento em metros, para gerar fixtures com distâncias conhecidas. */
const offset = (origin: GeoPoint, northM: number, eastM: number): GeoPoint => ({
  lat: origin.lat + northM / 111320,
  lon: origin.lon + eastM / (111320 * Math.cos((origin.lat * Math.PI) / 180)),
});

const box = { width: 280, height: 168, padding: 10 };

/**
 * A caixa exacta da pré-visualização do ecrã de trilhos (`PREVIEW_VIEWPORT` em
 * `TrackView.tsx`). Antes de a projeção passar a ser partilhada, um quadrado de
 * 1 km era desenhado com 571 x 571 px dentro desta caixa de 280 x 168 e
 * transbordava por cima do cartão.
 */
const previewBox = { width: 280, height: 168, padding: 16 };

describe('a caixa real da pré-visualização', () => {
  it('um quadrado de 1 km cabe dentro dos 280 x 168', () => {
    const square = [
      offset(LISBOA, 0, 0),
      offset(LISBOA, 0, 1000),
      offset(LISBOA, 1000, 0),
      offset(LISBOA, 1000, 1000),
    ];
    const p = projectTrack(square, previewBox);
    const xs = p.points.map(q => q.x);
    const ys = p.points.map(q => q.y);

    expect(Math.max(...xs)).toBeLessThanOrEqual(previewBox.width);
    expect(Math.max(...ys)).toBeLessThanOrEqual(previewBox.height);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
  });

  it('um trilho de 10 km também cabe: a escala encolhe, não o desenho', () => {
    const long = [offset(LISBOA, 0, 0), offset(LISBOA, 0, 10000)];
    const p = projectTrack(long, previewBox);

    expect(p.points[1].x).toBeLessThanOrEqual(previewBox.width);
    expect(p.points[1].x).toBeCloseTo(previewBox.width - previewBox.padding, 0);
  });
});

describe('projectTrack — o desenho cabe na caixa', () => {
  it('um quadrado de 1 km sai quadrado, não esticado', () => {
    // A 38.7°N um grau de longitude vale ~0.78 do de latitude. Se a projeção
    // ignorasse o cos(), a caixa de 1 km saía ~27% mais larga que alta.
    const square = [
      offset(LISBOA, 0, 0),
      offset(LISBOA, 0, 1000),
      offset(LISBOA, 1000, 0),
      offset(LISBOA, 1000, 1000),
    ];
    const p = projectTrack(square, box);
    const xs = p.points.map(q => q.x);
    const ys = p.points.map(q => q.y);
    const w = Math.max(...xs) - Math.min(...xs);
    const h = Math.max(...ys) - Math.min(...ys);

    expect(Math.abs(w - h) / h).toBeLessThan(0.02);
  });

  it('nada ultrapassa a margem, seja o trilho quadrado, vertical ou horizontal', () => {
    const shapes: GeoPoint[][] = [
      [offset(LISBOA, 0, 0), offset(LISBOA, 1000, 1000)],
      [offset(LISBOA, 0, 0), offset(LISBOA, 1000, 0)],
      [offset(LISBOA, 0, 0), offset(LISBOA, 0, 1000)],
      [offset(LISBOA, 0, 0), offset(LISBOA, 20, 5), offset(LISBOA, 3000, 12)],
    ];

    for (const shape of shapes) {
      for (const q of projectTrack(shape, box).points) {
        expect(q.x).toBeGreaterThanOrEqual(box.padding - 0.01);
        expect(q.x).toBeLessThanOrEqual(box.width - box.padding + 0.01);
        expect(q.y).toBeGreaterThanOrEqual(box.padding - 0.01);
        expect(q.y).toBeLessThanOrEqual(box.height - box.padding + 0.01);
      }
    }
  });

  it('o trilho fica centrado na caixa', () => {
    const p = projectTrack([offset(LISBOA, 0, 0), offset(LISBOA, 400, 900)], box);
    const xs = p.points.map(q => q.x);
    const ys = p.points.map(q => q.y);
    const midX = (Math.max(...xs) + Math.min(...xs)) / 2;
    const midY = (Math.max(...ys) + Math.min(...ys)) / 2;

    expect(midX).toBeCloseTo(box.width / 2, 6);
    expect(midY).toBeCloseTo(box.height / 2, 6);
  });

  it('o norte fica para cima: subir em latitude desenha mais para cima', () => {
    const p = projectTrack([offset(LISBOA, 0, 0), offset(LISBOA, 500, 0)], box);
    expect(p.points[1].y).toBeLessThan(p.points[0].y);
  });

  it('este fica para a direita: ir para leste desenha mais para a direita', () => {
    const p = projectTrack([offset(LISBOA, 0, 0), offset(LISBOA, 0, 500)], box);
    expect(p.points[1].x).toBeGreaterThan(p.points[0].x);
  });
});

describe('projectTrack — a escala é a mesma nos dois eixos', () => {
  it('a distância no ecrã é a distância real a multiplicar pela escala', () => {
    const a = offset(LISBOA, 0, 0);
    const b = offset(LISBOA, 0, 300);
    const p = projectTrack([a, b], box);
    const onScreen = Math.hypot(p.points[1].x - p.points[0].x, p.points[1].y - p.points[0].y);

    expect(onScreen).toBeCloseTo(300 * p.scale, 1);
  });

  it('a escala é limitada pelo eixo mais apertado, não pela média', () => {
    const wide = projectTrack([offset(LISBOA, 0, 0), offset(LISBOA, 10, 1000)], box);
    expect(wide.scale).toBeCloseTo(
      Math.min(
        (box.width - box.padding * 2) / wide.spanMeters.width,
        (box.height - box.padding * 2) / wide.spanMeters.height,
      ),
      6,
    );
  });
});

describe('projectTrack — o que não tem extensão', () => {
  it('um ponto só não dá escala infinita', () => {
    const p = projectTrack([LISBOA], box);

    expect(Number.isFinite(p.scale)).toBe(true);
    expect(p.scale).toBeGreaterThan(0);
    expect(p.atMinimumSpan).toBe(true);
  });

  it('o ponto solitário fica no meio da caixa', () => {
    const p = projectTrack([LISBOA], box);

    expect(p.points[0].x).toBeCloseTo(box.width / 2, 6);
    expect(p.points[0].y).toBeCloseTo(box.height / 2, 6);
  });

  it('um trilho parado de poucos metros ainda mostra uma janela útil', () => {
    const jitter = [offset(LISBOA, 0, 0), offset(LISBOA, 3, 2), offset(LISBOA, 1, -3)];
    const p = projectTrack(jitter, box);

    expect(p.atMinimumSpan).toBe(true);
    expect(p.spanMeters.width).toBeGreaterThanOrEqual(400);
    expect(p.points.every(q => Number.isFinite(q.x) && Number.isFinite(q.y))).toBe(true);
  });

  it('sem pontos não há projeção, e não uma exceção', () => {
    const p = projectTrack([], box);

    expect(p.points).toEqual([]);
    expect(p.center).toBeNull();
    expect(p.scale).toBe(0);
  });
});

describe('niceScaleBar', () => {
  it('escolhe 1, 2 ou 5 vezes uma potência de dez', () => {
    for (const meters of [0.7, 3, 27, 480, 9300]) {
      const projection = projectTrack(
        [LISBOA, offset(LISBOA, meters * 2, meters * 3)],
        box,
      );
      const bar = niceScaleBar(projection, box.width);
      expect(bar).not.toBeNull();
      const mantissa = bar!.meters / 10 ** Math.floor(Math.log10(bar!.meters));
      expect([1, 2, 5]).toContain(Math.round(mantissa));
    }
  });

  it('a barra cabe na fração pedida da largura', () => {
    const projection = projectTrack([LISBOA, offset(LISBOA, 800, 800)], box);
    const bar = niceScaleBar(projection, box.width)!;

    expect(bar.pixels).toBeLessThanOrEqual(box.width * 0.3 + 0.01);
    expect(bar.pixels).toBeGreaterThan(0);
  });

  it('numa janela de 400 m a barra diz metros, não décimos de metro', () => {
    // Os números reais do `MiniMapView`: caixa de 360, margem 14, janela de
    // 400 m. O erro de multiplicar a escala pela fracção dava "0.2 m" aqui.
    const mapBox = { width: 360, height: 360, padding: 14 };
    const projection = projectTrack([LISBOA], { ...mapBox, center: LISBOA, spanMeters: 400 });
    const bar = niceScaleBar(projection, mapBox.width, 0.25)!;

    expect(bar.meters).toBe(100);
    expect(bar.pixels).toBeCloseTo(100 * projection.scale, 6);
    expect(bar.pixels).toBeLessThanOrEqual(mapBox.width * 0.25 + 0.01);
  });

  it('nunca anuncia menos de um metro', () => {
    const projection = projectTrack([LISBOA], { ...box, center: LISBOA, spanMeters: 2 });

    expect(niceScaleBar(projection, box.width)!.meters).toBe(1);
  });

  it('sem centro não há barra', () => {
    expect(niceScaleBar(projectTrack([], box), box.width)).toBeNull();
  });
});

describe('as duas formas de desenhar o mesmo traço', () => {
  const shape = [offset(LISBOA, 0, 0), offset(LISBOA, 120, 80), offset(LISBOA, 260, 90)];

  it('cada barra fica centrada no segmento e com o comprimento certo', () => {
    const p = projectTrack(shape, box);
    const segments = polylineSegments(p.points);

    expect(segments).toHaveLength(p.points.length - 1);
    segments.forEach((seg, i) => {
      const a = p.points[i];
      const b = p.points[i + 1];
      expect(seg.w).toBeCloseTo(Math.hypot(b.x - a.x, b.y - a.y), 6);
      expect(seg.x + seg.w / 2).toBeCloseTo((a.x + b.x) / 2, 6);
      expect(seg.y).toBeCloseTo((a.y + b.y) / 2 - 1, 6);
    });
  });

  it('o ângulo vai de menos 180 a 180 graus, para o rotate não dar a volta', () => {
    const p = projectTrack(shape, box);

    for (const seg of polylineSegments(p.points)) {
      expect(seg.a).toBeGreaterThanOrEqual(-180);
      expect(seg.a).toBeLessThanOrEqual(180);
    }
  });

  it('pontos coincidentes não enchem a tela de barras de largura zero', () => {
    const doubled = projectTrack([LISBOA, LISBOA, LISBOA], box);

    expect(polylineSegments(doubled.points)).toEqual([]);
  });

  it('o caminho SVG tem um M e um L por ponto', () => {
    const p = projectTrack(shape, box);
    const path = polylinePath(p.points);

    expect(path.startsWith('M ')).toBe(true);
    expect(path.match(/[ML] /g)).toHaveLength(p.points.length);
    expect(polylinePath([])).toBe('');
  });
});

describe('a vista que segue a pessoa', () => {
  const followed = { ...box, center: LISBOA, spanMeters: 300 };

  it('a posição no centro fica mesmo no meio da caixa', () => {
    const p = projectTrack([LISBOA], followed);

    expect(p.points[0].x).toBeCloseTo(box.width / 2, 6);
    expect(p.points[0].y).toBeCloseTo(box.height / 2, 6);
  });

  it('a escala é a da janela pedida, não a do trilho', () => {
    const p = projectTrack([LISBOA, offset(LISBOA, 50, 50)], followed);

    expect(p.scale).toBeCloseTo(Math.min(260 / 300, 148 / 300), 6);
    expect(p.spanMeters.width).toBe(300);
  });

  it('quem anda 300 m sai da caixa, e é o esperado: a janela é a pedida', () => {
    const p = projectTrack([LISBOA, offset(LISBOA, 300, 0)], followed);

    expect(p.points[1].y).toBeLessThan(box.padding);
  });

  it('a janela segue o centro pedido, não o meio do trilho', () => {
    const walk = [offset(LISBOA, 0, 0), offset(LISBOA, 100, 0)];
    const p = projectTrack(walk, { ...followed, center: walk[1] });

    expect(p.points[1].x).toBeCloseTo(box.width / 2, 6);
    expect(p.points[1].y).toBeCloseTo(box.height / 2, 6);
  });

  it('com centro pedido, a janela não é alargada pelo mínimo', () => {
    expect(projectTrack([LISBOA], followed).atMinimumSpan).toBe(false);
  });

  it('sem spanMeters dá a janela mínima em vez de uma escala infinita', () => {
    const p = projectTrack([LISBOA], { ...box, center: LISBOA });

    expect(Number.isFinite(p.scale)).toBe(true);
    expect(p.scale).toBeGreaterThan(0);
  });
});

describe('determinismo', () => {
  it('a mesma entrada dá sempre a mesma saída', () => {
    const shape = [offset(LISBOA, 0, 0), offset(LISBOA, 300, 120)];

    expect(projectTrack(shape, box)).toEqual(projectTrack(shape, box));
  });
});

describe('distanceToTrackPath', () => {
  const trail = [
    offset(LISBOA, 0, 0),
    offset(LISBOA, 0, 100),
    offset(LISBOA, 100, 100),
  ];

  it('devolve null sem pontos', () => {
    expect(distanceToTrackPath(LISBOA.lat, LISBOA.lon, [])).toBeNull();
  });

  it('quem está sobre o traço fica a ~0 m', () => {
    const hint = distanceToTrackPath(trail[1].lat, trail[1].lon, trail);
    expect(hint?.meters).toBeLessThan(0.5);
  });

  it('mede a distância ao segmento, não só aos vértices', () => {
    // Traçado a 20 m de lado (meio do segmento horizontal de 40 m).
    const beside = offset(trail[1], 20, 20);
    const hint = distanceToTrackPath(beside.lat, beside.lon, trail);
    expect(hint!.meters).toBeCloseTo(20, 0);
  });

  it('devolve o rumo de volta ao ponto mais próximo', () => {
    const atStart = trail[0];
    const hint = distanceToTrackPath(
      offset(atStart, -50, 0).lat,
      offset(atStart, -50, 0).lon,
      trail,
    );
    // o mais próximo é o início, que está a norte: voltar significa rumo norte (~0°)
    expect(hint!.meters).toBeCloseTo(50, 0);
    expect(hint!.bearing).toBeLessThan(15);
  });

  it('com um só ponto, a distância é ao vértice', () => {
    const hint = distanceToTrackPath(
      offset(trail[0], -30, 0).lat,
      offset(trail[0], -30, 0).lon,
      [trail[0]],
    );
    expect(hint!.meters).toBeCloseTo(30, 0);
  });
});