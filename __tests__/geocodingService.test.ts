import { reverseGeocode } from '../src/services/geocodingService';

/**
 * O endereço a partir da posição (usado no painel de localização).
 *
 * O serviço é do OpenStreetMap e não é do app: quando a rede falha, quando a
 * resposta é um 500 ou quando o endereço não tem nome nenhum, o que a app
 * tem de fazer é continuar a funcionar sem o endereço. O timer de 8 s que
 * corta a tentativa também tem de ser cancelado em qualquer caminho — um
 * timeout que fica vivo depois da resposta é um timer a mais em cada
 * consulta.
 */

const ok = (body: unknown) =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve(body),
  });

describe('o endereço a partir da posição', () => {
  beforeEach(() => {
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('traz a rua e o codigo postal', async () => {
    (global.fetch as jest.Mock).mockReturnValue(
      ok({ address: { road: 'Rua das Flores', postcode: '1100-001' } }),
    );

    expect(await reverseGeocode(-23.55, -46.63)).toEqual({
      name: 'Rua das Flores',
      cep: '1100-001',
    });
  });

  it('aceita os nomes de lugar que o OpenStreetMap usa', async () => {
    (global.fetch as jest.Mock).mockReturnValue(ok({ address: { city: 'Lisboa' } }));

    expect(await reverseGeocode(38.72, -9.14)).toEqual({
      name: 'Lisboa',
      cep: null,
    });
  });

  it('sem nome nao ha endereco', async () => {
    (global.fetch as jest.Mock).mockReturnValue(ok({ address: {} }));

    expect(await reverseGeocode(0, 0)).toBeNull();
  });

  it('uma resposta de erro nao estraga o app', async () => {
    (global.fetch as jest.Mock).mockReturnValue(
      Promise.resolve({ ok: false, json: () => Promise.resolve({}) }),
    );

    expect(await reverseGeocode(-23.55, -46.63)).toBeNull();
  });

  it('a rede a falhar nao estraga o app', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('sem rede'));

    expect(await reverseGeocode(-23.55, -46.63)).toBeNull();
  });

  it('o idioma vai no pedido', async () => {
    (global.fetch as jest.Mock).mockReturnValue(ok({ address: { city: 'Porto' } }));

    await reverseGeocode(41.15, -8.61, 'es');

    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('accept-language=es');
    expect(url).toContain('lat=41.15');
    expect(url).toContain('lon=-8.61');
  });

  it('o timeout e cancelado mesmo quando a resposta falha', async () => {
    // O `clearTimeout` fora do `try` deixava o timer vivo quando a fetch
    // rebentava: uma consulta de cada vez, cada uma com um timer de 8 s a
    // mais, à espera de rebentar.
    const clear = jest.spyOn(global, 'clearTimeout');
    (global.fetch as jest.Mock).mockRejectedValue(new Error('sem rede'));

    await reverseGeocode(-23.55, -46.63);

    expect(clear).toHaveBeenCalled();
  });
});
