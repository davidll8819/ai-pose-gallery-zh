let scope='standalone'
export function setStorageScope(value:string){scope=value}
export function getStorageScope(){return scope}
export const scopedStorage={
 getItem:(key:string)=>localStorage.getItem(`${scope}:${key}`),
 setItem:(key:string,value:string)=>localStorage.setItem(`${scope}:${key}`,value),
 removeItem:(key:string)=>localStorage.removeItem(`${scope}:${key}`),
}
