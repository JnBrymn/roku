# Polyhedron Data Scripts

## Adding Polyhedra Using Conway Notation

[polyhedronisme](https://levskaya.github.io/polyhedronisme/) supports Conway polyhedral notation, allowing you to create arbitrarily many polyhedra by combining operations.

### Understanding Conway Notation

1. **Learn the notation**: Visit [polyhedronisme](https://levskaya.github.io/polyhedronisme/?recipe=J92) and read the documentation on the page. It explains:
   - **Base shapes**: `T` (tetrahedron), `C` (cube), `O` (octahedron), `I` (icosahedron), `D` (dodecahedron), `P_N` (prism), `A_N` (antiprism), `Y_N` (pyramid), `J_N` (Johnson solid)
   - **Operations**: `a` (ambo), `t` (truncate), `e` (explode), `g` (gyro), `d` (dual), `s` (snub), `b` (bevel), `c` (chamfer), `k` (kis), `j` (join), `o` (ortho), `p` (propellor), `w` (whirl), `q` (quinto), and more
   - **Canonicalization**: `C_N` (canonicalize N times), `K_N` (quick canonicalization), `A_N` (spherical adjustment)

2. **Try recipes**: Enter any Conway notation recipe in the URL or the recipe box on the site. For example:
   - `https://levskaya.github.io/polyhedronisme/?recipe=C1000qtI` - Quinto truncated icosahedron
   - `https://levskaya.github.io/polyhedronisme/?recipe=A10egaT` - A10 exploded gyro ambo tetrahedron
   - `https://levskaya.github.io/polyhedronisme/?recipe=J92` - 92nd Johnson solid

3. **Experiment**: You can combine operations in any order to create new polyhedra.

### Adding a Recipe to the Site

Once you've found a recipe you like, follow these three steps:

**Step 1: Download the polyhedron**

```bash
python3 scripts/download_polyhedronisme.py RECIPE [output_dir]
```

Example:
```bash
python3 scripts/download_polyhedronisme.py A10dooI IGNORED
```

This script:
- Uses Playwright to navigate to polyhedronisme with your recipe
- Waits for the polyhedron to generate
- Extracts the OBJ content from the page
- Saves it to `IGNORED/polyhedronisme-RECIPE.obj`

**Step 2: Convert to project format**

```bash
python3 scripts/convert_polyhedronisme.py input.obj output_name "Display Name"
```

Example:
```bash
python3 scripts/convert_polyhedronisme.py IGNORED/polyhedronisme-A10dooI.obj A10dooI "A10 Dual Ortho Ortho Icosahedron"
```

This script:
- Parses the OBJ file to extract vertices and faces
- Derives edges from faces
- Normalizes vertices (centers at origin, scales to max distance = 1.0)
- Calculates midradius (minimum distance from origin to any edge)
- Saves to `public/data/output_name.txt`
- Shows you the code snippet to add to `polyhedraData`

**Step 3: Add to polyhedraData**

Edit `lib/polyhedronUtils.ts` and add the entry to the `polyhedraData` array:

```typescript
export const polyhedraData = [
  // ... existing polyhedra ...
  { file: '/data/A10dooI.txt', name: 'A10 Dual Ortho Ortho Icosahedron', slug: 'A10dooI' }
]
```

The conversion script will show you the exact code to add.

**Complete Example Workflow:**

```bash
# Download
python3 scripts/download_polyhedronisme.py A10dooI IGNORED

# Convert
python3 scripts/convert_polyhedronisme.py IGNORED/polyhedronisme-A10dooI.obj A10dooI "A10 Dual Ortho Ortho Icosahedron"

# Then add the shown code snippet to lib/polyhedronUtils.ts
```

## Data Format

Each polyhedron file in `public/data/` contains:
- **VERTICES**: List of 3D coordinates (x,y,z), numbered starting at 0
- **EDGES**: List of vertex pairs (v1,v2) defining edges, numbered starting at 0
- **MIDRADIUS**: Minimum distance from origin to any edge (single floating-point number)

Format example:
```
VERTICES:
0:0.2937,0.4540,-0.8186
1:0.6873,0.2112,-0.6846
2:0.5383,-0.0054,-0.8172
...

EDGES:
0:0,1
1:1,2
2:2,0
...

MIDRADIUS:
0.9168
```

**Properties:**
- Vertices are normalized to be centered at origin with max distance = 1.0
- Coordinates are floating-point numbers (typically 4 decimal places)
- Edges reference vertex indices (0-based)

## Data Storage

- **Polyhedron data files**: `public/data/*.txt` - All converted polyhedron files
- **Temporary OBJ files**: `IGNORED/*.obj` - Downloaded OBJ files (gitignored)
- **Polyhedra registry**: `lib/polyhedronUtils.ts` - The `polyhedraData` array that lists all available polyhedra

The `polyhedraData` array in `lib/polyhedronUtils.ts` is the master list that determines which polyhedra appear on the site. Each entry has:
- `file`: Path relative to `public/` (e.g., `/data/polyhedron_name.txt`)
- `name`: Display name shown in the UI
- `slug`: URL-friendly identifier (used in routes)
