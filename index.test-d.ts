import pSome, {pEvery} from './index.js';

declare function expectType<T>(value: T): void;

expectType<Promise<number[]>>(pSome([Promise.resolve(1), Promise.resolve(2)], {count: 1}));

expectType<Promise<Array<string | number>>>(pSome([Promise.resolve(1), Promise.resolve('a')], {
	count: 2,
	filter(value) {
		expectType<string | number>(value);
		return true;
	},
}));

expectType<Promise<number[]>>(pSome<number>([Promise.resolve(1)], {count: 1}));
expectType<Promise<number[]>>(pSome<Promise<number>>([Promise.resolve(1)], {
	count: 1,
	filter(value) {
		expectType<number>(value);
		// @ts-expect-error Input promises are awaited before calling the filter.
		value.then(() => true);
		return true;
	},
}));

expectType<Promise<Array<string | number | boolean>>>(pSome<string | number | boolean>(
	[Promise.resolve(1), Promise.resolve('a'), Promise.resolve(false)],
	{count: 1},
));

expectType<Promise<Array<string | number | boolean>>>(pSome<string | number | boolean>(
	[Promise.resolve(1), Promise.resolve('a'), Promise.resolve(false)],
	{
		count: 1,
		filter(element) {
			expectType<string | number | boolean>(element);
			return false;
		},
	},
));

expectType<Promise<Array<string | number | boolean>>>(pSome<string | number | boolean>(
	[Promise.resolve(1), Promise.resolve('a'), Promise.resolve(false)],
	{
		count: 1,
		async filter(element) {
			expectType<string | number | boolean>(element);
			return false;
		},
	},
));

expectType<Promise<Array<string | number | boolean>>>(pSome<string | number | boolean>(
	[Promise.resolve(1), Promise.resolve('a'), Promise.resolve(false)],
	{
		count: 1,
		signal: new AbortController().signal,
	},
));

const aggregateError = new AggregateError([new Error('error')], 'Test error');
expectType<AggregateError>(aggregateError);

// PEvery type tests
expectType<Promise<boolean>>(pEvery([Promise.resolve(1), Promise.resolve(2)], value => value > 0));

expectType<Promise<boolean>>(pEvery([Promise.resolve(1), Promise.resolve('a')], value => {
	expectType<string | number>(value);
	return true;
}));

expectType<Promise<boolean>>(pEvery<number>([Promise.resolve(1)], value => value > 0));
expectType<Promise<boolean>>(pEvery<Promise<number>>([Promise.resolve(1)], value => {
	expectType<number>(value);
	// @ts-expect-error Input promises are awaited before calling the test function.
	value.then(() => true);
	return true;
}));

expectType<Promise<boolean>>(pEvery<string | number>([Promise.resolve(1), Promise.resolve('a')], value => {
	expectType<string | number>(value);
	return true;
}));

expectType<Promise<boolean>>(pEvery([Promise.resolve(1), Promise.resolve(2)], async value => {
	expectType<number>(value);
	return value % 2 === 0;
}));

expectType<Promise<boolean>>(pEvery([Promise.resolve(1), Promise.resolve(2)], value => value > 0, {
	concurrency: 2,
}));

expectType<Promise<boolean>>(pEvery([Promise.resolve(1), Promise.resolve(2)], value => value > 0, {
	signal: new AbortController().signal,
}));

expectType<Promise<boolean>>(pEvery([Promise.resolve(1), Promise.resolve(2)], value => value > 0, {
	concurrency: 2,
	signal: new AbortController().signal,
}));
