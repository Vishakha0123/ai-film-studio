/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** "true" unlocks Coming-soon features (Audio, Music, Generate Teaser) */
  readonly VITE_UNLOCK_PREVIEW?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
