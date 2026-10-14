import {
  formatDistance,
  formatAltitude,
  formatSpeed,
  formatAccuracy,
  altitudeValue,
  altitudeUnit,
  setUnitSystem,
  getUnitSystem,
} from '../src/utils/units';
import { formatDistance as geoFormatDistance } from '../src/utils/geo';

afterEach(() => setUnitSystem('metric'));

describe('formatDistance — métrico (comportamento preservado)', () => {
  it('metros com casa decimal abaixo de 100', () => {
    expect(formatDistance(0.5)).toBe('0.5 m');
    expect(formatDistance(12)).toBe('12.0 m');
  });
  it('metros inteiros até 1000', () => {
    expect(formatDistance(150)).toBe('150 m');
  });
  it('km com duas casas a partir de 1000', () => {
    expect(formatDistance(1500)).toBe('1.50 km');
  });
  it('o reexport de geo é o mesmo formatador', () => {
    expect(geoFormatDistance(1500)).toBe('1.50 km');
  });
});

describe('formatDistance — imperial', () => {
  it('pés abaixo de 0,1 mi', () => {
    expect(formatDistance(100, 'imperial')).toBe('328 ft');
    expect(formatDistance(30.48, 'imperial')).toBe('100 ft');
  });
  it('milhas a partir de 0,1 mi', () => {
    expect(formatDistance(2000, 'imperial')).toBe('1.24 mi');
  });
});

describe('formatAltitude / altitudeValue / altitudeUnit', () => {
  it('métrico arredonda para metro inteiro', () => {
    expect(formatAltitude(123.4)).toBe('123 m');
    expect(formatAltitude(-5)).toBe('-5 m');
  });
  it('imperial converte para pés', () => {
    expect(formatAltitude(100, 'imperial')).toBe('328 ft');
  });
  it('partes separadas para o layout com unidade estilizada', () => {
    expect(altitudeValue(123.4, 'metric')).toBe('123');
    expect(altitudeUnit('metric')).toBe('m');
    expect(altitudeValue(100, 'imperial')).toBe('328');
    expect(altitudeUnit('imperial')).toBe('ft');
  });
});

describe('formatSpeed', () => {
  it('métrico em km/h', () => {
    expect(formatSpeed(10)).toBe('36.0 km/h');
  });
  it('imperial em mph', () => {
    expect(formatSpeed(10, 'imperial')).toBe('22.4 mph');
  });
});

describe('formatAccuracy', () => {
  it('métrico mantém o inteiro', () => {
    expect(formatAccuracy(12)).toBe('12 m');
  });
  it('imperial converte para pés', () => {
    expect(formatAccuracy(12, 'imperial')).toBe('39 ft');
  });
});

describe('estado global do sistema de unidades', () => {
  it('arranca em métrico', () => {
    setUnitSystem('metric');
    expect(getUnitSystem()).toBe('metric');
  });
  it('muda o padrão dos formatadores sem segundo argumento', () => {
    setUnitSystem('imperial');
    expect(getUnitSystem()).toBe('imperial');
    expect(formatDistance(100)).toBe('328 ft');
    expect(formatAltitude(100)).toBe('328 ft');
    expect(formatSpeed(10)).toBe('22.4 mph');
  });
  it('volta ao métrico', () => {
    setUnitSystem('imperial');
    setUnitSystem('metric');
    expect(formatDistance(150)).toBe('150 m');
  });
});
