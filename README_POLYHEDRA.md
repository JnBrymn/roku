# Adding Polyhedra to the Project

This document explains how to add new polyhedra to the project, including Johnson solids and near-miss Johnson solids.

## Overview

The project supports polyhedra in a custom text format with:
- **Vertices**: 3D coordinates (x, y, z)
- **Edges**: Pairs of vertex indices
- **Midradius**: Minimum distance from origin to any edge

All vertices are normalized (centered at origin, max distance = 1.0).

## Data Sources

### 1. Johnson Solids - Polyhedra Viewer (Tesseralis)
**URL**: https://polyhedra.tessera.li/

Best for: Standard Johnson solids (J1-J92)

**How to download:**
1. Navigate to a polyhedron page (e.g., https://polyhedra.tessera.li/triangular-cupola/info)
2. Click "Download a .obj" button
3. File downloads to your Downloads folder

**Conversion:**
```bash
python3 scripts/convert_obj_to_format.py ~/Downloads/polyhedron.obj public/data/polyhedron_name.txt
```

### 2. Near-Miss Johnson Solids - Polyhedronisme
**URL**: https://levskaya.github.io/polyhedronisme/

Best for: Near-miss Johnson solids and complex polyhedra using Conway notation

**How to download:**

#### Method 1: Browser Console (Recommended)
1. Navigate to the polyhedron page (e.g., https://levskaya.github.io/polyhedronisme/?recipe=C1000aatI)
2. Press **F12** (or right-click → Inspect) to open Developer Tools
3. Go to the **Console** tab
4. Wait a few seconds for the page to fully load
5. Paste this JavaScript code and press Enter:

```javascript
if (typeof globPolys !== 'undefined' && globPolys.length > 0) {
    const objtxt = globPolys[0].toOBJ();
    const spec = document.getElementById('spec')?.value || 'polyhedron';
    const filename = `polyhedronisme-${spec.split(/\s+/g)[0].replace(/\([^\)]+\)/g, "")}.obj`;
    const blob = new Blob([objtxt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log('Downloaded:', filename);
} else {
    console.log('Page not ready. Wait a moment and try again.');
}
```

6. The OBJ file will download to your Downloads folder

#### Method 2: Right-click (if available)
- Right-click directly on the 3D model
- Look for "Save as..." or "Download" option

**Conversion:**
```bash
# Copy files to IGNORED folder first (macOS security may block direct access)
cp ~/Downloads/polyhedronisme-*.obj IGNORED/

# Convert using the helper script
python3 scripts/convert_polyhedronisme.py IGNORED/polyhedronisme-C1000aatI.obj expanded_truncated_icosahedron "Expanded Truncated Icosahedron"
```

The helper script (`convert_polyhedronisme.py`) will:
- Parse the OBJ file
- Extract vertices and faces
- Derive edges from faces
- Normalize and center the polyhedron
- Calculate midradius
- Save in the project's format
- Show you the code to add to `polyhedraData`

## Complete Workflow: Adding Near-Miss Johnson Solids

### Step 1: Download OBJ Files

1. **Identify the polyhedra you want** from Wikipedia or other sources
2. **Find the Conway notation** (recipe) for each polyhedron
   - Example: `C1000aatI` = Expanded Truncated Icosahedron
   - Example: `C1000stI` = Snub Rectified Truncated Icosahedron
   - Example: `C400A1atI` = Rectified Truncated Icosahedron

3. **Navigate to each polyhedron** on polyhedronisme:
   ```
   https://levskaya.github.io/polyhedronisme/?recipe=RECIPE_CODE
   ```

4. **Download using browser console** (see Method 1 above)

5. **Copy files to IGNORED folder** (macOS security workaround):
   ```bash
   cp ~/Downloads/polyhedronisme-*.obj IGNORED/
   ```

### Step 2: Convert to Project Format

Use the conversion script for each file:

```bash
python3 scripts/convert_polyhedronisme.py \
  IGNORED/polyhedronisme-C1000aatI.obj \
  expanded_truncated_icosahedron \
  "Expanded Truncated Icosahedron"
```

**Parameters:**
- `input.obj`: Path to the OBJ file
- `output_name`: Filename (without .txt extension) for the output
- `display_name`: Human-readable name (optional, defaults to formatted output_name)

**Output:**
- Creates `public/data/{output_name}.txt`
- Shows the code snippet to add to `polyhedraData`

### Step 3: Add to Polyhedra List

Edit `lib/polyhedronUtils.ts` and add to the `polyhedraData` array:

```typescript
export const polyhedraData = [
  // ... existing polyhedra ...
  // Near-miss Johnson Solids
  { 
    file: '/data/expanded_truncated_icosahedron.txt', 
    name: 'Expanded Truncated Icosahedron', 
    slug: 'expanded-truncated-icosahedron' 
  },
]
```

**Format:**
- `file`: Path relative to `public/` (starts with `/data/`)
- `name`: Display name shown in the UI
- `slug`: URL-friendly identifier (lowercase, hyphens)

### Step 4: Verify

1. **Check midradius calculation:**
   ```bash
   python3 scripts/calculate_midradius.py
   ```
   This will recalculate and update midradius values for all polyhedra.

2. **Test in the app:**
   - Start the development server
   - Navigate to the polyhedra list
   - Verify the new polyhedron appears and renders correctly

## Available Scripts

### `scripts/convert_obj_to_format.py`
Generic OBJ file converter.

**Usage:**
```bash
python3 scripts/convert_obj_to_format.py input.obj output.txt
```

### `scripts/convert_polyhedronisme.py`
Specialized converter for polyhedronisme files with helpful output.

**Usage:**
```bash
python3 scripts/convert_polyhedronisme.py input.obj output_name "Display Name"
```

**Features:**
- Automatically determines output path (`public/data/`)
- Shows code snippet to add to `polyhedraData`
- Better error messages

### `scripts/calculate_midradius.py`
Recalculates midradius for all polyhedra files.

**Usage:**
```bash
python3 scripts/calculate_midradius.py
```

**What it does:**
- Finds all `.txt` files in `public/data/`
- Parses vertices and edges
- Calculates minimum distance from origin to any edge
- Updates the MIDRADIUS value in each file

## Troubleshooting

### macOS Permission Errors

**Problem:** `Operation not permitted` when accessing files in Downloads folder.

**Solution:** Copy files to `IGNORED/` folder first:
```bash
cp ~/Downloads/polyhedronisme-*.obj IGNORED/
```

Then convert from the `IGNORED/` folder.

### Page Not Ready Error

**Problem:** Browser console shows "Page not ready" when trying to download.

**Solution:** 
- Wait a few seconds after the page loads
- Look for "canonicalization done" message in console
- Try running the download script again

### Missing Vertices/Edges

**Problem:** Converted file has 0 vertices or edges.

**Solution:**
- Check that the OBJ file is valid
- Verify the file wasn't corrupted during download
- Try re-downloading the file

### Incorrect Geometry

**Problem:** Polyhedron looks wrong or doesn't render.

**Solution:**
- Verify the OBJ file is correct
- Check that edges were properly extracted from faces
- Run `calculate_midradius.py` to verify calculations
- Check browser console for errors

## File Format Reference

Each polyhedron file (`public/data/*.txt`) follows this format:

```
VERTICES:
0:x1,y1,z1
1:x2,y2,z2
...

EDGES:
0:v1,v2
1:v3,v4
...

MIDRADIUS:
0.xxxx
```

**Rules:**
- Vertices are numbered starting at 0
- Edges reference vertex indices
- Coordinates are floating-point numbers (4 decimal places)
- Midradius is a single floating-point number

## Examples

### Example 1: Adding a Johnson Solid

1. Visit: https://polyhedra.tessera.li/triangular-cupola/info
2. Click "Download a .obj"
3. Convert:
   ```bash
   python3 scripts/convert_obj_to_format.py \
     ~/Downloads/triangular-cupola.obj \
     public/data/triangular_cupola.txt
   ```
4. Add to `polyhedraData`:
   ```typescript
   { file: '/data/triangular_cupola.txt', name: 'Triangular Cupola', slug: 'triangular-cupola' }
   ```

### Example 2: Adding a Near-Miss Johnson Solid

1. Visit: https://levskaya.github.io/polyhedronisme/?recipe=C1000aatI
2. Use browser console to download OBJ file
3. Copy to IGNORED:
   ```bash
   cp ~/Downloads/polyhedronisme-C1000aatI.obj IGNORED/
   ```
4. Convert:
   ```bash
   python3 scripts/convert_polyhedronisme.py \
     IGNORED/polyhedronisme-C1000aatI.obj \
     expanded_truncated_icosahedron \
     "Expanded Truncated Icosahedron"
   ```
5. Add to `polyhedraData` (script shows the exact code)

## Discovering Available Polyhedra

### Finding Large Spherical Polyhedra (> 80 vertices)

Use the discovery script to find polyhedra from both sources:

```bash
python3 scripts/discover_polyhedra.py
```

This script will:
- Discover polyhedra from `polyhedra.tessera.li` by checking known patterns
- List known Conway notation recipes for `polyhedronisme`
- Filter for large spherical polyhedra (> 80 vertices)
- Save results to `discovered_polyhedra.json`

**Note**: For `polyhedronisme`, the script lists known recipes but cannot automatically download them (requires browser JavaScript execution). Use the browser console method described above.

**Example output:**
- Lists all discovered polyhedra with vertex counts
- Highlights those with > 80 vertices
- Provides direct URLs for downloading

### Manual Discovery Methods

**For polyhedra.tessera.li:**
1. Browse the site: https://polyhedra.tessera.li/
2. Each polyhedron page shows vertex/edge/face counts
3. Look for polyhedra with high vertex counts (e.g., Truncated Icosidodecahedron has 120 vertices)

**For polyhedronisme:**
1. Try Conway notation recipes with high iteration counts (e.g., `C1000atI` = 1000 iterations of operations on icosahedron)
2. Common patterns for large polyhedra:
   - `C{N}atI` - Truncated icosahedron variants
   - `C{N}atD` - Truncated dodecahedron variants
   - `C{N}aatI` - Expanded truncated icosahedron
   - `C{N}stI` - Snub variants
   - Where `{N}` is iteration count (higher = more vertices)

## Resources

- **Polyhedra Viewer**: https://polyhedra.tessera.li/ - Johnson solids with downloadable OBJ files
- **Polyhedronisme**: https://levskaya.github.io/polyhedronisme/ - Near-miss Johnson solids using Conway notation
- **Wikipedia - Near-miss Johnson solid**: https://en.wikipedia.org/wiki/Near-miss_Johnson_solid
- **Wikipedia - Johnson solid**: https://en.wikipedia.org/wiki/Johnson_solid

## Notes

- The `IGNORED/` folder is used to store temporary OBJ files (gitignored)
- All converted files go to `public/data/`
- Midradius is calculated automatically but can be manually adjusted if needed
- Vertex normalization ensures consistent scaling across all polyhedra

