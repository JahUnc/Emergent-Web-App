/**
 * Runs a requestAnimationFrame loop only while it can be seen.
 *
 * The loop pauses when its element scrolls out of view (IntersectionObserver), when the browser tab is
 * hidden (visibilitychange), and when the screen is cached but not shown (KeepAlive's deactivated hook).
 * A screen nobody is looking at costs nothing.
 */
import { onActivated, onDeactivated, onMounted, onScopeDispose, ref, type Ref } from 'vue';

/**
 * Starts a frame loop tied to an element's visibility.
 * @param target The element whose visibility controls the loop.
 * @param frame Called every frame with the current time in milliseconds.
 * @returns Whether the loop is running, and a way to draw one frame on demand while paused.
 */
export function useAnimationLoop(target: Readonly<Ref<HTMLElement | null>>, frame: (now: number) => void) {
  const running = ref(false);
  let inView = false;
  let active = true;
  let handle = 0;

  const tick = (now: number) => {
    frame(now);
    handle = requestAnimationFrame(tick);
  };

  const update = () => {
    const shouldRun = inView && active && document.visibilityState === 'visible';
    if (shouldRun && !running.value) {
      running.value = true;
      handle = requestAnimationFrame(tick);
    } else if (!shouldRun && running.value) {
      running.value = false;
      cancelAnimationFrame(handle);
    }
  };

  const observer = new IntersectionObserver((entries) => {
    inView = entries.some((e) => e.isIntersecting);
    update();
  });

  onMounted(() => {
    if (target.value) observer.observe(target.value);
  });
  onActivated(() => {
    active = true;
    update();
  });
  onDeactivated(() => {
    active = false;
    update();
  });
  document.addEventListener('visibilitychange', update);
  onScopeDispose(() => {
    observer.disconnect();
    document.removeEventListener('visibilitychange', update);
    cancelAnimationFrame(handle);
  });

  return {
    running,
    /** Draws one frame now, for paused loops that still need to show a change. */
    drawOnce: () => frame(performance.now()),
  };
}
