export const evalArithmetic = (expr: string): number | null => {
  const tokens = (expr.match(/\d+(?:\.\d+)?|[+\-*/()]/g) || []).filter(Boolean);
  if (tokens.length === 0) {
    return null;
  }

  let pos = 0;
  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  const parseFactor = (): number | null => {
    const t = peek();
    if (t === '-' || t === '+') {
      consume();
      const inner = parseFactor();
      return inner == null ? null : t === '-' ? -inner : inner;
    }
    if (t === '(') {
      consume();
      const value = parseExpr();
      if (peek() !== ')' || value == null) {
        return null;
      }
      consume();
      return value;
    }
    if (t != null && /^\d/.test(t)) {
      consume();
      const n = parseFloat(t);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };

  const parseTerm = (): number | null => {
    let value = parseFactor();
    if (value == null) {
      return null;
    }
    while (peek() === '*' || peek() === '/') {
      const op = consume();
      const right = parseFactor();
      if (right == null) {
        return null;
      }
      if (op === '/') {
        if (right === 0) {
          return null;
        }
        value = value / right;
      } else {
        value = value * right;
      }
    }
    return value;
  };

  const parseExpr = (): number | null => {
    let value = parseTerm();
    if (value == null) {
      return null;
    }
    while (peek() === '+' || peek() === '-') {
      const op = consume();
      const right = parseTerm();
      if (right == null) {
        return null;
      }
      value = op === '+' ? value + right : value - right;
    }
    return value;
  };

  const result = parseExpr();
  if (result == null || pos !== tokens.length || !Number.isFinite(result)) {
    return null;
  }
  return Math.round(result * 1e6) / 1e6;
};