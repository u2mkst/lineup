import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { addPlayerRemote, deletePlayerRemote, fetchJoinCode, renameTeam, saveMatch } from '../../lib/cloud';
import { inviteLink, inviteMessage } from '../../lib/pending';
import { useInstall } from '../../lib/pwa';
import { useStore } from '../../lib/store';
import { reloadRoster } from '../../lib/sync';
import { toast } from '../../lib/toast';
import type { EventKind, Pos } from '../../types';
import { toLocalInput } from './EventForm';
import { NextButton, Wizard } from './Wizard';

const POS_CHOICES: { id: Pos; label: string; hint: string }[] = [
  { id: 'GK', label: '골키퍼', hint: 'GK' },
  { id: 'DF', label: '수비수', hint: 'DF' },
  { id: 'MF', label: '미드필더', hint: 'MF' },
  { id: 'FW', label: '공격수', hint: 'FW' },
];

type Stage = 'name' | 'roster' | 'p-name' | 'p-number' | 'p-pos' | 'p-added' | 'event' | 'event-form' | 'invite' | 'install' | 'done';
const MAIN: Stage[] = ['name', 'roster', 'event', 'invite', 'install'];
const mainIndex = (s: Stage): number => {
  if (s.startsWith('p-')) return 2;
  if (s === 'event-form') return 3;
  const i = MAIN.indexOf(s);
  return i < 0 ? MAIN.length : i + 1;
};

const nextSaturday = () => {
  const d = new Date();
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
  d.setHours(20, 0, 0, 0);
  return toLocalInput(d.toISOString());
};

/** First-run setup for the first admin: club name → players (one by one) → first event → invite → install. */
export function AdminSetup({ onDone }: { onDone: () => void }) {
  const teamName = useAuth(s => s.teamName);
  const refresh = useAuth(s => s.refresh);
  const roster = useStore(s => s.roster);
  const total = MAIN.length;

  const [stage, setStage] = useState<Stage>('name');
  const [name, setName] = useState(teamName === '우리 팀' ? '' : teamName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [added, setAdded] = useState(0);

  const [pName, setPName] = useState('');
  const [pNumber, setPNumber] = useState('');
  const [pPos, setPPos] = useState<Pos | null>(null);

  const [kind, setKind] = useState<EventKind>('match');
  const [opponent, setOpponent] = useState('');
  const [when, setWhen] = useState(nextSaturday);

  const wrap = async (fn: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  const saveName = () => wrap(async () => {
    if (name.trim() && name.trim() !== teamName) { await renameTeam(name); await refresh(); }
    setStage('roster');
  });

  const clearSample = () => {
    if (!confirm(`지금 등록된 선수 ${roster.length}명을 모두 지울까요? 이 선수들을 쓰던 전술에서는 자리가 비어 보여요.`)) return;
    void wrap(async () => {
      for (const p of roster) await deletePlayerRemote(p.id);
      await reloadRoster();
      toast('명단을 비웠어요. 한 명씩 추가해 볼까요?');
      setStage('p-name');
    });
  };

  const numberTaken = roster.some(p => p.number === pNumber.trim());
  const addPlayer = () => wrap(async () => {
    if (!pPos) return;
    const p = await addPlayerRemote({ number: pNumber.trim(), name: pName.trim(), pos: pPos });
    await reloadRoster().catch(() => undefined);
    setAdded(n => n + 1);
    toast(`${p.name} 선수를 추가했어요`);
    setStage('p-added');
  });

  const nextPlayer = () => { setPName(''); setPNumber(''); setPPos(null); setError(''); setStage('p-name'); };

  const saveEvent = () => wrap(async () => {
    const at = new Date(when);
    if (Number.isNaN(at.getTime())) throw new Error('일시를 입력해 주세요.');
    const title = kind === 'match' ? (opponent.trim() ? `vs ${opponent.trim()}` : '첫 경기') : '첫 연습';
    await saveMatch({ kind, title, opponent: kind === 'match' ? opponent : '', kickoff: at.toISOString(), venue: '', notes: '', voteDeadline: null });
    toast('일정을 등록했어요');
    setStage('invite');
  });

  const step = mainIndex(stage);

  switch (stage) {
    case 'name':
      return (
        <Wizard step={step} total={total} title="구단 이름을 정해 주세요" sub="나중에 구단 관리에서 바꿀 수 있어요."
          onSubmit={() => void saveName()} footer={<NextButton busy={busy} disabled={!name.trim()}>다음</NextButton>}>
          <input className="wiz-input" value={name} maxLength={30} autoFocus placeholder="예) FC 축구방" aria-label="구단 이름" onChange={e => setName(e.target.value)} />
          {error && <p className="error" role="alert">{error}</p>}
        </Wizard>
      );

    case 'roster':
      return (
        <Wizard step={step} total={total} title={roster.length ? `선수 ${roster.length}명이 이미 있어요` : '선수를 등록해 볼까요?'}
          sub={roster.length ? '샘플 명단이 들어 있어요. 그대로 쓰거나, 비우고 우리 선수로 채울 수 있어요.' : '이름, 번호, 포지션만 있으면 돼요. 한 명씩 차근차근 넣어요.'}
          onBack={() => setStage('name')} onSubmit={() => setStage('p-name')}
          footer={<>
            <NextButton>한 명씩 추가하기</NextButton>
            {roster.length > 0 && <button type="button" className="btn ghost lg block" disabled={busy} onClick={clearSample}>비우고 새로 시작하기</button>}
            <button type="button" className="link wiz-switch" onClick={() => setStage('event')}>{roster.length ? '이 명단 그대로 쓸게요' : '나중에 할게요'}</button>
          </>}>
          {error && <p className="error" role="alert">{error}</p>}
        </Wizard>
      );

    case 'p-name':
      return (
        <Wizard step={step} total={total} title="선수 이름이 뭐예요?" sub={added ? `${added}명 추가했어요` : undefined}
          onBack={() => setStage(added ? 'p-added' : 'roster')} onSubmit={() => { if (pName.trim()) setStage('p-number'); }}
          footer={<NextButton disabled={!pName.trim()}>다음</NextButton>}>
          <input className="wiz-input" value={pName} maxLength={20} autoFocus aria-label="선수 이름" onChange={e => setPName(e.target.value)} />
        </Wizard>
      );

    case 'p-number':
      return (
        <Wizard step={step} total={total} title={`${pName.trim()} 선수의 등번호는요?`}
          onBack={() => setStage('p-name')} onSubmit={() => { if (pNumber.trim() && !numberTaken) setStage('p-pos'); }}
          footer={<NextButton disabled={!pNumber.trim() || numberTaken}>다음</NextButton>}>
          <input className="wiz-input code-in" inputMode="numeric" pattern="[0-9]*" maxLength={3} autoFocus aria-label="등번호"
            value={pNumber} onChange={e => setPNumber(e.target.value.replace(/\D/g, ''))} />
          {numberTaken && <p className="error" role="alert">{roster.find(p => p.number === pNumber.trim())?.name} 선수가 이미 쓰는 번호예요.</p>}
        </Wizard>
      );

    case 'p-pos':
      return (
        <Wizard step={step} total={total} title="주로 어느 자리에서 뛰어요?" sub="겸임 포지션은 나중에 선수 관리에서 추가할 수 있어요."
          onBack={() => setStage('p-number')} onSubmit={() => void addPlayer()}
          footer={<NextButton busy={busy} disabled={!pPos}>추가하기</NextButton>}>
          <div className="wiz-choices" role="radiogroup" aria-label="포지션">
            {POS_CHOICES.map(c => (
              <button type="button" key={c.id} role="radio" aria-checked={pPos === c.id} className={`wiz-choice${pPos === c.id ? ' on' : ''}`} onClick={() => setPPos(c.id)}>
                <strong>{c.label}</strong><span>{c.hint}</span>
              </button>
            ))}
          </div>
          {error && <p className="error" role="alert">{error}</p>}
        </Wizard>
      );

    case 'p-added':
      return (
        <Wizard step={step} total={total} title={`${added}명 등록했어요`} sub="한 명 더 넣을까요?"
          onSubmit={nextPlayer}
          footer={<>
            <NextButton>한 명 더 추가</NextButton>
            <button type="button" className="btn ghost lg block" onClick={() => setStage('event')}>다 됐어요</button>
          </>}>
          <p className="wiz-count" aria-live="polite">현재 명단 {roster.length}명</p>
        </Wizard>
      );

    case 'event':
      return (
        <Wizard step={step} total={total} title="다음 경기나 연습이 정해졌나요?" sub="지금 등록하면 팀원이 들어오자마자 참석 투표를 할 수 있어요."
          onBack={() => setStage('roster')} onSubmit={() => setStage('event-form')}
          footer={<>
            <NextButton>일정 등록하기</NextButton>
            <button type="button" className="link wiz-switch" onClick={() => setStage('invite')}>아직 없어요</button>
          </>} />
      );

    case 'event-form':
      return (
        <Wizard step={step} total={total} title="언제, 어떤 일정인가요?" onBack={() => setStage('event')} onSubmit={() => void saveEvent()}
          footer={<NextButton busy={busy} disabled={!when}>등록하기</NextButton>}>
          <div className="wiz-choices two" role="radiogroup" aria-label="일정 종류">
            {([['match', '경기'], ['practice', '연습']] as const).map(([id, label]) => (
              <button type="button" key={id} role="radio" aria-checked={kind === id} className={`wiz-choice${kind === id ? ' on' : ''}`} onClick={() => setKind(id)}><strong>{label}</strong></button>
            ))}
          </div>
          {kind === 'match' && <input className="wiz-input" value={opponent} maxLength={30} placeholder="상대팀 (모르면 비워 두세요)" aria-label="상대팀" onChange={e => setOpponent(e.target.value)} />}
          <input className="wiz-input" type="datetime-local" value={when} aria-label="일시" onChange={e => setWhen(e.target.value)} />
          {error && <p className="error" role="alert">{error}</p>}
        </Wizard>
      );

    case 'invite':
      return <InviteStep step={step} total={total} onBack={() => setStage('event')} onNext={() => setStage('install')} />;

    case 'install':
      return <InstallGuide step={step} total={total} onBack={() => setStage('invite')} onDone={() => setStage('done')} />;

    default:
      return (
        <Wizard title="준비가 끝났어요!" sub="이제 팀원들이 초대 링크로 들어오면 바로 함께 쓸 수 있어요." onSubmit={onDone}
          footer={<NextButton>구단 홈으로</NextButton>}>
          <div className="wiz-hero big" aria-hidden>🎉</div>
        </Wizard>
      );
  }
}

function InviteStep({ step, total, onBack, onNext }: { step: number; total: number; onBack: () => void; onNext: () => void }) {
  const teamName = useAuth(s => s.teamName);
  const [code, setCode] = useState('');
  const [failed, setFailed] = useState(false);
  useEffect(() => { fetchJoinCode().then(setCode, () => setFailed(true)); }, []);

  const link = code ? inviteLink(code) : '';
  const share = async () => {
    const text = inviteMessage(teamName, code);
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); toast('초대 메시지를 복사했어요. 단체방에 붙여넣어 주세요'); }
    } catch (e) { if ((e as DOMException).name !== 'AbortError') toast('공유하지 못했어요', 'error'); }
  };
  const copy = async () => { try { await navigator.clipboard.writeText(link); toast('링크를 복사했어요'); } catch { toast('링크를 복사하지 못했어요', 'error'); } };

  return (
    <Wizard step={step} total={total} title="팀원을 초대해요" sub="단체방에 이 링크를 보내면, 누르는 것만으로 합류해요." onBack={onBack} onSubmit={onNext}
      footer={<>
        <button type="button" className="btn primary lg block" disabled={!code} onClick={() => void share()}>초대 링크 보내기</button>
        <button type="button" className="btn ghost lg block" onClick={onNext}>다음</button>
      </>}>
      {failed ? <p className="error" role="alert">합류코드를 불러오지 못했어요. 나중에 구단 관리에서 확인해 주세요.</p> : (
        <div className="wiz-share">
          <output className="join-code" aria-label="합류코드">{code || '…'}</output>
          <p className="hint wiz-link">{link}</p>
          <button type="button" className="btn ghost sm" disabled={!code} onClick={() => void copy()}>링크 복사</button>
        </div>
      )}
    </Wizard>
  );
}

/** "Add to home screen" guidance: native prompt where the browser has one, written steps on iOS. */
export function InstallGuide({ step, total, onBack, onDone, final }: { step?: number; total?: number; onBack?: () => void; onDone: () => void; final?: boolean }) {
  const { mode, install } = useInstall();
  return (
    <Wizard step={step} total={total} title="홈 화면에 추가해 두세요" sub="앱처럼 한 번에 열리고, 일정 알림을 놓치지 않아요." onBack={onBack} onSubmit={onDone}
      footer={<>
        {mode === 'native' && <button type="button" className="btn primary lg block" onClick={() => void install().then(onDone)}>홈 화면에 추가</button>}
        {mode === 'native' ? <button type="button" className="btn ghost lg block" onClick={onDone}>나중에 할게요</button> : <NextButton>{final ? '시작하기' : '다음'}</NextButton>}
      </>}>
      {mode === 'ios' ? (
        <ol className="wiz-steps">
          <li>아래쪽 <b>공유</b> 버튼 <span aria-hidden>⎋</span>을 눌러요</li>
          <li><b>홈 화면에 추가</b>를 골라요</li>
          <li>오른쪽 위 <b>추가</b>를 누르면 끝!</li>
        </ol>
      ) : mode === 'native' ? (
        <p className="wiz-sub">버튼 한 번이면 돼요.</p>
      ) : (
        <p className="wiz-sub">브라우저 메뉴에서 <b>홈 화면에 추가</b>를 고르면 앱처럼 쓸 수 있어요. 이미 추가했다면 건너뛰어도 돼요.</p>
      )}
    </Wizard>
  );
}
