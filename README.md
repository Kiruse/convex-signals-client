# convex-signals-client
An integration of [Convex](https://www.convex.dev/) with [Preact Signals](https://preactjs.com/guide/v10/signals).

## Installation
Install using your favorite package manager's equivalent of:

```bash
$ npm install convex @preact/signals convex-signals-client
```

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

