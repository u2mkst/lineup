import { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { checkPlayerCode, type CodeInfo } from '../../lib/cloud';
import { clearPending } from '../../lib/pending';
import { MIN_PLAYER_PASSWORD, checkUsername, isCode, normalizeCode, normalizeUsername } from '../../lib/playerId';
import { NextButton, Wizard } from './Wizard';

/** Sign in with an ID (players) or an e-mail (staff). The session is kept on this device, so it is a one-time step. */
export function IdLogin({ onBack }: { onBack: () => void }) {
  const signIn = useAuth(s => s.signIn);
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'id' | 'pass'>('id');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true); setError('');
    try { await signIn(id, password); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  if (step === 'id') {
    return (
      <Wizard step={1} total={2} title="아이디가 뭐예요?" sub="가입할 때 정한 아이디 (스태프는 이메일)" onBack={onBack}
        onSubmit={() => { if (id.trim()) { setError(''); setStep('pass'); } }} footer={<NextButton disabled={!id.trim()}>다음</NextButton>}>
        <input className="wiz-input" value={id} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoFocus aria-label="아이디"
          onChange={e => setId(e.target.value)} />
      </Wizard>
    );
  }
  return (
    <Wizard step={2} total={2} title="비밀번호를 입력해 주세요" sub={id.trim()} onBack={() => { setPassword(''); setError(''); setStep('id'); }}
      onSubmit={() => void submit()} footer={<NextButton busy={busy} disabled={!password}>로그인</NextButton>}>
      <div className="wiz-pass">
        <input className="wiz-input" type={show ? 'text' : 'password'} autoComplete="current-password" autoFocus aria-label="비밀번호" value={password} onChange={e => setPassword(e.target.value)} />
        <button type="button" className="link" onClick={() => setShow(v => !v)}>{show ? '숨기기' : '보기'}</button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <p className="hint">한 번 로그인하면 이 기기에서는 계속 로그인 상태로 유지돼요. 비밀번호를 잊었다면 감독에게 새 코드를 요청하세요.</p>
    </Wizard>
  );
}

type Step = 'code' | 'who' | 'id' | 'pass';

/** Personal code → "is this you?" → choose an ID → choose a password → signed in for good. */
export function CodeSignUp({ initialCode, onBack }: { initialCode: string; onBack: () => void }) {
  const claimPlayer = useAuth(s => s.claimPlayer);
  const [step, setStep] = useState<Step>('code');
  const [code, setCode] = useState(normalizeCode(initialCode));
  const [info, setInfo] = useState<CodeInfo | null>(null);
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const total = info?.recovery ? 2 : 3;
  const idCheck = checkUsername(id);
  const passOk = password.length >= MIN_PLAYER_PASSWORD;

  const verify = async () => {
    setBusy(true); setError('');
    try { setInfo(await checkPlayerCode(code)); setStep('who'); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const finish = async () => {
    setBusy(true); setError('');
    try {
      await claimPlayer({ code, username: info?.recovery ? undefined : normalizeUsername(id), password });
      clearPending();
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      if (/아이디/.test(msg) && !info?.recovery) setStep('id');
    } finally { setBusy(false); }
  };

  if (step === 'code') {
    return (
      <Wizard step={1} total={3} title="내 코드를 입력해 주세요" sub="감독에게 받은 8자리 코드예요. 링크로 받았다면 이미 채워져 있어요." onBack={onBack}
        onSubmit={() => { if (isCode(code)) void verify(); }} footer={<NextButton busy={busy} disabled={!isCode(code)}>다음</NextButton>}>
        <input className="wiz-input code-in" value={code} maxLength={9} autoCapitalize="characters" autoComplete="off" autoCorrect="off" spellCheck={false} autoFocus aria-label="선수 코드"
          onChange={e => setCode(normalizeCode(e.target.value).slice(0, 8))} />
        {error && <p className="error" role="alert">{error}</p>}
      </Wizard>
    );
  }

  if (step === 'who' && info) {
    return (
      <Wizard step={1} total={total} title={`${info.playerName} 선수가 맞나요?`}
        sub={info.recovery ? `이미 가입한 계정(${info.username})의 비밀번호를 새로 정해요.` : '맞다면 아이디와 비밀번호를 정해 주세요.'} onBack={() => { setInfo(null); setStep('code'); }}
        onSubmit={() => setStep(info.recovery ? 'pass' : 'id')}
        footer={<>
          <NextButton>네, 맞아요</NextButton>
          <button type="button" className="btn ghost lg block" onClick={() => { setInfo(null); setCode(''); setStep('code'); }}>아니에요, 코드를 다시 입력할게요</button>
        </>} />
    );
  }

  if (step === 'id') {
    return (
      <Wizard step={2} total={3} title="아이디를 정해 주세요" sub="로그인할 때 쓰는 이름이에요. 영문 소문자·숫자·밑줄(_) 3~20자" onBack={() => setStep('who')}
        onSubmit={() => { if (idCheck.ok) { setError(''); setStep('pass'); } }} footer={<NextButton disabled={!idCheck.ok}>다음</NextButton>}>
        <input className="wiz-input" value={id} maxLength={20} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoFocus aria-label="아이디"
          placeholder="예) kimhamin" onChange={e => setId(e.target.value)} />
        <ul className="wiz-checks" aria-label="아이디 조건">
          <li className={idCheck.long ? 'ok' : ''}>3~20자</li>
          <li className={idCheck.chars && id ? 'ok' : ''}>영문 소문자·숫자·_</li>
        </ul>
        {error && <p className="error" role="alert">{error}</p>}
      </Wizard>
    );
  }

  return (
    <Wizard step={total} total={total} title="비밀번호를 정해 주세요" sub={info?.recovery ? info.username ?? undefined : normalizeUsername(id)}
      onBack={() => { setError(''); setStep(info?.recovery ? 'who' : 'id'); }} onSubmit={() => { if (passOk) void finish(); }}
      footer={<NextButton busy={busy} disabled={!passOk}>시작하기</NextButton>}>
      <div className="wiz-pass">
        <input className="wiz-input" type={show ? 'text' : 'password'} autoComplete="new-password" autoFocus aria-label="비밀번호" value={password} onChange={e => setPassword(e.target.value)} />
        <button type="button" className="link" onClick={() => setShow(v => !v)}>{show ? '숨기기' : '보기'}</button>
      </div>
      <ul className="wiz-checks" aria-label="비밀번호 조건"><li className={passOk ? 'ok' : ''}>{MIN_PLAYER_PASSWORD}자 이상</li></ul>
      {error && <p className="error" role="alert">{error}</p>}
      <p className="hint">시작하면 이 기기에서는 계속 로그인 상태로 유지돼요.</p>
    </Wizard>
  );
}
