const assert = require('assert');
const { resolveStudentId } = require('../middleware/security/feeIntegrityValidator');

(async () => {
  const id = '6a5a2b04607769801051e26b';
  assert.strictEqual(await resolveStudentId({ body: {}, params: {}, path: `/${id}/payment`, user: {} }), id);
  assert.strictEqual(await resolveStudentId({ body: {}, params: {}, path: '/not-an-id/payment', user: {} }), null);
  console.log('fee integrity student ID resolution passed');
})();
