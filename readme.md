# p-some

> Wait for a specified number of promises to be fulfilled

Useful when you need the fastest of multiple promises.

## Install

```sh
npm install p-some
```

## Usage

Checks 4 websites and logs the 2 fastest.

```js
import got from 'got';
import pSome from 'p-some';

const input = [
	got.head('github.com').then(() => 'github'),
	got.head('google.com').then(() => 'google'),
	got.head('twitter.com').then(() => 'twitter'),
	got.head('medium.com').then(() => 'medium')
];

const [first, second] = await pSome(input, {count: 2});

console.log(first, second);
//=> 'google twitter'
```

## API

### pSome(input, options)

Returns a `Promise` that is fulfilled when `count` promises from `input` are fulfilled. The fulfilled value is an `Array` of the values from the `input` promises in the order they were fulfilled. If it becomes impossible to satisfy `count`, for example, too many promises rejected, it will reject with an `AggregateError`. The promise can be aborted using the `signal` option.

#### input

Type: `Iterable<Promise | unknown>`

An `Iterable` collection of promises/values to wait for.

#### options

Type: `object`

##### count

*Required*\
Type: `number`\
Minimum: `1`

Number of promises from `input` that have to be fulfilled until the returned promise is fulfilled.

##### filter

Type: `Function`

Receives the value resolved by the promise. Used to filter out values that don't satisfy a condition.

The filter function can return either a boolean directly or a Promise that resolves to a boolean.

Example with async filter:

```js
import got from 'got';
import pSome from 'p-some';

const input = [
	got('api.github.com').then(response => response.body),
	got('api.twitter.com').then(response => response.body),
	got('api.reddit.com').then(response => response.body)
];

// Only include responses that contain certain data (async check)
const result = await pSome(input, {
	count: 2,
	async filter(response) {
		// Simulate async validation (e.g., database lookup)
		await new Promise(resolve => setTimeout(resolve, 10));
		return response.includes('api');
	}
});
```

##### signal

Type: `AbortSignal`

[AbortSignal](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal) to abort the operation.

### AggregateError

Exposed for instance checking.

### FilterError

Exposed for instance checking.

## Related

- [p-any](https://github.com/sindresorhus/p-any) - Wait for any promise to be fulfilled
- [More…](https://github.com/sindresorhus/promise-fun)
