import {createContext, useContext, useEffect, useState, type ReactNode} from 'react'
import english from './en.json'
let currentLocale='zh-CN'
export function translate(text:string){return currentLocale==='en'?((english as Record<string,string>)[text]||strings[text]||text):text}
type Locale='zh-CN'|'en'
type Mode=Locale|'platform'
const strings:Record<string,string>={
 '工作台':'Workspace','图库总览':'Gallery overview','AI 角色合成台':'AI character studio','三大参考图库':'Reference galleries','动作姿势库':'Poses','服装穿搭库':'Costumes','人像颜值库':'Portraits','配置与说明':'Settings and help','API 接口配置':'API settings','使用说明与免责声明':'Guide and disclaimer','AI 角色三合一参考台':'Portrait, costume and pose studio','当前角色配方':'Current character recipe','未选择 · 点击去捏人':'No references selected','点击进入 AI 合成台':'Open AI studio','访问 GitHub 仓库':'View source repository','安全模式 (SFW)':'Safe mode (SFW)','18+ 完整模式':'18+ full gallery','随机捏人':'Random character','AI 合成台':'AI studio',
}
const Context=createContext({locale:'zh-CN' as Locale,mode:'platform' as Mode,setMode:(_mode:Mode)=>{},t:(text:string)=>text})
export const useLocale=()=>useContext(Context)
export function LocaleProvider({children}:{children:ReactNode}){
 const [locale,setLocale]=useState<Locale>('zh-CN')
 const [mode,setModeState]=useState<Mode>('platform')
 const [scope,setScope]=useState<string|null>(null)
 const [platform,setPlatform]=useState<Locale|null>(null)
 const [embedded,setEmbedded]=useState(false)
 const setMode=(value:Mode)=>{setModeState(value);if(scope)sessionStorage.setItem(`pose-locale:${scope}`,value)}
 useEffect(()=>{
  let disposed=false
  const poll=async()=>{try{
   const response=await fetch('/api/locale');if(!response.ok)return
   const data=await response.json();if(disposed)return
   setEmbedded(Boolean(data.platform));setPlatform(data.locale==='en'?'en':data.locale==='zh-CN'?'zh-CN':null)
   if(typeof data.scope==='string'){setScope(data.scope);const saved=sessionStorage.getItem(`pose-locale:${data.scope}`);if(['en','zh-CN','platform'].includes(saved||''))setModeState(saved as Mode)}
  }catch{/* Keep current language through temporary disconnects. */}}
  void poll();const timer=setInterval(()=>void poll(),3000);window.addEventListener('focus',poll)
  return()=>{disposed=true;clearInterval(timer);window.removeEventListener('focus',poll)}
 },[])
 useEffect(()=>{
  const effective=embedded&&platform?platform:mode!=='platform'?mode:platform||(navigator.language.startsWith('zh')?'zh-CN':'en')
  currentLocale=effective;document.documentElement.lang=effective;setLocale(effective)
 },[embedded,mode,platform])
 return <Context.Provider value={{locale,mode,setMode,t:translate}}>{children}</Context.Provider>
}
export function LocaleSelect(){const {mode,setMode,locale}=useLocale();return <select aria-label={locale==='en'?'Language':'语言'} value={mode} onChange={event=>setMode(event.target.value as Mode)} className="h-8 max-w-32 rounded-md border bg-background px-2 text-sm"><option value="platform">{locale==='en'?'Follow 4yi':'跟随 4yi'}</option><option value="zh-CN">中文</option><option value="en">English</option></select>}
