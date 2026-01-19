'use client';

import React, { useEffect, useState } from 'react';
import Konva from 'konva';
import TacticalBoard from '../components/TacticalBoard';
import { FormationId, useBoardStore } from '../store/boardStore';

const FORMATIONS: FormationId[] = ['4-4-2', '4-3-3', '3-5-2', '4-2-3-1'];

export default function Page() {
  /* Undo/Redo */
  const undo = useBoardStore((s) => s.undo);
  const redo = useBoardStore((s) => s.redo);
  const canUndo = useBoardStore((s) => s.canUndo);
  const canRedo = useBoardStore((s) => s.canRedo);

  /* 라인 선택/삭제 */
  const selectedLineId = useBoardStore((s) => s.selectedLineId);
  const removeSelectedLine = useBoardStore((s) => s.removeSelectedLine);

  /* 그리기 모드 (store에서 가져오기)*/
  const drawMode = useBoardStore((s) => s.drawMode);
  const setDrawMode = useBoardStore((s) => s.setDrawMode);
  const clearLines = useBoardStore((s) => s.clearLines);
  
  /* 상태 */
  const applyFormation = useBoardStore((s) => s.applyFormation);
  
  /* 리셋, 내보내기 */
  const reset = useBoardStore((s) => s.reset);

  /* 내보내기 */
  const exportJSON = useBoardStore((s) => s.exportJSON);

  /* 팀 클리어 */
  const clearTeam = useBoardStore((s) => s.clearTeam);

  /* 볼 상태 */
  const ball = useBoardStore((s) => s.ball);
  const setBallVisible = useBoardStore((s) => s.setBallVisible);
  const centerBall = useBoardStore((s) => s.centerBall);

  /* 포메이션 선택 상태 */
  const [homeFormation, setHomeFormation] = useState<FormationId>('4-3-3');
  const [awayFormation, setAwayFormation] = useState<FormationId>('4-4-2');

  /* 핸들러 */
  const downloadJSON = () => {
    const data = exportJSON();
    const blob = new Blob([data], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'sboard-tactic.json';
    a.click();

    URL.revokeObjectURL(url);
  };

  /* PNG 내보내기 */
  const downloadPNG = () => {
    const stage = Konva.stages?.[0];
    if (!stage) return;

    const dataUrl = stage.toDataURL({ pixelRatio: 2 });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'sboard-tactic.png';
    a.click();
  };

  useEffect(() => {
      const onKeyDown = (e: KeyboardEvent) => {
        // 입력창에서 Delete 누를 때는 삭제 동작하지 않게(안전)
        const t = e.target;
  
        const isTyping =
          t instanceof HTMLElement &&
          (t.tagName === 'INPUT' ||
            t.tagName === 'TEXTAREA' ||
            t.isContentEditable);
  
        if (isTyping) return;
  
        const key = e.key.toLowerCase();
        const isCmdOrCtrl = e.ctrlKey || e.metaKey;
  
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          removeSelectedLine();
        }
        
        /* Undo: Ctrl+Z / Cmd+Z */
        if (isCmdOrCtrl && key === 'z' && !e.shiftKey) {
          e.preventDefault();
          undo();
          return;
        }

        /* Redo: Ctrl+Y / Cmd+Y or Ctrl+Shift+Z / Cmd+Shift+Z */
        if ((isCmdOrCtrl && key === 'y') || (isCmdOrCtrl && key === 'z' && e.shiftKey)) {
          e.preventDefault();
          redo();
          return;
        }
      };
  
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
      }, [selectedLineId, removeSelectedLine, undo, redo] 
  );

  return (
    <main style={{ padding: 20, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 1100 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>
          sBoard Tactical Board (Formation)
        </h1>

        {/* 포메이션 컨트롤 */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
          {/* 홈 포메이션 */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <strong>Home(A)</strong>
            <select value={homeFormation} onChange={(e) => setHomeFormation(e.target.value as FormationId)}>
              {FORMATIONS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <button className="native-button" onClick={() => applyFormation('A', homeFormation)}>적용</button>
            <button className="native-button" onClick={() => clearTeam('A')}>Clear</button>
          </div>

          {/* 어웨이 포메이션 */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <strong>Away(B)</strong>

            <select value={awayFormation} onChange={(e) => setAwayFormation(e.target.value as FormationId)}>
              {FORMATIONS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <button className="native-button" onClick={() => applyFormation('B', awayFormation)}>적용</button>
            <button onClick={() => clearTeam('B')}>Clear</button>
          </div>
            
          {/* 볼 컨트롤 */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <strong>Ball</strong>
            <button onClick={centerBall}>센터에 놓기</button>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={ball.visible}
                onChange={(e) => setBallVisible(e.target.checked)}
              />
              표시
            </label>
          </div>

          {/* 그리기 모드 */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <strong>Draw</strong>
            <button onClick={() => setDrawMode('select')} disabled={drawMode === 'select'}>이동</button>
            <button onClick={() => setDrawMode('pass')} disabled={drawMode === 'pass'}>패스</button>
            <button onClick={() => setDrawMode('run')} disabled={drawMode === 'run'}>러닝</button>
            <button onClick={removeSelectedLine} disabled={!selectedLineId}> 선택 라인 삭제 </button>
            <button onClick={clearLines}>라인 Clear</button>
            <button onClick={undo} disabled={!canUndo()}>Undo</button>
            <button onClick={redo} disabled={!canRedo()}>Redo</button>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={reset}>리셋</button>
            <button onClick={downloadJSON}>JSON 저장</button>
            <button onClick={downloadPNG}>PNG 내보내기</button>
          </div>
        </div>

        <TacticalBoard />

        <p style={{ marginTop: 10, opacity: 0.8 }}>
          홈/어웨이 포메이션을 선택하고 “적용”을 누르면 자동 배치됩니다. 공도 드래그로 이동 가능합니다.
        </p>
      </div>
    </main>
  );
}
