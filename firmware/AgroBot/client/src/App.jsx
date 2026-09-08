import { useEffect, useState } from 'react'
import Home from './pages/Home'
import UserConfig from './pages/UserConfig'
import Login from './pages/Login'
import 'leaflet/dist/leaflet.css'

function App() {
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname)
  const onLoginState = null;

  const handleNavigate = (path) => {
    setCurrentPath(path)
    window.history.pushState({}, '', path)
  }

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  if (currentPath === '/userconf') {
    return <UserConfig onNavigate={handleNavigate} />
  }
  if(currentPath === '/login'){
    return <Login onNavigate={handleNavigate} onLogin={onLoginState}/>
  }

  return <Home onNavigate={handleNavigate} />
}

export default App