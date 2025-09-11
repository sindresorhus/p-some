export class FilterError extends Error {}

function createAbortHandler(signal, isSettled, reject) {
	if (!signal) {
		return () => {};
	}

	const handleAbort = () => {
		if (!isSettled.value) {
			isSettled.value = true;
			try {
				signal.throwIfAborted();
			} catch (error) {
				reject(error);
			}
		}
	};

	signal.addEventListener('abort', handleAbort, {once: true});

	return () => {
		signal.removeEventListener('abort', handleAbort);
	};
}

export function pEvery(iterable, testFunction, options = {}) {
	return new Promise((resolve, reject) => {
		const {concurrency = Number.POSITIVE_INFINITY, signal} = options;

		if (!(concurrency === Number.POSITIVE_INFINITY || (Number.isFinite(concurrency) && Number.isInteger(concurrency) && concurrency >= 1))) {
			reject(new TypeError('Expected `concurrency` to be Infinity or a finite integer ≥ 1'));
			return;
		}

		if (signal?.aborted) {
			try {
				signal.throwIfAborted();
			} catch (error) {
				reject(error);
			}

			return;
		}

		const elements = [...iterable];

		if (elements.length === 0) {
			resolve(true);
			return;
		}

		const isSettled = {value: false};
		let completedCount = 0;
		let runningCount = 0;
		let nextIndex = 0;

		const cleanupAbort = createAbortHandler(signal, isSettled, reject);

		const processNext = () => {
			while (nextIndex < elements.length && runningCount < concurrency && !isSettled.value) {
				const currentIndex = nextIndex++;
				runningCount++;

				(async () => {
					try {
						const value = await elements[currentIndex];

						if (isSettled.value) {
							return;
						}

						const testResult = await Promise.resolve(testFunction(value, currentIndex));

						if (!testResult) {
							if (!isSettled.value) {
								isSettled.value = true;
								cleanupAbort();
								resolve(false);
							}

							return;
						}

						if (++completedCount === elements.length && !isSettled.value) {
							isSettled.value = true;
							cleanupAbort();
							resolve(true);
						}
					} catch (error) {
						if (!isSettled.value) {
							isSettled.value = true;
							cleanupAbort();
							reject(error);
						}
					} finally {
						runningCount--;
						processNext();
					}
				})();
			}
		};

		processNext();
	});
}

export default function pSome(iterable, options) {
	return new Promise((resolve, reject) => {
		const {count, filter = () => true, signal} = options;

		if (!(Number.isFinite(count) && Number.isInteger(count) && count >= 1)) {
			reject(new TypeError('Expected `options.count` to be a finite integer ≥ 1'));
			return;
		}

		if (signal?.aborted) {
			try {
				signal.throwIfAborted();
			} catch (error) {
				reject(error);
			}

			return;
		}

		// Early bounds check
		const elements = [...iterable];
		if (count > elements.length) {
			reject(new RangeError(`Expected input to contain at least ${count} items, but contains ${elements.length} items`));
			return;
		}

		const values = [];
		const errors = [];
		const isSettled = {value: false};

		const cleanupAbort = createAbortHandler(signal, isSettled, reject);

		let pendingCount = elements.length;

		const checkSettlement = () => {
			if (isSettled.value) {
				return;
			}

			if (values.length === count) {
				isSettled.value = true;
				cleanupAbort();
				resolve(values);
			} else if (pendingCount + values.length < count) {
				isSettled.value = true;
				cleanupAbort();
				reject(new AggregateError(errors, 'Too many promises rejected'));
			}
		};

		for (const element of elements) {
			(async () => {
				try {
					const value = await element;

					if (isSettled.value) {
						return;
					}

					const shouldInclude = await Promise.resolve(filter(value));

					if (!shouldInclude) {
						throw new FilterError('Value does not satisfy filter');
					}

					if (values.length < count) {
						values.push(value);
					}
				} catch (error) {
					errors.push(error);
				} finally {
					pendingCount--;
					checkSettlement();
				}
			})();
		}
	});
}
