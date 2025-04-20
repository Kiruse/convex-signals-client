import { computed, signal } from '@preact/signals';
import { BaseConvexClient, type MutationOptions, type QueryToken } from 'convex/browser';
import type { ArgsAndOptions, FunctionReturnType } from 'convex/server';
import { getFunctionName } from 'convex/server';
import type { FunctionReference } from 'convex/server';

const IsLoaded = Symbol('IsLoaded');

export interface QuerySignalOptions {}

export interface QueryOptions {
  /** Maximum time to wait before rejecting the promise. Defaults to 10 seconds. */
  timeout?: number;
}

/** A `ConvexSignal` is a readonly signal integrating with Convex reactive queries. */
export interface ConvexSignal<Query extends FunctionReference<"query">> {
  get value(): FunctionReturnType<Query>;
  get isLoaded(): boolean;
  subscribe(fn: (value: FunctionReturnType<Query> | undefined) => void): (() => void);
  /** Refreshes the signal value from the underlying state. Called automatically by the client. You only need `value` or `subscribe` to use the signal.zs */
  refresh(): void;
  /** Unsubscribe from the underlying Convex query. The signal will no longer update. */
  destroy(): void;
  /** Waits until the signal has been first loaded from the server and returns its value. */
  sync(): Promise<FunctionReturnType<Query>>;
}

export class ConvexSignalsClient {
  #client: BaseConvexClient;
  #signals = new Map<QueryToken, ConvexSignal<any>>();

  constructor(baseUrl: string) {
    this.#client = new BaseConvexClient(
      baseUrl,
      this.#onTransition,
      {},
    );
  }

  #onTransition = (updatedQueries: QueryToken[]) => {
    for (const queryToken of updatedQueries) {
      const signal = this.#signals.get(queryToken);
      if (signal) {
        (signal as any)[IsLoaded] = true;
        signal.refresh();
      }
    }
  };

  action<Action extends FunctionReference<"action">>(
    action: Action,
    ...argsAndOptions: ArgsAndOptions<Action, {}>
  ): Promise<FunctionReturnType<Action>> {
    return this.#client.action(getFunctionName(action), ...argsAndOptions);
  }

  /** Create a reactive signal from a static Convex query. */
  querySignal<Query extends FunctionReference<"query">>(
    query: Query,
    ...argsAndOptions: ArgsAndOptions<Query, QuerySignalOptions>
  ): ConvexSignal<Query> {
    const name = getFunctionName(query);
    const [args, options] = argsAndOptions;
    const { queryToken, unsubscribe } = this.#client.subscribe(name, args, options);

    if (this.#signals.has(queryToken)) {
      unsubscribe();
      return this.#signals.get(queryToken)!;
    }

    const sig = signal<FunctionReturnType<Query>>();
    let counter = 0;
    const result = {
      // note: this field is updated in the #onTransition callback
      [IsLoaded]: false,
      get value() {
        return sig.value;
      },
      get isLoaded() {
        // force hooking into effects & computed signals so that `isLoaded` can be used as condition
        // for `value`.
        sig.value;
        return this[IsLoaded];
      },
      subscribe: (fn: (value: FunctionReturnType<Query> | undefined) => void) => {
        counter++;
        const unsub = sig.subscribe(fn);
        return () => {
          unsub();
          if (--counter === 0) {
            unsubscribe();
            this.#signals.delete(queryToken);
          }
        };
      },
      refresh: () => {
        sig.value = this.#client.localQueryResult(name, args);
      },
      destroy: () => {
        this.#signals.delete(queryToken);
        unsubscribe();
      },
      sync(timeout = 10000) {
        return new Promise((resolve, reject) => {
          var timer = setTimeout(() => {
            reject(new Error('Query timed out'));
            unsub?.();
          }, timeout);
          var unsub = sig.subscribe((value) => {
            if (this.isLoaded) {
              resolve(value);
              unsub?.();
              clearTimeout(timer);
            }
          });
        });
      },
    };
    this.#signals.set(queryToken, result);
    return result;
  }

  /** Create a reactive signal from a Convex query responding to signal changes. */
  queryComputed<Query extends FunctionReference<"query">>(
    query: Query,
    fnArgsAndOptions: () => ArgsAndOptions<Query, QueryOptions>
  ): ConvexSignal<Query> {
    const sig = computed(() => {
      return this.querySignal(query, ...fnArgsAndOptions());
    });
    return {
      get value() {
        return sig.value.value;
      },
      get isLoaded() {
        return sig.value.isLoaded;
      },
      refresh: () => sig.value.refresh(),
      subscribe: (fn: (value: FunctionReturnType<Query> | undefined) => void) => sig.value.subscribe(fn),
      destroy: () => sig.value.destroy(),
      sync: () => sig.value.sync(),
    }
  }

  query<Query extends FunctionReference<"query">>(
    query: Query,
    ...argsAndOptions: ArgsAndOptions<Query, QueryOptions>
  ): Promise<FunctionReturnType<Query>> {
    const [args, options] = argsAndOptions;
    const signal = this.querySignal(query, args, options);
    return new Promise<FunctionReturnType<Query>>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Query timed out')), options?.timeout ?? 10000);
      const unsub = signal.subscribe((value) => {
        if (!signal.isLoaded) return;
        clearTimeout(timer);
        resolve(value);
        unsub();
      });
    })
  }

  mutation<Mutation extends FunctionReference<"mutation">>(
    mutation: Mutation,
    ...argsAndOptions: ArgsAndOptions<Mutation, MutationOptions>
  ): Promise<FunctionReturnType<Mutation>> {
    const name = getFunctionName(mutation);
    const [args, options] = argsAndOptions;
    return this.#client.mutation(name, args, options);
  }
}
