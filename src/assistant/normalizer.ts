const isDigit = (ch: string | undefined) => ch !== undefined && ch >= '0' && ch <= '9';

export const normalizeText = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,!?;:"'()[\]{}<>|]/g, (m: string, offset: number, full: string) =>
      // separador decimal (pt-BR "1,5" e en-US "1.5") e vírgula de milhar
      // "1.234,56" viram ponto e permanecem no mesmo token; o resto é
      // pontuação e vira espaço
      (m === '.' || m === ',') && isDigit(full[offset - 1]) && isDigit(full[offset + 1])
        ? '.'
        : ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();

export const toTokens = (text: string): string[] => {
  const n = normalizeText(text);
  return n ? n.split(' ') : [];
};