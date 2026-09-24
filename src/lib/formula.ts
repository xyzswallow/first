// 轻量表格公式引擎：支持单元格引用、区间、常用函数与四则运算。
// 单元格内部存储 key 形如 "行:列"（0 基），公式以 "=" 开头。

export const FUNCTIONS = [
  "SUM",
  "AVERAGE",
  "COUNT",
  "COUNTA",
  "MAX",
  "MIN",
  "PRODUCT",
  "ROUND",
  "ROUNDUP",
  "ROUNDDOWN",
  "INT",
  "MOD",
  "POWER",
  "SQRT",
  "ABS",
  "SUMIF",
  "COUNTIF",
  "IF",
  "AND",
  "OR",
  "NOT",
  "LEN",
  "LEFT",
  "RIGHT",
  "MID",
  "CONCAT",
  "UPPER",
  "LOWER",
  "TRIM",
  "VLOOKUP",
  "HLOOKUP",
  "INDEX",
  "MATCH",
] as const;

export type FunctionName = (typeof FUNCTIONS)[number];

// 函数元信息：用于公式联想提示
export interface FunctionMeta {
  name: FunctionName;
  signature: string;
  desc: string;
}

export const FUNCTION_META: FunctionMeta[] = [
  { name: "SUM", signature: "SUM(区间/数值…)", desc: "求和" },
  { name: "AVERAGE", signature: "AVERAGE(区间/数值…)", desc: "求平均值" },
  { name: "COUNT", signature: "COUNT(区间/数值…)", desc: "统计数值个数" },
  { name: "COUNTA", signature: "COUNTA(区间/数值…)", desc: "统计非空个数" },
  { name: "MAX", signature: "MAX(区间/数值…)", desc: "求最大值" },
  { name: "MIN", signature: "MIN(区间/数值…)", desc: "求最小值" },
  { name: "PRODUCT", signature: "PRODUCT(数值…)", desc: "求乘积" },
  { name: "ROUND", signature: "ROUND(数值, 位数)", desc: "四舍五入" },
  { name: "ROUNDUP", signature: "ROUNDUP(数值, 位数)", desc: "向上舍入" },
  { name: "ROUNDDOWN", signature: "ROUNDDOWN(数值, 位数)", desc: "向下舍入" },
  { name: "INT", signature: "INT(数值)", desc: "向下取整" },
  { name: "MOD", signature: "MOD(数值, 除数)", desc: "求余数" },
  { name: "POWER", signature: "POWER(底数, 指数)", desc: "求幂" },
  { name: "SQRT", signature: "SQRT(数值)", desc: "平方根" },
  { name: "ABS", signature: "ABS(数值)", desc: "绝对值" },
  { name: "SUMIF", signature: "SUMIF(区间, 条件, [求和区间])", desc: "条件求和" },
  { name: "COUNTIF", signature: "COUNTIF(区间, 条件)", desc: "条件计数" },
  { name: "IF", signature: "IF(条件, 真值, 假值)", desc: "条件判断" },
  { name: "AND", signature: "AND(条件…)", desc: "逻辑与" },
  { name: "OR", signature: "OR(条件…)", desc: "逻辑或" },
  { name: "NOT", signature: "NOT(条件)", desc: "逻辑非" },
  { name: "LEN", signature: "LEN(文本)", desc: "文本长度" },
  { name: "LEFT", signature: "LEFT(文本, 个数)", desc: "取左侧字符" },
  { name: "RIGHT", signature: "RIGHT(文本, 个数)", desc: "取右侧字符" },
  { name: "MID", signature: "MID(文本, 起始, 个数)", desc: "取中间字符" },
  { name: "CONCAT", signature: "CONCAT(文本…)", desc: "拼接文本" },
  { name: "UPPER", signature: "UPPER(文本)", desc: "转大写" },
  { name: "LOWER", signature: "LOWER(文本)", desc: "转小写" },
  { name: "TRIM", signature: "TRIM(文本)", desc: "去除首尾空格" },
  {
    name: "VLOOKUP",
    signature: "VLOOKUP(查找值, 区间, 列号, [精确])",
    desc: "垂直查找",
  },
  {
    name: "HLOOKUP",
    signature: "HLOOKUP(查找值, 区间, 行号, [精确])",
    desc: "水平查找",
  },
  { name: "INDEX", signature: "INDEX(区间, 行号, [列号])", desc: "按位置取值" },
  {
    name: "MATCH",
    signature: "MATCH(查找值, 区间, [匹配类型])",
    desc: "查找位置",
  },
];

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

// SUMIF/COUNTIF 条件匹配：支持数值/文本相等，以及 ">10" "<=5" "<>x" 等比较串
function matchCriteria(cell: CellValue, criteria: CellValue): boolean {
  if (typeof criteria === "string") {
    const m = /^(<=|>=|<>|<|>|=)?\s*(.*)$/.exec(criteria.trim());
    if (m && m[1]) {
      const op = m[1];
      const rhs = m[2];
      const rn = parseFloat(rhs);
      if (!isNaN(rn)) {
        const cn = toNumber(cell);
        switch (op) {
          case ">":
            return cn > rn;
          case "<":
            return cn < rn;
          case ">=":
            return cn >= rn;
          case "<=":
            return cn <= rn;
          case "=":
            return cn === rn;
          case "<>":
            return cn !== rn;
        }
      }
      const cs = String(cell);
      if (op === "=") return cs === rhs;
      if (op === "<>") return cs !== rhs;
    }
  }
  // 无操作符：直接相等比较（数值优先）
  const cn = parseFloat(String(criteria));
  if (!isNaN(cn)) return toNumber(cell) === cn;
  return String(cell) === String(criteria);
}

// 计算区间的行列边界（0 基）。keys 形如 "行:列"，返回 null 表示无有效单元格
function rangeGeometry(
  keys: string[]
): { rlo: number; rhi: number; clo: number; chi: number } | null {
  let rlo = Infinity;
  let rhi = -Infinity;
  let clo = Infinity;
  let chi = -Infinity;
  for (const k of keys) {
    const [rs, cs] = k.split(":");
    const r = parseInt(rs, 10);
    const c = parseInt(cs, 10);
    if (isNaN(r) || isNaN(c)) continue;
    if (r < rlo) rlo = r;
    if (r > rhi) rhi = r;
    if (c < clo) clo = c;
    if (c > chi) chi = c;
  }
  if (rlo === Infinity) return null;
  return { rlo, rhi, clo, chi };
}

// 宽松相等：两者可转为相同数值则按数值比较，否则按字符串（忽略大小写）比较
function looseEqual(a: CellValue, b: CellValue): boolean {
  const an = parseFloat(String(a));
  const bn = parseFloat(String(b));
  if (
    !isNaN(an) &&
    !isNaN(bn) &&
    String(an) === String(a).trim() &&
    String(bn) === String(b).trim()
  ) {
    return an === bn;
  }
  return String(a).toLowerCase() === String(b).toLowerCase();
}

// 大小比较：数值优先，否则字符串比较。返回负/零/正
function compareValues(a: CellValue, b: CellValue): number {
  const an = parseFloat(String(a));
  const bn = parseFloat(String(b));
  if (
    !isNaN(an) &&
    !isNaN(bn) &&
    String(an) === String(a).trim() &&
    String(bn) === String(b).trim()
  ) {
    return an - bn;
  }
  const as = String(a);
  const bs = String(b);
  return as < bs ? -1 : as > bs ? 1 : 0;
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
        case "COUNTA": {
          let cnt = 0;
          node.args.forEach((n) => {
            if (n.kind === "range") {
              n.keys.forEach((k) => {
                const v = resolve(k);
                if (v !== "" && v !== undefined) cnt++;
              });
            } else {
              const v = evalNode(n, resolve);
              if (v !== "") cnt++;
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
        case "ROUNDUP": {
          const val = toNumber(evalNode(node.args[0], resolve));
          const digits = node.args[1]
            ? toNumber(evalNode(node.args[1], resolve))
            : 0;
          const f = Math.pow(10, digits);
          return (val < 0 ? -1 : 1) * Math.ceil(Math.abs(val) * f) / f;
        }
        case "ROUNDDOWN": {
          const val = toNumber(evalNode(node.args[0], resolve));
          const digits = node.args[1]
            ? toNumber(evalNode(node.args[1], resolve))
            : 0;
          const f = Math.pow(10, digits);
          return (val < 0 ? -1 : 1) * Math.floor(Math.abs(val) * f) / f;
        }
        case "INT":
          return Math.floor(toNumber(evalNode(node.args[0], resolve)));
        case "MOD": {
          const a = toNumber(evalNode(node.args[0], resolve));
          const b = toNumber(evalNode(node.args[1], resolve));
          if (b === 0) throw new Error("#DIV/0!");
          return a - b * Math.floor(a / b);
        }
        case "POWER":
          return Math.pow(
            toNumber(evalNode(node.args[0], resolve)),
            toNumber(evalNode(node.args[1], resolve))
          );
        case "SQRT": {
          const v = toNumber(evalNode(node.args[0], resolve));
          if (v < 0) throw new Error("#NUM!");
          return Math.sqrt(v);
        }
        case "ABS":
          return Math.abs(toNumber(evalNode(node.args[0], resolve)));
        case "SUMIF": {
          const rangeNode = node.args[0];
          if (rangeNode?.kind !== "range") throw new Error("#VALUE!");
          const criteria = evalNode(node.args[1], resolve);
          const sumNode = node.args[2];
          const sumKeys =
            sumNode?.kind === "range" ? sumNode.keys : rangeNode.keys;
          let total = 0;
          rangeNode.keys.forEach((k, idx) => {
            if (matchCriteria(resolve(k), criteria)) {
              const sk = sumKeys[idx];
              if (sk !== undefined) total += toNumber(resolve(sk));
            }
          });
          return total;
        }
        case "COUNTIF": {
          const rangeNode = node.args[0];
          if (rangeNode?.kind !== "range") throw new Error("#VALUE!");
          const criteria = evalNode(node.args[1], resolve);
          let cnt = 0;
          rangeNode.keys.forEach((k) => {
            if (matchCriteria(resolve(k), criteria)) cnt++;
          });
          return cnt;
        }
        case "IF": {
          const cond = toNumber(evalNode(node.args[0], resolve));
          return cond !== 0
            ? evalNode(node.args[1], resolve)
            : node.args[2]
              ? evalNode(node.args[2], resolve)
              : 0;
        }
        case "AND":
          return node.args.every(
            (a) => toNumber(evalNode(a, resolve)) !== 0
          )
            ? 1
            : 0;
        case "OR":
          return node.args.some((a) => toNumber(evalNode(a, resolve)) !== 0)
            ? 1
            : 0;
        case "NOT":
          return toNumber(evalNode(node.args[0], resolve)) === 0 ? 1 : 0;
        case "LEN":
          return String(evalNode(node.args[0], resolve)).length;
        case "LEFT": {
          const s = String(evalNode(node.args[0], resolve));
          const n = node.args[1]
            ? toNumber(evalNode(node.args[1], resolve))
            : 1;
          return s.slice(0, Math.max(0, n));
        }
        case "RIGHT": {
          const s = String(evalNode(node.args[0], resolve));
          const n = node.args[1]
            ? toNumber(evalNode(node.args[1], resolve))
            : 1;
          return n <= 0 ? "" : s.slice(-n);
        }
        case "MID": {
          const s = String(evalNode(node.args[0], resolve));
          const start = toNumber(evalNode(node.args[1], resolve));
          const len = toNumber(evalNode(node.args[2], resolve));
          return s.slice(Math.max(0, start - 1), Math.max(0, start - 1) + Math.max(0, len));
        }
        case "CONCAT": {
          let out = "";
          node.args.forEach((n) => {
            if (n.kind === "range") {
              n.keys.forEach((k) => {
                const v = resolve(k);
                if (v !== "" && v !== undefined) out += String(v);
              });
            } else {
              out += String(evalNode(n, resolve));
            }
          });
          return out;
        }
        case "UPPER":
          return String(evalNode(node.args[0], resolve)).toUpperCase();
        case "LOWER":
          return String(evalNode(node.args[0], resolve)).toLowerCase();
        case "TRIM":
          return String(evalNode(node.args[0], resolve)).trim();
        case "VLOOKUP":
        case "HLOOKUP": {
          const rangeNode = node.args[1];
          if (rangeNode?.kind !== "range") throw new Error("#VALUE!");
          const geo = rangeGeometry(rangeNode.keys);
          if (!geo) throw new Error("#REF!");
          const lookup = evalNode(node.args[0], resolve);
          const idx = toNumber(evalNode(node.args[2], resolve));
          // 第四参数：TRUE/非 0 近似匹配，默认精确匹配
          const approx = node.args[3]
            ? toNumber(evalNode(node.args[3], resolve)) !== 0
            : false;
          const horizontal = node.name === "HLOOKUP";
          // 查找序列：VLOOKUP 用首列，HLOOKUP 用首行
          const line = horizontal
            ? Array.from({ length: geo.chi - geo.clo + 1 }, (_, i) => geo.clo + i)
            : Array.from({ length: geo.rhi - geo.rlo + 1 }, (_, i) => geo.rlo + i);
          const cellAt = (r: number, c: number) => resolve(`${r}:${c}`);
          let hitPos = -1;
          for (let i = 0; i < line.length; i++) {
            const v = horizontal
              ? cellAt(geo.rlo, line[i])
              : cellAt(line[i], geo.clo);
            if (approx) {
              if (compareValues(v, lookup) <= 0) hitPos = i;
              else break;
            } else if (looseEqual(v, lookup)) {
              hitPos = i;
              break;
            }
          }
          if (hitPos < 0) throw new Error("#N/A");
          if (idx < 1) throw new Error("#VALUE!");
          return horizontal
            ? cellAt(geo.rlo + idx - 1, line[hitPos])
            : cellAt(line[hitPos], geo.clo + idx - 1);
        }
        case "INDEX": {
          const rangeNode = node.args[0];
          if (rangeNode?.kind !== "range") throw new Error("#VALUE!");
          const geo = rangeGeometry(rangeNode.keys);
          if (!geo) throw new Error("#REF!");
          const rows = geo.rhi - geo.rlo + 1;
          const rowArg = toNumber(evalNode(node.args[1], resolve));
          const colArg = node.args[2]
            ? toNumber(evalNode(node.args[2], resolve))
            : 0;
          let rr: number;
          let cc: number;
          // 单行/单列区间允许只传一个位置参数
          if (!node.args[2]) {
            if (rows === 1) {
              rr = geo.rlo;
              cc = geo.clo + rowArg - 1;
            } else {
              rr = geo.rlo + rowArg - 1;
              cc = geo.clo;
            }
          } else {
            rr = geo.rlo + rowArg - 1;
            cc = geo.clo + colArg - 1;
          }
          if (rr < geo.rlo || rr > geo.rhi || cc < geo.clo || cc > geo.chi)
            throw new Error("#REF!");
          return resolve(`${rr}:${cc}`);
        }
        case "MATCH": {
          const rangeNode = node.args[1];
          if (rangeNode?.kind !== "range") throw new Error("#VALUE!");
          const geo = rangeGeometry(rangeNode.keys);
          if (!geo) throw new Error("#REF!");
          const lookup = evalNode(node.args[0], resolve);
          // 匹配类型：0 精确；1(默认) 小于等于的最大值；-1 大于等于的最小值
          const mType = node.args[2]
            ? toNumber(evalNode(node.args[2], resolve))
            : 1;
          const horizontal = geo.rhi === geo.rlo;
          const seq = horizontal
            ? Array.from({ length: geo.chi - geo.clo + 1 }, (_, i) => resolve(`${geo.rlo}:${geo.clo + i}`))
            : Array.from({ length: geo.rhi - geo.rlo + 1 }, (_, i) => resolve(`${geo.rlo + i}:${geo.clo}`));
          let pos = -1;
          if (mType === 0) {
            pos = seq.findIndex((v) => looseEqual(v, lookup));
          } else if (mType === 1) {
            for (let i = 0; i < seq.length; i++) {
              if (compareValues(seq[i], lookup) <= 0) pos = i;
              else break;
            }
          } else {
            for (let i = 0; i < seq.length; i++) {
              if (compareValues(seq[i], lookup) >= 0) pos = i;
              else break;
            }
          }
          if (pos < 0) throw new Error("#N/A");
          return pos + 1;
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


