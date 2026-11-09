import http from 'node:http';
import path from 'node:path';
import {readFile, stat} from 'node:fs/promises';
import {createRouterIdentityVerifier} from './router-identity.mjs';
import {createImageGateway} from './image-gateway.mjs';
import {createJobs} from './jobs.mjs';
import {createUploads} from './uploads.mjs';

const root = path.resolve(import.meta.dirname, '..');
const local = process.env.POSE_LOCAL_MODE === '1';
const gateway=createImageGateway();
const jobs=createJobs({directory:path.join(process.env.DATA_DIR || '/data','jobs'),gateway});
const uploads=createUploads(path.join(process.env.DATA_DIR || '/data','uploads'));
if (local && process.env.NODE_ENV === 'production') throw new Error('local_mode_forbidden_in_production');
const verify = local ? () => true : createRouterIdentityVerifier({
  key: process.env.FOURYI_ROUTER_IDENTITY_KEY,
  hostname: process.env.XCLAW_APP_HOSTNAME,
  replayDirectory: path.join(process.env.DATA_DIR || '/data', 'identity-nonces'),
});
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server = http.createServer(async (req,res) => {
  const json = (status, body) => {res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(body));};
  try {
    if (req.url === '/healthz' && req.method === 'GET') return json(200, {status:'ok'});
    if (!['GET','HEAD','POST'].includes(req.method)) return json(405, {error:'method_not_allowed'});
    const chunks=[];let size=0;
    for await(const chunk of req){size+=chunk.length;if(size>16*1024)return json(413,{error:'request_too_large'});chunks.push(chunk);}
    const body=Buffer.concat(chunks);
    if (!verify(req,body)) return json(401, {error:'unauthorized'});
    const pathname = decodeURIComponent(new URL(req.url, 'http://app').pathname);
    if(pathname.includes('\\') || pathname.split('/').some(part=>part==='.'||part==='..') || pathname.includes('\0'))return json(404,{error:'not_found'});
    const owner=jobs.scope(local?'local':req.headers['x-xclaw-owner-org-id'],local?'local':req.headers['x-xclaw-user-id']);
    if(pathname==='/api/runtime')return json(200,{platform:true,configured:gateway.configured,model:gateway.model||null});
    const upload=pathname.match(/^\/api\/uploads\/([a-f0-9-]{36})\/(\d+)$/);
    if(upload&&req.method==='POST'){try{return json(200,uploads.put(owner,upload[1],Number(upload[2]),JSON.parse(body.toString('utf8'))));}catch{return json(400,{error:'invalid_upload'});}}
    if(pathname==='/api/jobs'){
      if(req.method==='GET')return json(200,{jobs:jobs.list(owner)});
      if(req.method==='POST'){try{const input=JSON.parse(body.toString('utf8'));const previous=jobs.list(owner).find(job=>job.requestId===input.requestId);if(previous)return json(202,jobs.get(owner,previous.id));if(input.uploads){if(!Array.isArray(input.uploads)||input.uploads.length!==3)throw Error('invalid_generation_input');input.images=input.uploads.map(id=>uploads.read(owner,id));}const job=jobs.start(owner,input);if(input.uploads)for(const id of input.uploads)uploads.remove(owner,id);return json(202,job);}catch(error){return json(error.message==='generation_busy'?429:400,{error:['generation_busy','image_gateway_not_configured','invalid_generation_input'].includes(error.message)?error.message:'invalid_generation_input'});}}
    }
    const match=pathname.match(/^\/api\/jobs\/([a-f0-9-]{36})(\/cancel)?$/);
    if(match){const job=match[2]&&req.method==='POST'?jobs.cancel(owner,match[1]):req.method==='GET'&&!match[2]?jobs.get(owner,match[1]):null;return json(job?200:404,job||{error:'not_found'});}
    if(req.method==='POST')return json(404,{error:'not_found'});
    if (pathname === '/api/locale') {
      const cookies = Object.fromEntries((req.headers.cookie || '').split(';').map(v => v.trim().split('=')));
      const locale = cookies['__Host-xclaw_app_locale'] || cookies.xclaw_app_locale;
      return json(200, {platform:!local,scope:owner,locale: locale === 'en' ? 'en' : locale === 'zh' ? 'zh-CN' : null});
    }
    if (pathname.startsWith('/api/') || pathname.startsWith('/comfy')) return json(404, {error:'not_found'});
    const assets = /^\/(data|img|thumbs)\//.test(pathname);
    const base = assets ? root : path.join(root,'dist');
    let file = path.resolve(base, '.' + pathname);
    if (file !== base && !file.startsWith(base + path.sep)) return json(404, {error:'not_found'});
    let info;
    try { info = await stat(file); } catch {}
    if (!info?.isFile()) {
      if (assets || path.extname(pathname)) return json(404,{error:'not_found'});
      file = path.join(root,'dist/index.html');
    }
    const content = await readFile(file);
    res.writeHead(200, {'Content-Type':mime[path.extname(file)] || 'application/octet-stream','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Cache-Control':'private, no-cache'});
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch { json(500,{error:'internal_error'}); }
});
server.maxConnections=40;
server.requestTimeout=30000;
server.headersTimeout=15000;
server.listen(Number(process.env.PORT || 3000), local ? '127.0.0.1' : '0.0.0.0');
