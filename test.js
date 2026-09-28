/* eslint-disable node-test/no-conditional-assertion -- each collected error is asserted individually, so the assertions have to sit inside the loop */
import test from 'node:test';
import {setTimeout as delay} from 'node:timers/promises';
import {rejectsWith} from './helpers.js';
import pSome, {FilterError} from './index.js';

test('reject with RangeError when fulfillment is impossible', async t => {
	await rejectsWith(pSome([], {count: 1}), RangeError);
	await rejectsWith(pSome([1, 2, 3], {count: 4}), RangeError);
	t.assert.deepStrictEqual(await pSome([1, 2, 3], {count: 3}), [1, 2, 3]);
	t.assert.deepStrictEqual(await pSome([1, 2, 3], {count: 1}), [1]);
});

test('works with values', async t => {
	t.assert.deepStrictEqual(await pSome([1, 2, 3], {count: 1}), [1]);
	t.assert.deepStrictEqual(await pSome([1, 2, 3], {count: 2}), [1, 2]);
	t.assert.deepStrictEqual(await pSome([1, 2, 3], {count: 3}), [1, 2, 3]);
});

test('works with promises', async t => {
	const fixture = () => [
		Promise.resolve(1),
		Promise.resolve(2),
		Promise.resolve(3),
	];

	t.assert.deepStrictEqual(await pSome(fixture(), {count: 1}), [1]);
	t.assert.deepStrictEqual(await pSome(fixture(), {count: 2}), [1, 2]);
	t.assert.deepStrictEqual(await pSome(fixture(), {count: 3}), [1, 2, 3]);
});

test('returns values in the order they resolved', async t => {
	const fixture = [
		delay(100, 1),
		Promise.resolve(2),
		delay(50, 3),
	];

	t.assert.deepStrictEqual(await pSome(fixture, {count: 3}), [2, 3, 1]);
});

test('rejects with all errors if satisfying `count` becomes impossible', async t => {
	const fixture = [
		Promise.reject(new Error('foo')),
		Promise.resolve(1),
		Promise.reject(new Error('bar')),
		Promise.resolve(2),
	];

	const error = await rejectsWith(pSome(fixture, {count: 3}), AggregateError);
	const items = [...error.errors];
	t.assert.strictEqual(items.length, 2);
	t.assert.deepStrictEqual(items, [new Error('foo'), new Error('bar')]);
});

test('rejects with all errors if satisfying `count` becomes impossible #2', async t => {
	const fixture = [
		Promise.reject(new Error('foo')),
		Promise.resolve(1),
		Promise.reject(new Error('bar')),
		Promise.resolve(2),
	];

	const error = await rejectsWith(pSome(fixture, {count: 4}), AggregateError);
	const items = [...error.errors];
	t.assert.strictEqual(items.length, 1);
	t.assert.deepStrictEqual(items, [new Error('foo')]);
});

test('returns an array of values', async t => {
	const fixture = [
		Promise.reject(new Error('1')),
		Promise.resolve('2'),
		Promise.reject(new Error('3')),
		Promise.resolve('4'),
	];

	t.assert.deepStrictEqual(await pSome(fixture, {count: 2}), ['2', '4']);
});

test('returns an array of values #2', async t => {
	const fixture = () => [
		Promise.resolve('1'),
		Promise.resolve('2'),
		Promise.reject(new Error('3')),
		Promise.resolve('4'),
		Promise.reject(new Error('5')),
	];

	t.assert.deepStrictEqual(await pSome(fixture(), {count: 1}), ['1']);
	t.assert.deepStrictEqual(await pSome(fixture(), {count: 2}), ['1', '2']);
	t.assert.deepStrictEqual(await pSome(fixture(), {count: 3}), ['1', '2', '4']);
});

test('only returns values that passes `filter` option', async t => {
	const fixture = [
		'foo',
		1,
		Promise.resolve('foo'),
		Promise.resolve(2),
	];

	t.assert.deepStrictEqual(await pSome(fixture, {count: 1, filter: value => typeof value === 'number'}), [1]);
	t.assert.deepStrictEqual(await pSome(fixture, {count: 2, filter: value => typeof value === 'number'}), [1, 2]);
});

test('reject with AggregateError when values returned from `filter` option doesn\'t match `count`', async t => {
	const fixture = [
		'foo',
		Promise.resolve(1),
		Promise.resolve('foo'),
		2,
	];

	const error = await rejectsWith(
		pSome(fixture, {count: 3, filter: value => typeof value === 'number'}),
		AggregateError,
	);

	for (const error_ of error.errors) {
		t.assert.ok(error_ instanceof FilterError);
		t.assert.strictEqual(error_.message, 'Value does not satisfy filter');
	}
});

test('reject with AggregateError when unfulfillable', async t => {
	const fixture = [
		Promise.resolve(1),
		Promise.resolve(2),
		Promise.reject(new Error('boom')),
	];

	const error = await rejectsWith(pSome(fixture, {count: 2, filter: value => value > 1}), AggregateError);
	// Check that the errors are properly included
	t.assert.strictEqual(error.errors.length, 2);
	t.assert.ok(error.errors.some(error_ => error_.message === 'boom'));
	t.assert.ok(error.errors.some(error_ => error_.message === 'Value does not satisfy filter'));
});

test('supports async filter functions', async t => {
	const fixture = [
		Promise.resolve(1),
		Promise.resolve(2),
		Promise.resolve(3),
		Promise.resolve(4),
	];

	// Async filter that only allows values > 2
	const asyncFilter = async value => {
		await delay(10); // Simulate async operation
		return value > 2;
	};

	const result = await pSome(fixture, {count: 2, filter: asyncFilter});
	t.assert.deepStrictEqual(result, [3, 4]);
});

test('async filter functions can reject and cause AggregateError', async t => {
	const fixture = [
		Promise.resolve(1),
		Promise.resolve(2),
		Promise.resolve(3),
	];

	// Async filter that rejects all values
	const asyncFilter = async () => {
		await delay(10);
		return false;
	};

	const error = await rejectsWith(pSome(fixture, {count: 1, filter: asyncFilter}), AggregateError);
	for (const error_ of error.errors) {
		t.assert.ok(error_ instanceof FilterError);
		t.assert.strictEqual(error_.message, 'Value does not satisfy filter');
	}
});

test('mixed sync and async filter behavior', async t => {
	const fixture = [
		Promise.resolve('sync1'),
		Promise.resolve('async1'),
		Promise.resolve('sync2'),
		Promise.resolve('async2'),
	];

	// Filter that returns async for 'async' values and sync for 'sync' values
	const mixedFilter = value => value.includes('async') ? Promise.resolve(true) : value.includes('sync');

	const result = await pSome(fixture, {count: 4, filter: mixedFilter});
	t.assert.strictEqual(result.length, 4);
	// Should include both sync and async values
	t.assert.ok(result.some(value => value.includes('sync')));
	t.assert.ok(result.some(value => value.includes('async')));
});

test('aborts when signal is aborted', async t => {
	const abortController = new AbortController();
	const fixture = [
		delay(100, 1),
		delay(200, 2),
		delay(300, 3),
		delay(400, 4),
	];

	const promise = pSome(fixture, {count: 4, signal: abortController.signal});
	// Abort after a short delay
	setTimeout(() => abortController.abort(), 50);

	const error = await rejectsWith(promise, DOMException);
	t.assert.strictEqual(error.name, 'AbortError');
});

test('rejects immediately if signal is already aborted', async t => {
	const abortController = new AbortController();
	abortController.abort();

	const fixture = [
		Promise.resolve(1),
		Promise.resolve(2),
	];

	const error = await rejectsWith(pSome(fixture, {count: 1, signal: abortController.signal}), DOMException);
	t.assert.strictEqual(error.name, 'AbortError');
});

test('works without abort signal', async t => {
	const fixture = [
		Promise.resolve(1),
		delay(50, 2),
		delay(100, 3),
		delay(200, 4),
	];

	t.assert.deepStrictEqual(await pSome(fixture, {count: 2}), [1, 2]);
});

test('stops when satisfying count becomes impossible', async t => {
	const fixture = [
		Promise.reject(new Error('foo')),
		(async () => {
			await delay(10);
			throw new Error('bar');
		})(),
		delay(200, 'success1'),
		delay(300, 'success2'),
	];

	const error = await rejectsWith(pSome(fixture, {count: 3}), AggregateError);
	const items = [...error.errors];
	t.assert.strictEqual(items.length, 2);
	t.assert.deepStrictEqual(items, [new Error('foo'), new Error('bar')]);
});
