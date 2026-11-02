/* eslint-disable node-test/no-conditional-assertion -- the abort-listener assertion runs inside the patched `addEventListener` callback and the last test asserts each collected error individually, so neither can be hoisted out */
import test from 'node:test';
import {setTimeout as delay} from 'node:timers/promises';
import {rejectsWith} from './helpers.js';
import pSome, {pEvery, FilterError} from './index.js';

// Basic functionality tests
test('rejects immediately if signal is already aborted', async t => {
	const controller = new AbortController();
	controller.abort();

	let isWorkCalled = false;
	const error = await rejectsWith(pSome([Promise.resolve(1)], {
		count: 1,
		signal: controller.signal,
		filter() {
			isWorkCalled = true;
			return true;
		},
	}), DOMException);

	t.assert.strictEqual(error.name, 'AbortError');
	t.assert.ok(!isWorkCalled, 'No work should run with already-aborted signal');
});

test('rejects if signal is aborted while reading the iterable', {timeout: 1000}, async t => {
	const controller = new AbortController();
	const iterable = {
		* [Symbol.iterator]() {
			controller.abort();
			yield new Promise(() => {});
		},
	};

	const error = await rejectsWith(pSome(iterable, {count: 1, signal: controller.signal}), DOMException);
	t.assert.strictEqual(error.name, 'AbortError');
});

test('returns an array of values', async t => {
	const result = await pSome([
		Promise.resolve(1),
		Promise.resolve(2),
		Promise.resolve(3),
	], {count: 2});

	t.assert.strictEqual(result.length, 2);
	t.assert.ok(result.includes(1));
	t.assert.ok(result.includes(2));
});

test('mixed sync and async filter behavior', async t => {
	const input = [1, 2, 3, 4, 5];

	// Sync filter
	const syncResult = await pSome(input, {
		count: 2,
		filter: x => x > 3,
	});
	t.assert.deepStrictEqual(syncResult, [4, 5]);

	// Async filter
	const asyncResult = await pSome(input, {
		count: 2,
		async filter(x) {
			await delay(1);
			return x > 3;
		},
	});
	t.assert.deepStrictEqual(asyncResult, [4, 5]);
});

test('rejects with all errors if satisfying `count` becomes impossible', async t => {
	const fixture = [
		Promise.reject(new Error('foo')),
		Promise.reject(new Error('bar')),
		Promise.resolve(1),
	];

	const error = await rejectsWith(pSome(fixture, {count: 2}), AggregateError);
	t.assert.strictEqual(error.errors.length, 2);
});

test('rejects with all errors if satisfying `count` becomes impossible #2', async t => {
	const fixture = [
		Promise.reject(new Error('foo')),
		1,
		Promise.reject(new Error('bar')),
		Promise.reject(new Error('baz')),
	];

	const error = await rejectsWith(pSome(fixture, {count: 3}), AggregateError);
	t.assert.strictEqual(error.errors.length, 2); // Only 2 rejections needed to make count=3 impossible with 4 total items
});

test('only returns values that passes `filter` option', async t => {
	const result = await pSome([1, 2, 3, 4, 5], {
		count: 2,
		filter: x => x > 3,
	});

	t.assert.deepStrictEqual(result, [4, 5]);
});

test('reject with AggregateError when values returned from `filter` option doesn\'t match `count`', async t => {
	const error = await rejectsWith(
		pSome([1, 2, 3], {count: 2, filter: x => x > 2}),
		AggregateError,
	);

	t.assert.strictEqual(error.message, 'Too many promises rejected');
});

test('reject with AggregateError when unfulfillable', async t => {
	const fixture = [
		Promise.reject(new Error('foo')),
		Promise.reject(new Error('bar')),
	];

	const error = await rejectsWith(pSome(fixture, {count: 2}), AggregateError);

	t.assert.strictEqual(error.message, 'Too many promises rejected');
});

test('works with values', async t => {
	const result = await pSome([1, 2, 3], {count: 2});
	t.assert.deepStrictEqual(result, [1, 2]);
});

test('works with promises', async t => {
	const result = await pSome([
		Promise.resolve(1),
		Promise.resolve(2),
		Promise.resolve(3),
	], {count: 2});

	t.assert.strictEqual(result.length, 2);
	t.assert.ok(result.includes(1));
	t.assert.ok(result.includes(2));
});

test('returns an array of values #2', async t => {
	const result = await pSome([
		delay(100, 4),
		delay(50, 2),
		delay(200, 5),
		delay(10, 1),
		delay(150, 3),
	], {count: 3});

	t.assert.deepStrictEqual(result, [1, 2, 4]);
});

test('reject with RangeError when fulfillment is impossible', async t => {
	const error = await rejectsWith(
		pSome([1, 2], {count: 4}),
		RangeError,
	);

	t.assert.strictEqual(error.message, 'Expected input to contain at least 4 items, but contains 2 items');
});

test('stops when satisfying count becomes impossible', async t => {
	const input = [
		Promise.reject(new Error('1')),
		Promise.reject(new Error('2')),
		delay(1000, 'should not be called'),
	];

	const start = Date.now();
	const error = await rejectsWith(pSome(input, {count: 2}), AggregateError);
	const duration = Date.now() - start;

	t.assert.ok(duration < 500);
	t.assert.strictEqual(error.errors.length, 2);
});

test('supports async filter functions', async t => {
	const input = [1, 2, 3, 4, 5];

	const result = await pSome(input, {
		count: 2,
		async filter(x) {
			await delay(10);
			return x > 3;
		},
	});

	t.assert.deepStrictEqual(result, [4, 5]);
});

test('async filter functions can reject and cause AggregateError', async t => {
	const input = [1, 2, 3];

	const error = await rejectsWith(
		pSome(input, {
			count: 2,
			async filter() {
				throw new Error('Filter error');
			},
		}),
		AggregateError,
	);

	t.assert.strictEqual(error.message, 'Too many promises rejected');
});

test('aborts when signal is aborted', async t => {
	const controller = new AbortController();
	const promise = pSome([delay(1000, 1)], {count: 1, signal: controller.signal});

	setTimeout(() => controller.abort(), 10);

	const error = await rejectsWith(promise, DOMException);
	t.assert.strictEqual(error.name, 'AbortError');
});

test('works without abort signal', async t => {
	const result = await pSome([1, 2, 3], {count: 2});
	t.assert.deepStrictEqual(result, [1, 2]);
});

test('returns values in the order they resolved', async t => {
	const result = await pSome([
		delay(100, 'third'),
		delay(50, 'second'),
		delay(10, 'first'),
	], {count: 3});

	t.assert.deepStrictEqual(result, ['first', 'second', 'third']);
});

// Validation tests
test('pSome should reject on invalid count: 0', async t => {
	const error = await rejectsWith(pSome([1, 2], {count: 0}), TypeError);
	t.assert.strictEqual(error.message, 'Expected `options.count` to be a finite integer ≥ 1');
});

test('pSome should reject on invalid count: 1.2', async t => {
	const error = await rejectsWith(pSome([1, 2], {count: 1.2}), TypeError);
	t.assert.strictEqual(error.message, 'Expected `options.count` to be a finite integer ≥ 1');
});

test('pSome should reject on invalid count: NaN', async t => {
	const error = await rejectsWith(pSome([1, 2], {count: NaN}), TypeError);
	t.assert.strictEqual(error.message, 'Expected `options.count` to be a finite integer ≥ 1');
});

test('pSome should reject on invalid count: negative', async t => {
	const error = await rejectsWith(pSome([1, 2], {count: -5}), TypeError);
	t.assert.strictEqual(error.message, 'Expected `options.count` to be a finite integer ≥ 1');
});

test('pSome should accept valid count: 1', async t => {
	const result = await pSome([1, 2], {count: 1});
	t.assert.deepStrictEqual(result, [1]);
});

// Behavioral tests
test('pSome should return values in order of fulfillment', async t => {
	const fixture = [
		delay(100, 'slow'),
		delay(10, 'fast'),
		delay(50, 'medium'),
	];

	const result = await pSome(fixture, {count: 3});

	// Should be in fulfillment order: fast, medium, slow
	t.assert.deepStrictEqual(result, ['fast', 'medium', 'slow']);
});

test('pSome should handle sync filter correctly', async t => {
	const result = await pSome([1, 2, 3, 4], {
		count: 2,
		filter: x => x > 2, // Sync filter
	});

	t.assert.deepStrictEqual(result, [3, 4]);
});

test('pSome should handle async filter correctly', async t => {
	const result = await pSome([1, 2, 3, 4], {
		count: 2,
		async filter(x) {
			await delay(1);
			return x > 2; // Async filter
		},
	});

	t.assert.deepStrictEqual(result, [3, 4]);
});

test('pSome should not count falsey filter results as success', async t => {
	const error = await rejectsWith(
		pSome([1, 2, 3, 4], {
			count: 3,
			filter: x => x > 5, // No values pass filter
		}),
		AggregateError,
	);

	t.assert.strictEqual(error.message, 'Too many promises rejected');
});

test('pSome should handle mixed sync/async values correctly', async t => {
	const fixture = [
		1, // Sync value
		Promise.resolve(2), // Async value
		3, // Sync value
	];

	const result = await pSome(fixture, {count: 2});

	// Should get first 2 values that resolve (order may vary due to async nature)
	t.assert.strictEqual(result.length, 2);
	t.assert.ok(result.includes(1));
	t.assert.ok(result.includes(2) || result.includes(3));
});

// AbortSignal tests
test('pSome abort listener should use once:true semantics', async t => {
	const controller = new AbortController();
	let listenerCount = 0;

	const originalAdd = controller.signal.addEventListener;
	const originalRemove = controller.signal.removeEventListener;

	controller.signal.addEventListener = function (type, listener, options) {
		if (type === 'abort') {
			listenerCount++;
			// Verify once:true is used
			t.assert.ok(options?.once, 'Should use {once: true} for abort listener');
		}

		return originalAdd.call(this, type, listener, options);
	};

	controller.signal.removeEventListener = function (type, listener) {
		if (type === 'abort') {
			listenerCount--;
		}

		return originalRemove.call(this, type, listener);
	};

	const result = await pSome([Promise.resolve(1)], {
		count: 1,
		signal: controller.signal,
	});

	t.assert.deepStrictEqual(result, [1]);
	t.assert.strictEqual(listenerCount, 0, 'Should cleanup listener after resolution');
});

test('pSome should cleanup abort listeners on early false', async t => {
	const controller = new AbortController();
	let listenerCount = 0;

	const originalAdd = controller.signal.addEventListener;
	const originalRemove = controller.signal.removeEventListener;

	controller.signal.addEventListener = function (type, listener, options) {
		if (type === 'abort') {
			listenerCount++;
		}

		return originalAdd.call(this, type, listener, options);
	};

	controller.signal.removeEventListener = function (type, listener) {
		if (type === 'abort') {
			listenerCount--;
		}

		return originalRemove.call(this, type, listener);
	};

	// This should trigger early false return
	const result = await pEvery([Promise.resolve(1), Promise.resolve(2)], x => x % 2 === 0, {
		signal: controller.signal,
	});

	t.assert.ok(!result);
	t.assert.strictEqual(listenerCount, 0, 'Should cleanup listeners on early false');
});

test('pSome should cleanup abort listeners when resolved', async t => {
	const controller = new AbortController();
	let listenerCount = 0;

	const originalAdd = controller.signal.addEventListener;
	const originalRemove = controller.signal.removeEventListener;

	controller.signal.addEventListener = function (type, listener, options) {
		if (type === 'abort') {
			listenerCount++;
		}

		return originalAdd.call(this, type, listener, options);
	};

	controller.signal.removeEventListener = function (type, listener) {
		if (type === 'abort') {
			listenerCount--;
		}

		return originalRemove.call(this, type, listener);
	};

	const result = await pSome([Promise.resolve(1)], {
		count: 1,
		signal: controller.signal,
	});

	t.assert.deepStrictEqual(result, [1]);
	t.assert.strictEqual(listenerCount, 0, 'Abort listener should be cleaned up after resolution');
});

test('pSome should cleanup abort listeners when rejected', async t => {
	const controller = new AbortController();
	let listenerCount = 0;

	const originalAdd = controller.signal.addEventListener;
	const originalRemove = controller.signal.removeEventListener;

	controller.signal.addEventListener = function (type, listener, options) {
		if (type === 'abort') {
			listenerCount++;
		}

		return originalAdd.call(this, type, listener, options);
	};

	controller.signal.removeEventListener = function (type, listener) {
		if (type === 'abort') {
			listenerCount--;
		}

		return originalRemove.call(this, type, listener);
	};

	const fixture = [Promise.reject(new Error('test'))];

	await rejectsWith(
		pSome(fixture, {
			count: 1,
			signal: controller.signal,
		}),
		AggregateError,
	);

	t.assert.strictEqual(listenerCount, 0, 'Abort listener should be cleaned up after rejection');
});

// Improvement tests
test('pSome should reject immediately for impossible count', async t => {
	const error = await rejectsWith(
		pSome([Promise.resolve(1), Promise.resolve(2)], {count: 5}),
		RangeError,
	);

	t.assert.strictEqual(error.message, 'Expected input to contain at least 5 items, but contains 2 items');
});

test('pSome early bounds check should fail quickly', async t => {
	const start = Date.now();

	await rejectsWith(
		pSome([delay(1000, 1)], {count: 5}),
		RangeError,
	);

	const duration = Date.now() - start;
	t.assert.ok(duration < 100, 'Should fail immediately without waiting');
});

test('pSome should detect impossibility correctly with pending count', async t => {
	const fixture = [
		Promise.resolve(1),
		Promise.reject(new Error('error1')),
		Promise.reject(new Error('error2')),
	];

	const error = await rejectsWith(pSome(fixture, {count: 2}), AggregateError);
	t.assert.strictEqual(error.errors.length, 2);
});

test('pSome impossibility detection should be precise', async t => {
	// This should succeed because we have exactly enough successful promises
	const result = await pSome([
		Promise.resolve(1),
		Promise.resolve(2),
		Promise.reject(new Error('should not matter')),
	], {count: 2});

	t.assert.deepStrictEqual(result, [1, 2]);
});

test('pSome should not falsely detect impossibility', async t => {
	// Should not reject early - we have exactly the right count
	const result = await pSome([
		Promise.resolve(1),
		Promise.resolve(2),
		Promise.resolve(3),
	], {count: 3});

	t.assert.deepStrictEqual(result, [1, 2, 3]);
});

test('pSome should cleanup abort listeners even when detecting impossibility', async t => {
	const controller = new AbortController();
	let listenerCount = 0;

	const originalAdd = controller.signal.addEventListener;
	const originalRemove = controller.signal.removeEventListener;

	controller.signal.addEventListener = function (type, listener, options) {
		if (type === 'abort') {
			listenerCount++;
		}

		return originalAdd.call(this, type, listener, options);
	};

	controller.signal.removeEventListener = function (type, listener) {
		if (type === 'abort') {
			listenerCount--;
		}

		return originalRemove.call(this, type, listener);
	};

	const fixture = [
		Promise.reject(new Error('1')),
		Promise.reject(new Error('2')),
	];

	await rejectsWith(
		pSome(fixture, {
			count: 2,
			signal: controller.signal,
		}),
		AggregateError,
	);

	t.assert.strictEqual(listenerCount, 0, 'Abort listener should be cleaned up even when detecting impossibility');
});

test('pSome with filter that always returns false should reject with AggregateError containing only FilterError instances', async t => {
	const error = await rejectsWith(
		pSome([1, 2, 3], {
			count: 2,
			filter: () => false, // Always returns false
		}),
		AggregateError,
	);

	// Should have 2 FilterError instances (enough to make count=2 impossible with 3 input items)
	t.assert.strictEqual(error.errors.length, 2);
	for (const filterError of error.errors) {
		t.assert.ok(filterError instanceof FilterError);
	}
});

// `node:test` fails a test when an unhandled rejection happens while it runs, so these tests wait a bit at the end.
test('handles rejected inputs when rejecting with RangeError', async t => {
	const input = [Promise.reject(new Error('input'))];
	const error = await rejectsWith(pSome(input, {count: 2}), RangeError);
	t.assert.match(error.message, /at least 2 items/v);
	await delay(50);
});

test('handles rejected inputs when signal is already aborted', async t => {
	const input = [Promise.reject(new Error('input'))];
	const error = await rejectsWith(pSome(input, {count: 1, signal: AbortSignal.abort()}), DOMException);
	t.assert.strictEqual(error.name, 'AbortError');
	await delay(50);
});

test('works with `null` and `undefined` inputs', async t => {
	t.assert.deepStrictEqual(await pSome([null, undefined], {count: 2}), [null, undefined]);
	t.assert.strictEqual(await pEvery([null, undefined], value => value === null || value === undefined), true);
});
