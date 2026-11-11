import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { addComment, deleteComment, fetchComments, setAck } from '../lib/cloud';
import { paths } from '../lib/route';
import { useStore } from '../lib/store';
import { toast } from '../lib/toast';
import type { TacticComment } from '../types';

const ago = (iso: string) => new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** "확인했어요" and comments under a shared tactic. Authors are team members. */
export function TacticComments({ tacticId }: { tacticId: string }) {
  const roster = useStore(s => s.roster);
  const isAdmin = useAuth(s => s.isAdmin);
  const member = useAuth(s => s.member);
  const me = roster.find(p => p.id === member?.playerId);
  const name = me?.name ?? member?.nickname ?? '';
  const [items, setItems] = useState<TacticComment[] | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try { setItems(await fetchComments(tacticId)); } catch { setItems(prev => prev ?? []); }
  }, [tacticId]);
  useEffect(() => { void reload(); }, [reload]);

  const acks = (items ?? []).filter(c => c.kind === 'ack');
  const comments = (items ?? []).filter(c => c.kind === 'comment');
  const iAcked = !!me && acks.some(a => a.playerId === me.id);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); await reload(); } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  };

  return (
    <section className="comments">
      {me ? (
        <div className="ack-row">
          <button className={`btn ${iAcked ? '' : 'primary'}`} disabled={busy} aria-pressed={iAcked} onClick={() => void run(() => setAck(tacticId, me.id, me.name, !iAcked))}>
            {iAcked ? '✓ 확인했어요 (취소)' : '확인했어요'}
          </button>
          <span className="muted small">{acks.length ? `${acks.length}명 확인: ${acks.map(a => a.author || '?').join(', ')}` : '아직 확인한 사람이 없어요'}</span>
        </div>
      ) : (
        <p className="hint">{acks.length ? `${acks.length}명 확인: ${acks.map(a => a.author || '?').join(', ')} · ` : ''}내 선수 프로필을 연결하면 "확인했어요"를 남길 수 있어요. <a className="link" href={paths.me}>연결하기</a></p>
      )}

      <h3>댓글 {comments.length > 0 && <span className="count">{comments.length}</span>}</h3>
      {items === null && <p className="muted small">불러오는 중…</p>}
      <ul className="comment-list">
        {comments.map(c => (
          <li key={c.id}>
            <div><strong>{c.author || '팀원'}</strong><span className="muted small"> · {ago(c.createdAt)}</span></div>
            <p>{c.body}</p>
            {(isAdmin || c.playerId === me?.id) && <button className="btn sm ghost danger" disabled={busy} onClick={() => confirm('이 댓글을 삭제할까요?') && void run(() => deleteComment(c.id))}>삭제</button>}
          </li>
        ))}
      </ul>
      <form className="comment-form" onSubmit={e => { e.preventDefault(); if (!text.trim()) return; void run(() => addComment(tacticId, me?.id ?? '', name || '팀원', text)).then(() => setText('')); }}>
        <input className="text-in" maxLength={200} placeholder={name ? `${name}(으)로 댓글 남기기` : '댓글 남기기'} value={text} onChange={e => setText(e.target.value)} aria-label="댓글" />
        <button className="btn primary" type="submit" disabled={busy || !text.trim()}>등록</button>
      </form>
    </section>
  );
}
