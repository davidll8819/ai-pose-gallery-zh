import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createJobs} from './jobs.mjs';
const input={requestId:'11111111-1111-4111-8111-111111111111',prompt:'test',locale:'en',images:Array(3).fill('data:image/png;base64,aA==')};
test('persists result and restricts reads to owner', async()=>{
 const directory=mkdtempSync(path.join(tmpdir(),'pose-jobs-'));
 try{
 const gateway={configured:true,model:'wan2.7-image-pro',generate:async()=>({imageUrl:'test'})};
 const jobs=createJobs({directory,gateway});const job=jobs.start('owner-a',input);
 assert.equal(jobs.start('owner-a',input).id,job.id);
 assert.equal(jobs.get('owner-b',job.id),null);assert.equal(jobs.list('owner-b').length,0);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(createJobs({directory,gateway}).get('owner-a',job.id).status,'completed');
 }finally{rmSync(directory,{recursive:true});}
});
test('restart marks interrupted job failed; cancel cannot become completed',async()=>{
 const directory=mkdtempSync(path.join(tmpdir(),'pose-jobs-'));
 try{
 let finish;const gateway={configured:true,generate:()=>new Promise(resolve=>{finish=resolve;})};
 const jobs=createJobs({directory,gateway});const job=jobs.start('owner',input);
 assert.equal(createJobs({directory,gateway}).get('owner',job.id).error,'server_restarted');
 await new Promise(resolve=>setImmediate(resolve));jobs.cancel('owner',job.id);finish({imageUrl:'late'});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(jobs.get('owner',job.id).status,'cancelled');
 }finally{rmSync(directory,{recursive:true});}
});
