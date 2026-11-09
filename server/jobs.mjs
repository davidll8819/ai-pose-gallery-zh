import {randomUUID, createHash} from 'node:crypto';
import {mkdirSync, readdirSync, readFileSync, writeFileSync, renameSync} from 'node:fs';
import path from 'node:path';
export function createJobs({directory, gateway}) {
  mkdirSync(directory,{recursive:true,mode:0o700});
  const jobs=new Map(), controllers=new Map();
  const save=job=>{const file=path.join(directory,job.id+'.json');writeFileSync(file+'.tmp',JSON.stringify(job),{mode:0o600});renameSync(file+'.tmp',file);};
  for(const name of readdirSync(directory).filter(n=>/^[a-f0-9-]{36}\.json$/.test(n))){const job=JSON.parse(readFileSync(path.join(directory,name),'utf8'));if(['queued','running'].includes(job.status)){job.status='failed';job.error='server_restarted';save(job);}jobs.set(job.id,job);}
  const scope=(org,user)=>createHash('sha256').update(JSON.stringify([org,user])).digest('hex');
  const get=(owner,id)=>{const job=jobs.get(id);return job?.owner===owner?job:null;};
  return {scope,get,
    list:owner=>[...jobs.values()].filter(j=>j.owner===owner).map(({result:_result,...job})=>job).reverse(),
    start(owner,input){
      if(typeof input?.requestId!=='string'||!/^[a-f0-9-]{36}$/.test(input.requestId))throw new Error('invalid_generation_input');
      const previous=[...jobs.values()].find(job=>job.owner===owner&&job.requestId===input.requestId);
      if(previous)return previous;
      if(!gateway.configured)throw new Error('image_gateway_not_configured');
      if(controllers.size>=2)throw new Error('generation_busy');
      if(!input || typeof input.prompt!=='string' || input.prompt.length>12000 || !input.prompt.trim() || !Array.isArray(input.images) || input.images.length!==3 || !input.images.every(x=>typeof x==='string'&&x.startsWith('data:image/')) || !['zh-CN','en'].includes(input.locale))throw new Error('invalid_generation_input');
      const job={id:randomUUID(),requestId:input.requestId,owner,status:'running',createdAt:Date.now(),locale:input.locale,prompt:input.prompt,model:gateway.model};
      save(job);jobs.set(job.id,job);const controller=new AbortController();controllers.set(job.id,controller);
      Promise.resolve().then(()=>gateway.generate(input,controller.signal)).then(result=>{if(job.status==='cancelled')return;job.result=result;job.status='completed';save(job);}).catch(error=>{if(job.status==='cancelled')return;job.status='failed';job.error=/^(image_|invalid_|images_)/.test(error.message)?error.message:'generation_failed';save(job);}).finally(()=>controllers.delete(job.id));
      return job;
    },
    cancel(owner,id){const job=get(owner,id);if(!job)return null;if(job.status==='running'){job.status='cancelled';save(job);controllers.get(id)?.abort();}return job;},
  };
}
