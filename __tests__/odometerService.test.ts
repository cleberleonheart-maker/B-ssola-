import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addDistance,
  dayKey,
  flushOdometer,
  getTotals,
  resetToday,
  setTotals,
} from '../src/services/odometerService';

const STORAGE_KEY = '@bussola/odometerDaily';

const yesterdayKey = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dayKey(d.getTime());
};

describe('odometerService', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await setTotals({});
  });

  it('acumula distâncias do dia', async () => {
    await addDistance(120);
    await addDistance(80);
    await flushOdometer();
    const totals = await getTotals();
    expect(totals.today).toBe(200);
  });

  it('resetToday zera o total do dia atual e persiste', async () => {
    await setTotals({ [yesterdayKey()]: 500 });
    await addDistance(100);

    await resetToday();

    const totals = await getTotals();
    expect(totals.today).toBe(0);
    // os dias anteriores ficam intactos
    expect(totals.lastDays[1].meters).toBe(500);

    // persistido de verdade: o AsyncStorage já não tem a chave de hoje
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)[dayKey(Date.now())]).toBeUndefined();
    expect(JSON.parse(raw as string)[yesterdayKey()]).toBe(500);
  });

  it('depois do reset, a contagem recomeça do zero', async () => {
    await addDistance(300);
    await resetToday();
    await addDistance(40);
    const totals = await getTotals();
    expect(totals.today).toBe(40);
  });

  it('resetToday sem nada registado é inofensivo', async () => {
    await resetToday();
    const totals = await getTotals();
    expect(totals.today).toBe(0);
  });
});
