#!/usr/bin/env python3
"""
Convert OBJ files to our polyhedron format.

Usage:
    python3 convert_obj_to_format.py input.obj output.txt
"""

import sys
import math
from pathlib import Path
from typing import List, Tuple, Set

def parse_obj_file(obj_path: Path) -> Tuple[List[List[float]], List[List[int]]]:
    """
    Parse an OBJ file and extract vertices and faces.
    Returns (vertices, faces) where faces are lists of vertex indices.
    """
    vertices = []
    faces = []
    
    with open(obj_path, 'r') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            
            if line.startswith('v '):
                # Vertex: v x y z [w]
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

def main():
    if len(sys.argv) != 3:
        print("Usage: python3 convert_obj_to_format.py input.obj output.txt")
        sys.exit(1)
    
    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    
    if not input_path.exists():
        print(f"Error: Input file not found: {input_path}")
        sys.exit(1)
    
    print(f"Converting {input_path} to {output_path}...")
    
    # Parse OBJ file
    vertices, faces = parse_obj_file(input_path)
    print(f"  Found {len(vertices)} vertices and {len(faces)} faces")
    
    # Convert faces to edges
    edges = faces_to_edges(faces)
    print(f"  Extracted {len(edges)} edges")
    
    # Normalize vertices
    vertices = normalize_vertices(vertices)
    
    # Calculate midradius
    midradius = calculate_midradius(vertices, edges)
    print(f"  Calculated midradius: {midradius:.4f}")
    
    # Convert to format
    content = convert_to_format(vertices, edges, midradius)
    
    # Write output
    with open(output_path, 'w') as f:
        f.write(content)
    
    print(f"  ✓ Saved to {output_path}")

if __name__ == '__main__':
    main()

