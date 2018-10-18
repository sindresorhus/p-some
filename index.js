'use strict';
const AggregateError = require('aggregate-error');
const PCancelable = require('p-cancelable');

class FilterError extends Error { }

const pSome = (iterable, options) => new PCancelable((resolve, reject, onCancel) => {
	const {count, filter = () => true} = options;

	if (!Number.isFinite(count)) {
		reject(new TypeError(`Expected a finite number, got ${typeof options.count}`));
		return;
	}

	const values = [];
	const errors = [];
	let elementCount = 0;
	let isSettled = false;

	const completed = new Set();
	const maybeSettle = () => {
		if (values.length === count) {
			resolve(values);
			isSettled = true;
		}

		if (elementCount - errors.length < count) {
			reject(new AggregateError(errors));
			isSettled = true;
		}

		return isSettled;
	};

	const cancelPending = () => {
		for (const promise of iterable) {
			if (!completed.has(promise) && typeof promise.cancel === 'function') {
				promise.cancel();
			}
		}
	};

	onCancel(cancelPending);

	for (const element of iterable) {
		elementCount++;
		(async () => {
			try {
				const value = await element;
				if (isSettled) {
					return;
				}

				if (!filter(value)) {
					throw new FilterError('Value does not satisfy filter');
				}

				values.push(value);
			} catch (error) {
				errors.push(error);
			} finally {
				completed.add(element);
				if (!isSettled && maybeSettle()) {
					cancelPending();
				}
			}
		})();
	}

	if (count > elementCount) {
		reject(new RangeError(`Expected input to contain at least ${options.count} items, but contains ${elementCount} items`));
		cancelPending();
	}
});

module.exports = pSome;
// TODO: Remove this for the next major release
module.exports.default = pSome;

module.exports.AggregateError = AggregateError;
module.exports.FilterError = FilterError;
