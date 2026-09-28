import assert from 'node:assert/strict';

/**
Wait for a promise to reject and return the rejection reason.

Stands in for the AVA `{instanceOf, message}` assertion options, which `node:assert` does not have. `assert.rejects` cannot return the error, so tests that inspect it need this.

@param {Promise<unknown>} promise - The promise expected to reject.
@param {new (message?: string) => Error} errorType - The expected error constructor.
@returns {Promise<Error>} The rejection reason.
*/
export async function rejectsWith(promise, errorType) {
	let error;

	try {
		await promise;
	} catch (error_) {
		error = error_;
	}

	assert.ok(error instanceof errorType, `Expected rejection with ${errorType.name}, got ${error}`);

	return error;
}
