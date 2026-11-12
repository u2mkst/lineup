import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { fetchMembers, linkMyPlayer } from '../../lib/cloud';
import { checkPassword, clearPending, isEmail, readPending, type Pending } from '../../lib/pending';
import { go, paths } from '../../lib/route';
import { useStore } from '../../lib/store';
import { reloadRoster } from '../../lib/sync';
import { toast } from '../../lib/toast';
import { useAsync } from '../../lib/useAsync';
import { IconLogo } from '../Icons';
import { Loading } from '../ui';
import { NextButton, Wizard } from './Wizard';

export function Splash() {
  return <div className="auth-screen"><IconLogo width={56} height={56} /><p className="muted small" role="status">불러오는 중…</p></div>;
}

const invitedLine = (p: Pending | null) =>
  p?.kind === 'setup' ? '구단을 만드는 링크로 들어오셨어요. 가입하면 바로 관리자로 시작해요.' : p ? '초대 링크로 들어오셨어요. 가입하면 바로 합류돼요.' : '팀원만 쓸 수 있는 우리 팀 전용 공간이에요.';

type Phase = 'welcome' | 'email' | 'password' | 'sent';

/** Sign in or sign up, one field per screen. */
export function LoginScreen() {
  const signIn = useAuth(s => s.signIn);
  const signUp = useAuth(s => s.signUp);
  const resend = useAuth(s => s.resend);
  const pending = readPending();
  const [mode, setMode] = useState<'in' | 'up'>('up');
  const [phase, setPhase] = useState<Phase>('welcome');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [unconfirmed, setUnconfirmed] = useState(false);

  const begin = (m: 'in' | 'up') => { setMode(m); setError(''); setPhase('email'); };
  const check = checkPassword(password);

  const submitPassword = async () => {
    setError(''); setUnconfirmed(false);
    if (mode === 'up' && !check.ok) { setError('비밀번호 조건을 모두 채워 주세요.'); return; }
    setBusy(true);
    try {
      if (mode === 'in') await signIn(email, password);
      else if ((await signUp(email, password)).needsConfirm) setPhase('sent');
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      if (mode === 'in' && /인증 링크/.test(msg)) setUnconfirmed(true);
    } finally {
      setBusy(false);
    }
  };

  const sendAgain = async () => {
    try { await resend(email); toast('인증 메일을 다시 보냈어요'); } catch (err) { toast((err as Error).message, 'error'); }
  };

  if (phase === 'welcome') {
    return (
      <Wizard title="우리 팀 축구방" sub={invitedLine(pending)} onSubmit={() => begin('up')}
        footer={<>
          <NextButton>시작하기</NextButton>
          <button type="button" className="btn ghost lg block" onClick={() => begin('in')}>이미 계정이 있어요</button>
        </>}>
        <div className="wiz-hero" aria-hidden><IconLogo width={84} height={84} /></div>
        <ul className="wiz-points">
          <li>일정 확인하고 참석 투표</li>
          <li>경기 기록과 시즌 통계</li>
          <li>라인업·전술 한눈에</li>
        </ul>
      </Wizard>
    );
  }

  if (phase === 'sent') {
    return (
      <Wizard title="메일을 확인해 주세요" sub={`${email}로 인증 메일을 보냈어요. 메일의 버튼을 누른 뒤 돌아와 로그인해 주세요.${pending ? ' 초대 정보는 이 기기에 기억해 둘게요.' : ''}`}
        onSubmit={() => { setMode('in'); setPassword(''); setError(''); setPhase('password'); }}
        footer={<>
          <NextButton>인증했어요, 로그인할게요</NextButton>
          <button type="button" className="btn ghost lg block" onClick={() => void sendAgain()}>메일 다시 보내기</button>
        </>} />
    );
  }

  if (phase === 'email') {
    return (
      <Wizard step={1} total={2} title={mode === 'up' ? '이메일 주소를 알려주세요' : '가입한 이메일이 뭐예요?'} sub={mode === 'up' ? '로그인할 때 쓰는 주소예요.' : undefined}
        onBack={() => setPhase('welcome')} onSubmit={() => { if (isEmail(email)) { setError(''); setPhase('password'); } }}
        footer={<NextButton disabled={!isEmail(email)}>다음</NextButton>}>
        <input className="wiz-input" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} autoFocus
          placeholder="name@example.com" aria-label="이메일" value={email} onChange={e => setEmail(e.target.value)} />
      </Wizard>
    );
  }

  return (
    <Wizard step={2} total={2} title={mode === 'up' ? '비밀번호를 만들어 주세요' : '비밀번호를 입력해 주세요'}
      sub={email} onBack={() => { setPassword(''); setError(''); setPhase('email'); }} onSubmit={() => void submitPassword()}
      footer={<NextButton busy={busy} disabled={!password || (mode === 'up' && !check.ok)}>{mode === 'up' ? '가입하기' : '로그인'}</NextButton>}>
      <div className="wiz-pass">
        <input className="wiz-input" type={show ? 'text' : 'password'} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} autoFocus
          aria-label="비밀번호" value={password} onChange={e => setPassword(e.target.value)} />
        <button type="button" className="link" onClick={() => setShow(v => !v)}>{show ? '숨기기' : '보기'}</button>
      </div>
      {mode === 'up' && (
        <ul className="wiz-checks" aria-label="비밀번호 조건">
          <li className={check.long ? 'ok' : ''}>8자 이상</li>
          <li className={check.letter ? 'ok' : ''}>글자 포함</li>
          <li className={check.digit ? 'ok' : ''}>숫자 포함</li>
        </ul>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      {unconfirmed && <button type="button" className="link" onClick={() => void sendAgain()}>인증 메일 다시 받기</button>}
      <button type="button" className="link wiz-switch" onClick={() => { setMode(m => (m === 'up' ? 'in' : 'up')); setError(''); setUnconfirmed(false); }}>
        {mode === 'up' ? '이미 계정이 있어요' : '처음이에요, 가입할게요'}
      </button>
    </Wizard>
  );
}

/**
 * Signed in but not in the team yet. A remembered invite / setup link is used automatically;
 * otherwise the code is typed (one field).
 */
export function JoinScreen() {
  const join = useAuth(s => s.join);
  const claim = useAuth(s => s.claim);
  const signOut = useAuth(s => s.signOut);
  const user = useAuth(s => s.user);
  const pending = useRef(readPending()).current;
  const [first, setFirst] = useState(pending?.kind === 'setup');
  const [code, setCode] = useState(pending?.code ?? '');
  const [busy, setBusy] = useState(!!pending);
  const [error, setError] = useState('');
  const tried = useRef(false);

  const enter = async (kind: 'invite' | 'setup', value: string) => {
    setBusy(true); setError('');
    try {
      await (kind === 'setup' ? claim(value) : join(value));
      clearPending();
      toast(kind === 'setup' ? '관리자로 시작해요' : '구단에 합류했어요');
      if (kind === 'setup') go(paths.setup()); else go(paths.home);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!pending || tried.current) return;
    tried.current = true;
    void enter(pending.kind, pending.code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (busy && pending && !error) {
    return <div className="auth-screen"><IconLogo width={56} height={56} /><p className="muted small" role="status">{pending.kind === 'setup' ? '구단을 만드는 중…' : '구단에 합류하는 중…'}</p></div>;
  }

  return (
    <Wizard title={first ? '설정 코드를 입력해 주세요' : '합류코드를 입력해 주세요'}
      sub={first ? '구단을 처음 만드는 사람만 쓰는 1회용 코드예요.' : '팀 단체방에서 받은 코드예요. 초대 링크를 열었다면 입력하지 않아도 돼요.'}
      onSubmit={() => void enter(first ? 'setup' : 'invite', code)}
      footer={<>
        <NextButton busy={busy} disabled={!code.trim()}>{first ? '관리자로 시작' : '합류하기'}</NextButton>
        <button type="button" className="link wiz-switch" onClick={() => { setFirst(f => !f); setError(''); setCode(''); }}>{first ? '합류코드로 들어갈게요' : '구단을 처음 만드는 사람이에요'}</button>
        <button type="button" className="link wiz-switch" onClick={() => { clearPending(); void signOut(); }}>{user?.email} 로그아웃</button>
      </>}>
      <input className="wiz-input code-in" value={code} autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={16} autoFocus
        aria-label={first ? '설정 코드' : '합류코드'} onChange={e => setCode(e.target.value.toUpperCase())} />
      {error && <p className="error" role="alert">{error}</p>}
    </Wizard>
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
    <Wizard title="나는 누구인가요?" sub="이름을 누르면 참석 투표와 기록이 내 이름으로 남아요."
      footer={<button type="button" className="btn ghost lg block" onClick={onSkip}>선수로 뛰지 않아요 · 나중에 할게요</button>}>
      {members.loading && !members.data ? <Loading /> : (
        <div className="picker-list">
          {free.map(p => (
            <button type="button" key={p.id} className="picker-row" disabled={busy} onClick={() => void pick(p.id)}>
              <span className="pk-num">{p.number}</span><span className="pk-name">{p.name}</span><span className="pk-pos">{p.pos}</span><span />
            </button>
          ))}
          {free.length === 0 && <p className="muted small">연결할 수 있는 선수가 없어요. 관리자에게 선수 등록을 요청해 주세요.</p>}
        </div>
      )}
    </Wizard>
  );
}
