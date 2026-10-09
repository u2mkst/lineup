import { useEffect, useState } from 'react';
import {
  canShareFile, download, exportFramePng, exportGif, exportLineupPng, exportVideo, share, videoSupported,
  type Output,
} from '../lib/exporters';
import { Sheet } from './Sheet';
import type { Player, Tactic } from '../types';

interface Props {
  tactic: Tactic;
  roster: Player[];
  frameIndex: number;
  speed: number;
  onClose: () => void;
}

type Kind = 'lineup' | 'frame' | 'gif' | 'video';

export function ExportSheet({ tactic, roster, frameIndex, speed, onClose }: Props) {
  const [busy, setBusy] = useState<{ kind: Kind; progress: number | null } | null>(null);
  const [result, setResult] = useState<{ out: Output; url: string; sharable: boolean } | null>(null);
  const [error, setError] = useState('');
  const multi = tactic.frames.length > 1;

  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);

  const run = async (kind: Kind) => {
    setError(''); setResult(null);
    setBusy({ kind, progress: kind === 'gif' || kind === 'video' ? 0 : null });
    const onProgress = (p: number) => setBusy({ kind, progress: p });
    try {
      const out =
        kind === 'lineup' ? await exportLineupPng(tactic, roster)
        : kind === 'frame' ? await exportFramePng(tactic, roster, frameIndex)
        : kind === 'gif' ? await exportGif(tactic, roster, speed, onProgress)
        : await exportVideo(tactic, roster, speed, onProgress);
      setResult({ out, url: URL.createObjectURL(out.blob), sharable: canShareFile(out) });
    } catch (e) {
      setError((e as Error).message || '내보내기에 실패했어요');
    } finally {
      setBusy(null);
    }
  };

  const doShare = async () => {
    if (!result) return;
    try { await share(result.out, tactic.name); } catch { setError('공유하지 못했어요. 저장 후 카카오톡에서 직접 보내 주세요.'); }
  };

  const items: { kind: Kind; title: string; desc: string; disabled?: boolean }[] = [
    { kind: 'lineup', title: '라인업 이미지', desc: '선발 11명 + 교체 명단 (PNG)' },
    { kind: 'frame', title: `장면 ${frameIndex + 1} 이미지`, desc: '지금 보고 있는 전술 장면 (PNG)' },
    { kind: 'gif', title: '전술 GIF', desc: multi ? '카톡에서 바로 움직여요' : '장면을 2개 이상 만들어 주세요', disabled: !multi },
    { kind: 'video', title: '전술 영상', desc: multi ? (videoSupported() ? '재생 시간만큼 걸려요 (mp4/webm)' : '이 브라우저는 지원하지 않아요') : '장면을 2개 이상 만들어 주세요', disabled: !multi || !videoSupported() },
  ];

  return (
    <Sheet title="내보내기" onClose={onClose}>
      <div className="export-list">
        {items.map(it => (
          <button key={it.kind} className="export-row" disabled={!!busy || it.disabled} onClick={() => run(it.kind)}>
            <strong>{it.title}</strong>
            <span>{it.desc}</span>
          </button>
        ))}
      </div>

      {busy && (
        <div className="progress" role="status">
          <div className="bar"><i style={{ width: `${Math.round((busy.progress ?? 0.3) * 100)}%` }} /></div>
          <span>만드는 중… {busy.progress != null ? `${Math.round(busy.progress * 100)}%` : ''}</span>
        </div>
      )}
      {error && <p className="error">{error}</p>}

      {result && (
        <div className="result">
          {result.out.kind === 'video'
            ? <video src={result.url} controls playsInline muted loop autoPlay />
            : <img src={result.url} alt="내보내기 미리보기" />}
          <div className="result-actions">
            <button className="btn" onClick={() => download(result.out)}>저장</button>
            {result.sharable && <button className="btn kakao" onClick={doShare}>공유 · 카카오톡</button>}
          </div>
          <p className="muted small">
            {result.sharable
              ? '공유를 누르고 공유창에서 카카오톡을 선택하면 채팅방에 바로 보낼 수 있어요.'
              : '이 기기에서는 공유창을 열 수 없어요. 저장한 뒤 카카오톡에서 파일로 보내 주세요.'}
          </p>
        </div>
      )}
    </Sheet>
  );
}
