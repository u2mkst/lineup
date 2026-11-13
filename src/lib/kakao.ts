/**
 * KakaoTalk card sharing through the Kakao JavaScript SDK.
 * Needs `VITE_KAKAO_JS_KEY` and the site's domain registered in the Kakao Developers console
 * (앱 > 플랫폼 > Web). Without the key the share buttons are simply hidden.
 */
const KEY = import.meta.env.VITE_KAKAO_JS_KEY;
const SDK = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js';

export const kakaoEnabled = !!KEY;

interface KakaoSdk {
  isInitialized(): boolean;
  init(key: string): void;
  Share: {
    uploadImage(o: { file: File[] }): Promise<{ infos: { original: { url: string; width?: number; height?: number } } }>;
    sendDefault(o: Record<string, unknown>): void;
  };
}

let loading: Promise<KakaoSdk> | null = null;

function load(): Promise<KakaoSdk> {
  if (!KEY) return Promise.reject(new Error('카카오 연동이 설정되지 않았어요'));
  loading ??= new Promise<KakaoSdk>((resolve, reject) => {
    const done = () => {
      const k = (window as unknown as { Kakao?: KakaoSdk }).Kakao;
      if (!k) { reject(new Error('카카오 SDK를 불러오지 못했어요')); return; }
      if (!k.isInitialized()) k.init(KEY);
      resolve(k);
    };
    if ((window as unknown as { Kakao?: unknown }).Kakao) { done(); return; }
    const s = document.createElement('script');
    s.src = SDK; s.async = true; s.crossOrigin = 'anonymous';
    s.onload = done;
    s.onerror = () => { loading = null; reject(new Error('카카오 SDK를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.')); };
    document.head.appendChild(s);
  });
  return loading;
}

const link = (url: string) => ({ mobileWebUrl: url, webUrl: url });

/** Builds the payload for a text card (match info). Exported for tests. */
export function textCard(text: string, url: string, button = '자세히 보기') {
  return { objectType: 'text', text: text.slice(0, 200), link: link(url), buttons: [{ title: button, link: link(url) }] };
}

/** Builds the payload for an image card (line-up / tactic). Exported for tests. */
export function feedCard(o: { title: string; description: string; imageUrl: string; width?: number; height?: number }, url: string, button = '전술 보기') {
  return {
    objectType: 'feed',
    content: { title: o.title.slice(0, 200), description: o.description.slice(0, 200), imageUrl: o.imageUrl, imageWidth: o.width, imageHeight: o.height, link: link(url) },
    buttons: [{ title: button, link: link(url) }],
  };
}

/** Uploads the picture to Kakao and opens the chat picker with a card that links to `url`. */
export async function shareImageCard(o: { title: string; description: string; image: Blob; url: string }): Promise<void> {
  const k = await load();
  const up = await k.Share.uploadImage({ file: [new File([o.image], 'lineup.png', { type: o.image.type || 'image/png' })] });
  const img = up.infos.original;
  k.Share.sendDefault(feedCard({ title: o.title, description: o.description, imageUrl: img.url, width: img.width, height: img.height }, o.url));
}

export async function shareTextCard(o: { text: string; url: string; button?: string }): Promise<void> {
  const k = await load();
  k.Share.sendDefault(textCard(o.text, o.url, o.button));
}
