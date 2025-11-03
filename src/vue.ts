import { computed, effect, ref, stop } from 'vue';
import { ConvexSignalsClient } from './client.js';

/** Specialized `ConvexSignalsClient` using Vue 3 `ref`s & `computed`s. */
export class VueConvexSignalsClient extends ConvexSignalsClient {
  constructor(baseUrl: string) {
    super(baseUrl, {
      signal: <T>(value?: T) => {
        const r = ref(value);
        return {
          get value() {
            return r.value;
          },
          set value(value: T) {
            r.value = value;
          },
          subscribe(fn: (value: T) => void) {
            const f = effect(() => {
              fn(r.value);
            });
            return () => {
              stop(f);
            };
          },
        };
      },
      computed: <T>(fn: () => T) => {
        const c = computed(fn);
        return {
          get value() {
            return c.value;
          },
          subscribe(fn: (value: T) => void) {
            const f = effect(() => {
              fn(c.value);
            });
            return () => {
              stop(f);
            };
          },
        };
      },
    });
  }
}
