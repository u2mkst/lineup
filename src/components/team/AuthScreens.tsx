import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { fetchMembers, linkMyPlayer } from '../../lib/cloud';
import { useStore } from '../../lib/store';
import { reloadRoster } from '../../lib/sync';
import { toast } from '../../lib/toast';
import { useAsync } from '../../lib/useAsync';
import { IconLogo } from '../Icons';
import { Loading, Segmented } from '../ui';

export function Splash() {
  return <div className="auth-screen"><IconLogo width={56} height={56} /><p className="muted small" role="status">불러오는 중…</p></div>;
}

function AuthFrame({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand"><IconLogo width={44} height={44} /><span>축구방</span></div>
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
        {children}
      </div>
    </div>
  );
}

/** Email + password. Signing up only creates the account; the team is joined with a code afterwards. */
export function LoginScreen() {
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
      if (mode === 'in') await signIn(email, password);
      else if ((await signUp(email, password)).needsConfirm) setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <AuthFrame title="메일을 확인해 주세요" sub={`${email}로 인증 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인해 주세요.`}>
        <button className="btn primary lg block" onClick={() => { setSent(false); setMode('in'); setPassword(''); }}>로그인하러 가기</button>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame title={mode === 'in' ? '우리 팀에 로그인' : '계정 만들기'} sub="우리 팀 전용 공간이에요. 팀원만 이용할 수 있어요.">
      <Segmented<'in' | 'up'> label="로그인 방식" value={mode} onChange={m => { setMode(m); setError(''); }} options={[{ id: 'in', label: '로그인' }, { id: 'up', label: '가입' }]} />
      <form className="form-col" onSubmit={submit}>
        <label className="field"><span>이메일</span>
          <input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label className="field"><span>비밀번호{mode === 'up' ? ' (8자 이상)' : ''}</span>
          <input type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} required minLength={mode === 'up' ? 8 : undefined}
            value={password} onChange={e => setPassword(e.target.value)} /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary lg block" type="submit" disabled={busy}>{busy ? '잠시만요…' : mode === 'in' ? '로그인' : '가입하기'}</button>
      </form>
      <p className="hint">{mode === 'up' ? '가입한 뒤에 팀에서 받은 합류코드를 입력하면 팀 정보를 볼 수 있어요.' : '처음이면 "가입"을 눌러 계정을 만들어 주세요.'}</p>
    </AuthFrame>
  );
}

/** Signed in but not in the team yet: enter the join code (or the one-time setup code for the first admin). */
export function JoinScreen() {
  const join = useAuth(s => s.join);
  const claim = useAuth(s => s.claim);
  const signOut = useAuth(s => s.signOut);
  const user = useAuth(s => s.user);
  const [first, setFirst] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await (first ? claim(code) : join(code));
      toast(first ? '관리자로 시작해요' : '구단에 합류했어요');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame title={first ? '관리자 설정 코드' : '구단 합류하기'} sub={first ? '처음 구단을 시작하는 사람만 쓰는 1회용 코드예요.' : '팀 단체방에서 받은 합류코드를 입력해 주세요.'}>
      <form className="form-col" onSubmit={submit}>
        <label className="field"><span>{first ? '설정 코드' : '합류코드'}</span>
          <input className="code-in" value={code} autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={16} required autoFocus
            onChange={e => setCode(e.target.value.toUpperCase())} /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary lg block" type="submit" disabled={busy || !code.trim()}>{busy ? '확인 중…' : first ? '관리자로 시작' : '합류하기'}</button>
      </form>
      <div className="auth-links">
        <button className="link" onClick={() => { setFirst(f => !f); setError(''); setCode(''); }}>{first ? '합류코드로 들어갈게요' : '처음 만드는 관리자예요'}</button>
        <button className="link" onClick={() => void signOut()}>{user?.email} 로그아웃</button>
      </div>
    </AuthFrame>
  );
}

/** After joining: pick your own player profile (skippable, e.g. for a coach who does not play). */
export function LinkPlayerScreen({ onSkip }: { onSkip: () => void }) {
  const roster = useStore(s => s.roster);
  const refresh = useAuth(s => s.refresh);
  const members = useAsync(fetchMembers, []);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void reloadRoster().catch(() => undefined); }, []);

  const taken = new Set((members.data ?? []).map(m => m.playerId).filter(Boolean));
  const free = roster.filter(p => !taken.has(p.id));

  const pick = async (id: string) => {
    setBusy(true);
    try { await linkMyPlayer(id); await refresh(); toast('선수 프로필을 연결했어요'); } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  };

  return (
    <AuthFrame title="나는 누구인가요?" sub="내 선수 프로필을 고르면 참석 투표와 기록이 내 이름으로 남아요.">
      {members.loading && !members.data ? <Loading /> : (
        <div className="picker-list">
          {free.map(p => (
            <button key={p.id} className="picker-row" disabled={busy} onClick={() => void pick(p.id)}>
              <span className="pk-num">{p.number}</span><span className="pk-name">{p.name}</span><span className="pk-pos">{p.pos}</span><span />
            </button>
          ))}
          {free.length === 0 && <p className="muted small">연결할 수 있는 선수가 없어요. 관리자에게 선수 등록을 요청해 주세요.</p>}
        </div>
      )}
      <button className="btn ghost block" onClick={onSkip}>나중에 할게요 (선수로 뛰지 않아요)</button>
    </AuthFrame>
  );
}
