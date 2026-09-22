import {
  loadMemory,
  saveMemory,
  pushHistory,
  createId,
  type MemoryState,
} from './memory';
import { runSkills } from './skills';
import { toTokens } from './normalizer';
import { buildEmptyContext, type ActionResult, type AssistantContextData, type AssistantAction } from './types';
import { createTranslator, Lang, Translator } from '../i18n/strings';

const pick = (list: string[]): string => list[Math.floor(Math.random() * list.length)];

export class KeferaEngine {
  private memory: MemoryState = { facts: {}, history: [] };
  private ctx: AssistantContextData = buildEmptyContext();
  private ready = false;
  private lang: Lang = 'pt';

  private tr(): Translator {
    return createTranslator(this.lang);
  }

  async init(): Promise<void> {
    this.memory = await loadMemory();
    this.ready = true;
  }

  isReady(): boolean {
    return this.ready;
  }

  getMemory(): MemoryState {
    return this.memory;
  }

  setLang(lang: Lang): void {
    this.lang = lang;
  }

  setContext(partial: Partial<AssistantContextData>): void {
    this.ctx = { ...this.ctx, ...partial };
  }

  private async persist(): Promise<void> {
    await saveMemory(this.memory);
  }

  private response(
    text: string,
    kind: ActionResult['kind'],
    action?: AssistantAction,
  ): ActionResult {
    pushHistory(this.memory, 'assistant', text);
    return { text, speak: true, kind, ...(action ? { action } : {}) };
  }

  private userAnswer(text: string): void {
    pushHistory(this.memory, 'user', text);
  }

  async handle(raw: string): Promise<ActionResult> {
    const t = this.tr();
    const text = raw.trim();
    if (!text) {
      return this.response(t('as_empty'), 'help');
    }

    const tokens = toTokens(text);
    const normalized = tokens.join(' ');
    this.userAnswer(text);

    if (!this.ready) {
      return this.response(t('as_engine_not_ready'), 'error');
    }

    const fact = this.parseFact(normalized, t);
    if (fact) {
      this.memory.facts[fact.key] = fact.value;
      this.persist();
      return this.response(fact.message, 'fact');
    }

    const memoryQuery = this.parseMemoryQuery(normalized, t);
    if (memoryQuery) {
      return this.response(memoryQuery, 'memory');
    }

    const skill = runSkills(this.ctx, normalized, tokens, t);
    if (typeof skill === 'string') {
      return this.response(skill, 'answer');
    }
    if (skill) {
      return this.response(skill.text, 'answer', skill.action);
    }

    return this.response(
      pick([t('as_fallback_1'), t('as_fallback_2'), t('as_fallback_3'), t('as_fallback_4'), t('as_fallback_5')]),
      'help',
    );
  }

  private parseFact(
    normalized: string,
    t: Translator,
  ): { key: string; value: string; message: string } | null {
    const queryRe =
      /^(?:como (?:eu )?me chamo|qual e o meu nome|qual o meu nome|quem sou eu|voce sabe meu nome)$/;
    const q = normalized.match(queryRe);
    if (q) {
      const name = this.memory.facts.nome;
      return name
        ? { key: 'nome', value: name, message: t('as_name_known', { name }) }
        : {
            key: 'nome',
            value: name || '',
            message: t('as_name_unknown'),
          };
    }

    const addRe = /^(?:meu nome e|me chamo|chamo-me|me chame de|pode me chamar de) (.+)$/;
    const m = normalized.match(addRe);
    if (m && m[1].trim()) {
      const name = m[1].replace(/ de$/, '').trim();
      return {
        key: 'nome',
        value: name,
        message: t('as_name_added', { name }),
      };
    }
    return null;
  }

  private parseMemoryQuery(normalized: string, t: Translator): string | null {
    const qRe =
      /^(?:do que|sobre o que) (?:nós|nos|a gente|voce e eu) (?:falamos|conversamos|estvamos falando|estavamos falando)/;
    if (qRe.test(normalized)) {
      const recent = this.memory.history
        .filter(x => x.role === 'user')
        .slice(-4)
        .map(x => x.text)
        .join('; ');
      return recent
        ? t('as_memory_recent', { list: recent })
        : t('as_memory_none');
    }
    const lastRe = /^(?:qual (?:foi|e) a (?:minha|a|ultima|última|minha ultima|minha última) (?:pergunta|mensagem|coisa))/;
    if (lastRe.test(normalized)) {
      const last = [...this.memory.history].reverse().find(x => x.role === 'user');
      return last ? t('as_memory_last', { text: last.text }) : t('as_memory_no_last');
    }
    if (normalized.includes('ultima resposta') || normalized.includes('última resposta')) {
      const last = [...this.memory.history].reverse().find(x => x.role === 'assistant');
      return last ? t('as_memory_last_answer', { text: last.text }) : t('as_memory_no_answer');
    }
    return null;
  }

  clearConversationHistory(): void {
    this.memory.history = [];
    this.persist();
  }

  newConversationId(): string {
    return createId();
  }
}