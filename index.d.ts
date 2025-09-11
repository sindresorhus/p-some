export type Value<T> = T | PromiseLike<T>;

export class FilterError extends Error {}

export type EveryOptions = {
	/**
	Number of input items tested concurrently. Minimum: `1`.

	@default Infinity
	*/
	readonly concurrency?: number;

	/**
	AbortSignal to abort the operation.
	*/
	readonly signal?: AbortSignal;
};

export type Options<T> = {
	/**
	Number of promises from `input` that have to be fulfilled until the returned promise is fulfilled. Minimum: `1`.
	*/
	readonly count: number;

	/**
	Used to filter out values that don't satisfy a condition.

	@param value - The value resolved by the promise.

	@example
	```
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
	*/
	readonly filter?: (value: T) => boolean | Promise<boolean>;

	/**
	AbortSignal to abort the operation.
	*/
	readonly signal?: AbortSignal;
};

/**
Wait for a specified number of promises to be fulfilled.

@param values - An `Iterable` collection of promises/values to wait for.
@returns A `Promise` that is fulfilled when `count` promises from `input` are fulfilled. The fulfilled value is an `Array` of the values from the `input` promises in the order they were fulfilled. If it becomes impossible to satisfy `count`, for example, too many promises rejected, it will reject with an `AggregateError`. The promise can be aborted using the `signal` option.

@example
```
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
*/
export default function pSome<T>(
	values: Iterable<Value<T>>,
	options: Options<T>
): Promise<T[]>;

/**
Test whether all promises pass a testing function.

@param input - An `Iterable` collection of promises/values to test.
@param testFunction - The function to test each promise with.
@returns A Promise that resolves to `true` only if **every** item makes `testFunction` resolve to `true`. Resolves to `false` if any item makes it resolve to `false`. **Rejects** if any input or `testFunction` throws or rejects.

@example
```
import {pEvery} from 'p-some';

const result = await pEvery([
	Promise.resolve(2),
	Promise.resolve(4),
	Promise.resolve(6)
], value => value % 2 === 0);

console.log(result);
//=> true
```
*/
export function pEvery<T>(
	input: Iterable<Value<T>>,
	testFunction: (value: T, index: number) => boolean | Promise<boolean>,
	options?: EveryOptions
): Promise<boolean>;
