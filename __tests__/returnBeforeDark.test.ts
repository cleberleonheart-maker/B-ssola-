import {
  estimateReturnBeforeDark,
  formatClock,
  MIN_TRAVEL_METERS,
  MIN_ELAPSED_MS,
  MIN_RETURN_METERS,
} from '../src/utils/returnBeforeDark';

const MIN = 60000;

// 1 km em 20 min = 20 min/km; de volta a 500 m = 10 min; margem de 20 min.
const base = {
  traveledMeters: 1000,
  elapsedMs: 20 * MIN,
  returnMeters: 500,
  now: new Date(2026, 0, 1, 17, 0).getTime(),
  sunset: new Date(2026, 0, 1, 18, 0),
};

describe('estimateReturnBeforeDark', () => {
  it('estima ritmo, tempo de volta e a hora-limite', () => {
    const r = estimateReturnBeforeDark(base);
    expect(r).not.toBeNull();
    expect(r!.paceMinPerKm).toBeCloseTo(20, 5);
    expect(r!.returnMinutes).toBeCloseTo(10, 5);
    // 18:00 − 10 min de volta − 20 min de margem = 17:30.
    expect(formatClock(r!.turnBackAt)).toBe('17:30');
    expect(r!.minutesToTurnBack).toBeCloseTo(30, 5);
    expect(r!.late).toBe(false);
  });

  it('marca atraso quando já passou a hora-limite', () => {
    const r = estimateReturnBeforeDark({
      ...base,
      now: new Date(2026, 0, 1, 17, 31).getTime(),
    });
    expect(r!.late).toBe(true);
    expect(r!.minutesToTurnBack).toBeCloseTo(-1, 5);
  });

  it('respeita a margem de segurança (no limite, exatamente 0)', () => {
    const r = estimateReturnBeforeDark({
      ...base,
      now: new Date(2026, 0, 1, 17, 30).getTime(),
      marginMinutes: 20,
    });
    expect(r!.minutesToTurnBack).toBeCloseTo(0, 5);
    expect(r!.late).toBe(true);
  });

  it('devolve null sem hora de pôr do sol', () => {
    expect(estimateReturnBeforeDark({ ...base, sunset: null })).toBeNull();
  });

  it('devolve null com amostras curtas demais', () => {
    expect(
      estimateReturnBeforeDark({ ...base, traveledMeters: MIN_TRAVEL_METERS - 1 }),
    ).toBeNull();
    expect(
      estimateReturnBeforeDark({ ...base, elapsedMs: MIN_ELAPSED_MS - 1 }),
    ).toBeNull();
  });

  it('devolve null quando já está praticamente em casa', () => {
    expect(
      estimateReturnBeforeDark({ ...base, returnMeters: MIN_RETURN_METERS - 1 }),
    ).toBeNull();
  });
});

describe('formatClock', () => {
  it('formata HH:MM com zeros à esquerda', () => {
    expect(formatClock(new Date(2026, 0, 1, 9, 5))).toBe('09:05');
    expect(formatClock(new Date(2026, 0, 1, 18, 0))).toBe('18:00');
  });
});
