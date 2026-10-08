import type { LiveShareHistoryRow } from '../src/services/cloud';
import {
  shareDurationLabel,
  shareDurationMs,
  shareEndMs,
  shareState,
  shareWhenLabel,
} from '../src/utils/shareHistory';

const ISO = (minutos: number, base = Date.UTC(2026, 9, 14, 0, 0, 0)) =>
  new Date(base + minutos * 60000).toISOString();

const linha = (sobre: Partial<LiveShareHistoryRow> = {}): LiveShareHistoryRow => ({
  token: 'lnv1',
  started_at: ISO(0),
  stopped_at: null,
  expires_at: ISO(30),
  updated_at: ISO(5),
  ...sobre,
});

const AGORA = Date.parse(ISO(10));

describe('shareState', () => {
  it('sessão parada é parada, mesmo com o prazo já vencido', () => {
    // A decisão da pessoa vence sobre o relógio: dizer "expirou" seria mentir
    // sobre o que ela fez.
    const r = linha({ stopped_at: ISO(10), expires_at: ISO(30) });
    expect(shareState(r, Date.parse(ISO(45)))).toBe('stopped');
  });

  it('sessão a decorrer é running enquanto o prazo estiver no futuro', () => {
    expect(shareState(linha(), AGORA)).toBe('running');
  });

  it('sessão sem stopped_at com o prazo vencido é expired', () => {
    expect(shareState(linha(), Date.parse(ISO(31)))).toBe('expired');
  });

  it('prazo igual ao agora já conta como expirada', () => {
    expect(shareState(linha(), Date.parse(ISO(30)))).toBe('expired');
  });
});

describe('shareEndMs / shareDurationMs', () => {
  it('o fim é o stopped_at quando existe', () => {
    const r = linha({ stopped_at: ISO(12) });
    expect(shareEndMs(r, AGORA)).toBe(Date.parse(ISO(12)));
  });

  it('sessão que acabou pelo prazo tem o fim no expires_at', () => {
    // O prazo é o fim só quando já venceu; enquanto ainda falta, o fim é o
    // agora (o teste de baixo), senão a duração de uma sessão viva andaria a
    // pular entre os dois.
    expect(shareEndMs(linha(), Date.parse(ISO(45)))).toBe(Date.parse(ISO(30)));
  });

  it('sessão a decorrer não dura mais do que agora', () => {
    // O fim de uma sessão viva é o agora: sem isto, a duração de uma sessão
    // a decorrer cresceria sozinha até ao prazo e o chip saltava.
    const r = linha({ expires_at: ISO(300) });
    expect(shareEndMs(r, AGORA)).toBe(AGORA);
    expect(shareDurationMs(r, AGORA)).toBe(AGORA - Date.parse(ISO(0)));
  });

  it('a duração nunca fica negativa, mesmo com timestamps trocados', () => {
    const r = linha({ started_at: ISO(20), stopped_at: ISO(5) });
    expect(shareDurationMs(r, AGORA)).toBe(0);
  });

  it('sem fim nenhum, o fim é o agora', () => {
    const r = linha({ expires_at: 'nao-e-data' });
    expect(shareEndMs(r, AGORA)).toBe(AGORA);
  });

  it('uma duração real: parada aos 12 min', () => {
    const r = linha({ stopped_at: ISO(12) });
    expect(shareDurationMs(r, AGORA)).toBe(12 * 60000);
  });
});

describe('shareDurationLabel', () => {
  it('segundos, minutos, horas cheias e horas com resto', () => {
    expect(shareDurationLabel(45_000)).toBe('45 s');
    expect(shareDurationLabel(12 * 60_000)).toBe('12 min');
    expect(shareDurationLabel(3 * 3600_000)).toBe('3 h');
    expect(shareDurationLabel(85 * 60_000)).toBe('1 h 25 min');
  });

  it('não escreve "0 s" nem negativos', () => {
    expect(shareDurationLabel(-5)).toBe('0 s');
    expect(shareDurationLabel(0)).toBe('0 s');
  });
});

describe('shareWhenLabel', () => {
  it('fica no mesmo formato do CloudSection', () => {
    const d = new Date(Date.UTC(2026, 9, 14, 21, 4));
    // O formato é local; o que se testa é a estrutura dd/mm hh:mm.
    expect(shareWhenLabel(d.toISOString())).toMatch(
      /^\d{2}\/\d{2} \d{2}:\d{2}$/,
    );
  });

  it('timestamp inválido vira travessão, não "Invalid Date"', () => {
    expect(shareWhenLabel('qualquer coisa')).toBe('—');
  });
});
