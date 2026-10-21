import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { getSupabase, setToken } from './api/client'
import './index.css'

/**
 * With Supabase Auth, restore the session (and finish a Google/Apple sign-in redirect, whose tokens
 * arrive in the URL) before the first render, so route guards see the signed-in user.
 */
async function boot() {
  const supabase = getSupabase()
  if (supabase) {
    try {
      const { data } = await (await supabase).auth.getSession()
      setToken(data.session ? 'supabase' : null)
    } catch {
      setToken(null)
    }
  }
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

void boot()
