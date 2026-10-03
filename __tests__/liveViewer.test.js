const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'web', 'live.html'), 'utf8');
const script = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const booted = [];

// O mapa e SVG criado com `createElementNS` e escrito por `setAttribute`, o
// que os stubs originais nao tinham. `children` e um array simples: o viewer
// so acrescenta — nao ha nada a remover nem a reordenar.
const makeNode = (id) => ({
  id,
  textContent: '',
  href: '',
  children: [],
  attrs: {},
  setAttribute(name, value) { this.attrs[name] = String(value); },
  getAttribute(name) { return this.attrs[name]; },
  appendChild(child) { this.children.push(child); return child; },
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
    createElementNS: (_ns, tag) => makeNode(tag),
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

// O teardown vive aqui em cima, e não dentro de um `describe`: o viewer deixa
// um `setInterval` de 1 s e um `setTimeout` de poll vivos, e um `afterEach`
// preso a um só bloco deixava os testes do mini mapa a correr sem ser
// desligados — o jest passava tudo e depois não saía.
afterEach(() => {
  while (booted.length) booted.pop().halt();
});

describe('viewer do rastreio ao vivo', () => {
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

  // Sem a RPC de status o viewer tratava prazo cumprido como "a pessoa
  // encerrou": dois motivos para a posição sumir, um mensaje só.
  it('diz que expirou quando o prazo venceu e ninguem encerrou', async () => {
    let positionCalls = 0;
    const app = boot('#tkn=abc', (url) => {
      if (String(url).indexOf('get_live_status') >= 0) {
        return reply([{
          expires_at: new Date(Date.now() - 1000).toISOString(),
          updated_at: new Date(Date.now() - 60000).toISOString(),
          expired: true,
        }]);
      }
      positionCalls += 1;
      return reply(positionCalls === 1 ? [fix()] : []);
    });
    await wait(30);
    app.again();
    await wait(30);
    expect(app.nodes.note.textContent).toMatch(/expirou/i);
    expect(app.nodes.note.textContent).not.toMatch(/encerrado/i);
  });

  it('segue tentando quando a linha continua viva e sem posicao', async () => {
    let positionCalls = 0;
    const app = boot('#tkn=abc', (url) => {
      if (String(url).indexOf('get_live_status') >= 0) {
        return reply([{
          expires_at: new Date(Date.now() + 600000).toISOString(),
          updated_at: new Date().toISOString(),
          expired: false,
        }]);
      }
      positionCalls += 1;
      return reply(positionCalls === 1 ? [fix()] : []);
    });
    await wait(30);
    app.again();
    await wait(30);
    expect(app.nodes.note.textContent).not.toMatch(/encerrado|expirou/i);
    app.again();
    await wait(30);
    expect(positionCalls).toBe(3);
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

// ---------------------------------------------------------------------------
// O mini mapa. Sem tiles e sem pedidos: um SVG desenhado a partir das
// coordenadas. `live_shares` guarda um unico ponto por token, portanto o
// trajecto e o que o viewer viu desde que abriu a pagina.
// ---------------------------------------------------------------------------
describe('mini mapa da pagina', () => {
  const SP = { latitude: -23.5505199, longitude: -46.6333094 };
  const norte = (metros) => ({ latitude: SP.latitude + metros / 111320 });

  // O SVG tem dois `circle` (o anel de precisao e o ponto) e dois `text` (o
  // norte e a escala): a etiqueta do elemento nao chega para os distinguir. E o
  // `id` posto em `buildMap` que os separa.
  const parts = (app) => {
    const svg = app.nodes.map.children[0];
    if (!svg) throw new Error('o mapa ainda nao tem SVG');
    const byId = {};
    svg.children.forEach((c) => { byId[c.attrs.id] = c; });
    return byId;
  };

  const TAG = {
    path: 'mapTrail',
    ring: 'mapRing',
    arrow: 'mapArrow',
    dot: 'mapDot',
    scaleText: 'mapScaleText',
  };

  it('a primeira posicao abre o mapa', async () => {
    const { nodes } = boot('#tkn=abc', reply([fix()]));
    await wait(30);
    expect(nodes.map.classList.contains('hidden')).toBe(false);
    expect(nodes.map.children).toHaveLength(1);
  });

  it('sem posicao nao ha mapa, e nao um mapa vazio', async () => {
    const { nodes } = boot('#tkn=abc', reply([]));
    await wait(30);
    expect(nodes.map.classList.contains('hidden')).toBe(true);
    expect(nodes.map.children).toHaveLength(0);
  });

  it('a posicao actual fica no centro do mapa', async () => {
    const app = boot('#tkn=abc', reply([fix()]));
    await wait(30);
    const g = parts(app);
    // Caixa de 300 px: o centro e (150, 150).
    expect(Number(g[TAG.dot].getAttribute('cx'))).toBeCloseTo(150, 6);
    expect(Number(g[TAG.dot].getAttribute('cy'))).toBeCloseTo(150, 6);
  });

  it('o mapa diz que o trajecto comeca quando a pagina abre', async () => {
    const { nodes } = boot('#tkn=abc', reply([fix()]));
    await wait(30);
    expect(nodes.mapNote.textContent).toMatch(/desde que abriste/i);
    expect(nodes.mapNote.classList.contains('hidden')).toBe(false);
  });

  it('andar longe de verdad acrescenta um ponto ao trajecto', async () => {
    let calls = 0;
    const app = boot('#tkn=abc', () => {
      calls += 1;
      return reply([fix(calls === 1 ? {} : { latitude: norte(40).latitude })]);
    });
    await wait(30);
    const antes = parts(app)[TAG.path].getAttribute('d');

    app.again();
    await wait(40);

    const depois = parts(app)[TAG.path].getAttribute('d');
    expect(depois).not.toBe(antes);
    expect(depois.match(/[ML] /g)).toHaveLength(2);
  });

  it('oscilar um metro nao desenha tracos de ruido', async () => {
    let calls = 0;
    const app = boot('#tkn=abc', () => {
      calls += 1;
      return reply([fix(calls === 1 ? {} : { latitude: norte(0.5).latitude })]);
    });
    await wait(30);
    const antes = parts(app)[TAG.path].getAttribute('d');

    app.again();
    await wait(40);

    // Nao se compara o `d` byte a byte: a janela segue a pessoa, portanto meio
    // metro de deriva deslocam o trilho todo de meio pixel. O que nao pode
    // acontecer e o trilho ganhar um comando novo por causa do ruido.
    expect(parts(app)[TAG.path].getAttribute('d').match(/[ML] /g)).toHaveLength(
      antes.match(/[ML] /g).length,
    );
  });

  it('a precisao vira um circulo do raio certo', async () => {
    const app = boot('#tkn=abc', reply([fix({ accuracy: 50 })]));
    await wait(30);
    const ring = parts(app)[TAG.ring];
    expect(ring.getAttribute('opacity')).not.toBe('0');
    expect(Number(ring.getAttribute('r'))).toBeGreaterThan(1);
  });

  it('sem precisao o circulo desaparece em vez de virar raio zero', async () => {
    const app = boot('#tkn=abc', reply([fix({ accuracy: null })]));
    await wait(30);
    expect(parts(app)[TAG.ring].getAttribute('opacity')).toBe('0');
  });

  it('sem rumo a seta desaparece em vez de apontar a norte', async () => {
    const app = boot('#tkn=abc', reply([fix({ heading: null })]));
    await wait(30);
    expect(parts(app)[TAG.arrow].getAttribute('opacity')).toBe('0');
  });

  it('a seta aponta no rumo, e nao para cima', async () => {
    // 90° e para leste: a ponta da seta fica a direita do ponto.
    const app = boot('#tkn=abc', reply([fix({ heading: 90 })]));
    await wait(30);
    const arrow = parts(app)[TAG.arrow];
    expect(arrow.getAttribute('opacity')).toBe('1');
    expect(Number(arrow.getAttribute('x2'))).toBeGreaterThan(Number(arrow.getAttribute('x1')));
    expect(Number(arrow.getAttribute('y2'))).toBeCloseTo(Number(arrow.getAttribute('y1')), 6);
  });

  it('a barra de escala diz metros, nao decimos de metro', async () => {
    const app = boot('#tkn=abc', reply([fix()]));
    await wait(30);
    expect(parts(app)[TAG.scaleText].textContent).toMatch(/^\d+(\.\d+)? (m|km)$/);
  });

  it('quando o link expira o mapa some com as coordenadas', async () => {
    const app = boot('#tkn=abc', reply([fix({ expires_at: new Date(Date.now() - 1000).toISOString() })]));
    await wait(30);
    expect(app.nodes.map.classList.contains('hidden')).toBe(true);
  });

  it('quando a pessoa encerra, o mapa fica com a ultima posicao', async () => {
    let calls = 0;
    const app = boot('#tkn=abc', () => {
      calls += 1;
      return reply(calls === 1 ? [fix()] : []);
    });
    await wait(30);
    app.again();
    await wait(40);
    expect(app.nodes.note.textContent).toMatch(/encerrado/i);
    expect(app.nodes.map.classList.contains('hidden')).toBe(false);
  });
});
