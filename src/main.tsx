import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { StudioProvider } from '@/store/studioStore'
import {LocaleProvider} from '@/lib/locale'
import {setStorageScope} from '@/lib/scoped-storage'
import { routeTree } from './routeTree.gen'
import './index.css'
import './notifications.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
  interface StaticDataRouteOption {
    title?: string
  }
}

const root=createRoot(document.getElementById('root')!)
async function boot(){
 try {
 const response=await fetch('/api/locale',{signal:AbortSignal.timeout(20000)})
 if(!response.ok)throw new Error('session_unavailable')
 if(response.headers.get('content-type')?.includes('application/json')){const data=await response.json();if(typeof data.scope!=='string')throw new Error('identity_unavailable');setStorageScope(data.scope)}
 root.render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <LocaleProvider><StudioProvider>
          <RouterProvider router={router} />
        </StudioProvider></LocaleProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>
)

 }catch{root.render(<main><p>连接暂不可用 / Connection unavailable</p><button onClick={()=>void boot()}>重试 / Retry</button></main>)}
}
void boot()
