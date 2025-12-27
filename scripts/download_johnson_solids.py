#!/usr/bin/env python3
"""
Download and convert Johnson polyhedron data from online sources.

This script downloads polyhedron data and converts it to our format.
"""

import os
import re
import math
import json
import requests
from pathlib import Path
from typing import List, Tuple, Dict, Set

# List of Johnson solids to download
# Format: (slug, name, J_number)
JOHNSON_SOLIDS = [
    ("square-pyramid", "Square Pyramid", "J1"),
    ("pentagonal-pyramid", "Pentagonal Pyramid", "J2"),
    ("triangular-cupola", "Triangular Cupola", "J3"),
    ("square-cupola", "Square Cupola", "J4"),
    ("pentagonal-cupola", "Pentagonal Cupola", "J5"),
    ("pentagonal-rotunda", "Pentagonal Rotunda", "J6"),
    ("elongated-triangular-pyramid", "Elongated Triangular Pyramid", "J7"),
    ("elongated-square-pyramid", "Elongated Square Pyramid", "J8"),
    ("elongated-pentagonal-pyramid", "Elongated Pentagonal Pyramid", "J9"),
    ("gyroelongated-square-pyramid", "Gyroelongated Square Pyramid", "J10"),
    ("gyroelongated-pentagonal-pyramid", "Gyroelongated Pentagonal Pyramid", "J11"),
    ("triangular-bipyramid", "Triangular Bipyramid", "J12"),
    ("pentagonal-bipyramid", "Pentagonal Bipyramid", "J13"),
    ("elongated-triangular-bipyramid", "Elongated Triangular Bipyramid", "J14"),
    ("elongated-square-bipyramid", "Elongated Square Bipyramid", "J15"),
    ("elongated-pentagonal-bipyramid", "Elongated Pentagonal Bipyramid", "J16"),
    ("gyroelongated-square-bipyramid", "Gyroelongated Square Bipyramid", "J17"),
]

def parse_obj_file(obj_content: str) -> Tuple[List[List[float]], List[List[int]]]:
    """
    Parse an OBJ file and extract vertices and faces.
    Returns (vertices, faces) where faces are lists of vertex indices.
    """
    vertices = []
    faces = []
    
    for line in obj_content.split('\n'):
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        
        if line.startswith('v '):
            # Vertex: v x y z
            parts = line.split()
            if len(parts) >= 4:
                vertices.append([
                    float(parts[1]),
                    float(parts[2]),
                    float(parts[3])
                ])
        elif line.startswith('f '):
            # Face: f v1 v2 v3 ... (OBJ uses 1-based indexing)
            parts = line.split()[1:]  # Skip 'f'
            face_vertices = []
            for part in parts:
                # Handle format like "v1/vt1/vn1" or just "v1"
                vertex_idx = int(part.split('/')[0]) - 1  # Convert to 0-based
                face_vertices.append(vertex_idx)
            if len(face_vertices) >= 2:
                faces.append(face_vertices)
    
    return vertices, faces

def faces_to_edges(faces: List[List[int]]) -> List[Tuple[int, int]]:
    """
    Convert faces to edges.
    Each face contributes edges between consecutive vertices.
    """
    edges_set: Set[Tuple[int, int]] = set()
    
    for face in faces:
        for i in range(len(face)):
            v1 = face[i]
            v2 = face[(i + 1) % len(face)]
            # Ensure edges are ordered (smaller index first)
            edge = (min(v1, v2), max(v1, v2))
            edges_set.add(edge)
    
    edges = sorted(list(edges_set))
    return edges

def normalize_vertices(vertices: List[List[float]]) -> List[List[float]]:
    """
    Normalize vertices so the polyhedron is centered at origin
    and scaled appropriately.
    """
    if not vertices:
        return vertices
    
    # Find centroid
    centroid = [
        sum(v[i] for v in vertices) / len(vertices)
        for i in range(3)
    ]
    
    # Center at origin
    centered = [
        [v[i] - centroid[i] for i in range(3)]
        for v in vertices
    ]
    
    # Find max distance from origin
    max_dist = max(
        math.sqrt(sum(v[i]**2 for i in range(3)))
        for v in centered
    )
    
    # Scale to reasonable size (max distance = 1.0)
    if max_dist > 0:
        normalized = [
            [v[i] / max_dist for i in range(3)]
            for v in centered
        ]
    else:
        normalized = centered
    
    return normalized

def calculate_midradius(vertices: List[List[float]], edges: List[Tuple[int, int]]) -> float:
    """
    Calculate the midradius (minimum distance from origin to any edge).
    """
    origin = [0.0, 0.0, 0.0]
    min_distance = float('inf')
    
    for v1_idx, v2_idx in edges:
        p1 = vertices[v1_idx]
        p2 = vertices[v2_idx]
        
        # Vector from p1 to p2
        edge_vec = [p2[i] - p1[i] for i in range(3)]
        
        # Vector from p1 to origin
        to_origin = [-p1[i] for i in range(3)]
        
        # Project to_origin onto edge_vec
        edge_len_sq = sum(edge_vec[i] ** 2 for i in range(3))
        
        if edge_len_sq < 1e-10:  # Degenerate edge
            distance = math.sqrt(sum(p1[i] ** 2 for i in range(3)))
        else:
            t = sum(to_origin[i] * edge_vec[i] for i in range(3)) / edge_len_sq
            t = max(0, min(1, t))  # Clamp to [0, 1]
            
            # Closest point on segment
            closest = [p1[i] + t * edge_vec[i] for i in range(3)]
            distance = math.sqrt(sum(closest[i] ** 2 for i in range(3)))
        
        if distance < min_distance:
            min_distance = distance
    
    return min_distance

def convert_to_format(vertices: List[List[float]], edges: List[Tuple[int, int]], midradius: float) -> str:
    """
    Convert vertices and edges to our text format.
    """
    lines = ["VERTICES:"]
    
    for i, v in enumerate(vertices):
        lines.append(f"{i}:{v[0]:.4f},{v[1]:.4f},{v[2]:.4f}")
    
    lines.append("")
    lines.append("EDGES:")
    
    for i, (v1, v2) in enumerate(edges):
        lines.append(f"{i}:{v1},{v2}")
    
    lines.append("")
    lines.append("MIDRADIUS:")
    lines.append(f"{midradius:.4f}")
    
    return "\n".join(lines)

def download_polyhedron(slug: str) -> Tuple[List[List[float]], List[Tuple[int, int]]]:
    """
    Download a polyhedron from Tesseralis site.
    Returns (vertices, edges).
    """
    # Try different URL patterns
    urls = [
        f"https://polyhedra.tessera.li/{slug}.obj",
        f"https://polyhedra.tessera.li/api/polyhedra/{slug}",
    ]
    
    for url in urls:
        try:
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                content_type = response.headers.get('content-type', '')
                if 'json' in content_type.lower():
                    # Try parsing as JSON
                    data = response.json()
                    # Extract vertices and faces from JSON structure
                    # This depends on the actual JSON format
                    if 'vertices' in data and 'faces' in data:
                        vertices = data['vertices']
                        faces = data['faces']
                        edges = faces_to_edges(faces)
                        return vertices, edges
                elif 'text' in content_type.lower() or url.endswith('.obj'):
                    # Parse as OBJ
                    vertices, faces = parse_obj_file(response.text)
                    if vertices and faces:
                        edges = faces_to_edges(faces)
                        return vertices, edges
        except Exception as e:
            print(f"  Error downloading from {url}: {e}")
            continue
    
    raise Exception(f"Could not download {slug} from any URL")

def main():
    """Download and convert Johnson solids."""
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    data_dir = project_root / 'public' / 'data'
    
    data_dir.mkdir(parents=True, exist_ok=True)
    
    print("Downloading Johnson solids...")
    print("=" * 60)
    
    successful = []
    failed = []
    
    for slug, name, j_num in JOHNSON_SOLIDS:
        print(f"\nProcessing {name} ({j_num})...")
        
        try:
            # Download
            vertices, edges = download_polyhedron(slug)
            
            # Normalize
            vertices = normalize_vertices(vertices)
            
            # Calculate midradius
            midradius = calculate_midradius(vertices, edges)
            
            # Convert to format
            content = convert_to_format(vertices, edges, midradius)
            
            # Save
            filename = f"{slug.replace('-', '_')}.txt"
            filepath = data_dir / filename
            
            with open(filepath, 'w') as f:
                f.write(content)
            
            print(f"  ✓ Saved: {filename}")
            print(f"    Vertices: {len(vertices)}, Edges: {len(edges)}, Midradius: {midradius:.4f}")
            
            successful.append((name, j_num, filename))
            
        except Exception as e:
            print(f"  ✗ Failed: {e}")
            failed.append((name, j_num, str(e)))
    
    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY:")
    print("=" * 60)
    print(f"Successful: {len(successful)}")
    print(f"Failed: {len(failed)}")
    
    if successful:
        print("\nSuccessfully downloaded:")
        for name, j_num, filename in successful:
            print(f"  {j_num}: {name} -> {filename}")
    
    if failed:
        print("\nFailed:")
        for name, j_num, error in failed:
            print(f"  {j_num}: {name} - {error}")

if __name__ == '__main__':
    main()

