import { lazy, Suspense, useEffect, useState } from 'react'
import { routeFromHash } from './routing'
import { loadWorkspaceRoutes, saveWorkspaceRoutes } from './workspaceNavigation'

const ShipWorkspace = lazy(() => import('./ShipWorkspace'))
const CraftingWorkspace = lazy(() => import('./features/CraftingWorkspace'))

export default function App() {
  const [route, setRoute] = useState(() => routeFromHash(window.location.hash))
  const tool = route.tab === 'crafting' ? 'crafting' : 'ships'
  const [shipsVisited, setShipsVisited] = useState(tool === 'ships')
  const [previous, setPrevious] = useState(loadWorkspaceRoutes)
  useEffect(() => saveWorkspaceRoutes(previous), [previous])
  useEffect(() => {
    const restore = () => {
      const next = routeFromHash(window.location.hash)
      const feature = next.tab === 'crafting' ? 'crafting' : 'ships'
      const hash = window.location.hash || '#/dashboard'
      setPrevious((routes) => ({ ...routes, [feature]: hash }))
      if (feature === 'ships') setShipsVisited(true)
      setRoute(next)
    }
    restore()
    window.addEventListener('hashchange', restore)
    window.addEventListener('popstate', restore)
    window.addEventListener('app-route-change', restore)
    return () => {
      window.removeEventListener('hashchange', restore)
      window.removeEventListener('popstate', restore)
      window.removeEventListener('app-route-change', restore)
    }
  }, [])
  return (
    <>
      <div className="tool-bar">
        <span className="tool-brand">BLACK DESERT · TOOLS</span>
        <nav aria-label="도구 선택">
          <a
            href={previous.ships}
            className={tool === 'ships' ? 'active' : ''}
            aria-current={tool === 'ships' ? 'page' : undefined}
          >
            함선 성장
          </a>
          <a
            href={previous.crafting}
            className={tool === 'crafting' ? 'active' : ''}
            aria-current={tool === 'crafting' ? 'page' : undefined}
          >
            제작 시뮬레이터
          </a>
        </nav>
      </div>
      <Suspense
        fallback={
          <main>
            <p>도구 불러오는 중…</p>
          </main>
        }
      >
        {shipsVisited && <ShipWorkspace active={tool === 'ships'} />}
        {tool === 'crafting' && <CraftingWorkspace route={route} />}
      </Suspense>
    </>
  )
}
