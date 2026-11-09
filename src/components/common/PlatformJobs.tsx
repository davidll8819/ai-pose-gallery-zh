import {useEffect, useState} from 'react'

type Job = {id:string; status:string; model:string; createdAt:number; error?:string; result?:{imageUrl:string}}
export function PlatformJobs() {
  const [runtime,setRuntime]=useState<{platform:boolean; configured:boolean; model:string}|null>(null)
  const [jobs,setJobs]=useState<Job[]>([])
  const [error,setError]=useState('')
  const [selected,setSelected]=useState<Job|null>(null)
  const [locale,setLocale]=useState(document.documentElement.lang)
  const en=locale.startsWith('en')
  useEffect(()=>{
    let stopped=false
    const load=async()=>{
      try {
        const response=await fetch('/api/runtime')
        if(!response.ok || !response.headers.get('content-type')?.includes('application/json'))return
        const config=await response.json()
        if(!config.platform || stopped)return
        setRuntime(config)
        const result=await fetch('/api/jobs')
        if(!result.ok)throw new Error('unavailable')
        const data=await result.json()
        if(!stopped){setJobs(data.jobs);setError('')}
      }catch{if(!stopped)setError('unavailable')}
    }
    void load()
    const timer=setInterval(()=>void load(),3000)
    const observer=new MutationObserver(()=>setLocale(document.documentElement.lang))
    observer.observe(document.documentElement,{attributes:true,attributeFilter:['lang']})
    window.addEventListener('online',load)
    return()=>{stopped=true;clearInterval(timer);observer.disconnect();window.removeEventListener('online',load)}
  },[])
  if(!runtime)return null
  const labels:Record<string,string>=en?{running:'Generating',completed:'Completed',failed:'Failed',cancelled:'Cancelled'}:{running:'生成中',completed:'已完成',failed:'失败',cancelled:'已取消'}
  const open=async(id:string)=>{
    try{const response=await fetch(`/api/jobs/${id}`);if(!response.ok)throw new Error();setSelected(await response.json());setError('')}catch{setError('unavailable')}
  }
  const cancel=async(id:string)=>{
    try{const response=await fetch(`/api/jobs/${id}/cancel`,{method:'POST'});if(!response.ok)throw new Error();const current=await response.json();setJobs(list=>list.map(job=>job.id===id?current:job));setError('')}catch{setError('unavailable')}
  }
  return <section className="rounded-lg border p-4 space-y-3" aria-label={en?'4yi generation tasks':'4yi 生成任务'}>
    <p>{runtime.configured?`${en?'Platform model':'平台模型'}: ${runtime.model}`:en?'Platform image model is not configured':'平台图像模型尚未配置'}</p>
    <p className="text-sm text-muted-foreground">{en?'Portrait, costume and pose are sent as three separate references. Tasks survive page refresh.':'人像、服装、姿势作为三张独立参考图提交。刷新页面后可在此查看任务和结果。'}</p>
    {error&&<p role="alert">{en?'Connection unavailable. Retrying automatically.':'暂时无法连接，正在自动重试。'}</p>}
    {jobs.length===0&&<p>{en?'No tasks yet':'暂无任务'}</p>}
    <ul className="space-y-2">{jobs.slice(0,30).map(job=><li key={job.id} className="flex flex-wrap items-center gap-3 text-sm">
      <span>{new Intl.DateTimeFormat(en?'en':'zh-CN',{dateStyle:'short',timeStyle:'short'}).format(job.createdAt)}</span>
      <span>{labels[job.status]||job.status}</span>
      {job.error&&<span>{job.error==='server_restarted'?(en?'Server restarted; submit again to retry':'服务已重启；请重新提交重试'):job.error}</span>}
      {job.status==='completed'&&<button className="underline" onClick={()=>void open(job.id)}>{en?'View result':'查看结果'}</button>}
      {job.status==='running'&&<button className="underline" onClick={()=>void cancel(job.id)}>{en?'Cancel':'取消'}</button>}
    </li>)}</ul>
    {selected?.result&&<div className="space-y-2">
      <img className="max-h-96 max-w-full object-contain" src={selected.result.imageUrl} alt={en?'Generated result':'生成结果'}/>
      <a className="underline" href={selected.result.imageUrl} download={`4yi-${selected.id}`}>{en?'Download original':'下载原图'}</a>
      <button className="ml-4 underline" onClick={()=>setSelected(null)}>{en?'Close':'关闭'}</button>
    </div>}
  </section>
}
