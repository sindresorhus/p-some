import {expectType} from 'tsd';
import pSome from './index.js';

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
