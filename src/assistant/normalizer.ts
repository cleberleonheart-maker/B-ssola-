export const normalizeText = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,!?;:"'()[\]{}<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const toTokens = (text: string): string[] => {
  const n = normalizeText(text);
  return n ? n.split(' ') : [];
};