import { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { addPostComment, deletePost, deletePostComment, fetchPost, fetchPostComments, fetchPosts, savePost } from '../../lib/cloud';
import { go, paths } from '../../lib/route';
import { useStore } from '../../lib/store';
import { toast } from '../../lib/toast';
import { useAsync } from '../../lib/useAsync';
import type { Post } from '../../types';
import { IconMessage, IconPin, IconPlus } from '../Icons';
import { Menu } from '../Menu';
import { Sheet } from '../Sheet';
import { Empty, Loading, PageHeader } from '../ui';

const when = (iso: string) => new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** Display name for things the member writes: linked player, else nickname. */
export function useAuthorName(): string {
  const member = useAuth(s => s.member);
  const roster = useStore(s => s.roster);
  return roster.find(p => p.id === member?.playerId)?.name ?? member?.nickname ?? '팀원';
}

function PostForm({ post, onClose, onSaved }: { post?: Post; onClose: () => void; onSaved: (p: Post) => void }) {
  const isAdmin = useAuth(s => s.isAdmin);
  const author = useAuthorName();
  const [title, setTitle] = useState(post?.title ?? '');
  const [body, setBody] = useState(post?.body ?? '');
  const [pinned, setPinned] = useState(post?.pinned ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('제목을 입력해 주세요.'); return; }
    setBusy(true); setError('');
    try { onSaved(await savePost({ id: post?.id, authorName: author, title, body, ...(isAdmin ? { pinned } : {}) })); } catch (err) { setError((err as Error).message); setBusy(false); }
  };

  return (
    <Sheet title={post ? '글 수정' : '글쓰기'} onClose={onClose}>
      <form className="form-col" onSubmit={submit}>
        <label className="field"><span>제목</span><input value={title} maxLength={80} onChange={e => setTitle(e.target.value)} required /></label>
        <label className="field"><span>내용</span><textarea className="text-in" rows={8} maxLength={4000} value={body} onChange={e => setBody(e.target.value)} /></label>
        {isAdmin && <label className="check"><input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} /> 공지로 고정 (홈에 표시돼요)</label>}
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary lg block" type="submit" disabled={busy}>{busy ? '저장 중…' : post ? '저장' : '등록'}</button>
      </form>
    </Sheet>
  );
}

export function BoardPage() {
  const posts = useAsync(fetchPosts, []);
  const [writing, setWriting] = useState(false);
  return (
    <>
      <PageHeader title="게시판" back={paths.more} right={<button className="btn sm primary" onClick={() => setWriting(true)}><IconPlus width={15} height={15} /> 글쓰기</button>} />
      {posts.loading && !posts.data && <Loading />}
      {posts.error && !posts.data && <Empty title="게시글을 불러오지 못했어요" action={<button className="btn sm" onClick={() => void posts.reload()}>다시 시도</button>} />}
      {posts.data?.length === 0 && <Empty title="아직 글이 없어요" hint="첫 글을 남겨 보세요." />}
      <div className="list-stack">
        {posts.data?.map(p => (
          <a key={p.id} className="post-row" href={paths.post(p.id)}>
            <span className="post-title">{p.pinned && <IconPin width={14} height={14} className="pin" />}<strong>{p.title}</strong></span>
            <span className="muted small">{p.authorName} · {when(p.createdAt)}{p.commentCount > 0 && <> · <IconMessage width={12} height={12} /> {p.commentCount}</>}</span>
          </a>
        ))}
      </div>
      {writing && <PostForm onClose={() => setWriting(false)} onSaved={p => { setWriting(false); go(paths.post(p.id)); }} />}
    </>
  );
}

export function PostPage({ id }: { id: string }) {
  const member = useAuth(s => s.member);
  const isAdmin = useAuth(s => s.isAdmin);
  const author = useAuthorName();
  const post = useAsync(() => fetchPost(id), [id]);
  const comments = useAsync(() => fetchPostComments(id), [id]);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const p = post.data;

  if (post.loading && p === undefined) return <><PageHeader title="게시판" back={paths.board} /><Loading /></>;
  if (!p) return <><PageHeader title="게시판" back={paths.board} /><Empty title="글을 찾을 수 없어요" /></>;
  const mine = p.authorId === member?.userId;

  const run = async (fn: () => Promise<unknown>, after?: () => void) => {
    setBusy(true);
    try { await fn(); after?.(); } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="게시판" back={paths.board} right={(mine || isAdmin) && (
        <Menu label="글 메뉴" items={[
          { label: '수정', onClick: () => setEditing(true) },
          ...(isAdmin ? [{ label: p.pinned ? '공지 해제' : '공지로 고정', onClick: () => void run(() => savePost({ id: p.id, authorName: p.authorName, title: p.title, body: p.body, pinned: !p.pinned }), () => void post.reload()) }] : []),
          { label: '삭제', danger: true, onClick: () => confirm('이 글을 삭제할까요?') && void run(() => deletePost(p.id), () => go(paths.board)) },
        ]} />
      )} />
      <article className="card post">
        <h2>{p.pinned && <IconPin width={16} height={16} className="pin" />}{p.title}</h2>
        <p className="muted small">{p.authorName} · {when(p.createdAt)}</p>
        <div className="post-body">{p.body || <span className="muted">내용이 없어요.</span>}</div>
      </article>
      <section className="card">
        <h3>댓글 {comments.data?.length ? <span className="count">{comments.data.length}</span> : null}</h3>
        <ul className="comment-list">
          {comments.data?.map(c => (
            <li key={c.id}>
              <div><strong>{c.authorName}</strong><span className="muted small"> · {when(c.createdAt)}</span></div>
              <p>{c.body}</p>
              {(isAdmin || c.authorId === member?.userId) && <button className="btn sm ghost danger" disabled={busy} onClick={() => void run(() => deletePostComment(c.id), () => void comments.reload())}>삭제</button>}
            </li>
          ))}
        </ul>
        <form className="comment-form" onSubmit={e => { e.preventDefault(); if (!text.trim()) return; void run(() => addPostComment(p.id, author, text), () => { setText(''); void comments.reload(); }); }}>
          <input className="text-in" maxLength={500} placeholder={`${author}(으)로 댓글 남기기`} value={text} onChange={e => setText(e.target.value)} aria-label="댓글" />
          <button className="btn primary" type="submit" disabled={busy || !text.trim()}>등록</button>
        </form>
      </section>
      {editing && <PostForm post={p} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); void post.reload(); }} />}
    </>
  );
}
