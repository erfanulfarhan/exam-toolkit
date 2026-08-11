import { createContext, useCallback, useContext, useEffect, useState } from 'react'

/**
 * A router in forty lines, because the alternative is a dependency for three
 * routes. Handles pushState navigation, the back button, and modifier clicks,
 * which is the whole contract a static multi-page site needs.
 */

type Ctx = { path: string; navigate: (to: string) => void }
const RouterContext = createContext<Ctx>({ path: '/', navigate: () => {} })

export function useRouter() {
  return useContext(RouterContext)
}

export function Router({ children }: { children: React.ReactNode }) {
  const [path, setPath] = useState(() => window.location.pathname.replace(/\/+$/, '') || '/')

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname.replace(/\/+$/, '') || '/')
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = useCallback((to: string) => {
    if (to === window.location.pathname) return
    window.history.pushState({}, '', to)
    setPath(to.replace(/\/+$/, '') || '/')
    window.scrollTo({ top: 0 })
  }, [])

  return <RouterContext.Provider value={{ path, navigate }}>{children}</RouterContext.Provider>
}

export function Link({
  to, className, children, ...rest
}: { to: string; className?: string; children: React.ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const { navigate } = useRouter()
  return (
    <a
      href={to}
      className={className}
      onClick={(e) => {
        // Let the browser handle new-tab and new-window clicks.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
        e.preventDefault()
        navigate(to)
      }}
      {...rest}
    >
      {children}
    </a>
  )
}
