/**
 * The club's public channels. Handles can be overridden at build time:
 * VITE_INSTAGRAM_HANDLE, VITE_YOUTUBE_HANDLE and (optional, to show the latest uploads in the app) VITE_YOUTUBE_CHANNEL_ID.
 */
const HANDLE = /^[A-Za-z0-9._-]{1,40}$/;
const clean = (v: string | undefined, fallback: string) => {
  const s = (v ?? '').trim().replace(/^@/, '');
  return HANDLE.test(s) ? s : fallback;
};

export interface Social {
  instagram: { handle: string; url: string };
  youtube: { handle: string; url: string; /** embeddable "latest uploads" playlist, only when the channel id is known */ uploadsEmbed: string | null };
}

export function socialLinks(env: Record<string, string | undefined> = import.meta.env as Record<string, string | undefined>): Social {
  const ig = clean(env.VITE_INSTAGRAM_HANDLE, 'yeonmufc');
  const yt = clean(env.VITE_YOUTUBE_HANDLE, 'yeonmufc');
  const channel = (env.VITE_YOUTUBE_CHANNEL_ID ?? '').trim();
  // A channel's uploads playlist id is its channel id with the "UC" prefix swapped for "UU".
  const uploads = /^UC[\w-]{22}$/.test(channel) ? `https://www.youtube.com/embed/videoseries?list=UU${channel.slice(2)}` : null;
  return {
    instagram: { handle: ig, url: `https://www.instagram.com/${ig}/` },
    youtube: { handle: yt, url: `https://www.youtube.com/@${yt}`, uploadsEmbed: uploads },
  };
}
