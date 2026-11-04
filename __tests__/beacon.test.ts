import {
  buildBeaconMessage,
  hasCountryCode,
  isBeaconDue,
  isValidPhone,
  normalizePhone,
  phoneForWhatsApp,
} from '../src/utils/beacon';

describe('número de telefone', () => {
  it('normaliza para dígitos, com o + se o tiver', () => {
    expect(normalizePhone('+55 (21) 99999-0000')).toBe('+5521999990000');
    expect(normalizePhone(' 21 99999 0000 ')).toBe('21999990000');
  });

  it('diz se o número tem código de país', () => {
    expect(hasCountryCode('+5521999990000')).toBe(true);
    expect(hasCountryCode('005521999990000')).toBe(true);
    expect(hasCountryCode('21999990000')).toBe(false);
  });

  it('o WhatsApp quer só dígitos, sem o + nem o 00', () => {
    expect(phoneForWhatsApp('+55 21 99999-0000')).toBe('5521999990000');
    expect(phoneForWhatsApp('005521999990000')).toBe('5521999990000');
    expect(phoneForWhatsApp('21999990000')).toBe('21999990000');
  });

  it('aceita números plausíveis e recusa os impossíveis', () => {
    expect(isValidPhone('+5521999990000')).toBe(true);
    expect(isValidPhone('12345')).toBe(false);
    expect(isValidPhone('1234567890123456')).toBe(false);
  });
});

describe('quando é que o beacon está na hora', () => {
  it('sem envio registado, vence logo', () => {
    expect(isBeaconDue(null, 30, 1000)).toBe(true);
  });

  it('espera o intervalo combinado', () => {
    expect(isBeaconDue(0, 30, 29 * 60_000)).toBe(false);
    expect(isBeaconDue(0, 30, 30 * 60_000)).toBe(true);
  });

  it('um relógio que recua não dispara o beacon', () => {
    expect(isBeaconDue(10_000, 30, 5_000)).toBe(false);
  });
});

describe('texto do beacon', () => {
  it('leva as coordenadas, a bateria e a rede', () => {
    const msg = buildBeaconMessage({
      latitude: 38.7223,
      longitude: -9.1393,
      accuracy: 12,
      altitude: 100,
      battery: 73,
      network: 'MEO',
      time: new Date('2026-01-02T03:04:05.000Z'),
    });
    expect(msg).toContain('38.722300');
    expect(msg).toContain('-9.139300');
    expect(msg).toContain('Bateria:73%');
    expect(msg).toContain('Rede:MEO');
    expect(msg).toContain('maps.google.com');
  });

  it('sem fix, o mapa não é inventado', () => {
    const msg = buildBeaconMessage({ battery: 50 });
    expect(msg).not.toContain('maps.google.com');
    expect(msg).toContain('Lat:?');
  });
});
