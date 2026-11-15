// Block format: https://github.com/google/snappy/blob/main/format_description.txt

const readLittleEndian = (input: Uint8Array, offset: number, width: number): number => {
  if (offset + width > input.length) {
    throw new Error("truncated input");
  }
  let value = 0;
  for (let index = 0; index < width; index++) {
    value += input[offset + index] * 2 ** (8 * index);
  }
  return value;
};

export const uncompress = (input: Uint8Array): Uint8Array => {
  let cursor = 0;
  const nextByte = (): number => {
    if (cursor === input.length) {
      throw new Error("truncated input");
    }
    return input[cursor++];
  };

  let length = 0;
  for (let width = 0; ; width++) {
    const value = nextByte();
    if (width === 4 && value >= 16) {
      throw new Error("the uncompressed length is not a 32-bit varint");
    }
    length += (value & 0x7f) * 2 ** (7 * width);
    if (value < 0x80) {
      break;
    }
  }

  const output = new Uint8Array(length);
  let written = 0;
  while (cursor < input.length) {
    const tag = nextByte();
    const type = tag & 0x03;
    if (type === 0) {
      const code = tag >>> 2;
      // Codes 60..63 encode the literal length in 1..4 little-endian bytes.
      const literalLength = code < 60 ? code + 1 : readLittleEndian(input, cursor, code - 59) + 1;
      if (code >= 60) {
        cursor += code - 59;
      }
      if (cursor + literalLength > input.length) {
        throw new Error("truncated literal");
      }
      if (output.length - written < literalLength) {
        throw new Error("the literal exceeds the declared length");
      }
      output.set(input.subarray(cursor, cursor + literalLength), written);
      cursor += literalLength;
      written += literalLength;
    } else {
      const copyLength = type === 1 ? ((tag >>> 2) & 0x07) + 4 : (tag >>> 2) + 1;
      let offset: number;
      if (type === 1) {
        offset = ((tag >>> 5) << 8) | nextByte();
      } else {
        const width = type === 2 ? 2 : 4;
        offset = readLittleEndian(input, cursor, width);
        cursor += width;
      }
      if (offset === 0 || offset > written) {
        throw new Error("the copy offset points outside the decoded data");
      }
      if (output.length - written < copyLength) {
        throw new Error("the copy exceeds the declared length");
      }
      // A copy may overlap the bytes it produces, so it is written one byte at a time.
      for (let index = 0; index < copyLength; index++) {
        output[written + index] = output[written - offset + index];
      }
      written += copyLength;
    }
  }
  if (written !== output.length) {
    throw new Error(`the stream ended after ${written} of ${output.length} bytes`);
  }
  return output;
};
