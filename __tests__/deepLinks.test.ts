import { parseModeUrl } from '../src/utils/deepLinks';

describe('os atilhos de modo', () => {
  it('tira o modo do url do tile', () => {
    expect(parseModeUrl('bussola://mode/compass')).toBe('compass');
    expect(parseModeUrl('bussola://mode/sun')).toBe('sun');
    expect(parseModeUrl('bussola://mode/tri')).toBe('tri');
  });

  it('aceita maiúsculas e espaços', () => {
    expect(parseModeUrl('bussola://mode/Track')).toBe('track');
    expect(parseModeUrl('  bussola://mode/metal  ')).toBe('metal');
  });

  it('ignora o que não é atalho de modo', () => {
    expect(parseModeUrl('bussola://sos')).toBeNull();
    expect(parseModeUrl('https://exemplo.pt')).toBeNull();
    expect(parseModeUrl('')).toBeNull();
    expect(parseModeUrl(null)).toBeNull();
    expect(parseModeUrl(undefined)).toBeNull();
  });

  it('ignora um modo que não existe', () => {
    expect(parseModeUrl('bussola://mode/inventado')).toBeNull();
    expect(parseModeUrl('bussola://mode/')).toBeNull();
  });
});
