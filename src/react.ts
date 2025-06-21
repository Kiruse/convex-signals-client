import type { ArgsAndOptions, FunctionReference } from 'convex/server';
import type { ConvexSignalsClient, QueryOptions } from './client';
import { useEffect, useMemo } from 'react';

export function useQuery<T extends FunctionReference<"query">>(client: ConvexSignalsClient, query: T, ...args: ArgsAndOptions<T, QueryOptions>) {
  const signal = useMemo(() => client.querySignal(query, ...args), [client, query, ...args]);
  useEffect(() => {
    return () => signal.destroy();
  }, [signal]);
  return signal.value;
}

export function useComputedQuery<T extends FunctionReference<"query">>(client: ConvexSignalsClient, query: T, factory: () => ArgsAndOptions<T, QueryOptions>) {
  const signal = useMemo(() => client.queryComputed(query, factory), [client, query]);
  useEffect(() => {
    return () => signal.destroy();
  }, [signal]);
  return signal.value;
}
