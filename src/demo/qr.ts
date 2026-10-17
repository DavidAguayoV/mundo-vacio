// Código QR mínimo, sin dependencias: modo byte, corrección de errores M, versiones 1 a 10 (hasta
// 213 bytes, de sobra para un enlace). Sigue la norma ISO/IEC 18004; la estructura es la de la
// implementación de referencia de Nayuki (dominio público en su versión didáctica).

/** Corrección M: palabras de corrección por bloque y cantidad de bloques, por versión (índice = versión). */
const ECC_PER_BLOCK = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const NUM_BLOCKS = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
const MAX_VERSION = 10;
/** bits de formato del nivel M */
const FORMAT_M = 0;

/** Módulos que quedan para datos y corrección en una versión (sin patrones fijos). */
function rawDataModules(ver: number): number {
  let n = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const align = Math.floor(ver / 7) + 2;
    n -= (25 * align - 10) * align - 55;
    if (ver >= 7) n -= 36;
  }
  return n;
}

const dataCodewords = (ver: number) => Math.floor(rawDataModules(ver) / 8) - ECC_PER_BLOCK[ver] * NUM_BLOCKS[ver];

// ---------- Reed-Solomon sobre GF(256), polinomio 0x11D ----------

function gfMul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function rsDivisor(degree: number): number[] {
  const out = new Array<number>(degree).fill(0);
  out[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < out.length; j++) {
      out[j] = gfMul(out[j], root);
      if (j + 1 < out.length) out[j] ^= out[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return out;
}

function rsRemainder(data: number[], divisor: number[]): number[] {
  const out = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ (out.shift() as number);
    out.push(0);
    divisor.forEach((d, i) => (out[i] ^= gfMul(d, factor)));
  }
  return out;
}

// ---------- la matriz ----------

class Matrix {
  readonly size: number;
  readonly dark: boolean[][];
  readonly fixed: boolean[][];

  constructor(readonly ver: number) {
    this.size = ver * 4 + 17;
    this.dark = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
    this.fixed = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
  }

  set(x: number, y: number, dark: boolean): void {
    this.dark[y][x] = dark;
    this.fixed[y][x] = true;
  }

  drawPatterns(): void {
    const n = this.size;
    for (let i = 0; i < n; i++) {
      this.set(6, i, i % 2 === 0);
      this.set(i, 6, i % 2 === 0);
    }
    this.finder(3, 3);
    this.finder(n - 4, 3);
    this.finder(3, n - 4);
    const pos = this.alignmentPositions();
    const last = pos.length - 1;
    pos.forEach((a, i) =>
      pos.forEach((b, j) => {
        if (!((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0))) this.alignment(a, b);
      }),
    );
    this.drawFormat(0);
    this.drawVersion();
  }

  private finder(x: number, y: number): void {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        const xx = x + dx;
        const yy = y + dy;
        if (xx >= 0 && xx < this.size && yy >= 0 && yy < this.size) this.set(xx, yy, d !== 2 && d !== 4);
      }
  }

  private alignment(x: number, y: number): void {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) this.set(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }

  private alignmentPositions(): number[] {
    if (this.ver === 1) return [];
    const count = Math.floor(this.ver / 7) + 2;
    const step = Math.ceil((this.ver * 4 + 4) / (count * 2 - 2)) * 2;
    const out = [6];
    for (let p = this.size - 7; out.length < count; p -= step) out.splice(1, 0, p);
    return out;
  }

  drawFormat(mask: number): void {
    const data = (FORMAT_M << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    const bit = (i: number) => ((bits >>> i) & 1) !== 0;
    const n = this.size;
    for (let i = 0; i <= 5; i++) this.set(8, i, bit(i));
    this.set(8, 7, bit(6));
    this.set(8, 8, bit(7));
    this.set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) this.set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) this.set(n - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) this.set(8, n - 15 + i, bit(i));
    this.set(8, n - 8, true);
  }

  private drawVersion(): void {
    if (this.ver < 7) return;
    let rem = this.ver;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (this.ver << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >>> i) & 1) !== 0;
      const a = this.size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      this.set(a, b, dark);
      this.set(b, a, dark);
    }
  }

  drawCodewords(data: number[]): void {
    let i = 0;
    for (let right = this.size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < this.size; vert++)
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const up = ((right + 1) & 2) === 0;
          const y = up ? this.size - 1 - vert : vert;
          if (!this.fixed[y][x] && i < data.length * 8) {
            this.dark[y][x] = ((data[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0;
            i++;
          }
        }
    }
  }

  applyMask(mask: number): void {
    for (let y = 0; y < this.size; y++)
      for (let x = 0; x < this.size; x++) {
        if (this.fixed[y][x]) continue;
        let flip: boolean;
        switch (mask) {
          case 0: flip = (x + y) % 2 === 0; break;
          case 1: flip = y % 2 === 0; break;
          case 2: flip = x % 3 === 0; break;
          case 3: flip = (x + y) % 3 === 0; break;
          case 4: flip = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: flip = ((x * y) % 2) + ((x * y) % 3) === 0; break;
          case 6: flip = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
          default: flip = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
        }
        if (flip) this.dark[y][x] = !this.dark[y][x];
      }
  }

  /** Penalización de la norma: tramos largos, bloques 2×2, patrones parecidos al buscador y equilibrio. */
  penalty(): number {
    const n = this.size;
    let p = 0;
    const line = (get: (i: number) => boolean) => {
      let run = 1;
      for (let i = 1; i <= n; i++) {
        if (i < n && get(i) === get(i - 1)) run++;
        else {
          if (run >= 5) p += run - 2;
          run = 1;
        }
      }
      // 1:1:3:1:1 con margen claro de 4 a un lado
      for (let i = 0; i + 10 < n + 1; i++) {
        const pat = [true, false, true, true, true, false, true];
        const seq = (k: number) => pat.every((d, m) => get(k + m) === d);
        const light = (a: number, b: number) => {
          for (let k = a; k < b; k++) if (k >= 0 && k < n && get(k)) return false;
          return true;
        };
        if (i + 7 <= n && seq(i) && (light(i - 4, i) || light(i + 7, i + 11))) p += 40;
      }
    };
    for (let y = 0; y < n; y++) line((x) => this.dark[y][x]);
    for (let x = 0; x < n; x++) line((y) => this.dark[y][x]);
    for (let y = 0; y + 1 < n; y++)
      for (let x = 0; x + 1 < n; x++) {
        const c = this.dark[y][x];
        if (c === this.dark[y][x + 1] && c === this.dark[y + 1][x] && c === this.dark[y + 1][x + 1]) p += 3;
      }
    const darkCount = this.dark.reduce((s, row) => s + row.filter(Boolean).length, 0);
    const total = n * n;
    p += (Math.ceil(Math.abs(darkCount * 20 - total * 10) / total) - 1) * 10;
    return p;
  }
}

/** Datos más corrección, intercalados por bloques como pide la norma. */
function withEcc(data: number[], ver: number): number[] {
  const blocks = NUM_BLOCKS[ver];
  const eccLen = ECC_PER_BLOCK[ver];
  const raw = Math.floor(rawDataModules(ver) / 8);
  const shortBlocks = blocks - (raw % blocks);
  const shortLen = Math.floor(raw / blocks);
  const div = rsDivisor(eccLen);
  const all: number[][] = [];
  for (let i = 0, k = 0; i < blocks; i++) {
    const dat = data.slice(k, k + shortLen - eccLen + (i < shortBlocks ? 0 : 1));
    k += dat.length;
    const ecc = rsRemainder(dat, div);
    if (i < shortBlocks) dat.push(0);
    all.push([...dat, ...ecc]);
  }
  const out: number[] = [];
  for (let i = 0; i < all[0].length; i++)
    all.forEach((b, j) => {
      if (i !== shortLen - eccLen || j >= shortBlocks) out.push(b[i]);
    });
  return out;
}

/**
 * La matriz del código para un texto: true = módulo oscuro. `mask` fija la máscara (para los tests);
 * por defecto se elige la de menor penalización.
 */
export function qrMatrix(text: string, mask?: number): boolean[][] {
  const bytes = [...new TextEncoder().encode(text)];
  let ver = 1;
  const bitsFor = (v: number) => 4 + (v < 10 ? 8 : 16) + bytes.length * 8;
  while (ver <= MAX_VERSION && bitsFor(ver) > dataCodewords(ver) * 8) ver++;
  if (ver > MAX_VERSION) throw new Error('Texto demasiado largo para el código QR');
  const cap = dataCodewords(ver) * 8;
  const bits: number[] = [];
  const put = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };
  put(0b0100, 4);
  put(bytes.length, ver < 10 ? 8 : 16);
  bytes.forEach((b) => put(b, 8));
  put(0, Math.min(4, cap - bits.length));
  put(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) put(pad, 8);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));

  const m = new Matrix(ver);
  m.drawPatterns();
  m.drawCodewords(withEcc(data, ver));
  let best = mask ?? 0;
  if (mask === undefined) {
    let bestP = Infinity;
    for (let k = 0; k < 8; k++) {
      m.applyMask(k);
      m.drawFormat(k);
      const p = m.penalty();
      if (p < bestP) {
        bestP = p;
        best = k;
      }
      m.applyMask(k);
    }
  }
  m.applyMask(best);
  m.drawFormat(best);
  return m.dark;
}

/** El código como SVG en línea (con su margen claro de 4 módulos). */
export function qrSvg(text: string): string {
  const dark = qrMatrix(text);
  const n = dark.length;
  const q = 4;
  let d = '';
  dark.forEach((row, y) =>
    row.forEach((on, x) => {
      if (on) d += `M${x + q} ${y + q}h1v1h-1z`;
    }),
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n + 2 * q} ${n + 2 * q}" shape-rendering="crispEdges" role="img" aria-label="Código QR de la demo"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
