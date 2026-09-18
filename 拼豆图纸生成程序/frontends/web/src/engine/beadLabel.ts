/** Return the official bead code, falling back to a visible placeholder. */
export function colorLabel(
  color: { code?: string } | undefined,
  index: number
): string {
  return color?.code?.trim() || `#${index + 1}`;
}

/** Draw a bead label that shrinks until it fits inside the bead. */
export function drawBeadLabel(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  beadSize: number,
  color: string
): void {
  const maxWidth = Math.max(8, beadSize - 2);
  let size = Math.min(beadSize * 0.42, Math.max(6, beadSize * 0.34));
  const font = () => `${size.toFixed(2)}px 'SF Mono','Consolas',monospace`;

  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = font();
  while (size > 5 && ctx.measureText(text).width > maxWidth) {
    size -= 0.25;
    ctx.font = font();
  }
  if (ctx.measureText(text).width > maxWidth + 1) return;
  ctx.fillText(text, cx, cy);
}
