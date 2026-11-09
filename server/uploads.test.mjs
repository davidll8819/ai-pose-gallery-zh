import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createUploads} from './uploads.mjs';
test('independent chunks are idempotent, ordered and owner scoped',()=>{
 const directory=mkdtempSync(path.join(tmpdir(),'pose-uploads-'));
 try{const uploads=createUploads(directory);const owner='a'.repeat(64),id='11111111-1111-4111-8111-111111111111';
 uploads.put(owner,id,1,{total:2,data:'aGVsbG8='});uploads.put(owner,id,0,{total:2,data:'data:image/png;base64,'});uploads.put(owner,id,0,{total:2,data:'data:image/png;base64,'});
 assert.equal(uploads.read(owner,id),'data:image/png;base64,aGVsbG8=');
 assert.throws(()=>uploads.read('b'.repeat(64),id));
 assert.throws(()=>uploads.put(owner,id,0,{total:2,data:'different'}),/conflict/);
 uploads.remove(owner,id);assert.throws(()=>uploads.read(owner,id));
 assert.throws(()=>uploads.put(owner,'../escape',0,{total:1,data:'x'}),/invalid/);
 }finally{rmSync(directory,{recursive:true});}
});
