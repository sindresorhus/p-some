import {expectType} from 'tsd';
import pSome, {AggregateError, CancelablePromise} from './index.js';

expectType<CancelablePromise<number[]>>(
	pSome([Promise.resolve(1), Promise.resolve(2)], {count: 1})
);

expectType<CancelablePromise<Array<string | number | boolean>>>(
	pSome<string | number | boolean>(
		[Promise.resolve(1), Promise.resolve('a'), Promise.resolve(false)],
		{count: 1}
	)
);

expectType<CancelablePromise<Array<string | number | boolean>>>(
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

// TODO: This is a TypeScript bug.
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const aggregateError = new AggregateError([new Error('error')]);
expectType<AggregateError>(aggregateError);
