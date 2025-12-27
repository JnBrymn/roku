# Polyhedron Data Scripts

## Adding New Polyhedra

### Method 1: Convert from polyhedronisme (Near-miss Johnson solids)

For near-miss Johnson solids, use [polyhedronisme](https://levskaya.github.io/polyhedronisme/):

1. Navigate to a polyhedron (e.g., https://levskaya.github.io/polyhedronisme/?recipe=C1000aatI)
2. Right-click on the 3D model and select "Save as OBJ" or use the export button
3. The file will download to your Downloads folder
4. Convert using the helper script:

```bash
python3 scripts/convert_polyhedronisme.py ~/Downloads/polyhedron.obj expanded_truncated_icosahedron "Expanded Truncated Icosahedron"
```

The script will:
- Convert the OBJ to our format
- Save it to `public/data/`
- Show you the code to add to `polyhedraData`

### Method 2: Convert from Polyhedra Viewer (Johnson solids)

The best source for Johnson polyhedron data is the [Polyhedra Viewer](https://polyhedra.tessera.li/) by Tesseralis.

1. Navigate to a polyhedron page (e.g., https://polyhedra.tessera.li/triangular-cupola/info)
2. Click "Download a .obj" to download the OBJ file
3. Convert the OBJ file to our format:

```bash
python3 scripts/convert_obj_to_format.py downloaded.obj public/data/polyhedron_name.txt
```

4. Add the polyhedron to `lib/polyhedronUtils.ts` in the `polyhedraData` array

### Method 2: Manual creation

For simple polyhedra, you can create the data file manually:

1. Create a `.txt` file in `public/data/`
2. Format:
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

3. Run the midradius calculator to verify/update:
   ```bash
   python3 scripts/calculate_midradius.py
   ```

## Scripts

- `calculate_midradius.py` - Calculate and update midradius for all polyhedra
- `convert_obj_to_format.py` - Convert OBJ files to our format (generic)
- `convert_polyhedronisme.py` - Convert OBJ files from polyhedronisme (with helpful output)
- `download_johnson_solids.py` - (Work in progress) Automated download script

## Data Format

Each polyhedron file contains:
- **VERTICES**: List of 3D coordinates (x,y,z)
- **EDGES**: List of vertex pairs (v1,v2) defining edges
- **MIDRADIUS**: Minimum distance from origin to any edge

Vertices are normalized to be centered at origin with max distance = 1.0.

