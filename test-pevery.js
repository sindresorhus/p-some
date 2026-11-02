/* eslint-disable node-test/no-conditional-assertion -- the abort-listener assertion runs inside the patched `addEventListener` callback, so it cannot be hoisted out */
import test from 'node:test';
import {setTimeout as delay} from 'node:timers/promises';
import {rejectsWith} from './helpers.js';
import {pEvery} from './index.js';

// Basic functionality tests
test('pEvery should work like Array.every() but for promises', async t => {
	const fixture = [
		Promise.resolve(2),
		Promise.resolve(4),
		Promise.resolve(6),
	];

	const result = await pEvery(fixture, value => value % 2 === 0);
	t.assert.ok(result);
});

test('pEvery should return false when some promises fail test', async t => {
	const fixture = [
		Promise.resolve(2),
		Promise.resolve(3),
		Promise.resolve(4),
	];

	const result = await pEvery(fixture, value => value % 2 === 0);
	t.assert.ok(!result);
});

test('pEvery should work with async test functions', async t => {
	const fixture = [
		Promise.resolve(2),
		Promise.resolve(4),
		Promise.resolve(6),
	];

	const result = await pEvery(fixture, async value => {
		await delay(10);
		return value % 2 === 0;
	});

	t.assert.ok(result);
});

test('pEvery should work with mixed promises and values', async t => {
	const fixture = [
		2,
		Promise.resolve(4),
		6,
	];

	const result = await pEvery(fixture, value => value % 2 === 0);
	t.assert.ok(result);
});

test('pEvery should support concurrency control', async t => {
	let runningCount = 0;
	let maxConcurrent = 0;

	const fixture = [
		delay(50, 2),
		delay(50, 4),
		delay(50, 6),
	];

	const result = await pEvery(fixture, value => {
		runningCount++;
		maxConcurrent = Math.max(maxConcurrent, runningCount);

		// Simulate some work
		return new Promise(resolve => {
			setTimeout(() => {
				runningCount--;
				resolve(value % 2 === 0);
			}, 10);
		});
	}, {concurrency: 1});

	t.assert.ok(result);
	t.assert.strictEqual(maxConcurrent, 1, 'Should never run more than 1 test concurrently');
});

test('pEvery should handle AbortSignal', async t => {
	const controller = new AbortController();
	const fixture = [
		delay(100, 2),
		delay(200, 4),
	];

	setTimeout(() => controller.abort(), 50);

	const error = await rejectsWith(
		pEvery(fixture, value => value % 2 === 0, {signal: controller.signal}),
		DOMException,
	);
	t.assert.strictEqual(error.name, 'AbortError');
});

test('pEvery rejects if signal is aborted while reading the iterable', {timeout: 1000}, async t => {
	const controller = new AbortController();
	const iterable = {
		* [Symbol.iterator]() {
			controller.abort();
			yield new Promise(() => {});
		},
	};

	const error = await rejectsWith(pEvery(iterable, () => true, {signal: controller.signal}), DOMException);
	t.assert.strictEqual(error.name, 'AbortError');
});

test('pEvery should return false early when first test fails', async t => {
	const start = Date.now();
	const fixture = [
		Promise.resolve(1), // This will fail the test
		delay(500, 2), // This should not be awaited
	];

	const result = await pEvery(fixture, value => value % 2 === 0);
	const duration = Date.now() - start;

	t.assert.ok(!result);
	t.assert.ok(duration < 500); // Should complete quickly
});

test('pEvery should return true for empty iterable', async t => {
	const result = await pEvery([], () => false);
	t.assert.ok(result);
});

test('pEvery should reject when test function throws', async t => {
	const fixture = [
		Promise.resolve(1),
		Promise.resolve(2),
	];

	const testFunction = () => {
		throw new Error('Test error');
	};

	const error = await rejectsWith(pEvery(fixture, testFunction), Error);
	t.assert.strictEqual(error.message, 'Test error');
});

// Validation tests
test('pEvery should reject on invalid concurrency: 0', async t => {
	const error = await rejectsWith(pEvery([1, 2], () => true, {concurrency: 0}), TypeError);
	t.assert.strictEqual(error.message, 'Expected `concurrency` to be Infinity or a finite integer ≥ 1');
});

test('pEvery should reject on invalid concurrency: 0.5', async t => {
	const error = await rejectsWith(pEvery([1, 2], () => true, {concurrency: 0.5}), TypeError);
	t.assert.strictEqual(error.message, 'Expected `concurrency` to be Infinity or a finite integer ≥ 1');
});

test('pEvery should reject on invalid concurrency: NaN', async t => {
	const error = await rejectsWith(pEvery([1, 2], () => true, {concurrency: NaN}), TypeError);
	t.assert.strictEqual(error.message, 'Expected `concurrency` to be Infinity or a finite integer ≥ 1');
});

test('pEvery should reject on invalid concurrency: -1', async t => {
	const error = await rejectsWith(pEvery([1, 2], () => true, {concurrency: -1}), TypeError);
	t.assert.strictEqual(error.message, 'Expected `concurrency` to be Infinity or a finite integer ≥ 1');
});

test('pEvery should accept valid concurrency: Infinity', async t => {
	const result = await pEvery([2, 4], x => x % 2 === 0, {concurrency: Infinity});
	t.assert.ok(result);
});

test('pEvery should accept valid concurrency: 1', async t => {
	const result = await pEvery([2, 4], x => x % 2 === 0, {concurrency: 1});
	t.assert.ok(result);
});

// Error handling tests
test('pEvery should reject when input promise rejects', async t => {
	const fixture = [
		Promise.resolve(2),
		Promise.reject(new Error('input fail')),
	];

	const error = await rejectsWith(pEvery(fixture, x => x % 2 === 0), Error);

	t.assert.strictEqual(error.message, 'input fail');
});

test('pEvery should return false when test function returns false', async t => {
	const result = await pEvery([Promise.resolve(1)], x => x % 2 === 0);
	t.assert.ok(!result);
});

// Behavioral tests
test('pEvery should reject for input promise rejections', async t => {
	const fixture = [
		Promise.resolve(2),
		Promise.reject(new Error('fail')),
		Promise.resolve(4),
	];

	const error = await rejectsWith(pEvery(fixture, x => x % 2 === 0), Error);
	t.assert.strictEqual(error.message, 'fail');
});

test('pEvery should reject when test function throws during processing', async t => {
	const fixture = [
		Promise.resolve(2),
		Promise.resolve(4),
	];

	const error = await rejectsWith(pEvery(fixture, x => {
		if (x === 4) {
			throw new Error('test error');
		}

		return x % 2 === 0;
	}), Error);

	t.assert.strictEqual(error.message, 'test error');
});

test('pEvery should pass correct input index with concurrency=1', async t => {
	const indices = [];

	const result = await pEvery(['a', 'b', 'c', 'd'], (value, index) => {
		indices.push({value, index});
		return true;
	}, {concurrency: 1});

	t.assert.ok(result);
	t.assert.deepStrictEqual(indices, [
		{value: 'a', index: 0},
		{value: 'b', index: 1},
		{value: 'c', index: 2},
		{value: 'd', index: 3},
	]);
});

test('pEvery should pass correct input index with concurrency=Infinity', async t => {
	const indices = [];

	const result = await pEvery(['a', 'b', 'c', 'd'], (value, index) => {
		indices.push({value, index});
		return true;
	}, {concurrency: Infinity});

	t.assert.ok(result);

	// Sort by index since they can complete in any order with infinite concurrency
	indices.sort((a, b) => a.index - b.index);

	t.assert.deepStrictEqual(indices, [
		{value: 'a', index: 0},
		{value: 'b', index: 1},
		{value: 'c', index: 2},
		{value: 'd', index: 3},
	]);
});

test('pEvery should work correctly with mixed sync/async values', async t => {
	const fixture = [
		2, // Sync value
		Promise.resolve(4), // Async value
		6, // Sync value
	];

	const result = await pEvery(fixture, x => x % 2 === 0);

	t.assert.ok(result);
});

// AbortSignal tests
test('pEvery abort listener should use once:true semantics', async t => {
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

	const result = await pEvery([Promise.resolve(2), Promise.resolve(4)], x => x % 2 === 0, {
		signal: controller.signal,
	});

	t.assert.ok(result);
	t.assert.strictEqual(listenerCount, 0, 'Should cleanup listener after resolution');
});

test('pEvery abort listener cleanup should work with early false return', async t => {
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

	const result = await pEvery([Promise.resolve(1)], x => x % 2 === 0, {
		signal: controller.signal,
	});

	t.assert.ok(!result);
	t.assert.strictEqual(listenerCount, 0, 'Should cleanup listener even on early false');
});

test('pEvery should cleanup abort listeners when resolved', async t => {
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

	const result = await pEvery([Promise.resolve(2)], x => x % 2 === 0, {
		signal: controller.signal,
	});

	t.assert.ok(result);
	t.assert.strictEqual(listenerCount, 0, 'Abort listener should be cleaned up after resolution');
});

test('pEvery should cleanup abort listeners when returning false', async t => {
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

	const result = await pEvery([Promise.resolve(1)], x => x % 2 === 0, {
		signal: controller.signal,
	});

	t.assert.ok(!result);
	t.assert.strictEqual(listenerCount, 0, 'Abort listener should be cleaned up after returning false');
});

test('pEvery should cleanup abort listeners when test function throws', async t => {
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

	const error = await rejectsWith(pEvery([Promise.resolve(1)], () => {
		throw new Error('test error');
	}, {
		signal: controller.signal,
	}), Error);

	t.assert.strictEqual(error.message, 'test error');
	t.assert.strictEqual(listenerCount, 0, 'Abort listener should be cleaned up even when test function throws');
});

test('pEvery should cleanup abort listeners on success', async t => {
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

	const result = await pEvery([Promise.resolve(2), Promise.resolve(4)], x => x % 2 === 0, {
		signal: controller.signal,
	});

	t.assert.ok(result);
	t.assert.strictEqual(listenerCount, 0, 'Should cleanup listeners on success');
});

test('pEvery should reject immediately if signal is already aborted', async t => {
	const controller = new AbortController();
	controller.abort(); // Abort before calling pEvery

	let isWorkCalled = false;
	const error = await rejectsWith(pEvery([Promise.resolve(1)], () => {
		isWorkCalled = true;
		return true;
	}, {signal: controller.signal}), DOMException);

	t.assert.strictEqual(error.name, 'AbortError');
	t.assert.ok(!isWorkCalled, 'No work should run with already-aborted signal');
});

test('pEvery should cleanup abort listeners on immediate abort', async t => {
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

	controller.abort(); // Abort immediately

	const error = await rejectsWith(pEvery([Promise.resolve(1)], () => true, {signal: controller.signal}), DOMException);
	t.assert.strictEqual(error.name, 'AbortError');

	// Note: immediate abort uses fast-path, so no listeners are added
	t.assert.strictEqual(listenerCount, 0, 'Should not leak listeners on immediate abort');
});
