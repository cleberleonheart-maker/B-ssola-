import { angleDiff, intersectRays } from '../src/utils/triangulate';

describe('intersectRays — o cruzamento de dois raios', () => {
  it('devolve o ponto onde os raios se cruzam', () => {
    // Um raio a nordeste a partir de (0, 0) e outro a noroeste a partir de
    // (0.001, 0): cruzam-se a nordeste, em (0.0005, 0.0005).
    const res = intersectRays(
      { point: { lat: 0, lon: 0 }, bearing: 45 },
      { point: { lat: 0.001, lon: 0 }, bearing: 135 },
    );
    expect(res).not.toBeNull();
    expect(res!.lat).toBeCloseTo(0.0005, 4);
    expect(res!.lon).toBeCloseTo(0.0005, 4);
  });

  it('não devolve nada quando os raios são paralelos', () => {
    const res = intersectRays(
      { point: { lat: 0, lon: 0 }, bearing: 45 },
      { point: { lat: 0.01, lon: 0.01 }, bearing: 45 },
    );
    expect(res).toBeNull();
  });

  it('não devolve nada quando os dois raios partem do mesmo ponto', () => {
    expect(
      intersectRays(
        { point: { lat: 0, lon: 0 }, bearing: 10 },
        { point: { lat: 0, lon: 0 }, bearing: 200 },
      ),
    ).toBeNull();
  });

  /**
   * A ressecção: quem mira um marco vê o marco no rumo α, o que quer dizer que
   * está no raio que sai do marco com o rumo α+180. Cruzando os dois raios
   * invertidos volta-se à posição de quem mirou — é esta propriedade que
   * sustenta a "triangulação por marcadores".
   */
  it('os raios invertidos a partir de dois marcos devolvem a posição de quem mirou', () => {
    const observer = { lat: 41.1579, lon: -8.6291 };
    const markerA = { lat: 41.16, lon: -8.63 };
    const markerB = { lat: 41.155, lon: -8.62 };

    const bearingTo = (from: { lat: number; lon: number }, to: { lat: number; lon: number }) => {
      const y = Math.sin(((to.lon - from.lon) * Math.PI) / 180) * Math.cos((to.lat * Math.PI) / 180);
      const x =
        Math.cos((from.lat * Math.PI) / 180) * Math.sin((to.lat * Math.PI) / 180) -
        Math.sin((from.lat * Math.PI) / 180) * Math.cos((to.lat * Math.PI) / 180) * Math.cos(((to.lon - from.lon) * Math.PI) / 180);
      return (Math.atan2(y, x) * 180) / Math.PI;
    };

    const res = intersectRays(
      {
        point: markerA,
        bearing: (bearingTo(observer, markerA) + 180) % 360,
      },
      {
        point: markerB,
        bearing: (bearingTo(observer, markerB) + 180) % 360,
      },
    );

    expect(res).not.toBeNull();
    expect(res!.lat).toBeCloseTo(observer.lat, 3);
    expect(res!.lon).toBeCloseTo(observer.lon, 3);
  });
});

describe('angleDiff — o desvio entre dois rumos', () => {
  it('é zero quando os rumos são iguais', () => {
    expect(angleDiff(120, 120)).toBe(0);
  });

  it('é a diferença mais curta, sem dar a volta ao quadrante', () => {
    expect(angleDiff(350, 10)).toBe(20);
    expect(angleDiff(10, 350)).toBe(20);
  });

  it('nunca passa de 180', () => {
    expect(angleDiff(0, 180)).toBe(180);
    expect(angleDiff(0, 181)).toBe(179);
  });
});
