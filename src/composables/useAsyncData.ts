/**
 * Loads a large data file on demand. Screens call this for their scene recordings, so the recordings
 * are split into their own chunks and only downloaded when a screen that needs them is opened.
 */
import { markRaw, onMounted, shallowRef } from 'vue';

/**
 * Starts loading a JSON module when the component mounts.
 * @param load A dynamic import of the JSON file.
 * @returns A ref that holds the data once it arrives (null until then). The data is marked raw,
 *          because recordings never change and deep reactivity on thousands of numbers would be wasted work.
 */
export function useAsyncData<T>(load: () => Promise<{ default: unknown }>) {
  const data = shallowRef<T | null>(null);
  onMounted(async () => {
    const module = await load();
    data.value = markRaw(module.default as object) as T;
  });
  return data;
}
