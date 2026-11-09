import {useQuery} from '@tanstack/react-query'
export function usePlatform(){return useQuery({queryKey:['platform-runtime'],queryFn:async()=>{
 const response=await fetch('/api/runtime');if(!response.ok||!response.headers.get('content-type')?.includes('application/json'))return null
 return await response.json() as {platform:boolean;configured:boolean;model:string|null}
},retry:1,staleTime:30000}).data}
