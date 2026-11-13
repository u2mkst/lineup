import { useAuth } from '../../lib/auth';
import { useInstall } from '../../lib/pwa';
import { paths } from '../../lib/route';
import { IconBoardTactic, IconChevronRight, IconKey, IconMessage, IconUser, IconUsers } from '../Icons';
import { PageHeader } from '../ui';

export function MorePage() {
  const isAdmin = useAuth(s => s.isAdmin);
  const teamName = useAuth(s => s.teamName);
  const { mode, install } = useInstall();
  const rows = [
    { href: paths.roster, icon: <IconUsers />, label: '선수단', sub: '선수 목록과 시즌 기록' },
    { href: paths.board, icon: <IconMessage />, label: '게시판', sub: '공지와 팀 이야기' },
    { href: paths.tactics, icon: <IconBoardTactic />, label: '전술 보드', sub: '선발 라인업과 전술 애니메이션' },
    { href: paths.me, icon: <IconUser />, label: '내 프로필', sub: '선수 프로필 연결, 닉네임, 로그아웃' },
    ...(isAdmin ? [{ href: paths.admin, icon: <IconKey />, label: '구단 관리', sub: '합류코드, 팀원, 권한' }] : []),
  ];
  return (
    <>
      <PageHeader title="더보기" />
      <p className="muted small more-team">{teamName}</p>
      <div className="menu-rows">
        {rows.map(r => (
          <a key={r.href} className="row-link" href={r.href}>
            <span className="row-ic">{r.icon}</span><span><strong>{r.label}</strong><small className="muted">{r.sub}</small></span><IconChevronRight width={18} height={18} />
          </a>
        ))}
      </div>
      {mode && (
        <div className="notice">
          <div><strong>앱처럼 설치해서 쓰기</strong><p>{mode === 'ios' ? '공유 버튼 → "홈 화면에 추가"를 눌러 주세요.' : '홈 화면에 추가하면 바로 열 수 있어요.'}</p></div>
          {mode === 'native' && <button className="btn sm primary" onClick={install}>설치</button>}
        </div>
      )}
    </>
  );
}
