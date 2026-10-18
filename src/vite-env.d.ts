/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** Kakao JavaScript key; enables the KakaoTalk card share button */
  readonly VITE_KAKAO_JS_KEY?: string;
}
