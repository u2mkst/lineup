# 축구방

11인제 축구 **라인업 짜기**와 **전술 애니메이션 짜기**를 한 곳에서 하는 웹앱.

- **라인업**: 포메이션 선택 → 선수 탭으로 배정 / 끌어서 위치 조정, 상대팀 라인업(선택), 교체 명단
- **전술**: 라인업이 장면 1. 장면을 추가하며 선수·공을 옮기면 장면 사이를 부드럽게 재생
- **내보내기**: 라인업 PNG, 장면 PNG, 전술 GIF, 전술 영상(mp4/webm). 모바일에서는 공유창으로 카카오톡 전송
- 데이터는 브라우저(localStorage)에 자동 저장돼요. 선수 명단은 직접 편집할 수 있어요.

## 개발

```bash
npm install
npm run dev     # 개발 서버
npm run build   # 타입체크 + 빌드 (dist/)
```

React + Vite + TypeScript + zustand. 배포는 Vercel (Framework: Vite, 빌드 `npm run build`, 출력 `dist`).
