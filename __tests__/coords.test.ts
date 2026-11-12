import {
  formatUTM,
  googleMapsUrl,
  toDMS,
  toUTM,
  wazeUrl,
} from '../src/utils/coords';

/**
 * As coordenadas em vários formatos (ideia #26).
 *
 * O que se prova aqui é o que o utilizador lê no ecrã e copia para o mapa: o
 * DMS tem de dizer o hemisfério certo e arredondar sem inventar um minuto a
 * mais, e o UTM tem de dar a zona e a letra que o mapa espera — uma letra
 * errada põe o ponto na zona ao lado, e quem está no campo não vê o erro.
 */

describe('DMS', () => {
  it('separa graus, minutos e segundos', () => {
    expect(toDMS(23.5505, true)).toBe('23°33\'1.8" N');
  });

  it('o hemisfério segue o sinal e o eixo', () => {
    expect(toDMS(23.5505, true)).toContain('N');
    expect(toDMS(-23.5505, true)).toContain('S');
    expect(toDMS(46.6333, false)).toContain('E');
    expect(toDMS(-46.6333, false)).toContain('W');
  });

  it('o zero é de norte e não de oeste', () => {
    expect(toDMS(0, true)).toBe('0°00\'0" N');
    expect(toDMS(0, false)).toBe('0°00\'0" E');
  });

  it('os minutos e as segundos ficam com dois algarismos', () => {
    expect(toDMS(10.5, true)).toBe('10°30\'0" N');
  });

  it('um segundo que arredonda a 60 vira minuto, e um minuto a 60 vira grau', () => {
    // 10°59'59.99" arredonda para 11°00'00": o caminho normal de escrever
    // "59'60.0\"" põe o ponto no minuto seguinte do que a app mostra.
    expect(toDMS(10.99999861111, true)).toBe('11°00\'0" N');
  });
});

describe('UTM', () => {
  it('São Paulo está na zona 23K', () => {
    const utm = toUTM(-23.5505, -46.6333);
    expect(utm).not.toBeNull();
    expect(utm?.zone).toBe(23);
    expect(utm?.letter).toBe('K');
  });

  it('a easting de 500000 m é a do meridiano central da zona', () => {
    // Em (0, 3) — o meridiano central da zona 31 — a easting são 500000 m e a
    // northing 0. Em (0, 0) a easting é menor, porque o ponto está a oeste do
    // meridiano.
    const utm = toUTM(0, 3);
    expect(utm?.easting).toBe(500000);
    expect(utm?.northing).toBe(0);
    expect(toUTM(0, 0)?.easting).toBeLessThan(500000);
  });

  it('as coordenadas batem com o sitio', () => {
    const utm = toUTM(-23.5505, -46.6333);
    // São Paulo: 23K 333288 E, 7 394588 N. A northing do hemisfério sul
    // tem a falsa origem de 10 000 km — sem ela, saía negativa e o mapa
    // apontava para o outro lado do mundo.
    expect(utm?.easting).toBe(333287.92);
    expect(utm?.northing).toBe(7394588.32);
  });

  it('no hemisfério norte a northing é a distância ao equador', () => {
    // Lisboa: 29S 487891 E, 4 285970 N.
    const utm = toUTM(38.7223, -9.1393);
    expect(utm?.letter).toBe('S');
    expect(utm?.easting).toBe(487890.76);
    expect(utm?.northing).toBe(4285969.86);
  });

  it('fora da faixa da projecção nao ha coordenadas UTM', () => {
    // Acima de 84°N e abaixo de 80°S a projecção não vale.
    expect(toUTM(85, 0)).toBeNull();
    expect(toUTM(-81, 0)).toBeNull();
  });

  it('a zona muda de seis em seis graus de longitude', () => {
    expect(toUTM(0, -177)?.zone).toBe(1);
    expect(toUTM(0, -174)?.zone).toBe(2);
    expect(toUTM(0, 0)?.zone).toBe(31);
    expect(toUTM(0, 174)?.zone).toBe(60);
  });

  it('o formato para o ecrã mostra zona, letra e as duas coordenadas', () => {
    const utm = toUTM(-23.5505, -46.6333);
    if (!utm) throw new Error('UTM unexpectedly null');
    expect(formatUTM(utm)).toBe(`23K ${Math.round(utm.easting)} ${Math.round(utm.northing)}`);
  });
});

describe('os links para o mapa', () => {
  it('o Google Maps leva as coordenadas com seis casas', () => {
    expect(googleMapsUrl(-23.5505, -46.6333)).toBe(
      'https://www.google.com/maps/search/?api=1&query=-23.550500,-46.633300',
    );
  });

  it('o Waze leva as coordenadas e pede navegacao', () => {
    const url = wazeUrl(-23.5505, -46.6333);
    expect(url).toContain('ll=-23.550500,-46.633300');
    expect(url).toContain('navigate=yes');
  });

  it('nenhum dos links deixa o utilizador semsaidinha do sitio', () => {
    expect(googleMapsUrl(-23.5505, -46.6333)).toContain('-23.550500');
    expect(wazeUrl(-23.5505, -46.6333)).toContain('-46.633300');
  });
});
