import { Component, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="empty">
        <h2>문제가 생겼어요</h2>
        <p className="muted">화면을 불러오는 중 오류가 났어요. 저장된 전술은 그대로 남아 있어요.</p>
        <div className="btn-row center">
          <button className="btn primary" onClick={() => { location.hash = '#/'; location.reload(); }}>처음으로</button>
        </div>
      </div>
    );
  }
}
