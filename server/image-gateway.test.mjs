import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createImageGateway} from './image-gateway.mjs';
const input = {prompt:'Combine the references', images:['data:image/png;base64,aGVsbG8='], locale:'en'};
const env = {OPENAI_API_BASE:'https://gateway.invalid/api/v1/', OPENAI_API_KEY:'test-installation-key', IMAGE_MODEL:'selected-image-model'};
test('uses installation configuration and multipart references', async () => {
  const gateway = createImageGateway({env, request:async (url, options) => {
    assert.equal(url, 'https://gateway.invalid/api/v1/images/edits');
    assert.equal(options.headers.Authorization, 'Bearer test-installation-key');
    assert.equal(options.body.get('model'), env.IMAGE_MODEL);
    assert.equal(options.body.getAll('image[]').length, 1);
    return Response.json({data:[{b64_json:Buffer.from('89504e470d0a1a0a','hex').toString('base64')}]});
  }});
  assert.equal((await gateway.generate(input)).modelUsed, env.IMAGE_MODEL);
});
test('fails closed without runtime configuration', async () => {
  await assert.rejects(createImageGateway({env:{}}).generate(input), /not_configured/);
});
test('rejects remote references before contacting provider', async () => {
  await assert.rejects(createImageGateway({env, request:()=>assert.fail('network called')}).generate({...input, images:['http://127.0.0.1/private']}), /invalid_image/);
});
test('does not expose upstream error bodies', async () => {
  await assert.rejects(createImageGateway({env, request:async()=>new Response('secret', {status:402})}).generate(input), /^Error: image_gateway_http_402$/);
});
