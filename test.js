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
	const f = () => [
		Promise.resolve(1),
		Promise.resolve(2),
		Promise.resolve(3)
	];
	t.deepEqual(await pSome(f(), {count: 1}), [1]);
	t.deepEqual(await pSome(f(), {count: 2}), [1, 2]);
	t.deepEqual(await pSome(f(), {count: 3}), [1, 2, 3]);
});

test('returns values in the order they resolved', async t => {
	const f = [
		delay(100, {value: 1}),
		Promise.resolve(2),
		delay(50, {value: 3})
	];
	t.deepEqual(await pSome(f, {count: 3}), [2, 3, 1]);
});

test('rejects with all errors if satisfying `count` becomes impossible', async t => {
	const f = [
		Promise.reject(new Error('foo')),
		Promise.resolve(1),
		Promise.reject(new Error('bar')),
		Promise.resolve(2)
	];
	const err = await t.throwsAsync(pSome(f, {count: 3}), pSome.AggregateError);
	const items = [...err];
	t.is(items.length, 2);
	t.deepEqual(items, [new Error('foo'), new Error('bar')]);
});

test('rejects with all errors if satisfying `count` becomes impossible #2', async t => {
	const f = [
		Promise.reject(new Error('foo')),
		Promise.resolve(1),
		Promise.reject(new Error('bar')),
		Promise.resolve(2)
	];
	const err = await t.throwsAsync(pSome(f, {count: 4}), pSome.AggregateError);
	const items = [...err];
	t.is(items.length, 1);
	t.deepEqual(items, [new Error('foo')]);
});

test('returns an array of values', async t => {
	const f = [
		Promise.reject(new Error(1)),
		Promise.resolve(2),
		Promise.reject(new Error(3)),
		Promise.resolve(4)
	];
	t.deepEqual(await pSome(f, {count: 2}), [2, 4]);
});

test('returns an array of values #2', async t => {
	const f = () => [
		Promise.resolve(1),
		Promise.resolve(2),
		Promise.reject(new Error(3)),
		Promise.resolve(4),
		Promise.reject(new Error(5))
	];
	t.deepEqual(await pSome(f(), {count: 1}), [1]);
	t.deepEqual(await pSome(f(), {count: 2}), [1, 2]);
	t.deepEqual(await pSome(f(), {count: 3}), [1, 2, 4]);
});

test('only returns values that passes `filter` option', async t => {
	const f = [
		'foo',
		Promise.resolve(1),
		Promise.resolve('foo'),
		2
	];
	t.deepEqual(await pSome(f, {count: 1, filter: val => typeof val === 'number'}), [1]);
	t.deepEqual(await pSome(f, {count: 2, filter: val => typeof val === 'number'}), [1, 2]);
});

test('reject with RangeError when values returned from `filter` option doesn\'t match `count`', async t => {
	const f = [
		'foo',
		Promise.resolve(1),
		Promise.resolve('foo'),
		2
	];
	const err = await t.throwsAsync(pSome(f, {count: 3, filter: val => typeof val === 'number'}), RangeError);
	t.is(err.message, 'Not enough values pass the `filter` option');
});

test('cancels pending promises when cancel is called', async t => {
	const f = [
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
	const p = pSome(f, {count: 4});
	p.cancel();
	await t.throwsAsync(p, PCancelable.CancelError);
	t.is(await f[0], 1);
	t.is(await f[1], 2);
	await t.throwsAsync(f[2], PCancelable.CancelError);
	await t.throwsAsync(f[3], PCancelable.CancelError);
});

test('can handle non-cancelable promises', async t => {
	const f = [
		new PCancelable(resolve => resolve(1)),
		delay(100, {value: 2}),
		new PCancelable(async resolve => {
			await delay(10);
			resolve(2);
		}),
		delay(200, {value: 4})
	];
	t.deepEqual(await pSome(f, {count: 1}), [1]);
	t.is(await f[1], 2);
	await t.throwsAsync(f[2], PCancelable.CancelError);
	t.is(await f[3], 4);
});

test('cancels pending promises when count is reached', async t => {
	const f = [
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
	t.deepEqual(await pSome(f, {count: 2}), [1, 2]);
	await t.throwsAsync(f[2], PCancelable.CancelError);
	await t.throwsAsync(f[3], PCancelable.CancelError);
});

test('cancels pending promises if satisfying `count` becomes impossible', async t => {
	const f = [
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
	const err = await t.throwsAsync(pSome(f, {count: 3}, pSome.AggregateError));
	const items = [...err];
	t.is(items.length, 2);
	t.deepEqual(items, [new Error('foo'), new Error('bar')]);
	await t.throwsAsync(f[2], PCancelable.CancelError);
	await t.throwsAsync(f[3], PCancelable.CancelError);
});
