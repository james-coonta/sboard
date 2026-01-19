import { create } from 'zustand';
import { nanoid } from 'nanoid';

export type Team = 'A' | 'B';

export type PlayerToken = {
  id: string;
  team: Team;
  number: number; // 등번호(간단히 1~11)
  xPct: number; // 0~100
  yPct: number; // 0~100
};

export type BallToken = {
  xPct: number;
  yPct: number;
  visible: boolean;
};

export type FormationId = '4-4-2' | '4-3-3' | '3-5-2' | '4-2-3-1';

export type DrawMode = 'select' | 'pass' | 'run';

export type TacticLine = {
  id: string;
  kind: 'pass' | 'run';
  from: { xPct: number; yPct: number };
  to: { xPct: number; yPct: number };
};

/* Undo/Redo 커밋 헬퍼 */
function commit(
  get: () => BoardState,
  set: (fn: (s: BoardState) => Partial<BoardState>) => void
) {
  const { players, ball, lines, selectedLineId, history } = get();

  const snapshot: BoardSnapshot = {
    players,
    ball,
    lines,
    selectedLineId
  };

  set(() => ({
    history: {
      past: [...history.past, cloneSnapshot(snapshot)],
      future: []
    }
  }));
}

/* 보드 상태 타입 정의 */
type BoardState = {
    history: {       
        past: BoardSnapshot[];
        future: BoardSnapshot[];
    };

    canUndo: () => boolean;
    canRedo: () => boolean;
    undo: () => void;
    redo: () => void;
    players: PlayerToken[];
    ball: BallToken;
    drawMode: DrawMode;
    lines: TacticLine[];

    /* 액션 */
    addPlayer: (team: Team) => void;
    updatePlayerPos: (id: string, xPct: number, yPct: number) => void;

    /* 볼 액션 */
    setBallPos: (xPct: number, yPct: number) => void;
    setBallVisible: (visible: boolean) => void;
    centerBall: () => void;

    /* 포메이션 적용 */
    applyFormation: (team: Team, formation: FormationId) => void;
    reset: () => void;

    /* 내보내기 */
    exportJSON: () => string;  
    
    clearTeam: (team: Team) => void;

    /* 그리기 모드 */
    setDrawMode: (mode: DrawMode) => void;
    addLine: (kind: 'pass' | 'run', from: { xPct: number; yPct: number }, to: { xPct: number; yPct: number }) => void;
    removeLine: (id: string) => void;
    clearLines: () => void;

    /* 라인 선택/삭제 */
    selectedLineId: string | null;
    selectLine: (id: string | null) => void;
    removeSelectedLine: () => void;
};

/* 스냅샷 타입 및 클론 헬퍼 Undo/Redo */
type BoardSnapshot = {
  players: PlayerToken[];
  ball: BallToken;
  lines: TacticLine[];
  selectedLineId: string | null;
};

const cloneSnapshot = (s: BoardSnapshot): BoardSnapshot => ({
  players: s.players.map((p) => ({ ...p })),
  ball: { ...s.ball },
  lines: s.lines.map((l) => ({
    ...l,
    from: { ...l.from },
    to: { ...l.to }
  })),
  selectedLineId: s.selectedLineId
});



/* 값 범위 제한 헬퍼 */
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
/* 포메이션별 포지션 좌표 정의 */
type P = { x: number; y: number };

// 홈(A) 기준 포지션(우측 공격 방향). 어웨이(B)는 x를 100-x로 미러링합니다.
const FORMATIONS: Record<FormationId, P[]> = {
  // 11명: GK + 4 + 4 + 2
  '4-4-2': [
    { x: 8, y: 50 }, // GK
    { x: 22, y: 18 }, { x: 22, y: 40 }, { x: 22, y: 60 }, { x: 22, y: 82 }, // DF4
    { x: 50, y: 18 }, { x: 50, y: 40 }, { x: 50, y: 60 }, { x: 50, y: 82 }, // MF4
    { x: 78, y: 40 }, { x: 78, y: 60 } // FW2
  ],
  // 11명: GK + 4 + 3 + 3
  '4-3-3': [
    { x: 8, y: 50 }, // GK
    { x: 22, y: 18 }, { x: 22, y: 40 }, { x: 22, y: 60 }, { x: 22, y: 82 }, // DF4
    { x: 50, y: 30 }, { x: 50, y: 50 }, { x: 50, y: 70 }, // MF3
    { x: 78, y: 25 }, { x: 82, y: 50 }, { x: 78, y: 75 } // FW3
  ],
  // 11명: GK + 3 + 5 + 2
  '3-5-2': [
    { x: 8, y: 50 }, // GK
    { x: 22, y: 30 }, { x: 22, y: 50 }, { x: 22, y: 70 }, // DF3
    { x: 44, y: 15 }, { x: 44, y: 35 }, { x: 50, y: 50 }, { x: 44, y: 65 }, { x: 44, y: 85 }, // MF5 (윙 포함)
    { x: 78, y: 40 }, { x: 78, y: 60 } // FW2
  ],
  // 11명: GK + 4 + 2 + 3 + 1
  '4-2-3-1': [
    { x: 8, y: 50 }, // GK
    { x: 22, y: 18 }, { x: 22, y: 40 }, { x: 22, y: 60 }, { x: 22, y: 82 }, // DF4
    { x: 44, y: 40 }, { x: 44, y: 60 }, // DM2
    { x: 62, y: 25 }, { x: 62, y: 50 }, { x: 62, y: 75 }, // AM3
    { x: 82, y: 50 } // ST1
  ]
};

function createFormationPlayers(team: Team, formation: FormationId): PlayerToken[] {
  const pts = FORMATIONS[formation];
  return pts.map((p, idx) => {
    const xPct = team === 'A' ? p.x : 100 - p.x; // 어웨이 미러링
    const yPct = p.y;
    return { id: nanoid(), team, number: idx + 1, xPct, yPct };
  });
}

export const useBoardStore = create<BoardState>((set, get) => ({
  selectedLineId: null,

  selectLine: (id) => set({ selectedLineId: id }),

  removeSelectedLine: () =>
    set((s) => {
        if (!s.selectedLineId) return s;
        return {
            lines: s.lines.filter((l) => l.id !== s.selectedLineId),
            selectedLineId: null
        };
    }),

  history: { past: [], future: [] },

  canUndo: () => get().history.past.length > 0,
  canRedo: () => get().history.future.length > 0,

    undo: () =>
    set((s) => {
        const past = s.history.past;
        if (past.length === 0) return s;

        const prev = past[past.length - 1];
        const current = {
        players: s.players,
        ball: s.ball,
        lines: s.lines,
        selectedLineId: s.selectedLineId
        };

        return {
            ...cloneSnapshot(prev),
            history: {
                past: past.slice(0, -1),
                future: [cloneSnapshot(current), ...s.history.future]
            }
        };
    }),

    redo: () =>
    set((s) => {
        const future = s.history.future;
        if (future.length === 0) return s;

        const next = future[0];
        const current = {
        players: s.players,
        ball: s.ball,
        lines: s.lines,
        selectedLineId: s.selectedLineId
    };

    return {
      ...cloneSnapshot(next),
      history: {
        past: [...s.history.past, cloneSnapshot(current)],
        future: future.slice(1)
      }
    };
  }),

  drawMode: 'select',
  lines: [],

  setDrawMode: (mode) => set({ drawMode: mode }),
  
  addLine: (kind, from, to) => {
    commit(get, set);
    set((s) => ({
      lines: [...s.lines, { 
        id: nanoid(), 
        kind, 
        from: { xPct: clamp(from.xPct, 0, 100), yPct: clamp(from.yPct, 0, 100) }, 
        to: { xPct: clamp(to.xPct, 0, 100), yPct: clamp(to.yPct, 0, 100) }
      }]
    }));
  },    

  removeLine: (id) => {
    commit(get, set);
    set((s) => ({
            lines: s.lines.filter((l) => l.id !== id),
            selectedLineId: s.selectedLineId === id ? null : s.selectedLineId
    }));
  },
  
  clearLines: () => {
    commit(get, set);
    set({ lines: [], selectedLineId: null });
  },

  players: [
    ...createFormationPlayers('A', '4-3-3'),
    ...createFormationPlayers('B', '4-4-2')
  ],

  ball: { xPct: 50, yPct: 50, visible: true },

  /* 팀 클리어 */
  clearTeam: (team) => {
    commit(get, set);
    set((s) => ({
        players: s.players.filter((p) => p.team !== team)
    // ball: { ...s.ball, visible: false }  // 같이 숨기고 싶으면 주석 해제
    }));
  },

  addPlayer: (team) => {
    commit(get, set);
    set((s) => {
      const sameTeam = s.players.filter((p) => p.team === team);
      const nextNum = (Math.max(0, ...sameTeam.map((p) => p.number)) || 0) + 1;
      return {
        players: [...s.players, { id: nanoid(), team, number: nextNum, xPct: 50, yPct: 50 }]
      };
    });
  },

  updatePlayerPos: (id, xPct, yPct) => {
    commit(get, set);
    set((s) => ({
      players: s.players.map((p) =>
        p.id === id ? { ...p, xPct: clamp(xPct, 0, 100), yPct: clamp(yPct, 0, 100) } : p
      )
    }));
  },

  setBallPos: (xPct, yPct) => {
    commit(get, set);
    set((s) => ({ 
        ball: { ...s.ball, 
            xPct: clamp(xPct, 0, 100), 
            yPct: clamp(yPct, 0, 100) 
        } }));
  },

  setBallVisible: (visible) => {
    commit(get, set);
    set((s) => ({ ball: { ...s.ball, visible } }));
  },

  centerBall: () => {
    commit(get, set);
    set((s) => ({ 
        ball: { ...s.ball, 
            xPct: 50, 
            yPct: 50, 
            visible: true 
        } }));
  },

  applyFormation: (team, formation) => {
    commit(get, set);
    set((s) => {
      const others = s.players.filter((p) => p.team !== team);
      const formed = createFormationPlayers(team, formation);
      return { players: [...others, ...formed] };
    });
  },

  reset: () => {
    commit(get, set);
    set({
      players: [
        ...createFormationPlayers('A', '4-3-3'),
        ...createFormationPlayers('B', '4-4-2')
      ],
      ball: { xPct: 50, yPct: 50, visible: true }
    });
 },

  exportJSON: () => {
    const { players, ball, lines } = get();
    return JSON.stringify({ version: 3, players, ball, lines }, null, 2);
  }


}));

