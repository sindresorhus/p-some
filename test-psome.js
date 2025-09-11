import test from 'ava';
import delay from 'delay';
import pSome, {pEvery, FilterError} from './index.js';

// Basic functionality tests
test('rejects immediately if signal is already aborted', async t => {
	const controller = new AbortController();
	controller.abort();

	let workCalled = false;
	try {
		await pSome([Promise.resolve(1)], {
			count: 1,
			signal: controller.signal,
			filter() {
				workCalled = true;
				return true;
			},
		});
		t.fail('Should have thrown');
	} catch (error) {
		t.true(error instanceof DOMException);
		t.is(error.name, 'AbortError');
		t.false(workCalled, 'No work should run with already-aborted signal');
	}
});

test('returns an array of values', async t => {
	const result = await pSome([
		Promise.resolve(1),
		Promise.resolve(2),
		Promise.resolve(3),
	], {count: 2});

	t.is(result.length, 2);
	t.true(result.includes(1));
	t.true(result.includes(2));
});

test('mixed sync and async filter behavior', async t => {
	const input = [1, 2, 3, 4, 5];

	// Sync filter
	const syncResult = await pSome(input, {
		count: 2,
		filter: x => x > 3,
	});
	t.deepEqual(syncResult, [4, 5]);

	// Async filter
	const asyncResult = await pSome(input, {
		count: 2,
		async filter(x) {
			await delay(1);
			return x > 3;
		},
	});
	t.deepEqual(asyncResult, [4, 5]);
});

test('rejects with all errors if satisfying `count` becomes impossible', async t => {
	const fixture = [
		Promise.reject(new Error('foo')),
		Promise.reject(new Error('bar')),
		Promise.resolve(1),
	];

	const error = await t.throwsAsync(pSome(fixture, {count: 2}), {instanceOf: AggregateError});
	t.is(error.errors.length, 2);
});

test('rejects with all errors if satisfying `count` becomes impossible #2', async t => {
	const fixture = [
		Promise.reject(new Error('foo')),
		1,
		Promise.reject(new Error('bar')),
		Promise.reject(new Error('baz')),
	];

	const error = await t.throwsAsync(pSome(fixture, {count: 3}), {instanceOf: AggregateError});
	t.is(error.errors.length, 2); // Only 2 rejections needed to make count=3 impossible with 4 total items
});

test('only returns values that passes `filter` option', async t => {
	const result = await pSome([1, 2, 3, 4, 5], {
		count: 2,
		filter: x => x > 3,
	});

	t.deepEqual(result, [4, 5]);
});

test('reject with AggregateError when values returned from `filter` option doesn\'t match `count`', async t => {
	await t.throwsAsync(
		pSome([1, 2, 3], {count: 2, filter: x => x > 2}),
		{instanceOf: AggregateError},
	);
});

test('reject with AggregateError when unfulfillable', async t => {
	await t.throwsAsync(
		pSome([
			Promise.reject(new Error('foo')),
			Promise.reject(new Error('bar')),
		], {count: 2}),
		{instanceOf: AggregateError},
	);
});

test('works with values', async t => {
	const result = await pSome([1, 2, 3], {count: 2});
	t.deepEqual(result, [1, 2]);
});

test('works with promises', async t => {
	const result = await pSome([
		Promise.resolve(1),
		Promise.resolve(2),
		Promise.resolve(3),
	], {count: 2});

	t.is(result.length, 2);
	t.true(result.includes(1));
	t.true(result.includes(2));
});

test('returns an array of values #2', async t => {
	const result = await pSome([
		delay(100, {value: 4}),
		delay(50, {value: 2}),
		delay(200, {value: 5}),
		delay(10, {value: 1}),
		delay(150, {value: 3}),
	], {count: 3});

	t.deepEqual(result, [1, 2, 4]);
});

test('reject with RangeError when fulfillment is impossible', async t => {
	await t.throwsAsync(
		pSome([1, 2], {count: 4}),
		{instanceOf: RangeError},
	);
});

test('stops when satisfying count becomes impossible', async t => {
	const input = [
		Promise.reject(new Error('1')),
		Promise.reject(new Error('2')),
		delay(1000, {value: 'should not be called'}),
	];

	const start = Date.now();
	const error = await t.throwsAsync(pSome(input, {count: 2}), {instanceOf: AggregateError});
	const duration = Date.now() - start;

	t.true(duration < 500);
	t.is(error.errors.length, 2);
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

	t.deepEqual(result, [4, 5]);
});

test('async filter functions can reject and cause AggregateError', async t => {
	const input = [1, 2, 3];

	await t.throwsAsync(
		pSome(input, {
			count: 2,
			async filter() {
				throw new Error('Filter error');
			},
		}),
		{instanceOf: AggregateError},
	);
});

test('aborts when signal is aborted', async t => {
	const controller = new AbortController();
	const promise = pSome([delay(1000, {value: 1})], {count: 1, signal: controller.signal});

	setTimeout(() => controller.abort(), 10);

	try {
		await promise;
		t.fail('Should have thrown');
	} catch (error) {
		t.true(error instanceof DOMException);
		t.is(error.name, 'AbortError');
	}
});

test('works without abort signal', async t => {
	const result = await pSome([1, 2, 3], {count: 2});
	t.deepEqual(result, [1, 2]);
});

test('returns values in the order they resolved', async t => {
	const result = await pSome([
		delay(100, {value: 'third'}),
		delay(50, {value: 'second'}),
		delay(10, {value: 'first'}),
	], {count: 3});

	t.deepEqual(result, ['first', 'second', 'third']);
});

// Validation tests
test('pSome should reject on invalid count: 0', async t => {
	await t.throwsAsync(
		pSome([1, 2], {count: 0}),
		{instanceOf: TypeError, message: 'Expected `options.count` to be a finite integer ≥ 1'},
	);
});

test('pSome should reject on invalid count: 1.2', async t => {
	await t.throwsAsync(
		pSome([1, 2], {count: 1.2}),
		{instanceOf: TypeError, message: 'Expected `options.count` to be a finite integer ≥ 1'},
	);
});

test('pSome should reject on invalid count: NaN', async t => {
	await t.throwsAsync(
		pSome([1, 2], {count: Number.NaN}),
		{instanceOf: TypeError, message: 'Expected `options.count` to be a finite integer ≥ 1'},
	);
});

test('pSome should reject on invalid count: negative', async t => {
	await t.throwsAsync(
		pSome([1, 2], {count: -5}),
		{instanceOf: TypeError, message: 'Expected `options.count` to be a finite integer ≥ 1'},
	);
});

test('pSome should accept valid count: 1', async t => {
	const result = await pSome([1, 2], {count: 1});
	t.deepEqual(result, [1]);
});

// Behavioral tests
test('pSome should return values in order of fulfillment', async t => {
	const fixture = [
		delay(100, {value: 'slow'}),
		delay(10, {value: 'fast'}),
		delay(50, {value: 'medium'}),
	];

	const result = await pSome(fixture, {count: 3});

	// Should be in fulfillment order: fast, medium, slow
	t.deepEqual(result, ['fast', 'medium', 'slow']);
});

test('pSome should handle sync filter correctly', async t => {
	const result = await pSome([1, 2, 3, 4], {
		count: 2,
		filter: x => x > 2, // Sync filter
	});

	t.deepEqual(result, [3, 4]);
});

test('pSome should handle async filter correctly', async t => {
	const result = await pSome([1, 2, 3, 4], {
		count: 2,
		async filter(x) {
			await delay(1);
			return x > 2; // Async filter
		},
	});

	t.deepEqual(result, [3, 4]);
});

test('pSome should not count falsey filter results as success', async t => {
	await t.throwsAsync(
		pSome([1, 2, 3, 4], {
			count: 3,
			filter: x => x > 5, // No values pass filter
		}),
		{instanceOf: AggregateError},
	);
});

test('pSome should handle mixed sync/async values correctly', async t => {
	const fixture = [
		1, // Sync value
		Promise.resolve(2), // Async value
		3, // Sync value
	];

	const result = await pSome(fixture, {count: 2});

	// Should get first 2 values that resolve (order may vary due to async nature)
	t.is(result.length, 2);
	t.true(result.includes(1));
	t.true(result.includes(2) || result.includes(3));
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
			t.true(options?.once, 'Should use {once: true} for abort listener');
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

	t.deepEqual(result, [1]);
	t.is(listenerCount, 0, 'Should cleanup listener after resolution');
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

	t.false(result);
	t.is(listenerCount, 0, 'Should cleanup listeners on early false');
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

	t.deepEqual(result, [1]);
	t.is(listenerCount, 0, 'Abort listener should be cleaned up after resolution');
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

	await t.throwsAsync(
		pSome([Promise.reject(new Error('test'))], {
			count: 1,
			signal: controller.signal,
		}),
		{instanceOf: AggregateError},
	);

	t.is(listenerCount, 0, 'Abort listener should be cleaned up after rejection');
});

// Improvement tests
test('pSome should reject immediately for impossible count', async t => {
	const error = await t.throwsAsync(
		pSome([Promise.resolve(1), Promise.resolve(2)], {count: 5}),
		{instanceOf: RangeError},
	);

	t.is(error.message, 'Expected input to contain at least 5 items, but contains 2 items');
});

test('pSome early bounds check should fail quickly', async t => {
	const start = Date.now();

	await t.throwsAsync(
		pSome([delay(1000, {value: 1})], {count: 5}),
		{instanceOf: RangeError},
	);

	const duration = Date.now() - start;
	t.true(duration < 100, 'Should fail immediately without waiting');
});

test('pSome should detect impossibility correctly with pending count', async t => {
	const fixture = [
		Promise.resolve(1),
		Promise.reject(new Error('error1')),
		Promise.reject(new Error('error2')),
	];

	const error = await t.throwsAsync(pSome(fixture, {count: 2}), {instanceOf: AggregateError});
	t.is(error.errors.length, 2);
});

test('pSome impossibility detection should be precise', async t => {
	// This should succeed because we have exactly enough successful promises
	const result = await pSome([
		Promise.resolve(1),
		Promise.resolve(2),
		Promise.reject(new Error('should not matter')),
	], {count: 2});

	t.deepEqual(result, [1, 2]);
});

test('pSome should not falsely detect impossibility', async t => {
	// Should not reject early - we have exactly the right count
	const result = await pSome([
		Promise.resolve(1),
		Promise.resolve(2),
		Promise.resolve(3),
	], {count: 3});

	t.deepEqual(result, [1, 2, 3]);
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

	await t.throwsAsync(
		pSome([
			Promise.reject(new Error('1')),
			Promise.reject(new Error('2')),
		], {
			count: 2,
			signal: controller.signal,
		}),
		{instanceOf: AggregateError},
	);

	t.is(listenerCount, 0, 'Abort listener should be cleaned up even when detecting impossibility');
});

test('pSome with filter that always returns false should reject with AggregateError containing only FilterError instances', async t => {
	const error = await t.throwsAsync(
		pSome([1, 2, 3], {
			count: 2,
			filter: () => false, // Always returns false
		}),
		{instanceOf: AggregateError},
	);

	// Should have 2 FilterError instances (enough to make count=2 impossible with 3 input items)
	t.is(error.errors.length, 2);
	for (const filterError of error.errors) {
		t.true(filterError instanceof FilterError);
	}
});
