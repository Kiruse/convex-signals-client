import { computed, effect, ref, stop, type ComputedRef } from 'vue';
import { ConvexSignalsClient } from './client.js';
import type { FunctionReturnType, FunctionReference } from 'convex/server';

// Declaration merging to augment ConvexSignal with Vue ComputedRef for IDE integration
declare module './client.js' {
  interface ConvexSignal<
    Query extends FunctionReference<"query">,
  > extends ComputedRef<FunctionReturnType<Query>>
  {}
}

/** Specialized `ConvexSignalsClient` using Vue 3 `ref`s & `computed`s. */
export class VueConvexSignalsClient extends ConvexSignalsClient {
  constructor(baseUrl: string) {
    super(baseUrl, {
      signal: <T>(value?: T) => {
        const r = ref(value);
        return Object.assign(r, {
          subscribe(fn: (value: T) => void) {
            const f = effect(() => {
              fn(r.value);
            });
            return () => {
              stop(f);
            };
          },
        });
      },
      computed: <T>(fn: () => T) => {
        const c = computed(fn);
        return Object.assign(c, {
          subscribe(fn: (value: T) => void) {
            const f = effect(() => {
              fn(c.value);
            });
            return () => {
              stop(f);
            };
          },
        });
      },
    });
  }
}
