# convex-signals-client
An integration of [Convex](https://www.convex.dev/) with [Preact Signals](https://preactjs.com/guide/v10/signals) or [Vue](https://vuejs.org).

## Installation
Install using your favorite package manager's equivalent of:

```bash
$ npm install convex convex-signals-client @preact/signals
```

Currently, this package has a strict peer dependency on `@preact/signals`, though this will be fixed in v0.2. It still supports Vue through the `VueConvexSignalsClient`.

## Usage
```typescript
import { ConvexSignalsClient } from "convex-signals-client";
import { api } from "./convex/_generated/api";

const client = new ConvexSignalsClient(process.env.CONVEX_URL!);
const signal = client.querySignal(api.example.exampleQuery);

signal.subscribe((value) => {
  console.log(value);
});

const computed = client.queryComputed(api.example.exampleQuery, () => {
  // [args, options], as if you were calling `query`
  return [{ values: [1, 2, 3] }];
});

// sync waits for the signal to be first loaded from the server and returns its value.
// on subsequent calls, it resolves immediately with the locally cached value.
console.log(await computed.sync());

await client.query(api.example.exampleQuery, { values: [1, 2, 3] });
await client.mutation(api.example.exampleMutation, { values: [1, 2, 3] });
await client.action(api.example.exampleAction, { values: [1, 2, 3] });
```

*Convex Signals Client* creates a wrapper around both a Convex query and a Preact signal called `ConvexSignal`. This special signal exposes some additional properties:

```typescript
export interface ConvexSignal<Query extends FunctionReference<"query">> {
  get value(): FunctionReturnType<Query>;
  get isLoaded(): boolean;
  subscribe(fn: (value: FunctionReturnType<Query> | undefined) => void): (() => void);
  refresh(): void;
  destroy(): void;
}
```

- `value`: The current locally cached value of the query. Integrated with Convex's `onTransition` to update its value automatically.
- `isLoaded`: Reactive flag indicating if the query has been loaded from the server at least once. Once true, this flag should never revert back to false. Using this flag will, like `value`, hook into *Preact Signals'* reactivity system.
- `subscribe`: Subscribe to the signal.
- `refresh`: Manually refresh the signal value from the server.
- `destroy`: Manually unsubscribe the signal from the Convex query. The signal will no longer automatically update, but you may still be able to `refresh` it.

## Vue Integration
Vue provides its own signals. This library only really cares about the `value` property and the `subscribe` method, for which this library delivers a wrapper implementation:

```ts
import { VueConvexSignalsClient } from 'convex-signals-client/vue';
import { ref } from 'vue';
import { api } from '../convex/_generated';

// assuming a Nuxt environment, for example
const convex = new VueConvexSignalsClient(config.public.convexUrl || '');

// I typically use a vanity sessionId for reactive queries & cache invalidation
const sessionId = ref<string | undefined>();
const user = convex.queryComputed(api.users.me, () => [{ sessionId }]);
user.subscribe(usr => {
  console.log(usr);
});
```

Does not break Nuxt SSR, however, it is also not fully compatible and does not support hydration.

## React & Preact Hooks
Unlike the Vue integration, P/React integration is achieved through hooks, which are exposed by the two sub-modules `convex-signals-client/react` and `convex-signals-client/preact` respectively. React and Preact are peer dependencies. These modules both expose the `useQuery` and `useComputedQuery` hooks, which take a `ConvexSignalsClient` instance.

For React, you likely will use [@preact/signals-react](https://www.npmjs.com/package/@preact/signals-react), in which case you will either need the [@preact/signals-react-transformer](https://www.npmjs.com/package/@preact/signals-react-transformer) for Webpack, or the `useSignals()` hook expored from `@preact/signals-react/runtime` to make your components respond to signal changes.

## Authentication
Currently, Convex only supports OIDC. Following is my preferred setup:

```ts
const convex = new ConvexSignalsClient(convexUrl);

convex.setAuth(async () => {
  // fetch OIDC token
  return accessToken;
});

// isAuthenticated will be undefined aka "initial" while we are attempting to login
// once the authentication succeeded or failed, it will be true or false respectively
convex.authenticated.subscribe(isAuthenticated => {
  if (isAuthenticated === undefined) {
    sessionId.value = undefined;
  } else if (isAuthenticated) {
    sessionId.value = Date.now().toString(36).slice(2) + '-' + Math.random().toString(36).slice(2);
  }
});
```

## Caveats
Due to lack of direct resource management control, there are some edge cases to avoid bugs. This library is built under the assumption that you will generally use one of two patterns:

- Global signals: Keeping signals around indefinitely for the lifetime of your application. In this case, the signal will live forever.
- Subscribers: Using the `subscribe` method to keep your application in sync with the server. The final unsubscribe method called will also destroy the signal.

For other patterns, you may need to manually manage the signal's lifecycle by keeping a subscription active and/or calling `destroy` on it. I'll gladly accept PRs to improve the lifecycle management of the signals or to hook into garbage collection.

## License
The MIT License (MIT)
Copyright © 2025 Kiruse

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

