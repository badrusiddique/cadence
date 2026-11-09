/**
 * Safe Signal Lab predicate evaluator — no Function/eval.
 * Supports: identifiers, numbers, strings, true/false/null,
 * comparisons (< > <= >= == !=), AND/OR, parentheses.
 */

type Tok =
  | { kind: 'id'; value: string }
  | { kind: 'num'; value: number }
  | { kind: 'str'; value: string }
  | { kind: 'bool'; value: boolean }
  | { kind: 'null' }
  | { kind: 'op'; value: string }
  | { kind: 'and' }
  | { kind: 'or' }
  | { kind: 'lp' }
  | { kind: 'rp' };

function tokenize(input: string): Tok[] {
  const s = input.trim();
  if (!s) throw new Error('Empty expression.');
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i]!;
    if (/\s/.test(c)) {
      i += 1;
      continue;
    }
    if (c === '(') {
      out.push({ kind: 'lp' });
      i += 1;
      continue;
    }
    if (c === ')') {
      out.push({ kind: 'rp' });
      i += 1;
      continue;
    }
    if (c === '"' || c === "'") {
      const q = c;
      i += 1;
      let v = '';
      while (i < s.length && s[i] !== q) {
        if (s[i] === '\\' && i + 1 < s.length) {
          v += s[i + 1];
          i += 2;
          continue;
        }
        v += s[i];
        i += 1;
      }
      if (s[i] !== q) throw new Error('Unterminated string.');
      i += 1;
      out.push({ kind: 'str', value: v });
      continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && i + 1 < s.length && /[0-9]/.test(s[i + 1]!))) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j]!)) j += 1;
      const n = Number(s.slice(i, j));
      if (!Number.isFinite(n)) throw new Error(`Bad number near ${s.slice(i, j)}`);
      out.push({ kind: 'num', value: n });
      i = j;
      continue;
    }
    if ('<>=!'.includes(c)) {
      let j = i + 1;
      if (j < s.length && s[j] === '=') j += 1;
      const op = s.slice(i, j);
      if (!['<', '>', '<=', '>=', '==', '!='].includes(op)) throw new Error(`Unsupported operator ${op}`);
      out.push({ kind: 'op', value: op });
      i = j;
      continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      let j = i + 1;
      while (j < s.length && /[a-zA-Z0-9_]/.test(s[j]!)) j += 1;
      const id = s.slice(i, j);
      const upper = id.toUpperCase();
      if (upper === 'AND') out.push({ kind: 'and' });
      else if (upper === 'OR') out.push({ kind: 'or' });
      else if (id === 'true') out.push({ kind: 'bool', value: true });
      else if (id === 'false') out.push({ kind: 'bool', value: false });
      else if (id === 'null') out.push({ kind: 'null' });
      else out.push({ kind: 'id', value: id });
      i = j;
      continue;
    }
    throw new Error(`Unsupported character '${c}' in expression.`);
  }
  return out;
}

type Node =
  | { type: 'lit'; value: unknown }
  | { type: 'id'; name: string }
  | { type: 'cmp'; op: string; left: Node; right: Node }
  | { type: 'and'; left: Node; right: Node }
  | { type: 'or'; left: Node; right: Node };

class Parser {
  private i = 0;
  constructor(private tokens: Tok[]) {}

  parse(): Node {
    const n = this.parseOr();
    if (this.i < this.tokens.length) throw new Error('Unexpected trailing tokens.');
    return n;
  }

  private peek(): Tok | undefined {
    return this.tokens[this.i];
  }

  private take(): Tok {
    const t = this.tokens[this.i];
    if (!t) throw new Error('Unexpected end of expression.');
    this.i += 1;
    return t;
  }

  private parseOr(): Node {
    let left = this.parseAnd();
    while (this.peek()?.kind === 'or') {
      this.take();
      left = { type: 'or', left, right: this.parseAnd() };
    }
    return left;
  }

  private parseAnd(): Node {
    let left = this.parseCmp();
    while (this.peek()?.kind === 'and') {
      this.take();
      left = { type: 'and', left, right: this.parseCmp() };
    }
    return left;
  }

  private parseCmp(): Node {
    const left = this.parsePrimary();
    const t = this.peek();
    if (t?.kind === 'op') {
      this.take();
      return { type: 'cmp', op: t.value, left, right: this.parsePrimary() };
    }
    return left;
  }

  private parsePrimary(): Node {
    const t = this.take();
    if (t.kind === 'lp') {
      const inner = this.parseOr();
      const close = this.take();
      if (close.kind !== 'rp') throw new Error('Expected ).');
      return inner;
    }
    if (t.kind === 'id') return { type: 'id', name: t.value };
    if (t.kind === 'num') return { type: 'lit', value: t.value };
    if (t.kind === 'str') return { type: 'lit', value: t.value };
    if (t.kind === 'bool') return { type: 'lit', value: t.value };
    if (t.kind === 'null') return { type: 'lit', value: null };
    throw new Error('Expected value or (expression).');
  }
}

function evalNode(node: Node, row: Record<string, unknown>): unknown {
  switch (node.type) {
    case 'lit':
      return node.value;
    case 'id':
      return Object.prototype.hasOwnProperty.call(row, node.name) ? row[node.name] : undefined;
    case 'and':
      return Boolean(evalNode(node.left, row)) && Boolean(evalNode(node.right, row));
    case 'or':
      return Boolean(evalNode(node.left, row)) || Boolean(evalNode(node.right, row));
    case 'cmp': {
      const l = evalNode(node.left, row) as any;
      const r = evalNode(node.right, row) as any;
      switch (node.op) {
        case '<':
          return l < r;
        case '>':
          return l > r;
        case '<=':
          return l <= r;
        case '>=':
          return l >= r;
        case '==':
          return l === r;
        case '!=':
          return l !== r;
        default:
          return false;
      }
    }
    default:
      return false;
  }
}

export function buildSafePredicate(expression: string): (row: Record<string, unknown>) => boolean {
  const ast = new Parser(tokenize(expression)).parse();
  return (row) => Boolean(evalNode(ast, row));
}

export function assertSafeExpression(expression: string): void {
  buildSafePredicate(expression);
}
