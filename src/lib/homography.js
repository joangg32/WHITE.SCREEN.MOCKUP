// ---------------------------------------------------------------------------
// Homography (projective transform) from 4 point correspondences.
//
// A homography is a 3x3 matrix H that maps a point p=(x,y) to p'=(x',y') in
// HOMOGENEOUS coordinates:
//
//     [x']   [h0 h1 h2] [x]
//     [y'] = [h3 h4 h5] [y]        p' = H * p   (then divide by w')
//     [w']   [h6 h7 h8] [1]
//
// Unlike an affine transform, the bottom row (h6,h7) is non-zero, which is what
// produces true perspective — parallel lines can converge. That is exactly what
// we need to fit an image inside an arbitrary (non-rectangular) quadrilateral.
//
// We fix h8 = 1 (H is defined up to scale), leaving 8 unknowns. Each of the 4
// point pairs gives 2 equations, so we solve an 8x8 linear system.
//
// For a pair (sx,sy) -> (dx,dy):
//     dx = (h0*sx + h1*sy + h2) / (h6*sx + h7*sy + 1)
//     dy = (h3*sx + h4*sy + h5) / (h6*sx + h7*sy + 1)
// Cross-multiplying gives two linear equations in the 8 unknowns:
//     h0*sx + h1*sy + h2 - h6*sx*dx - h7*sy*dx = dx
//     h3*sx + h4*sy + h5 - h6*sx*dy - h7*sy*dy = dy
// ---------------------------------------------------------------------------

// Solve a general NxN linear system A·x = b via Gauss-Jordan with partial
// pivoting. A is an array of N rows (each an array of N), b is length N.
function solveLinearSystem(A, b) {
  const n = b.length;
  // Build augmented matrix.
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    // Partial pivot: find the row with the largest absolute value in this col.
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    if (Math.abs(M[pivot][col]) < 1e-12) return null; // singular / degenerate
    [M[col], M[pivot]] = [M[pivot], M[col]];

    // Normalize pivot row.
    const pv = M[col][col];
    for (let k = col; k <= n; k++) M[col][k] /= pv;

    // Eliminate this column from all other rows.
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col];
      if (factor === 0) continue;
      for (let k = col; k <= n; k++) M[r][k] -= factor * M[col][k];
    }
  }
  return M.map((row) => row[n]);
}

/**
 * Compute the 3x3 homography mapping `src` (4 points) to `dst` (4 points).
 * Points are [x, y] arrays, ordered consistently (e.g. TL, TR, BR, BL).
 * Returns a length-9 array in ROW-MAJOR order, or null if degenerate.
 */
export function computeHomography(src, dst) {
  const A = [];
  const b = [];
  for (let i = 0; i < 4; i++) {
    const [sx, sy] = src[i];
    const [dx, dy] = dst[i];
    A.push([sx, sy, 1, 0, 0, 0, -sx * dx, -sy * dx]);
    b.push(dx);
    A.push([0, 0, 0, sx, sy, 1, -sx * dy, -sy * dy]);
    b.push(dy);
  }
  const h = solveLinearSystem(A, b);
  if (!h) return null;
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

/** Invert a 3x3 matrix (row-major, length 9). Returns null if singular. */
export function invert3x3(m) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) return null;
  const id = 1 / det;
  return [
    A * id, (c * h - b * i) * id, (b * f - c * e) * id,
    B * id, (a * i - c * g) * id, (c * d - a * f) * id,
    C * id, (b * g - a * h) * id, (a * e - b * d) * id,
  ];
}

/** Apply a row-major 3x3 homography to a point [x,y]; returns [x',y']. */
export function applyHomography(m, [x, y]) {
  const w = m[6] * x + m[7] * y + m[8];
  return [
    (m[0] * x + m[1] * y + m[2]) / w,
    (m[3] * x + m[4] * y + m[5]) / w,
  ];
}
