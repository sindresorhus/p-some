import {expectType} from 'tsd';
import pSome, {pEvery} from './index.js';

expectType<Promise<number[]>>(pSome([Promise.resolve(1), Promise.resolve(2)], {count: 1}));

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
