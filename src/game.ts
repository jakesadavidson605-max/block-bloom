// Block Bloom! — pure game logic (no React imports): shapes, placement, line clears.

export const GRID_SIZE = 8;
export const CELL_COUNT = GRID_SIZE * GRID_SIZE;

export type Cell = [number, number]; // [row, col]

export interface ShapeDef {
  cells: Cell[];
  rows: number; // bounding-box height
  cols: number; // bounding-box width
  weight: number; // spawn weight (smaller pieces spawn more often)
}

// Build a shape from rows of 'X'/'.' strings.
function S(rows: string[], weight: number): ShapeDef {
  const cells: Cell[] = [];
  let maxCol = 0;
  rows.forEach((line, r) => {
    [...line].forEach((ch, c) => {
      if (ch === 'X') {
        cells.push([r, c]);
        if (c > maxCol) maxCol = c;
      }
    });
  });
  return { cells, rows: rows.length, cols: maxCol + 1, weight };
}

export const SHAPES: ShapeDef[] = [
  // single
  S(['X'], 3),
  // lines
  S(['XX'], 3),
  S(['X', 'X'], 3),
  S(['XXX'], 3),
  S(['X', 'X', 'X'], 3),
  S(['XXXX'], 2),
  S(['X', 'X', 'X', 'X'], 2),
  S(['XXXXX'], 1),
  S(['X', 'X', 'X', 'X', 'X'], 1),
  // squares / rects
  S(['XX', 'XX'], 3),
  S(['XXX', 'XXX', 'XXX'], 1),
  S(['XXX', 'XXX'], 2),
  S(['XX', 'XX', 'XX'], 2),
  // small L (4 rotations)
  S(['X.', 'XX'], 3),
  S(['.X', 'XX'], 3),
  S(['XX', 'X.'], 3),
  S(['XX', '.X'], 3),
  // big L (4 rotations)
  S(['X..', 'X..', 'XXX'], 2),
  S(['..X', '..X', 'XXX'], 2),
  S(['XXX', 'X..', 'X..'], 2),
  S(['XXX', '..X', '..X'], 2),
  // T (4 rotations)
  S(['XXX', '.X.'], 2),
  S(['.X.', 'XXX'], 2),
  S(['X.', 'XX', 'X.'], 2),
  S(['.X', 'XX', '.X'], 2),
  // S / Z
  S(['.XX', 'XX.'], 2),
  S(['XX.', '.XX'], 2),
  // plus
  S(['.X.', 'XXX', '.X.'], 1),
];

export interface Piece {
  id: number;
  shape: ShapeDef;
  colorIndex: number;
}

let nextPieceId = 1;

export function randomPiece(colorCount: number): Piece {
  const total = SHAPES.reduce((a, s) => a + s.weight, 0);
  let roll = Math.random() * total;
  let shape = SHAPES[0];
  for (const s of SHAPES) {
    roll -= s.weight;
    if (roll <= 0) {
      shape = s;
      break;
    }
  }
  return {
    id: nextPieceId++,
    shape,
    colorIndex: Math.floor(Math.random() * colorCount),
  };
}

// Grid: length-64 array, -1 = empty, otherwise index into PIECE_COLORS.
export type Grid = number[];

export function emptyGrid(): Grid {
  return new Array(CELL_COUNT).fill(-1);
}

export function canPlace(grid: Grid, piece: Piece, row: number, col: number): boolean {
  for (const [r, c] of piece.shape.cells) {
    const gr = row + r;
    const gc = col + c;
    if (gr < 0 || gr >= GRID_SIZE || gc < 0 || gc >= GRID_SIZE) return false;
    if (grid[gr * GRID_SIZE + gc] !== -1) return false;
  }
  return true;
}

export function findFit(grid: Grid, piece: Piece): [number, number] | null {
  for (let r = 0; r <= GRID_SIZE - piece.shape.rows; r++) {
    for (let c = 0; c <= GRID_SIZE - piece.shape.cols; c++) {
      if (canPlace(grid, piece, r, c)) return [r, c];
    }
  }
  return null;
}

export function anyPieceFits(grid: Grid, pieces: (Piece | null)[]): boolean {
  return pieces.some((p) => p !== null && findFit(grid, p) !== null);
}

export function placeOnGrid(grid: Grid, piece: Piece, row: number, col: number): Grid {
  const next = grid.slice();
  for (const [r, c] of piece.shape.cells) {
    next[(row + r) * GRID_SIZE + (col + c)] = piece.colorIndex;
  }
  return next;
}

// Returns indexes of full rows and full columns.
export function fullLines(grid: Grid): { rows: number[]; cols: number[] } {
  const rows: number[] = [];
  const cols: number[] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    let full = true;
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid[r * GRID_SIZE + c] === -1) {
        full = false;
        break;
      }
    }
    if (full) rows.push(r);
  }
  for (let c = 0; c < GRID_SIZE; c++) {
    let full = true;
    for (let r = 0; r < GRID_SIZE; r++) {
      if (grid[r * GRID_SIZE + c] === -1) {
        full = false;
        break;
      }
    }
    if (full) cols.push(c);
  }
  return { rows, cols };
}

export function clearLines(grid: Grid, rows: number[], cols: number[]): Grid {
  const next = grid.slice();
  for (const r of rows) {
    for (let c = 0; c < GRID_SIZE; c++) next[r * GRID_SIZE + c] = -1;
  }
  for (const c of cols) {
    for (let r = 0; r < GRID_SIZE; r++) next[r * GRID_SIZE + c] = -1;
  }
  return next;
}
