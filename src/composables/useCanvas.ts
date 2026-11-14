/**
 * Keeps a canvas's backing store matched to its on-screen size and the display's pixel density, so
 * drawings stay sharp on high-density screens and after resizes.
 */
import { onMounted, onScopeDispose, shallowRef, type Ref } from 'vue';

export interface CanvasSize {
  /** Backing store size in device pixels. */
  width: number;
  height: number;
  /** Device pixels per CSS pixel, capped at 2 to keep large canvases cheap. */
  dpr: number;
}

/**
 * Watches a canvas element and resizes its backing store when its CSS size changes.
 * @param canvas The canvas element ref.
 * @param onResize Called after each resize, so the owner can redraw immediately.
 * @returns The 2D context (once mounted) and the current size.
 */
export function useCanvas(canvas: Readonly<Ref<HTMLCanvasElement | null>>, onResize?: (size: CanvasSize) => void) {
  const context = shallowRef<CanvasRenderingContext2D | null>(null);
  const size = shallowRef<CanvasSize>({ width: 0, height: 0, dpr: 1 });

  const observer = new ResizeObserver(([entry]) => {
    const el = canvas.value;
    if (!entry || !el) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(entry.contentRect.width * dpr);
    const height = Math.round(entry.contentRect.height * dpr);
    if (width === el.width && height === el.height) return;
    el.width = width;
    el.height = height;
    size.value = { width, height, dpr };
    onResize?.(size.value);
  });

  onMounted(() => {
    const el = canvas.value;
    if (!el) return;
    context.value = el.getContext('2d', { alpha: true });
    observer.observe(el);
  });
  onScopeDispose(() => observer.disconnect());

  return { context, size };
}
