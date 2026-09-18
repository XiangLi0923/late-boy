import { deflate, inflate } from 'pako';

export interface ShareColor {
  n: string;
  c: string;
  h: string;
}

export interface SharePayload {
  v: 1;
  w: number;
  h: number;
  dt: number;
  pb: string;
  colors: ShareColor[];
  g: string;
}

export interface DecodedShare extends Omit<SharePayload, 'g'> {
  indices: Int32Array;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function encodeSharePayload(
  gridWidth: number,
  gridHeight: number,
  indices: Int32Array | number[],
  paletteBrand: string,
  colors: { name: string; code: string; hex: string }[],
  ditherMode: number
): string {
  const packed = new Uint8Array(indices.length * 2);
  for (let i = 0; i < indices.length; i++) {
    const idx = Number(indices[i]) || 0;
    packed[i * 2] = idx & 0xff;
    packed[i * 2 + 1] = (idx >> 8) & 0xff;
  }
  const compressed = deflate(packed, { level: 9 });
  const payload: SharePayload = {
    v: 1,
    w: gridWidth,
    h: gridHeight,
    dt: ditherMode,
    pb: paletteBrand,
    colors: colors.map((c) => ({ n: c.name || '', c: c.code || '', h: c.hex || '#000000' })),
    g: bytesToBase64Url(compressed),
  };
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
}

export function decodeSharePayload(code: string): DecodedShare | null {
  try {
    const json = new TextDecoder().decode(base64UrlToBytes(code));
    const payload = JSON.parse(json) as SharePayload;
    if (!payload || payload.v !== 1 || !Array.isArray(payload.colors)) return null;
    const packed = inflate(base64UrlToBytes(payload.g));
    const count = payload.w * payload.h;
    if (!count || packed.length < count * 2) return null;
    const indices = new Int32Array(count);
    for (let i = 0; i < count; i++) {
      indices[i] = packed[i * 2] | (packed[i * 2 + 1] << 8);
    }
    return {
      v: payload.v,
      w: payload.w,
      h: payload.h,
      dt: payload.dt || 0,
      pb: payload.pb || '',
      colors: payload.colors,
      indices,
    };
  } catch {
    return null;
  }
}
