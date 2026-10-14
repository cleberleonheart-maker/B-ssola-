import { fingerprintOf, reportProblem } from '../src/services/crashReporter';
import { ensureCloudUser, pushCrashReport } from '../src/services/cloud';
import {
  clearSensorLog,
  recordMotionSample,
  sensorLogText,
  sensorSampleCount,
  updateFixQuality,
} from '../src/services/sensorLogService';

/**
 * O relato de problema (ideia #63) tem duas promessas que se testam sozinhas: a
 * de que o log de sensores ajuda a reproduzir o bug, e a de que não leva a
 * localização de ninguém. A segunda é a que um teste pode confirmar sem campo.
 */
jest.mock('../src/services/cloud', () => ({
  ensureCloudUser: jest.fn(),
  pushCrashReport: jest.fn(),
  deleteExpiredCrashReports: jest.fn(async () => true),
  noteCloudError: jest.fn(),
  takeCloudError: jest.fn(() => null),
}));

const mockEnsure = ensureCloudUser as jest.MockedFunction<typeof ensureCloudUser>;
const mockPush = pushCrashReport as jest.MockedFunction<typeof pushCrashReport>;

const t0 = 1_700_000_000_000;

beforeEach(() => {
  jest.clearAllMocks();
  mockEnsure.mockResolvedValue('user-abc');
  mockPush.mockResolvedValue(true);
  clearSensorLog();
});

describe('sensorLogService — o trecho anónimo', () => {
  it('sem amostras não há log nenhum', () => {
    expect(sensorLogText()).toBeNull();
    expect(sensorSampleCount()).toBe(0);
  });

  it('guarda a amostra e descreve-a num cabeçalho legível', () => {
    recordMotionSample(
      { ax: 0.1, ay: -0.2, az: 9.8, mx: 12.14, my: 3.25, mz: -40.06, heading: 137.4 },
      t0,
    );
    const log = sensorLogText();
    expect(log).not.toBeNull();
    expect(log).toContain('sensorlog v1');
    expect(log).toContain('dt,ax,ay,az,mx,my,mz,h,acc,spd');
    // heading arredondado a graus, movimento a uma casa decimal
    expect(log).toContain('0.0,0.1,-0.2,9.8,12.1,3.3,-40.1,137');
  });

  it('faz throttle: uma amostra por segundo', () => {
    recordMotionSample({ ax: 1, ay: 0, az: 0, mx: 0, my: 0, mz: 0, heading: 0 }, t0);
    recordMotionSample({ ax: 9, ay: 0, az: 0, mx: 0, my: 0, mz: 0, heading: 0 }, t0 + 500);
    expect(sensorSampleCount()).toBe(1);
    recordMotionSample({ ax: 2, ay: 0, az: 0, mx: 0, my: 0, mz: 0, heading: 0 }, t0 + 1100);
    expect(sensorSampleCount()).toBe(2);
  });

  it('esquece amostras mais antigas que um minuto', () => {
    recordMotionSample({ ax: 1, ay: 0, az: 0, mx: 0, my: 0, mz: 0, heading: 0 }, t0);
    recordMotionSample(
      { ax: 2, ay: 0, az: 0, mx: 0, my: 0, mz: 0, heading: 0 },
      t0 + 70000,
    );
    expect(sensorSampleCount()).toBe(1);
  });

  it('anexa a qualidade do GPS, mas nunca a posição', () => {
    updateFixQuality(8.4, 0.33);
    recordMotionSample(
      { ax: 0, ay: 0, az: 9.8, mx: 1, my: 2, mz: 3, heading: null },
      t0,
    );
    const log = sensorLogText()!;
    const linhaAmostra = log.split('\n').pop()!;
    // dt,ax,ay,az,mx,my,mz,h,acc,spd — o heading ausente fica vazio, a
    // precisão fica 8 e a velocidade 0.3.
    expect(linhaAmostra).toBe('0.0,0,0,9.8,1,2,3,,8,0.3');
    // E não há latitude nem longitude em lado nenhum do que se envia.
    expect(log.toLowerCase()).not.toContain('lat');
    expect(log.toLowerCase()).not.toContain('lon');
    expect(log).toContain('sem coordenadas');
  });
});

describe('reportProblem — enviar o relato', () => {
  it('um relato vazio não vai a lado nenhum', async () => {
    expect(await reportProblem('   ')).toBe('failed');
    expect(mockEnsure).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('envia a descrição com o log dos sensores anexado', async () => {
    recordMotionSample(
      { ax: 0.1, ay: 0, az: 9.8, mx: 1, my: 2, mz: 3, heading: 90 },
      t0,
    );
    expect(await reportProblem('a bússola travou ao abrir os waypoints')).toBe('sent');
    expect(mockPush).toHaveBeenCalledTimes(1);
    const [, report] = mockPush.mock.calls[0];
    expect(report.message).toContain('[relato] a bússola travou');
    expect(report.sensorLog).toContain('sensorlog v1');
  });

  it('sem amostras, o campo do log vai vazio', async () => {
    await reportProblem('sem sensores');
    const [, report] = mockPush.mock.calls[0];
    expect(report.sensorLog).toBeNull();
  });

  it('sem sessão nem rede, diz que está offline em vez de mentir', async () => {
    mockEnsure.mockResolvedValue(null);
    expect(await reportProblem('sem rede')).toBe('offline');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('se a nuvem recusar, diz que falhou', async () => {
    mockPush.mockResolvedValue(false);
    expect(await reportProblem('recusado')).toBe('failed');
  });

  it('o fingerprint é o da mensagem com prefixo, não um stack de crash', async () => {
    await reportProblem('mesma descrição');
    const [, report] = mockPush.mock.calls[0];
    expect(report.fingerprint).toBe(fingerprintOf('[relato] mesma descrição'));
    expect(report.stack).toBeNull();
  });
});
