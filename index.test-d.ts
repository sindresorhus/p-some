import {expectType} from 'tsd';
import pSome = require('.');
import {AggregateError, CancelablePromise} from '.';

expectType<CancelablePromise<number[]>>(
	pSome([Promise.resolve(1), Promise.resolve(2)], {count: 1})
);

expectType<CancelablePromise<(string | number | boolean)[]>>(
	pSome<string | number | boolean>(
		[Promise.resolve(1), Promise.resolve('a'), Promise.resolve(false)],
		{count: 1}
	)
);

expectType<CancelablePromise<(string | number | boolean)[]>>(
	pSome<string | number | boolean>(
		[Promise.resolve(1), Promise.resolve('a'), Promise.resolve(false)],
		{
			count: 1,
			filter(element) {
				expectType<string | number | boolean>(element);
				return false;
			}
		}
	)
);

const aggregateError = new AggregateError([new Error()]);
expectType<AggregateError>(aggregateError);
