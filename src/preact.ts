import type { ArgsAndOptions, FunctionReference } from 'convex/server';
import { useMemo } from 'preact/hooks';
import type { ConvexSignalsClient, QueryOptions } from './client.js';

export function useQuery<T extends FunctionReference<"query">>(client: ConvexSignalsClient, query: T, ...args: ArgsAndOptions<T, QueryOptions>) {
  return useMemo(() => client.querySignal(query, ...args), [client, query, ...args]);
}

export function useComputedQuery<T extends FunctionReference<"query">>(client: ConvexSignalsClient, query: T, factory: () => ArgsAndOptions<T, QueryOptions>) {
  return useMemo(() => client.queryComputed(query, factory), [client, query]);
}
