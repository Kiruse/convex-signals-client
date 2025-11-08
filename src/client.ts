import { computed, signal } from '@preact/signals';
import { BaseConvexClient, type MutationOptions, type QueryToken } from 'convex/browser';
import type { AuthTokenFetcher } from 'convex/react';
import { getFunctionName, type ArgsAndOptions, type FunctionReference, type FunctionReturnType } from 'convex/server';

const IsLoaded = Symbol('IsLoaded');

export interface SignalFactory {
  <T>(): Signalish<T | undefined, true>;
  <T>(value: T): Signalish<T, true>;
}

export interface ComputedFactory {
  <T>(fn: () => T): Signalish<T, false>;
}

export type Signalish<T, Writable extends boolean = true> =
  Writable extends true
  ? {
      value: T;
      subscribe: (fn: (value: T) => void) => () => void;
    }
  : {
      readonly value: T;
      subscribe: (fn: (value: T) => void) => () => void;
    };

export interface ConvexSignalsClientOptions {
  signal?: SignalFactory;
  computed?: ComputedFactory;
}

export interface QuerySignalOptions {}

export interface QueryOptions {
  /** Maximum time to wait before rejecting the promise. Defaults to 10 seconds. */
  timeout?: number;
}

type FinalizeEntry = [QueryToken, () => void];

/** A `ConvexSignal` is a readonly signal integrating with Convex reactive queries. */
export interface ConvexSignal<Query extends FunctionReference<"query">> {
  get value(): FunctionReturnType<Query>;
  get isLoaded(): boolean;
  subscribe(fn: (value: FunctionReturnType<Query> | undefined) => void): (() => void);
  /** Refreshes the signal value from the underlying state. Called automatically by the client. You only need `value` or `subscribe` to use the signal.zs */
  refresh(): void;
  /** Waits until the signal has been first loaded from the server and returns its value. */
  sync(): Promise<FunctionReturnType<Query>>;
}

/**
 * The framework-agnostic convex signals client.
 */
export class ConvexSignalsClient {
  #client: BaseConvexClient;
  #signals = new Map<QueryToken, ConvexSignal<any>>();
  #authenticated: Signalish<boolean | undefined, true>;
  #signal: SignalFactory;
  #computed: ComputedFactory;
  #finalizeRegistry = new FinalizationRegistry<FinalizeEntry>(this.#onFinalize.bind(this));

  constructor(baseUrl: string, options: ConvexSignalsClientOptions = {}) {
    this.#client = new BaseConvexClient(
      baseUrl,
      this.#onTransition,
      {},
    );
    this.#signal = options.signal ?? signal;
    this.#computed = options.computed ?? computed;
    this.#authenticated = this.#signal();
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

  #onFinalize([queryToken, unsub]: FinalizeEntry) {
    unsub();
    this.#signals.delete(queryToken);
  }

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

    const sig = this.#signal<FunctionReturnType<Query>>();
    const result: any = Object.assign(sig, {
      // note: this field is updated in the #onTransition callback
      [IsLoaded]: false,

      refresh: () => {
        sig.value = this.#client.localQueryResult(name, args);
      },

      sync(this: any, timeout = 10000) {
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
    });

    Object.defineProperty(result, 'isLoaded', {
      get: () => result[IsLoaded],
    });

    this.#signals.set(queryToken, result);
    this.#finalizeRegistry.register(result, [queryToken, unsubscribe]);
    return result;
  }

  /** Create a reactive signal from a Convex query responding to signal changes. */
  queryComputed<Query extends FunctionReference<"query">>(
    query: Query,
    fnArgsAndOptions: () => ArgsAndOptions<Query, QueryOptions>
  ): ConvexSignal<Query> {
    const querySig = this.#computed(() => {
      return this.querySignal(query, ...fnArgsAndOptions());
    });

    const baseSig = this.#computed(() => querySig.value.value);

    const resultSig: any = Object.assign(baseSig, {
      refresh: () => querySig.value.refresh(),
      sync: () => querySig.value.sync(),
    });

    Object.defineProperty(resultSig, 'isLoaded', {
      get: () => (querySig.value as any)[IsLoaded],
    });

    return resultSig;
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

  /** Set the auth token fetcher to be used for subsequent queries and mutations. Should return
   * `null` if the token cannot be retrieved, for example when the user's rights were permanently
   * revoked. Otherwise, the token should be a JWT-encoded OpenID Connect Identity Token.
   * @see BaseConvexClient.setAuth
   */
  setAuth(fetcher: AuthTokenFetcher) {
    this.#authenticated.value = undefined;
    this.#client.setAuth(fetcher, (authenticated) => {
      this.#authenticated.value = authenticated;
    });
    return this;
  }

  clearAuth() {
    this.#client.clearAuth();
    return this;
  }

  /** A signal storing whether the client is currently authenticated. */
  get authenticated() {
    return this.#authenticated as Signalish<boolean | undefined, false>;
  }
}
