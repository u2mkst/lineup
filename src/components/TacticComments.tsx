import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { addComment, deleteComment, fetchComments, setAck } from '../lib/cloud';
import { useMe } from '../lib/me';
import { useStore } from '../lib/store';
import { toast } from '../lib/toast';
import type { TacticComment } from '../types';
import { MePicker } from './MePicker';

const ago = (iso: string) => new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** "확인했어요" and comments under a public tactic. No account needed: you just say who you are. */
export function TacticComments({ tacticId }: { tacticId: string }) {
  const roster = useStore(s => s.roster);
  const isAdmin = useAuth(s => s.isAdmin);
  const meId = useMe(s => s.playerId);
  const me = roster.find(p => p.id === meId);
  const [items, setItems] = useState<TacticComment[] | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);

  const reload = useCallback(async () => {
    try { setItems(await fetchComments(tacticId)); } catch { setItems(prev => prev ?? []); }
  }, [tacticId]);
  useEffect(() => { void reload(); }, [reload]);

  const acks = (items ?? []).filter(c => c.kind === 'ack');
  const comments = (items ?? []).filter(c => c.kind === 'comment');
  const iAcked = !!me && acks.some(a => a.playerId === me.id);

  const run = async (fn: () => Promise<void>, ok?: string) => {
    setBusy(true);
    try { await fn(); if (ok) toast(ok); await reload(); } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  };
  const needMe = () => { if (!me) { setPicking(true); return true; } return false; };

  return (
    <section className="comments">
      <div className="ack-row">
        <button className={`btn ${iAcked ? '' : 'primary'}`} disabled={busy} aria-pressed={iAcked}
          onClick={() => { if (needMe()) return; void run(() => setAck(tacticId, me!.id, me!.name, !iAcked)); }}>
          {iAcked ? '✓ 확인했어요 (취소)' : '확인했어요'}
        </button>
        <span className="muted small">
          {acks.length ? `${acks.length}명 확인: ${acks.map(a => a.author || '?').join(', ')}` : '아직 확인한 사람이 없어요'}
        </span>
      </div>

      <h3>댓글 {comments.length > 0 && <span className="count">{comments.length}</span>}</h3>
      {items === null && <p className="muted small">불러오는 중…</p>}
      <ul className="comment-list">
        {comments.map(c => (
          <li key={c.id}>
            <div><strong>{c.author || '익명'}</strong><span className="muted small"> · {ago(c.createdAt)}</span></div>
            <p>{c.body}</p>
            {isAdmin && <button className="btn sm ghost danger" disabled={busy} onClick={() => confirm('이 댓글을 삭제할까요?') && void run(() => deleteComment(c.id))}>삭제</button>}
          </li>
        ))}
      </ul>
      <form className="comment-form" onSubmit={e => {
        e.preventDefault();
        if (needMe() || !text.trim()) return;
        void run(() => addComment(tacticId, me!.id, me!.name, text), undefined).then(() => setText(''));
      }}>
        <input className="text-in" maxLength={200} placeholder={me ? `${me.name}(으)로 댓글 남기기` : '댓글 남기기'} value={text} onChange={e => setText(e.target.value)} aria-label="댓글" />
        <button className="btn primary" type="submit" disabled={busy || !text.trim()}>등록</button>
      </form>
      <p className="hint">{me ? <>작성자: <b>{me.name}</b> · <button className="link" onClick={() => setPicking(true)}>바꾸기</button></> : <button className="link" onClick={() => setPicking(true)}>내 이름을 먼저 선택해 주세요</button>}</p>
      {picking && <MePicker onClose={() => setPicking(false)} />}
    </section>
  );
}
