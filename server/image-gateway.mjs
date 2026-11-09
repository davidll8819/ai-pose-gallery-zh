// Platform credentials and model selection never cross the server boundary.
export function createImageGateway({env = process.env, request = fetch} = {}) {
  const base = env.OPENAI_API_BASE?.replace(/\/+$/, '');
  const model = env.IMAGE_MODEL;
  const key = env.OPENAI_API_KEY;
  return {
    configured: Boolean(base && model && key),
    model,
    async generate({prompt, images, locale = 'zh-CN'}, signal) {
      if (!base || !model || !key) throw new Error('image_gateway_not_configured');
      if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 12000) throw new Error('invalid_prompt');
      if (!['zh-CN', 'en'].includes(locale)) throw new Error('invalid_locale');
      if (!Array.isArray(images) || images.length < 1 || images.length > 8) throw new Error('invalid_images');
      const form = new FormData();
      form.append('model', model);
      form.append('response_format', 'b64_json');
      form.append('prompt', prompt);
      let total = 0;
      images.forEach((image, index) => {
        const match = typeof image === 'string' && image.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
        if (!match) throw new Error('invalid_image');
        const bytes = Buffer.from(match[2], 'base64');
        total += bytes.length;
        if (bytes.length > 8 * 1024 * 1024 || total > 24 * 1024 * 1024) throw new Error('images_too_large');
        form.append('image[]', new Blob([bytes], {type:`image/${match[1]}`}), `reference-${index}.${match[1]}`);
      });
      const response = await request(`${base}/images/edits`, {
        method: 'POST', headers: {Authorization:`Bearer ${key}`}, body: form,
        signal: AbortSignal.any([signal || new AbortController().signal, AbortSignal.timeout(240000)]),
      });
      // Provider messages can contain request details and credentials; persist only safe codes.
      if (!response.ok) throw new Error(`image_gateway_http_${response.status}`);
      const reader = response.body.getReader();
      const chunks = []; let size = 0;
      for (;;) {
        const {done, value} = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 32 * 1024 * 1024) {await reader.cancel(); throw new Error('image_result_too_large');}
        chunks.push(Buffer.from(value));
      }
      const result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const encoded = result.data?.[0]?.b64_json;
      // Do not fetch arbitrary provider URLs from inside the installation network.
      if (typeof encoded !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error('image_result_base64_required');
      const bytes = Buffer.from(encoded, 'base64');
      const mime = bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a','hex')) ? 'image/png'
        : bytes.subarray(0, 3).equals(Buffer.from('ffd8ff','hex')) ? 'image/jpeg'
        : bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP' ? 'image/webp' : null;
      if (!mime) throw new Error('invalid_image_result');
      return {imageUrl:`data:${mime};base64,${encoded}`, modelUsed:model, providerUsed:'gpt', locale};
    },
  };
}
