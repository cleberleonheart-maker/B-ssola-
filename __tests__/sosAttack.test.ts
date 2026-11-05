import {
  buildSosMessage,
  sosCountdownTick,
  SOS_COUNTDOWN_SECONDS,
  SOS_MESSAGE_TITLE,
} from '../src/utils/sos';
import { buildBeaconMessage } from '../src/utils/beacon';

/**
 * O modo de assalto (ideia #107).
 *
 * O que se prova aqui é o que não se pode ver no ecrã: que a contagem não
 * dispara o aviso antes do tempo (e nunca fica presa), que a mensagem leva
 * o link do rastreio — que é a diferença entre "a pessoa estava aqui" e "a
 * pessoa está aqui" — e que o texto do beacon não mudou para quem já o
 * usava.
 */

const FIX = {
  latitude: 38.7223,
  longitude: -9.1393,
  accuracy: 12,
  altitude: 40,
  battery: 63,
  network: 'MEO',
  time: new Date(Date.UTC(2026, 10, 5, 22, 15, 0)),
};

describe('a contagem do modo de assalto', () => {
  it('conta a partir de cinco segundos', () => {
    expect(SOS_COUNTDOWN_SECONDS).toBe(5);
  });

  it('desce um de cada vez', () => {
    expect(sosCountdownTick(5)).toBe(4);
    expect(sosCountdownTick(4)).toBe(3);
    expect(sosCountdownTick(1)).toBe(0);
  });

  it('nunca passa do zero', () => {
    expect(sosCountdownTick(0)).toBe(0);
    expect(sosCountdownTick(-1)).toBe(0);
  });

  it('sem contagem continua sem contagem', () => {
    expect(sosCountdownTick(null)).toBeNull();
  });
});

describe('a mensagem do modo de assalto', () => {
  it('tem o cabeçalho do modo de assalto', () => {
    const msg = buildSosMessage(FIX);

    expect(msg.startsWith(SOS_MESSAGE_TITLE)).toBe(true);
    expect(msg).toContain('Lat:38.722300 Lon:-9.139300');
    expect(msg).toContain('Bateria:63%');
  });

  it('leva o link do rastreio, para ver o movimento e não só o ponto', () => {
    const msg = buildSosMessage({
      ...FIX,
      liveLink: 'https://exemplo/live.html#tkn=abc123',
    });

    expect(msg).toContain('Rastreio ao vivo: https://exemplo/live.html#tkn=abc123');
  });

  it('sem link não inventa nenhum', () => {
    const msg = buildSosMessage(FIX);

    expect(msg).not.toContain('Rastreio ao vivo');
  });

  it('o mapa continua a estar lá', () => {
    const msg = buildSosMessage(FIX);

    expect(msg).toContain('https://maps.google.com/?q=38.7223,-9.1393');
  });

  it('o texto do beacon não mudou para quem o usava', () => {
    // O beacon é o mesmo aviso de sempre: se a mensagem dele mudasse, quem
    // dependia do formato perdia o costume sem dar por isso.
    const beacon = buildBeaconMessage(FIX);

    expect(beacon.startsWith('SOS BEACON Bussola')).toBe(true);
    expect(beacon).not.toContain('Rastreio ao vivo');
  });
});
