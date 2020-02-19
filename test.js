import test from 'ava';
import delay from 'delay';
import PCancelable from 'p-cancelable';
import pSome from '.';

test('reject with RangeError when fulfillment is impossible', async t => {
	await t.throwsAsync(pSome([], {count: 1}), RangeError);
	await t.throwsAsync(pSome([1, 2, 3], {count: 4}), RangeError);
	await t.notThrowsAsync(pSome([1, 2, 3], {count: 3}));
	await t.notThrowsAsync(pSome([1, 2, 3], {count: 1}));
});

test('works with values', async t => {
	t.deepEqual(await pSome([1, 2, 3], {count: 1}), [1]);
	t.deepEqual(await pSome([1, 2, 3], {count: 2}), [1, 2]);
	t.deepEqual(await pSome([1, 2, 3], {count: 3}), [1, 2, 3]);
});

test('works with promises', async t => {
	const fixture = () => [
		Promise.resolve(1),
		Promise.resolve(2),
		Promise.resolve(3)
	];

	t.deepEqual(await pSome(fixture(), {count: 1}), [1]);
	t.deepEqual(await pSome(fixture(), {count: 2}), [1, 2]);
	t.deepEqual(await pSome(fixture(), {count: 3}), [1, 2, 3]);
});

test('returns values in the order they resolved', async t => {
	const fixture = [
		delay(100, {value: 1}),
		Promise.resolve(2),
		delay(50, {value: 3})
	];

	t.deepEqual(await pSome(fixture, {count: 3}), [2, 3, 1]);
});

test('rejects with all errors if satisfying `count` becomes impossible', async t => {
	const fixture = [
		Promise.reject(new Error('foo')),
		Promise.resolve(1),
		Promise.reject(new Error('bar')),
		Promise.resolve(2)
	];

	const error = await t.throwsAsync(pSome(fixture, {count: 3}), pSome.AggregateError);
	const items = [...error];
	t.is(items.length, 2);
	t.deepEqual(items, [new Error('foo'), new Error('bar')]);
});

test('rejects with all errors if satisfying `count` becomes impossible #2', async t => {
	const fixture = [
		Promise.reject(new Error('foo')),
		Promise.resolve(1),
		Promise.reject(new Error('bar')),
		Promise.resolve(2)
	];

	const error = await t.throwsAsync(pSome(fixture, {count: 4}), pSome.AggregateError);
	const items = [...error];
	t.is(items.length, 1);
	t.deepEqual(items, [new Error('foo')]);
});

test('returns an array of values', async t => {
	const fixture = [
		Promise.reject(new Error(1)),
		Promise.resolve(2),
		Promise.reject(new Error(3)),
		Promise.resolve(4)
	];

	t.deepEqual(await pSome(fixture, {count: 2}), [2, 4]);
});

test('returns an array of values #2', async t => {
	const fixture = () => [
		Promise.resolve(1),
		Promise.resolve(2),
		Promise.reject(new Error(3)),
		Promise.resolve(4),
		Promise.reject(new Error(5))
	];

	t.deepEqual(await pSome(fixture(), {count: 1}), [1]);
	t.deepEqual(await pSome(fixture(), {count: 2}), [1, 2]);
	t.deepEqual(await pSome(fixture(), {count: 3}), [1, 2, 4]);
});

test('only returns values that passes `filter` option', async t => {
	const fixture = [
		'foo',
		1,
		Promise.resolve('foo'),
		Promise.resolve(2)
	];

	t.deepEqual(await pSome(fixture, {count: 1, filter: value => typeof value === 'number'}), [1]);
	t.deepEqual(await pSome(fixture, {count: 2, filter: value => typeof value === 'number'}), [1, 2]);
});

test('reject with AggregateError when values returned from `filter` option doesn\'t match `count`', async t => {
	const fixture = [
		'foo',
		Promise.resolve(1),
		Promise.resolve('foo'),
		2
	];

	const errors = await t.throwsAsync(
		pSome(fixture, {count: 3, filter: value => typeof value === 'number'}),
		pSome.AggregateError
	);

	for (const error of errors) {
		t.true(error instanceof pSome.FilterError);
		t.is(error.message, 'Value does not satisfy filter');
	}
});

test('reject with AggregateError when unfulfillable', async t => {
	const fixture = [
		Promise.resolve(1),
		Promise.resolve(2),
		Promise.reject(new Error('boom'))
	];

	const error = await t.throwsAsync(pSome(fixture, {count: 2, filter: value => value > 1}), pSome.AggregateError);
	t.regex(error.message, /Error: boom/);
	t.regex(error.message, /Error: Value does not satisfy filter/);
});

test('cancels pending promises when cancel is called', async t => {
	const fixture = [
		new PCancelable(resolve => resolve(1)),
		new PCancelable(resolve => resolve(2)),
		new PCancelable(async resolve => {
			await delay(10);
			resolve(2);
		}),
		new PCancelable(async resolve => {
			await delay(100);
			resolve(4);
		})
	];

	const promise = pSome(fixture, {count: 4});
	promise.cancel();

	await t.throwsAsync(promise, PCancelable.CancelError);
	t.is(await fixture[0], 1);
	t.is(await fixture[1], 2);
	await t.throwsAsync(fixture[2], PCancelable.CancelError);
	await t.throwsAsync(fixture[3], PCancelable.CancelError);
});

test('can handle non-cancelable promises', async t => {
	const fixture = [
		new PCancelable(resolve => resolve(1)),
		delay(100, {value: 2}),
		new PCancelable(async resolve => {
			await delay(10);
			resolve(2);
		}),
		delay(200, {value: 4})
	];

	t.deepEqual(await pSome(fixture, {count: 1}), [1]);
	t.is(await fixture[1], 2);
	await t.throwsAsync(fixture[2], PCancelable.CancelError);
	t.is(await fixture[3], 4);
});

test('cancels pending promises when count is reached', async t => {
	const fixture = [
		new PCancelable(resolve => resolve(1)),
		new PCancelable(async resolve => {
			await delay(50);
			resolve(2);
		}),
		new PCancelable(async resolve => {
			await delay(100);
			resolve(3);
		}),
		new PCancelable(async resolve => {
			await delay(200);
			resolve(4);
		})
	];

	t.deepEqual(await pSome(fixture, {count: 2}), [1, 2]);
	await t.throwsAsync(fixture[2], PCancelable.CancelError);
	await t.throwsAsync(fixture[3], PCancelable.CancelError);
});

test('cancels pending promises if satisfying `count` becomes impossible', async t => {
	const fixture = [
		new PCancelable((_, reject) => reject(new Error('foo'))),
		new PCancelable(async (_, reject) => {
			await delay(10);
			reject(new Error('bar'));
		}),
		new PCancelable(async (_, reject) => {
			await delay(200);
			reject(new Error('baz'));
		}),
		new PCancelable(async (_, reject) => {
			await delay(300);
			reject(new Error('qux'));
		})
	];

	const error = await t.throwsAsync(pSome(fixture, {count: 3}, pSome.AggregateError));
	const items = [...error];
	t.is(items.length, 2);
	t.deepEqual(items, [new Error('foo'), new Error('bar')]);
	await t.throwsAsync(fixture[2], PCancelable.CancelError);
	await t.throwsAsync(fixture[3], PCancelable.CancelError);
});
