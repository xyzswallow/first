// 轻量表格公式引擎：支持单元格引用、区间、常用函数与四则运算。
// 单元格内部存储 key 形如 "行:列"（0 基），公式以 "=" 开头。

export const FUNCTIONS = [
  "SUM",
  "AVERAGE",
  "COUNT",
  "MAX",
  "MIN",
  "PRODUCT",
  "ROUND",
  "ABS",
  "IF",
] as const;

export type FunctionName = (typeof FUNCTIONS)[number];

// 列号 -> 字母（0 -> A, 25 -> Z, 26 -> AA）
export function colLabel(c: number): string {
  let s = "";
  let n = c;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

// 字母 -> 列号（A -> 0）
export function colIndex(label: string): number {
  let n = 0;
  for (const ch of label.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}

// A1 形式 -> 内部 key "行:列"
export function a1ToKey(a1: string): string | null {
  const m = /^([A-Za-z]+)(\d+)$/.exec(a1.trim());
  if (!m) return null;
  const col = colIndex(m[1]);
  const row = parseInt(m[2], 10) - 1;
  if (row < 0 || col < 0) return null;
  return `${row}:${col}`;
}

// 内部 key -> A1
export function keyToA1(key: string): string {
  const [r, c] = key.split(":").map(Number);
  return `${colLabel(c)}${r + 1}`;
}

type Cells = Record<string, string>;

// 判断字符串是否为公式
export function isFormula(raw: string | undefined): boolean {
  return typeof raw === "string" && raw.trimStart().startsWith("=");
}

// 展开区间 A1:B3 -> A1 形式的 key 列表
function expandRange(a1: string, a2: string): string[] {
  const k1 = a1ToKey(a1);
  const k2 = a1ToKey(a2);
  if (!k1 || !k2) return [];
  const [r1, c1] = k1.split(":").map(Number);
  const [r2, c2] = k2.split(":").map(Number);
  const rlo = Math.min(r1, r2);
  const rhi = Math.max(r1, r2);
  const clo = Math.min(c1, c2);
  const chi = Math.max(c1, c2);
  const keys: string[] = [];
  for (let r = rlo; r <= rhi; r++) {
    for (let c = clo; c <= chi; c++) {
      keys.push(`${r}:${c}`);
    }
  }
  return keys;
}

// ---------- Tokenizer ----------
type Token =
  | { type: "num"; value: number }
  | { type: "str"; value: string }
  | { type: "ref"; key: string }
  | { type: "range"; keys: string[] }
  | { type: "func"; name: string }
  | { type: "op"; value: string }
  | { type: "lparen" }
  | { type: "rparen" }
  | { type: "comma" };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const s = input;
  while (i < s.length) {
    const ch = s[i];
    if (ch === " " || ch === "\t") {
      i++;
      continue;
    }
    if (ch === '"') {
      let j = i + 1;
      let str = "";
      while (j < s.length && s[j] !== '"') {
        str += s[j];
        j++;
      }
      tokens.push({ type: "str", value: str });
      i = j + 1;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let num = "";
      while (i < s.length && /[0-9.]/.test(s[i])) {
        num += s[i];
        i++;
      }
      tokens.push({ type: "num", value: parseFloat(num) });
      continue;
    }
    if (/[A-Za-z]/.test(ch)) {
      let word = "";
      while (i < s.length && /[A-Za-z0-9]/.test(s[i])) {
        word += s[i];
        i++;
      }
      // 区间 A1:B3
      if (s[i] === ":" && /^[A-Za-z]+[0-9]+$/.test(word)) {
        let j = i + 1;
        let w2 = "";
        while (j < s.length && /[A-Za-z0-9]/.test(s[j])) {
          w2 += s[j];
          j++;
        }
        if (/^[A-Za-z]+[0-9]+$/.test(w2)) {
          tokens.push({ type: "range", keys: expandRange(word, w2) });
          i = j;
          continue;
        }
      }
      // 函数名（后跟左括号）
      if (s[i] === "(" && /^[A-Za-z]+$/.test(word)) {
        tokens.push({ type: "func", name: word.toUpperCase() });
        continue;
      }
      // 单元格引用 A1
      const key = a1ToKey(word);
      if (key) {
        tokens.push({ type: "ref", key });
        continue;
      }
      throw new Error(`未知标识符 ${word}`);
    }
    if (ch === "(") {
      tokens.push({ type: "lparen" });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "rparen" });
      i++;
      continue;
    }
    if (ch === ",") {
      tokens.push({ type: "comma" });
      i++;
      continue;
    }
    if ("+-*/^".includes(ch)) {
      tokens.push({ type: "op", value: ch });
      i++;
      continue;
    }
    if ("<>=".includes(ch)) {
      let op = ch;
      if (s[i + 1] === "=") {
        op += "=";
        i++;
      }
      tokens.push({ type: "op", value: op });
      i++;
      continue;
    }
    throw new Error(`非法字符 ${ch}`);
  }
  return tokens;
}

// ---------- Parser (递归下降) ----------
type Node =
  | { kind: "num"; value: number }
  | { kind: "str"; value: string }
  | { kind: "ref"; key: string }
  | { kind: "range"; keys: string[] }
  | { kind: "func"; name: string; args: Node[] }
  | { kind: "bin"; op: string; left: Node; right: Node }
  | { kind: "neg"; operand: Node };

class Parser {
  private pos = 0;
  constructor(private tokens: Token[]) {}

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }
  private next(): Token | undefined {
    return this.tokens[this.pos++];
  }

  parse(): Node {
    const node = this.parseComparison();
    if (this.pos < this.tokens.length) throw new Error("公式语法错误");
    return node;
  }

  private parseComparison(): Node {
    let left = this.parseAddSub();
    while (true) {
      const t = this.peek();
      if (t?.type === "op" && ["<", ">", "<=", ">=", "=", "<>"].includes(t.value)) {
        this.next();
        const right = this.parseAddSub();
        left = { kind: "bin", op: t.value, left, right };
      } else break;
    }
    return left;
  }

  private parseAddSub(): Node {
    let left = this.parseMulDiv();
    while (true) {
      const t = this.peek();
      if (t?.type === "op" && (t.value === "+" || t.value === "-")) {
        this.next();
        const right = this.parseMulDiv();
        left = { kind: "bin", op: t.value, left, right };
      } else break;
    }
    return left;
  }

  private parseMulDiv(): Node {
    let left = this.parsePow();
    while (true) {
      const t = this.peek();
      if (t?.type === "op" && (t.value === "*" || t.value === "/")) {
        this.next();
        const right = this.parsePow();
        left = { kind: "bin", op: t.value, left, right };
      } else break;
    }
    return left;
  }

  private parsePow(): Node {
    const left = this.parseUnary();
    const t = this.peek();
    if (t?.type === "op" && t.value === "^") {
      this.next();
      const right = this.parsePow();
      return { kind: "bin", op: "^", left, right };
    }
    return left;
  }

  private parseUnary(): Node {
    const t = this.peek();
    if (t?.type === "op" && t.value === "-") {
      this.next();
      return { kind: "neg", operand: this.parseUnary() };
    }
    if (t?.type === "op" && t.value === "+") {
      this.next();
      return this.parseUnary();
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Node {
    const t = this.next();
    if (!t) throw new Error("公式不完整");
    if (t.type === "num") return { kind: "num", value: t.value };
    if (t.type === "str") return { kind: "str", value: t.value };
    if (t.type === "ref") return { kind: "ref", key: t.key };
    if (t.type === "range") return { kind: "range", keys: t.keys };
    if (t.type === "lparen") {
      const node = this.parseComparison();
      const close = this.next();
      if (close?.type !== "rparen") throw new Error("括号不匹配");
      return node;
    }
    if (t.type === "func") {
      const lp = this.next();
      if (lp?.type !== "lparen") throw new Error("函数缺少括号");
      const args: Node[] = [];
      if (this.peek()?.type !== "rparen") {
        args.push(this.parseComparison());
        while (this.peek()?.type === "comma") {
          this.next();
          args.push(this.parseComparison());
        }
      }
      const rp = this.next();
      if (rp?.type !== "rparen") throw new Error("函数括号不匹配");
      return { kind: "func", name: t.name, args };
    }
    throw new Error("公式语法错误");
  }
}

// ---------- Evaluator ----------
// 计算值可能是数字或字符串（用于文本/比较）
type CellValue = number | string;

// 收集节点中引用到的单元格 key（含区间展开）
function collectRefs(node: Node, out: Set<string>) {
  switch (node.kind) {
    case "ref":
      out.add(node.key);
      break;
    case "range":
      node.keys.forEach((k) => out.add(k));
      break;
    case "func":
      node.args.forEach((a) => collectRefs(a, out));
      break;
    case "bin":
      collectRefs(node.left, out);
      collectRefs(node.right, out);
      break;
    case "neg":
      collectRefs(node.operand, out);
      break;
  }
}

function toNumber(v: CellValue): number {
  if (typeof v === "number") return v;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

// 单个单元格求值上下文：resolve 用于取其它单元格的最终计算值
function evalNode(
  node: Node,
  resolve: (key: string) => CellValue
): CellValue {
  switch (node.kind) {
    case "num":
      return node.value;
    case "str":
      return node.value;
    case "ref":
      return resolve(node.key);
    case "range":
      // 区间单独出现时无意义，取首格
      return node.keys.length ? resolve(node.keys[0]) : 0;
    case "neg":
      return -toNumber(evalNode(node.operand, resolve));
    case "bin": {
      const op = node.op;
      const l = evalNode(node.left, resolve);
      const r = evalNode(node.right, resolve);
      switch (op) {
        case "+":
          return toNumber(l) + toNumber(r);
        case "-":
          return toNumber(l) - toNumber(r);
        case "*":
          return toNumber(l) * toNumber(r);
        case "/": {
          const d = toNumber(r);
          if (d === 0) throw new Error("#DIV/0!");
          return toNumber(l) / d;
        }
        case "^":
          return Math.pow(toNumber(l), toNumber(r));
        case "=":
          return l === r ? 1 : 0;
        case "<>":
          return l !== r ? 1 : 0;
        case "<":
          return toNumber(l) < toNumber(r) ? 1 : 0;
        case ">":
          return toNumber(l) > toNumber(r) ? 1 : 0;
        case "<=":
          return toNumber(l) <= toNumber(r) ? 1 : 0;
        case ">=":
          return toNumber(l) >= toNumber(r) ? 1 : 0;
        default:
          throw new Error("未知运算符");
      }
    }
    case "func": {
      // 展开参数为数字列表（区间展开为多个数字）
      const nums: number[] = [];
      const collectNums = (n: Node) => {
        if (n.kind === "range") {
          n.keys.forEach((k) => {
            const v = resolve(k);
            if (v !== "" && v !== undefined) nums.push(toNumber(v));
          });
        } else {
          nums.push(toNumber(evalNode(n, resolve)));
        }
      };
      switch (node.name) {
        case "SUM":
          node.args.forEach(collectNums);
          return nums.reduce((a, b) => a + b, 0);
        case "PRODUCT":
          node.args.forEach(collectNums);
          return nums.reduce((a, b) => a * b, 1);
        case "AVERAGE":
          node.args.forEach(collectNums);
          return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
        case "COUNT": {
          let cnt = 0;
          node.args.forEach((n) => {
            if (n.kind === "range") {
              n.keys.forEach((k) => {
                const v = resolve(k);
                if (v !== "" && v !== undefined && !isNaN(parseFloat(String(v))))
                  cnt++;
              });
            } else {
              const v = evalNode(n, resolve);
              if (v !== "" && !isNaN(parseFloat(String(v)))) cnt++;
            }
          });
          return cnt;
        }
        case "MAX":
          node.args.forEach(collectNums);
          return nums.length ? Math.max(...nums) : 0;
        case "MIN":
          node.args.forEach(collectNums);
          return nums.length ? Math.min(...nums) : 0;
        case "ROUND": {
          const val = toNumber(evalNode(node.args[0], resolve));
          const digits = node.args[1]
            ? toNumber(evalNode(node.args[1], resolve))
            : 0;
          const f = Math.pow(10, digits);
          return Math.round(val * f) / f;
        }
        case "ABS":
          return Math.abs(toNumber(evalNode(node.args[0], resolve)));
        case "IF": {
          const cond = toNumber(evalNode(node.args[0], resolve));
          return cond !== 0
            ? evalNode(node.args[1], resolve)
            : node.args[2]
              ? evalNode(node.args[2], resolve)
              : 0;
        }
        default:
          throw new Error(`未知函数 ${node.name}`);
      }
    }
  }
}

/**
 * 计算整张表的显示值。
 * 输入 cells（原始文本，公式以 = 开头），返回每个 key 的显示字符串。
 * 处理依赖：递归求值 + 循环检测（返回 #REF! / #CIRC!）。
 */
export function computeSheet(cells: Cells): Record<string, string> {
  const ast = new Map<string, Node>();
  const display: Record<string, string> = {};
  const computing = new Set<string>();
  const cache = new Map<string, CellValue>();

  // 预解析所有公式
  for (const [key, raw] of Object.entries(cells)) {
    if (isFormula(raw)) {
      try {
        const expr = raw.trimStart().slice(1);
        ast.set(key, new Parser(tokenize(expr)).parse());
      } catch {
        ast.set(key, { kind: "str", value: "#ERR!" });
      }
    }
  }

  function resolve(key: string): CellValue {
    if (cache.has(key)) return cache.get(key)!;
    const node = ast.get(key);
    if (!node) {
      // 非公式单元格：数字则转数字，否则原文
      const raw = cells[key];
      if (raw === undefined || raw === "") return "";
      const n = parseFloat(raw);
      const v: CellValue = !isNaN(n) && String(n) === raw.trim() ? n : raw;
      cache.set(key, v);
      return v;
    }
    if (computing.has(key)) {
      throw new Error("#CIRC!");
    }
    computing.add(key);
    try {
      const v = evalNode(node, resolve);
      cache.set(key, v);
      return v;
    } finally {
      computing.delete(key);
    }
  }

  const allKeys = new Set<string>([...Object.keys(cells)]);
  for (const key of allKeys) {
    const raw = cells[key];
    if (!isFormula(raw)) {
      display[key] = raw ?? "";
      continue;
    }
    try {
      const v = resolve(key);
      display[key] = typeof v === "number" ? formatNumber(v) : String(v);
    } catch (e) {
      display[key] = e instanceof Error ? e.message : "#ERR!";
    }
  }
  return display;
}

function formatNumber(n: number): string {
  if (!isFinite(n)) return "#NUM!";
  // 去除浮点误差尾巴
  return String(Math.round(n * 1e10) / 1e10);
}

/** 单独计算一个公式字符串（供公式栏预览用），cells 提供依赖数据 */
export function evalFormula(formula: string, cells: Cells): string {
  try {
    const expr = formula.trimStart().slice(1);
    const node = new Parser(tokenize(expr)).parse();
    const computed = computeSheet(cells);
    const resolve = (key: string): CellValue => {
      const raw = computed[key];
      if (raw === undefined || raw === "") return "";
      const n = parseFloat(raw);
      return !isNaN(n) && String(n) === raw ? n : raw;
    };
    const v = evalNode(node, resolve);
    return typeof v === "number" ? formatNumber(v) : String(v);
  } catch (e) {
    return e instanceof Error ? e.message : "#ERR!";
  }
}

// 供外部消费
export { collectRefs };
export type { Node as FormulaNode };


