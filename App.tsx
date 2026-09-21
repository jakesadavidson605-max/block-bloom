// Block Bloom! Puzzle — 8x8 block puzzle (Block Blast style).
// Drag pieces from the tray onto the grid. Full rows AND columns clear.
// Combo multiplier grows on consecutive clearing moves.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { AdBanner, maybeShowInterstitial } from './src/ads';
import {
  GRID_SIZE,
  Piece,
  anyPieceFits,
  canPlace,
  clearLines,
  emptyGrid,
  fullLines,
  placeOnGrid,
  randomPiece,
  Grid,
} from './src/game';
import { PIECE_COLORS, THEME } from './src/theme';
import { bumpGameOverCount, getBestScore, saveBestScore } from './src/storage';

const { width: SCREEN_W } = Dimensions.get('window');
const GRID_PAD = 16;
const GRID_SIZE_PX = SCREEN_W - GRID_PAD * 2;
const CELL = GRID_SIZE_PX / GRID_SIZE;
const GRID_INNER_PAD = 4;
const CELL_GAP = 2;
const TRAY_CELL = CELL * 0.52;
const TRAY_HEIGHT = 128;

interface Ghost {
  row: number;
  col: number;
  fits: boolean;
}

interface Origins {
  gridX: number;
  gridY: number;
  rootX: number;
  rootY: number;
}

function newTray(): (Piece | null)[] {
  return [randomPiece(PIECE_COLORS.length), randomPiece(PIECE_COLORS.length), randomPiece(PIECE_COLORS.length)];
}

// Renders one piece's cells. `unit` = px per cell, `gap` = inset per cell.
function PieceCells({ piece, unit, gap = 2 }: { piece: Piece; unit: number; gap?: number }) {
  const color = PIECE_COLORS[piece.colorIndex];
  return (
    <View
      style={{
        width: piece.shape.cols * unit,
        height: piece.shape.rows * unit,
        position: 'relative',
      }}
    >
      {piece.shape.cells.map(([r, c]) => (
        <View
          key={`${r}-${c}`}
          style={{
            position: 'absolute',
            left: c * unit + gap,
            top: r * unit + gap,
            width: unit - gap * 2,
            height: unit - gap * 2,
            borderRadius: unit * 0.18,
            backgroundColor: color,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.25)',
          }}
        />
      ))}
    </View>
  );
}

export default function App() {
  const [grid, setGrid] = useState<Grid>(emptyGrid);
  const [tray, setTray] = useState<(Piece | null)[]>(newTray);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [combo, setCombo] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [newBest, setNewBest] = useState(false);
  const [dragging, setDragging] = useState<{ index: number; piece: Piece } | null>(null);
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const [origins, setOrigins] = useState<Origins | null>(null);
  const [clearingKeys, setClearingKeys] = useState<Set<number> | null>(null);

  const rootRef = useRef<View | null>(null);
  const gridRef = useRef<View | null>(null);
  const dragXY = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const popAnim = useRef(new Animated.Value(1)).current;
  const clearAnim = useRef(new Animated.Value(0)).current;

  // Fresh-state mirror for PanResponder callbacks (avoids stale closures).
  const stateRef = useRef({ grid, tray, gameOver, clearing: false });
  stateRef.current = { grid, tray, gameOver, clearing: clearingKeys !== null };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await SplashScreen.preventAutoHideAsync();
      } catch {
        /* ignore */
      }
      const b = await getBestScore();
      if (!cancelled) setBest(b);
      try {
        await SplashScreen.hideAsync();
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const measureOrigins = () => {
    try {
      rootRef.current?.measureInWindow((rx, ry) => {
        gridRef.current?.measureInWindow((gx, gy) => {
          setOrigins({ gridX: gx, gridY: gy, rootX: rx, rootY: ry });
        });
      });
    } catch {
      /* ignore */
    }
  };

  const ghostFor = (piece: Piece, moveX: number, moveY: number): Ghost | null => {
    const o = origins;
    if (!o) return null;
    const pw = piece.shape.cols * CELL;
    const ph = piece.shape.rows * CELL;
    const row = Math.round((moveY - o.gridY - ph / 2) / CELL);
    const col = Math.round((moveX - o.gridX - pw / 2) / CELL);
    return { row, col, fits: canPlace(stateRef.current.grid, piece, row, col) };
  };

  const doPlace = (index: number, piece: Piece, row: number, col: number) => {
    const s = stateRef.current;
    if (s.clearing || s.gameOver) return;
    if (!canPlace(s.grid, piece, row, col)) return;

    const placed = placeOnGrid(s.grid, piece, row, col);
    const { rows, cols } = fullLines(placed);
    const linesCleared = rows.length + cols.length;
    const cellsPlaced = piece.shape.cells.length;

    let nextCombo = 0;
    let gained: number;
    if (linesCleared > 0) {
      nextCombo = combo + 1;
      gained = (cellsPlaced + 10 * linesCleared) * nextCombo;
    } else {
      gained = cellsPlaced;
    }

    const nextScore = score + gained;
    let nextTray = s.tray.map((p, i) => (i === index ? null : p));
    if (nextTray.every((p) => p === null)) {
      nextTray = newTray();
    }

    setScore(nextScore);
    setCombo(nextCombo);
    setTray(nextTray);
    Vibration.vibrate(25);
    if (linesCleared > 0) {
      Vibration.vibrate([0, 40, 60, 80]);
    }

    // Subtle scale pop on the grid.
    popAnim.setValue(0);
    Animated.timing(popAnim, { toValue: 1, duration: 160, useNativeDriver: true }).start();

    const finish = (finalGrid: Grid) => {
      if (!anyPieceFits(finalGrid, nextTray)) {
        triggerGameOver(nextScore);
      }
    };

    if (linesCleared > 0) {
      const keys = new Set<number>();
      for (const r of rows) for (let c = 0; c < GRID_SIZE; c++) keys.add(r * GRID_SIZE + c);
      for (const c of cols) for (let r = 0; r < GRID_SIZE; r++) keys.add(r * GRID_SIZE + c);
      setGrid(placed);
      setClearingKeys(keys);
      clearAnim.setValue(0);
      Animated.timing(clearAnim, { toValue: 1, duration: 380, useNativeDriver: true }).start(() => {
        const cleared = clearLines(placed, rows, cols);
        setGrid(cleared);
        setClearingKeys(null);
        finish(cleared);
      });
    } else {
      setGrid(placed);
      finish(placed);
    }
  };

  const triggerGameOver = (finalScore: number) => {
    setGameOver(true);
    setBest((prevBest) => {
      if (finalScore > prevBest) {
        setNewBest(true);
        saveBestScore(finalScore);
        return finalScore;
      }
      return prevBest;
    });
    bumpGameOverCount().then((count) => {
      maybeShowInterstitial(count);
    });
  };

  const restart = () => {
    setGrid(emptyGrid());
    setTray(newTray());
    setScore(0);
    setCombo(0);
    setGameOver(false);
    setNewBest(false);
    setDragging(null);
    setGhost(null);
    setClearingKeys(null);
  };

  // One PanResponder per tray slot; recreated when the piece in the slot changes.
  const trayKey = tray.map((p) => (p ? p.id : 'x')).join(',');
  const responders = useMemo(
    () =>
      [0, 1, 2].map((i) =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => {
            const s = stateRef.current;
            return s.tray[i] !== null && !s.gameOver && !s.clearing;
          },
          onMoveShouldSetPanResponder: () => {
            const s = stateRef.current;
            return s.tray[i] !== null && !s.gameOver && !s.clearing;
          },
          onPanResponderGrant: () => {
            const piece = stateRef.current.tray[i];
            if (!piece) return;
            dragXY.setValue({ x: -500, y: -500 }); // park offscreen until first move
            setDragging({ index: i, piece });
            setGhost(null);
          },
          onPanResponderMove: (_e, g) => {
            const piece = stateRef.current.tray[i];
            const o = origins;
            if (!piece || !o) return;
            const pw = piece.shape.cols * CELL;
            const ph = piece.shape.rows * CELL;
            dragXY.setValue({
              x: g.moveX - o.rootX - pw / 2,
              y: g.moveY - o.rootY - ph / 2,
            });
            setGhost(ghostFor(piece, g.moveX, g.moveY));
          },
          onPanResponderRelease: (_e, g) => {
            const piece = stateRef.current.tray[i];
            setDragging(null);
            setGhost(null);
            if (!piece) return;
            const gh = ghostFor(piece, g.moveX, g.moveY);
            if (gh && gh.fits) {
              doPlace(i, piece, gh.row, gh.col);
            }
          },
          onPanResponderTerminate: () => {
            setDragging(null);
            setGhost(null);
          },
        }),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trayKey, origins],
  );

  const popScale = popAnim.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] });
  const clearOpacity = clearAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const clearScale = clearAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.1] });

  const renderGridCells = () => {
    const cells = [];
    for (let idx = 0; idx < GRID_SIZE * GRID_SIZE; idx++) {
      const v = grid[idx];
      const isClearing = clearingKeys !== null && clearingKeys.has(idx);
      const inner =
        v === -1 ? null : (
          <Animated.View
            style={[
              styles.cellBlock,
              {
                backgroundColor: PIECE_COLORS[v],
                opacity: isClearing ? clearOpacity : 1,
                transform: [{ scale: isClearing ? clearScale : 1 }],
              },
            ]}
          />
        );
      cells.push(
        <View key={idx} style={styles.cellOuter}>
          {inner}
        </View>,
      );
    }
    return cells;
  };

  const renderGhost = () => {
    if (!ghost || !dragging) return null;
    const piece = dragging.piece;
    const views = [];
    for (const [r, c] of piece.shape.cells) {
      const gr = ghost.row + r;
      const gc = ghost.col + c;
      if (gr < 0 || gr >= GRID_SIZE || gc < 0 || gc >= GRID_SIZE) continue;
      views.push(
        <View
          key={`${gr}-${gc}`}
          style={[
            styles.ghostCell,
            {
              left: GRID_INNER_PAD + gc * CELL + CELL_GAP,
              top: GRID_INNER_PAD + gr * CELL + CELL_GAP,
              width: CELL - CELL_GAP * 2,
              height: CELL - CELL_GAP * 2,
              backgroundColor: ghost.fits ? THEME.ghostValid : THEME.ghostInvalid,
              borderColor: ghost.fits ? THEME.ghostValidBorder : THEME.ghostInvalidBorder,
            },
          ]}
        />,
      );
    }
    return <>{views}</>;
  };

  return (
    <SafeAreaView ref={rootRef} style={styles.root} onLayout={measureOrigins}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Block Bloom!</Text>
        <View style={styles.scoreRow}>
          <View style={styles.scoreBox}>
            <Text style={styles.scoreLabel}>SCORE</Text>
            <Text style={styles.scoreValue}>{score}</Text>
          </View>
          <View style={styles.scoreBox}>
            <Text style={styles.scoreLabel}>BEST</Text>
            <Text style={styles.scoreValue}>{best}</Text>
          </View>
        </View>
        {combo >= 2 ? <Text style={styles.combo}>COMBO ×{combo}</Text> : null}
      </View>

      {/* Grid */}
      <View style={styles.gridWrap}>
        <Animated.View style={[styles.grid, { transform: [{ scale: popScale }] }]}>
          <View
            ref={gridRef}
            style={[styles.gridInner, { width: GRID_SIZE_PX, height: GRID_SIZE_PX }]}
            onLayout={measureOrigins}
          >
            {renderGridCells()}
            {renderGhost()}
          </View>
        </Animated.View>
      </View>

      {/* Tray */}
      <View style={[styles.tray, { height: TRAY_HEIGHT }]}>
        {[0, 1, 2].map((i) => {
          const piece = tray[i];
          const hidden = dragging !== null && dragging.index === i;
          return (
            <View key={i} style={styles.traySlot} {...responders[i].panHandlers}>
              {piece && !hidden ? <PieceCells piece={piece} unit={TRAY_CELL} /> : null}
            </View>
          );
        })}
      </View>

      {/* Floating dragged piece */}
      {dragging ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.dragLayer, { transform: dragXY.getTranslateTransform() }]}
        >
          <PieceCells piece={dragging.piece} unit={CELL} gap={2} />
        </Animated.View>
      ) : null}

      {/* Game-over overlay */}
      {gameOver ? (
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Game Over</Text>
            {newBest ? <Text style={styles.newBest}>★ NEW BEST ★</Text> : null}
            <Text style={styles.cardScore}>{score}</Text>
            <Text style={styles.cardBest}>Best: {best}</Text>
            <TouchableOpacity style={styles.button} onPress={restart} activeOpacity={0.8}>
              <Text style={styles.buttonText}>Play Again</Text>
            </TouchableOpacity>
            <View style={styles.adSlot}>
              <AdBanner />
            </View>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: THEME.background,
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingTop: 8,
  },
  title: {
    color: THEME.text,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 1,
  },
  scoreRow: {
    flexDirection: 'row',
    gap: 28,
    marginTop: 8,
  },
  scoreBox: {
    alignItems: 'center',
  },
  scoreLabel: {
    color: THEME.textDim,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
  },
  scoreValue: {
    color: THEME.text,
    fontSize: 26,
    fontWeight: '800',
  },
  combo: {
    color: '#ffb020',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 4,
  },
  gridWrap: {
    alignItems: 'center',
    marginTop: 10,
  },
  grid: {
    borderRadius: 14,
  },
  gridInner: {
    backgroundColor: THEME.gridBg,
    borderRadius: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: GRID_INNER_PAD,
    position: 'relative',
  },
  cellOuter: {
    alignItems: 'center',
    height: CELL,
    justifyContent: 'center',
    width: CELL,
  },
  cellBlock: {
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 7,
    borderWidth: 1,
    height: CELL - CELL_GAP * 2,
    width: CELL - CELL_GAP * 2,
  },
  ghostCell: {
    borderRadius: 7,
    borderWidth: 2,
    position: 'absolute',
  },
  tray: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 14,
  },
  traySlot: {
    alignItems: 'center',
    height: TRAY_HEIGHT,
    justifyContent: 'center',
    width: GRID_SIZE_PX / 3,
  },
  dragLayer: {
    left: 0,
    position: 'absolute',
    top: 0,
  },
  overlay: {
    alignItems: 'center',
    backgroundColor: THEME.overlay,
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  card: {
    alignItems: 'center',
    backgroundColor: THEME.card,
    borderRadius: 20,
    paddingHorizontal: 36,
    paddingVertical: 28,
    width: SCREEN_W - 64,
  },
  cardTitle: {
    color: THEME.text,
    fontSize: 28,
    fontWeight: '800',
  },
  newBest: {
    color: '#ffb020',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 6,
  },
  cardScore: {
    color: THEME.text,
    fontSize: 52,
    fontWeight: '800',
    marginTop: 8,
  },
  cardBest: {
    color: THEME.textDim,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 2,
  },
  button: {
    backgroundColor: THEME.button,
    borderRadius: 14,
    marginTop: 20,
    paddingHorizontal: 44,
    paddingVertical: 14,
  },
  buttonText: {
    color: THEME.buttonText,
    fontSize: 18,
    fontWeight: '800',
  },
  adSlot: {
    marginTop: 18,
    minHeight: 52,
  },
});
