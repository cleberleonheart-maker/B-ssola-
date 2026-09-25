const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'web', 'live.html'), 'utf8');
const script = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const booted = [];

const makeNode = (id) => ({
  id,
  textContent: '',
  href: '',
  classList: {
    _set: new Set(),
    add(c) { this._set.add(c); },
    remove(c) { this._set.delete(c); },
    toggle(c, on) { on ? this._set.add(c) : this._set.delete(c); },
    contains(c) { return this._set.has(c); },
  },
  addEventListener() {},
});

const boot = (hash, fetchImpl) => {
  const nodes = {};
  const listeners = [];
  const document = {
    hidden: false,
    getElementById: (id) => (nodes[id] = nodes[id] || makeNode(id)),
    addEventListener: (type, fn) => listeners.push([type, fn]),
  };
  const ctx = {
    JSON, Math, Date, Number, String, Promise, Error, AbortController,
    setTimeout, clearTimeout, setInterval, clearInterval,
    location: { hash },
    window: { AbortController },
    document,
    fetch: typeof fetchImpl === 'function' ? fetchImpl : () => fetchImpl,
  };
  vm.createContext(ctx);
  vm.runInContext(script, ctx);
  const app = {
    nodes,
    document,
    listener: (type) => listeners.filter(([t]) => t === type).map(([, f]) => f)[0],
    again: () => vm.runInContext('poll();', ctx),
    halt: () => vm.runInContext('stop();', ctx),
  };
  booted.push(app);
  return app;
};

const reply = (body, status = 200) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });

const fix = (over) =>
  Object.assign(
    {
      latitude: -23.5505199,
      longitude: -46.6333094,
      accuracy: 12.4,
      heading: 275,
      speed: 1.4,
      altitude: 760,
      expires_at: new Date(Date.now() + 600000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    over || {},
  );

describe('viewer do rastreio ao vivo', () => {
  afterEach(() => {
    while (booted.length) booted.pop().halt();
  });

  it('avisa quando o link não tem código', async () => {
    const { nodes } = boot('', reply([]));
    await wait(30);
    expect(nodes.note.textContent).toMatch(/inválido/i);
  });

  it('aguarda a primeira posição sem inventar coordenada', async () => {
    const { nodes } = boot('#tkn=abc', reply([]));
    await wait(30);
    expect(nodes.note.textContent).toMatch(/aguardando/i);
    expect(nodes.coordsRow.classList.contains('hidden')).toBe(true);
    expect(nodes.liveTag.classList.contains('hidden')).toBe(true);
  });

  it('mostra posição, metadados, contagem e link do mapa', async () => {
    const { nodes } = boot('#tkn=abc', reply([fix()]));
    await wait(30);
    expect(nodes.liveTag.textContent).toMatch(/AO VIVO/);
    expect(nodes.liveTag.classList.contains('warn')).toBe(false);
    expect(nodes.coords.textContent).toMatch(/S 23°/);
    expect(nodes.coords.textContent).toMatch(/W 46°/);
    expect(nodes.meta.textContent).toMatch(/±12 m/);
    expect(nodes.meta.textContent).toMatch(/rumo 275°/);
    expect(nodes.count.textContent).toMatch(/expira em/);
    expect(nodes.mapBtn.href).toMatch(/google.com\/maps\?q=-23.55/);
  });

  it('aceita payload sem campos opcionais', async () => {
    const { nodes } = boot('#tkn=abc', reply([{
      latitude: 10.5,
      longitude: -20.25,
      accuracy: null,
      heading: null,
      speed: null,
      altitude: null,
      expires_at: new Date(Date.now() + 60000).toISOString(),
      updated_at: new Date().toISOString(),
    }]));
    await wait(30);
    expect(nodes.coords.textContent).toMatch(/N 10°30'/);
    expect(nodes.meta.textContent).toBe('');
  });

  it('marca SEM SINAL quando a posição envelope velha', async () => {
    const old = new Date(Date.now() - 90000).toISOString();
    const { nodes } = boot('#tkn=abc', reply([fix({ updated_at: old })]));
    await wait(30);
    expect(nodes.liveTag.textContent).toMatch(/SEM SINAL/);
    expect(nodes.liveTag.classList.contains('warn')).toBe(true);
    expect(nodes.note.textContent).toMatch(/atrás/);
    expect(nodes.coords.textContent).toMatch(/S 23°/);
  });

  it('distingue sessão encerrada de link expirado', async () => {
    let calls = 0;
    const app = boot('#tkn=abc', () => {
      calls += 1;
      return reply(calls === 1 ? [fix()] : []);
    });
    await wait(30);
    expect(app.nodes.liveTag.textContent).toMatch(/AO VIVO/);
    app.again();
    await wait(30);
    expect(app.nodes.note.textContent).toMatch(/encerrado/i);
    expect(app.nodes.liveTag.classList.contains('hidden')).toBe(true);
    expect(app.nodes.coords.textContent).toMatch(/S 23°/);
  });

  it('trata erro de rede com estado offline e botão de atualizar', async () => {
    const { nodes } = boot('#tkn=abc', () => Promise.reject(new Error('offline')));
    await wait(30);
    expect(nodes.note.textContent).toMatch(/sem conex/i);
    expect(nodes.retry.classList.contains('hidden')).toBe(false);
    expect(nodes.coordsRow.classList.contains('hidden')).toBe(true);
  });

  it('mantém a última posição visível quando a rede cai depois', async () => {
    let calls = 0;
    const app = boot('#tkn=abc', () => {
      calls += 1;
      return calls === 1 ? reply([fix()]) : Promise.reject(new Error('offline'));
    });
    await wait(30);
    app.again();
    await wait(30);
    expect(app.nodes.liveTag.textContent).toMatch(/SEM SINAL/);
    expect(app.nodes.note.textContent).toMatch(/atrás/);
    expect(app.nodes.coords.textContent).toMatch(/S 23°/);
  });

  it('trata erro HTTP como offline em vez de posição vazia', async () => {
    const { nodes } = boot('#tkn=abc', reply({ message: 'boom' }, 500));
    await wait(30);
    expect(nodes.note.textContent).toMatch(/sem conex/i);
  });

  it('expira quando o servidor devolve expires_at no passado', async () => {
    const { nodes } = boot('#tkn=abc', reply([fix({ expires_at: new Date(Date.now() - 1000).toISOString() })]));
    await wait(30);
    expect(nodes.note.textContent).toMatch(/expirou/i);
    expect(nodes.count.textContent).toBe('');
  });

  it('expira sozinho pela contagem regressiva', async () => {
    const soon = new Date(Date.now() + 400).toISOString();
    const { nodes } = boot('#tkn=abc', reply([fix({ expires_at: soon })]));
    await wait(50);
    expect(nodes.count.textContent).toMatch(/expira em/);
    await wait(1300);
    expect(nodes.note.textContent).toMatch(/expirou/i);
  });

  it('lê token com escape e evita polls sobrepostos', async () => {
    let calls = 0;
    const app = boot('#tkn=a%2Fb%20c', () => {
      calls += 1;
      return reply([fix()]);
    });
    await wait(30);
    expect(app.nodes.note.textContent).not.toMatch(/inválido/i);
    app.again();
    app.again();
    await wait(30);
    expect(calls).toBe(2);
  });

  it('pausa na aba oculta e retoma ao voltar', async () => {
    let calls = 0;
    const app = boot('#tkn=abc', () => {
      calls += 1;
      return reply([fix()]);
    });
    await wait(30);
    const onVisibility = app.listener('visibilitychange');
    expect(typeof onVisibility).toBe('function');
    app.document.hidden = true;
    onVisibility();
    await wait(60);
    expect(calls).toBe(1);
    app.document.hidden = false;
    onVisibility();
    await wait(30);
    expect(calls).toBe(2);
    expect(app.nodes.liveTag.textContent).toMatch(/AO VIVO/);
  });
});
