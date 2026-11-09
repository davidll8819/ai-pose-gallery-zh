import {mkdirSync,readFileSync,writeFileSync,existsSync,readdirSync,rmSync,statSync} from 'node:fs';
import path from 'node:path';
export function createUploads(directory){
 const locate=(owner,id)=>{if(!/^[a-f0-9]{64}$/.test(owner)||!/^[a-f0-9-]{36}$/.test(id))throw Error('invalid_upload');return path.join(directory,owner,id)};
 return {
 put(owner,id,index,{total,data}){
  if(!Number.isInteger(total)||total<1||total>1000||!Number.isInteger(index)||index<0||index>=total||typeof data!=='string'||data.length>12000)throw Error('invalid_upload');
  const dir=locate(owner,id);mkdirSync(path.dirname(dir),{recursive:true,mode:0o700});
  if(!existsSync(dir))for(const name of readdirSync(path.dirname(dir))){if(/^[a-f0-9-]{36}$/.test(name)){const old=path.join(path.dirname(dir),name);if(Date.now()-statSync(old).mtimeMs>3600000)rmSync(old,{recursive:true});}}
  if(!existsSync(dir)&&readdirSync(path.dirname(dir)).length>=12)throw Error('upload_limit');
  mkdirSync(dir,{recursive:true,mode:0o700});const metadata=path.join(dir,'total');
  if(existsSync(metadata)&&Number(readFileSync(metadata,'utf8'))!==total)throw Error('upload_conflict');
  writeFileSync(metadata,String(total),{mode:0o600});const file=path.join(dir,String(index));
  if(existsSync(file)&&readFileSync(file,'utf8')!==data)throw Error('upload_conflict');
  writeFileSync(file,data,{mode:0o600});return {id,index};
 },
 read(owner,id){const dir=locate(owner,id);const total=Number(readFileSync(path.join(dir,'total'),'utf8'));let image='';for(let i=0;i<total;i++)image+=readFileSync(path.join(dir,String(i)),'utf8');if(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(image)||image.length>12*1024*1024)throw Error('invalid_upload');return image;},
 remove(owner,id){rmSync(locate(owner,id),{recursive:true,force:true});},
 };
}
