import PCancelable from 'p-cancelable';

export type Value<T> = T | PromiseLike<T>;
export type CancelablePromise<ValueType> = PCancelable<ValueType>;

export interface Options<T> {
	/**
	 * Number of promises from `input` that have to be fulfilled until the returned promise is fulfilled. Minimum: `1`.
	 */
	readonly count: number;

	/**
	 * Used to filter out values that don't satisfy a condition.
	 *
	 * @param value - The value resolved by the promise.
	 */
	readonly filter?: (value: T) => boolean;
}

/**
 * Wait for a specified number of promises to be fulfilled.
 *
 * @param values - An `Iterable` collection of promises/values to wait for. If you pass in cancelable promises, specifically promises with a `.cancel()` method, that method will be called for the promises that are still unfulfilled when the returned `Promise` is either fulfilled or rejected.
 * @returns A cancelable `Promise` that is fulfilled when `count` promises from `input` are fulfilled. The fulfilled value is an `Array` of the values from the `input` promises in the order they were fulfilled. If it becomes impossible to satisfy `count`, for example, too many promises rejected, it will reject with an [`AggregateError`](https://github.com/sindresorhus/aggregate-error) error.
 */
export default function pSome<T>(
	values: Iterable<Value<T>>,
	options: Options<T>
): CancelablePromise<T[]>;

export {default as AggregateError} from 'aggregate-error';
