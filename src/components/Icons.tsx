import type { ReactNode, SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const base = (children: ReactNode, p: P) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}>
    {children}
  </svg>
);

export const IconBack = (p: P) => base(<path d="M15 18l-6-6 6-6" />, p);
export const IconClose = (p: P) => base(<path d="M18 6L6 18M6 6l12 12" />, p);
export const IconTrash = (p: P) => base(<><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5" /></>, p);
export const IconCopy = (p: P) => base(<><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 012-2h9" /></>, p);
export const IconPlay = (p: P) => base(<path d="M7 4l13 8-13 8z" fill="currentColor" />, p);
export const IconPause = (p: P) => base(<><rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" /><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" /></>, p);
export const IconUndo = (p: P) => base(<><path d="M9 14L4 9l5-5" /><path d="M4 9h10a6 6 0 010 12h-3" /></>, p);
export const IconRedo = (p: P) => base(<><path d="M15 14l5-5-5-5" /><path d="M20 9H10a6 6 0 000 12h3" /></>, p);
export const IconPlus = (p: P) => base(<path d="M12 5v14M5 12h14" />, p);
export const IconShare = (p: P) => base(<><path d="M12 3v12M8 7l4-4 4 4" /><path d="M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" /></>, p);
export const IconDownload = (p: P) => base(<><path d="M12 3v12M8 11l4 4 4-4" /><path d="M5 19h14" /></>, p);
export const IconLink = (p: P) => base(<><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" /></>, p);
export const IconHand = (p: P) => base(<path d="M8 12V5a1.5 1.5 0 013 0v5m0-6a1.5 1.5 0 013 0v6m0-4a1.5 1.5 0 013 0v8a6 6 0 01-6 6h-1a6 6 0 01-5-3l-3-5a1.5 1.5 0 012.5-1.5L8 15" />, p);
export const IconRun = (p: P) => base(<><path d="M4 20L19 5" strokeDasharray="3 3" /><path d="M11 5h8v8" /></>, p);
export const IconPass = (p: P) => base(<><path d="M4 20L19 5" /><path d="M11 5h8v8" /></>, p);
export const IconZone = (p: P) => base(<circle cx="12" cy="12" r="8" strokeDasharray="3 3" />, p);
export const IconEraser = (p: P) => base(<><path d="M4 16l9-11 7 6-7 9H8z" /><path d="M8 20h12" /></>, p);
export const IconLeft = (p: P) => base(<path d="M15 6l-6 6 6 6" />, p);
export const IconRight = (p: P) => base(<path d="M9 6l6 6-6 6" />, p);
export const IconMore = (p: P) => base(<><circle cx="5" cy="12" r="1.5" fill="currentColor" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /><circle cx="19" cy="12" r="1.5" fill="currentColor" /></>, p);
