import type { ArgsAndOptions, FunctionReference } from 'convex/server';
import { useEffect, useMemo } from 'react';
import type { ConvexSignalsClient, QueryOptions } from './client.js';

export function useQuery<T extends FunctionReference<"query">>(client: ConvexSignalsClient, query: T, ...args: ArgsAndOptions<T, QueryOptions>) {
  const signal = useMemo(() => client.querySignal(query, ...args), [client, query, ...args]);
  useEffect(() => {
    return () => signal.destroy();
  }, [signal]);
  return signal;
}

export function useComputedQuery<T extends FunctionReference<"query">>(client: ConvexSignalsClient, query: T, factory: () => ArgsAndOptions<T, QueryOptions>) {
  const signal = useMemo(() => client.queryComputed(query, factory), [client, query]);
  useEffect(() => {
    return () => signal.destroy();
  }, [signal]);
  return signal;
}
