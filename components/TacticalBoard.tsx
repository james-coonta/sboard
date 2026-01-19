'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Rect, Line, Circle, Text, Group, Arrow } from 'react-konva';
import Konva from 'konva';
import { useBoardStore } from '../store/boardStore';

type Size = { w: number; h: number };

const pctToPx = (pct: number, size: number) => (pct / 100) * size;
const pxToPct = (px: number, size: number) => (px / size) * 100;

export default function TacticalBoard() {

  /* store에서 selectedLineId/selectLine 가져오기 */
  const selectedLineId = useBoardStore((s) => s.selectedLineId);
  const selectLine = useBoardStore((s) => s.selectLine);

  /* store에서 drawMode/lines/addLine 가져오기 */
  const drawMode = useBoardStore((s) => s.drawMode);
  const lines = useBoardStore((s) => s.lines);
  const addLine = useBoardStore((s) => s.addLine);  
 
  /* 드래프팅 상태 관리 */
  const [draft, setDraft] = useState<null | {
    kind: 'pass' | 'run';
    from: { xPct: number; yPct: number };
    to: { xPct: number; yPct: number };
    }>(null);

  /* Konva Stage, Container ref */
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /* store에서 players/updatePlayerPos 가져오기 */
  const players = useBoardStore((s) => s.players);
  const updatePlayerPos = useBoardStore((s) => s.updatePlayerPos);
 
  /* store에서 ball/setBallPos 가져오기 */
  const ball = useBoardStore((s) => s.ball);
  const setBallPos = useBoardStore((s) => s.setBallPos);
 
  /* 사이즈 상태 관리 */
  const [size, setSize] = useState<Size>({ w: 900, h: 540 });

  /* 리사이즈 옵저버로 컨테이너 크기 감지 */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      const w = Math.max(320, el.clientWidth);
      const h = Math.round(w * (3 / 5));
      setSize({ w, h });
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pitchPadding = useMemo(() => Math.max(12, Math.round(size.w * 0.02)), [size.w]);

  const pitch = useMemo(() => {
    const x0 = pitchPadding;
    const y0 = pitchPadding;
    const x1 = size.w - pitchPadding;
    const y1 = size.h - pitchPadding;
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
  }, [size, pitchPadding]);

  const tokenRadius = useMemo(
    () => Math.max(14, Math.round(Math.min(pitch.w, pitch.h) * 0.035)),
    [pitch]
  );

  const ballRadius = Math.max(8, Math.round(tokenRadius * 0.55));

  return (
    <div ref={containerRef} style={{ width: '100%', maxWidth: 1100 }}>
      <Stage
        ref={stageRef}
        width={size.w}
        height={size.h}
        onMouseDown={(e) => {
            selectLine(null); // 아무 곳 클릭하면 선택 해제

            if (drawMode === 'select') return; // 선택 모드면 선 그리기 안함

            const stage = e.target.getStage();// stage 가져오기
            if (!stage) return;

            const pos = stage.getPointerPosition(); // 마우스 위치 가져오기
            if (!pos) return;

            // 피치 내부 좌표인지 확인
            const x = Math.max(pitch.x0, Math.min(pitch.x1, pos.x));
            const y = Math.max(pitch.y0, Math.min(pitch.y1, pos.y));

            const from = { 
            xPct: pxToPct(x - pitch.x0, pitch.w),
            yPct: pxToPct(y - pitch.y0, pitch.h),
            };
            
            const kind = drawMode === 'pass' ? 'pass' : 'run';
            setDraft({ kind, from, to: from });
        }}
        onMouseMove={(e) => {
            if (!draft) return;
            const stage = e.target.getStage();
            if (!stage) return;

            const pos = stage.getPointerPosition();
            if (!pos) return;

            const x = Math.max(pitch.x0, Math.min(pitch.x1, pos.x));
            const y = Math.max(pitch.y0, Math.min(pitch.y1, pos.y));

            const to = {
            xPct: pxToPct(x - pitch.x0, pitch.w),
            yPct: pxToPct(y - pitch.y0, pitch.h),
            };

            setDraft({ ...draft, to });
        }}
        onMouseUp={() => {
            if (!draft) return;

            // 너무 짧은 선은 무시(오작동 방지)
            const dx = draft.to.xPct - draft.from.xPct;
            const dy = draft.to.yPct - draft.from.yPct;
            const dist = Math.hypot(dx, dy);

            if (dist >= 1.5) {
            addLine(draft.kind, draft.from, draft.to);
            }
            setDraft(null);
        }}
        >
        <Layer>
          {/* 배경 */}
          <Rect x={0} y={0} width={size.w} height={size.h} fill="#0b6b3a" />

          {/* 피치 테두리 */}
          <Rect x={pitch.x0} y={pitch.y0} width={pitch.w} height={pitch.h} stroke="white" strokeWidth={2} />

          {/* 하프라인 */}
          <Line
            points={[pitch.x0 + pitch.w / 2, pitch.y0, pitch.x0 + pitch.w / 2, pitch.y1]}
            stroke="white"
            strokeWidth={2}
          />

          {/* 센터서클 */}
          <Circle
            x={pitch.x0 + pitch.w / 2}
            y={pitch.y0 + pitch.h / 2}
            radius={Math.min(pitch.w, pitch.h) * 0.12}
            stroke="white"
            strokeWidth={2}
          />
          {/* 선수 토큰 */}
          {players.map((p) => {
            const x = pitch.x0 + pctToPx(p.xPct, pitch.w);
            const y = pitch.y0 + pctToPx(p.yPct, pitch.h);

            return (
              <Group
                key={p.id}
                x={x}
                y={y}
                draggable={drawMode === 'select'}
                onDragMove={(e) => {
                  const nx = e.target.x();
                  const ny = e.target.y();
                  const xPct = pxToPct(nx - pitch.x0, pitch.w);
                  const yPct = pxToPct(ny - pitch.y0, pitch.h);
                  updatePlayerPos(p.id, xPct, yPct);
                }}
                onDragEnd={(e) => {
                  const nx = Math.max(pitch.x0, Math.min(pitch.x1, e.target.x()));
                  const ny = Math.max(pitch.y0, Math.min(pitch.y1, e.target.y()));
                  e.target.position({ x: nx, y: ny });

                  const xPct = pxToPct(nx - pitch.x0, pitch.w);
                  const yPct = pxToPct(ny - pitch.y0, pitch.h);
                  updatePlayerPos(p.id, xPct, yPct);
                }}
              >
                <Circle
                  radius={tokenRadius}
                  fill={p.team === 'A' ? '#1e40af' : '#b91c1c'}
                  stroke="white"
                  strokeWidth={2}
                />
                <Text
                  text={String(p.number)}
                  width={tokenRadius * 2}
                  height={tokenRadius * 2}
                  offsetX={tokenRadius}
                  offsetY={tokenRadius}
                  align="center"
                  verticalAlign="middle"
                  fontStyle="bold"
                  fontSize={Math.round(tokenRadius * 0.9)}
                  fill="white"
                />
              </Group>
            );
          })}

          {/* 공 토큰 */}
          {ball.visible && (
            <Group
                x={pitch.x0 + pctToPx(ball.xPct, pitch.w)}
                y={pitch.y0 + pctToPx(ball.yPct, pitch.h)}
                draggable={drawMode === 'select'}
                onMouseDown={(e) => e.target.moveToTop()}
                onDragStart={(e) => e.target.moveToTop()}
                onDragMove={(e) => {
                const nx = e.target.x();
                const ny = e.target.y();
                setBallPos(
                    pxToPct(nx - pitch.x0, pitch.w),
                    pxToPct(ny - pitch.y0, pitch.h)
                );
                }}
                onDragEnd={(e) => {
                const nx = Math.max(pitch.x0, Math.min(pitch.x1, e.target.x()));
                const ny = Math.max(pitch.y0, Math.min(pitch.y1, e.target.y()));
                e.target.position({ x: nx, y: ny });
                setBallPos(
                    pxToPct(nx - pitch.x0, pitch.w),
                    pxToPct(ny - pitch.y0, pitch.h)
                );
                }}
            >   
                <Circle
                    radius={ballRadius * 0.9}
                    fill="white"
                    opacity={0.8}
                />
                <Text
                text="⚽"
                fontSize={ballRadius * 2}
                offsetX={ballRadius}
                offsetY={ballRadius}
                align="center"
                verticalAlign="middle"
                />
            </Group>
            )}

            {/* 저장된 라인 */}
            {lines.map((l) => {
                const x1 = pitch.x0 + pctToPx(l.from.xPct, pitch.w);
                const y1 = pitch.y0 + pctToPx(l.from.yPct, pitch.h);
                const x2 = pitch.x0 + pctToPx(l.to.xPct, pitch.w);
                const y2 = pitch.y0 + pctToPx(l.to.yPct, pitch.h);

                const isRun = l.kind === 'run';
                const isSelected = l.id === selectedLineId;

                return (
                    <Arrow key={l.id}
                        points={[x1, y1, x2, y2]}
                        stroke={isSelected ? 'yellow' : 'white'}
                        ffill={isSelected ? 'yellow' : 'white'}
                        strokeWidth={isRun ? 5 : 3}
                        pointerLength={10}
                        pointerWidth={10}
                        dash={isRun ? [8, 6] : []}   // 러닝은 점선 느낌
                        lineCap="round"
                        lineJoin="round"
                        opacity={0.95}

                        onClick={(e) => {
                            e.cancelBubble = true; // 클릭이 stage로 전파되는 것 방지
                            selectLine(l.id);
                        }}
                    />
                );
                })}

            {/* 드래프트(그리는 중 미리보기) */}
            {draft && (() => {
            const x1 = pitch.x0 + pctToPx(draft.from.xPct, pitch.w);
            const y1 = pitch.y0 + pctToPx(draft.from.yPct, pitch.h);
            const x2 = pitch.x0 + pctToPx(draft.to.xPct, pitch.w);
            const y2 = pitch.y0 + pctToPx(draft.to.yPct, pitch.h);

            const isRun = draft.kind === 'run';

            return (
                <Arrow
                points={[x1, y1, x2, y2]}
                stroke="yellow"
                fill="yellow"
                strokeWidth={3}
                pointerLength={10}
                pointerWidth={10}
                dash={isRun ? [8, 6] : []}
                lineCap="round"
                lineJoin="round"
                opacity={0.9}
                />
            );
            })()}          
        </Layer>
      </Stage>
    </div>
  );
}
