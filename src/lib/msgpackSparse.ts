/**
 * Minimal, memory-efficient MessagePack reader for the sparse expression matrix.
 *
 * The packed format is a map of `gene -> [[cellIndex, value], ...]`.
 * A generic decoder would first materialise millions of small JS arrays
 * (several GB of heap for a ~350 MB payload). This reader walks the bytes
 * directly and writes each gene's entries straight into typed arrays, so peak
 * memory stays close to the size of the packed data.
 */

export interface SparseGene {
  indices: Int32Array;
  values: Float32Array;
}

const textDecoder = new TextDecoder();

class Reader {
  private view: DataView;
  private pos = 0;

  constructor(private bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  get offset(): number {
    return this.pos;
  }

  private u8(): number {
    return this.view.getUint8(this.pos++);
  }

  /** Reads a map header and returns the number of key/value pairs. */
  readMapLength(): number {
    const b = this.u8();
    if (b >= 0x80 && b <= 0x8f) return b & 0x0f;
    if (b === 0xde) {
      const n = this.view.getUint16(this.pos);
      this.pos += 2;
      return n;
    }
    if (b === 0xdf) {
      const n = this.view.getUint32(this.pos);
      this.pos += 4;
      return n;
    }
    throw new Error(`Expected msgpack map at byte ${this.pos - 1} (got 0x${b.toString(16)})`);
  }

  /** Reads an array header and returns its length. */
  readArrayLength(): number {
    const b = this.u8();
    if (b >= 0x90 && b <= 0x9f) return b & 0x0f;
    if (b === 0xdc) {
      const n = this.view.getUint16(this.pos);
      this.pos += 2;
      return n;
    }
    if (b === 0xdd) {
      const n = this.view.getUint32(this.pos);
      this.pos += 4;
      return n;
    }
    throw new Error(`Expected msgpack array at byte ${this.pos - 1} (got 0x${b.toString(16)})`);
  }

  readString(): string {
    const b = this.u8();
    let len: number;
    if (b >= 0xa0 && b <= 0xbf) {
      len = b & 0x1f;
    } else if (b === 0xd9) {
      len = this.u8();
    } else if (b === 0xda) {
      len = this.view.getUint16(this.pos);
      this.pos += 2;
    } else if (b === 0xdb) {
      len = this.view.getUint32(this.pos);
      this.pos += 4;
    } else {
      throw new Error(`Expected msgpack string at byte ${this.pos - 1} (got 0x${b.toString(16)})`);
    }
    const start = this.pos;
    this.pos += len;
    return textDecoder.decode(this.bytes.subarray(start, start + len));
  }

  /** Reads any numeric scalar (int or float). */
  readNumber(): number {
    const b = this.u8();
    if (b <= 0x7f) return b; // positive fixint
    if (b >= 0xe0) return b - 0x100; // negative fixint
    switch (b) {
      case 0xcc:
        return this.u8();
      case 0xcd: {
        const v = this.view.getUint16(this.pos);
        this.pos += 2;
        return v;
      }
      case 0xce: {
        const v = this.view.getUint32(this.pos);
        this.pos += 4;
        return v;
      }
      case 0xcf: {
        const v = Number(this.view.getBigUint64(this.pos));
        this.pos += 8;
        return v;
      }
      case 0xd0: {
        const v = this.view.getInt8(this.pos);
        this.pos += 1;
        return v;
      }
      case 0xd1: {
        const v = this.view.getInt16(this.pos);
        this.pos += 2;
        return v;
      }
      case 0xd2: {
        const v = this.view.getInt32(this.pos);
        this.pos += 4;
        return v;
      }
      case 0xd3: {
        const v = Number(this.view.getBigInt64(this.pos));
        this.pos += 8;
        return v;
      }
      case 0xca: {
        const v = this.view.getFloat32(this.pos);
        this.pos += 4;
        return v;
      }
      case 0xcb: {
        const v = this.view.getFloat64(this.pos);
        this.pos += 8;
        return v;
      }
      case 0xc0:
        return 0; // nil
      case 0xc2:
        return 0;
      case 0xc3:
        return 1;
      default:
        throw new Error(`Expected msgpack number at byte ${this.pos - 1} (got 0x${b.toString(16)})`);
    }
  }
}

/**
 * Parse `gene -> [[cellIndex, value], ...]` into typed arrays per gene.
 * `onProgress` receives a 0-1 fraction of bytes consumed.
 */
export function parseSparseExpression(
  bytes: Uint8Array,
  onProgress?: (fraction: number) => void
): Map<string, SparseGene> {
  const reader = new Reader(bytes);
  const geneCount = reader.readMapLength();
  const result = new Map<string, SparseGene>();
  const total = bytes.byteLength || 1;

  for (let g = 0; g < geneCount; g++) {
    const gene = reader.readString();
    const entryCount = reader.readArrayLength();
    const indices = new Int32Array(entryCount);
    const values = new Float32Array(entryCount);

    for (let i = 0; i < entryCount; i++) {
      const pairLength = reader.readArrayLength();
      indices[i] = reader.readNumber();
      values[i] = reader.readNumber();
      // Tolerate longer tuples without breaking the stream position
      for (let extra = 2; extra < pairLength; extra++) reader.readNumber();
    }

    result.set(gene, { indices, values });

    if (onProgress && (g & 0x3ff) === 0) {
      onProgress(reader.offset / total);
    }
  }

  onProgress?.(1);
  return result;
}
