export class FilterError extends Error {}

export default function pSome(iterable, options) {
	return new Promise((resolve, reject) => {
		const {
			count,
			filter = () => true,
			signal,
		} = options;

		if (!Number.isFinite(count)) {
			reject(new TypeError(`Expected a finite number, got ${typeof options.count}`));
			return;
		}

		signal?.throwIfAborted();

		const values = [];
		const errors = [];
		let elementCount = 0;
		let isSettled = false;

		const settle = () => {
			if (isSettled) {
				return;
			}

			if (values.length === count) {
				isSettled = true;
				resolve(values);
				return;
			}

			if (elementCount - errors.length < count) {
				isSettled = true;
				reject(new AggregateError(errors, 'Too many promises rejected'));
			}
		};

		const handleAbort = () => {
			if (!isSettled) {
				isSettled = true;
				try {
					signal.throwIfAborted();
				} catch (error) {
					reject(error);
				}
			}
		};

		signal?.addEventListener('abort', handleAbort);

		for (const element of iterable) {
			elementCount++;

			(async () => {
				try {
					const value = await element;

					if (isSettled) {
						return;
					}

					const filterResult = filter(value);
					const shouldInclude = filterResult instanceof Promise ? await filterResult : filterResult;

					if (!shouldInclude) {
						throw new FilterError('Value does not satisfy filter');
					}

					values.push(value);
				} catch (error) {
					errors.push(error);
				} finally {
					settle();
				}
			})();
		}

		if (count > elementCount) {
			reject(new RangeError(`Expected input to contain at least ${options.count} items, but contains ${elementCount} items`));
		}
	});
}

