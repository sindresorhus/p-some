import test from 'ava';
import delay from 'delay';
import m from '.';

test('reject with RangeError when fulfillment is impossible', async t => {
	await t.throws(m([], {count: 1}), RangeError);
	await t.throws(m([1, 2, 3], {count: 4}), RangeError);
	await t.notThrows(m([1, 2, 3], {count: 3}));
	await t.notThrows(m([1, 2, 3], {count: 1}));
});

test('works with values', async t => {
	t.deepEqual(await m([1, 2, 3], {count: 1}), [1]);
	t.deepEqual(await m([1, 2, 3], {count: 2}), [1, 2]);
	t.deepEqual(await m([1, 2, 3], {count: 3}), [1, 2, 3]);
});

test('works with promises', async t => {
	const f = () => [
		Promise.resolve(1),
		Promise.resolve(2),
		Promise.resolve(3)
	];
	t.deepEqual(await m(f(), {count: 1}), [1]);
	t.deepEqual(await m(f(), {count: 2}), [1, 2]);
	t.deepEqual(await m(f(), {count: 3}), [1, 2, 3]);
});

test('returns values in the order they resolved', async t => {
	const f = [
		Promise.resolve(1).then(delay(100)),
		Promise.resolve(2),
		Promise.resolve(3).then(delay(50))
	];
	t.deepEqual(await m(f, {count: 3}), [2, 3, 1]);
});

test('rejects with all errors if satisfying `count` becomes impossible', async t => {
	const f = [
		Promise.reject(new Error('foo')),
		Promise.resolve(1),
		Promise.reject(new Error('bar')),
		Promise.resolve(2)
	];
	const err = await t.throws(m(f, {count: 3}), m.AggregateError);
	const items = Array.from(err);
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
	const err = await t.throws(m(f, {count: 4}), m.AggregateError);
	const items = Array.from(err);
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
	t.deepEqual(await m(f, {count: 2}), [2, 4]);
});

test('returns an array of values #2', async t => {
	const f = () => [
		Promise.resolve(1),
		Promise.resolve(2),
		Promise.reject(new Error(3)),
		Promise.resolve(4),
		Promise.reject(new Error(5))
	];
	t.deepEqual(await m(f(), {count: 1}), [1]);
	t.deepEqual(await m(f(), {count: 2}), [1, 2]);
	t.deepEqual(await m(f(), {count: 3}), [1, 2, 4]);
});

test('only returns values that passes `filter` option', async t => {
	const f = [
		'foo',
		Promise.resolve(1),
		Promise.resolve('foo'),
		2
	];
	t.deepEqual(await m(f, {count: 1, filter: val => typeof val === 'number'}), [1]);
	t.deepEqual(await m(f, {count: 2, filter: val => typeof val === 'number'}), [1, 2]);
});

test('reject with RangeError when values returned from `filter` option doesn\'t match `count`', async t => {
	const f = [
		'foo',
		Promise.resolve(1),
		Promise.resolve('foo'),
		2
	];
	const err = await t.throws(m(f, {count: 3, filter: val => typeof val === 'number'}), RangeError);
	t.is(err.message, 'Not enough values pass the `filter` option');
});
