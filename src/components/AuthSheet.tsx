import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { toast } from '../lib/toast';
import { Sheet } from './Sheet';

/** Admin sign-in / sign-up. Everyone who signs up becomes an admin. */
export function AuthSheet({ onClose }: { onClose: () => void }) {
  const signIn = useAuth(s => s.signIn);
  const signUp = useAuth(s => s.signUp);
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (mode === 'up' && password.length < 8) { setError('비밀번호는 8자 이상으로 입력해 주세요.'); return; }
    setBusy(true);
    try {
      if (mode === 'in') {
        await signIn(email, password);
        toast('로그인했어요');
        onClose();
      } else {
        const { needsConfirm } = await signUp(email, password);
        if (needsConfirm) setSent(true);
        else { toast('가입했어요. 관리자 권한이 부여됐어요'); onClose(); }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <Sheet title="메일을 확인해 주세요" onClose={onClose}>
        <p><b>{email}</b>로 인증 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인해 주세요.</p>
        <button className="btn primary" onClick={() => { setSent(false); setMode('in'); setPassword(''); }}>로그인하러 가기</button>
      </Sheet>
    );
  }

  return (
    <Sheet title={mode === 'in' ? '관리자 로그인' : '관리자 가입'} onClose={onClose}>
      <div className="segmented tight" role="tablist">
        <button role="tab" aria-selected={mode === 'in'} className={mode === 'in' ? 'on' : ''} onClick={() => { setMode('in'); setError(''); }}>로그인</button>
        <button role="tab" aria-selected={mode === 'up'} className={mode === 'up' ? 'on' : ''} onClick={() => { setMode('up'); setError(''); }}>가입</button>
      </div>
      <form className="form-col" onSubmit={submit}>
        <label className="field"><span>이메일</span>
          <input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
        </label>
        <label className="field"><span>비밀번호{mode === 'up' ? ' (8자 이상)' : ''}</span>
          <input type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} required minLength={mode === 'up' ? 8 : undefined}
            value={password} onChange={e => setPassword(e.target.value)} />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary lg" type="submit" disabled={busy}>{busy ? '잠시만요…' : mode === 'in' ? '로그인' : '가입하기'}</button>
      </form>
      <p className="hint">
        {mode === 'up'
          ? '가입하면 관리자 권한이 부여돼요. 선수 명단 관리, 전술의 서버 저장과 팀 공개를 쓸 수 있어요.'
          : '관리자는 선수 명단을 관리하고, 전술을 서버에 저장해 팀에 공개할 수 있어요. 팀원은 로그인 없이 쓸 수 있어요.'}
      </p>
    </Sheet>
  );
}
