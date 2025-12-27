#!/usr/bin/env python3
"""
Calculate the midradius of polyhedra as the minimum distance from the origin to any edge.

The midradius is defined as the minimum distance from the origin (0,0,0) to any point
on any edge of the polyhedron. This represents the radius of a sphere that is tangent
to all edges of the polyhedron.
"""

import os
import re
import math
from pathlib import Path

def closest_point_on_segment(p1, p2, origin):
    """
    Find the closest point on the line segment from p1 to p2 to the origin.
    
    Returns the closest point and its distance from the origin.
    """
    # Vector from p1 to p2
    edge_vec = [p2[i] - p1[i] for i in range(3)]
    
    # Vector from p1 to origin
    to_origin = [-p1[i] for i in range(3)]
    
    # Project to_origin onto edge_vec
    edge_len_sq = sum(edge_vec[i] ** 2 for i in range(3))
    
    if edge_len_sq < 1e-10:  # Degenerate edge
        return p1, math.sqrt(sum(p1[i] ** 2 for i in range(3)))
    
    t = sum(to_origin[i] * edge_vec[i] for i in range(3)) / edge_len_sq
    
    # Clamp t to [0, 1] to stay on the segment
    t = max(0, min(1, t))
    
    # Closest point on segment
    closest = [p1[i] + t * edge_vec[i] for i in range(3)]
    
    # Distance from origin
    distance = math.sqrt(sum(closest[i] ** 2 for i in range(3)))
    
    return closest, distance

def parse_polyhedron_file(filepath):
    """Parse a polyhedron data file and return vertices, edges, and current midradius."""
    vertices = []
    edges = []
    midradius = None
    
    with open(filepath, 'r') as f:
        content = f.read()
    
    lines = content.split('\n')
    section = None
    
    for line in lines:
        line = line.strip()
        
        if line.startswith('VERTICES:'):
            section = 'vertices'
            continue
        elif line.startswith('EDGES:'):
            section = 'edges'
            continue
        elif line.startswith('MIDRADIUS:'):
            section = 'midradius'
            continue
        
        if not line:
            continue
        
        if section == 'vertices':
            match = re.match(r'^\d+:([-\d.]+),([-\d.]+),([-\d.]+)$', line)
            if match:
                vertices.append([
                    float(match.group(1)),
                    float(match.group(2)),
                    float(match.group(3))
                ])
        elif section == 'edges':
            match = re.match(r'^\d+:(\d+),(\d+)$', line)
            if match:
                edges.append([
                    int(match.group(1)),
                    int(match.group(2))
                ])
        elif section == 'midradius':
            match = re.match(r'^([\d.]+)$', line)
            if match:
                midradius = float(match.group(1))
    
    return vertices, edges, midradius

def calculate_midradius(vertices, edges):
    """Calculate the minimum distance from origin to any edge (midradius)."""
    origin = [0.0, 0.0, 0.0]
    min_distance = float('inf')
    min_edge = None
    min_point = None
    
    for edge in edges:
        v1_idx, v2_idx = edge
        p1 = vertices[v1_idx]
        p2 = vertices[v2_idx]
        
        closest_point, distance = closest_point_on_segment(p1, p2, origin)
        
        if distance < min_distance:
            min_distance = distance
            min_edge = edge
            min_point = closest_point
    
    return min_distance, min_edge, min_point

def update_midradius_in_file(filepath, new_midradius):
    """Update the MIDRADIUS value in the file."""
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Replace the MIDRADIUS value
    pattern = r'(MIDRADIUS:\s*\n)([\d.]+)'
    replacement = rf'MIDRADIUS:\n{new_midradius:.4f}'
    new_content = re.sub(pattern, replacement, content)
    
    with open(filepath, 'w') as f:
        f.write(new_content)

def main():
    """Process all polyhedron files in the data directory."""
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    data_dir = project_root / 'public' / 'data'
    
    if not data_dir.exists():
        print(f"Error: Data directory not found: {data_dir}")
        return
    
    print("Calculating midradius for all polyhedra...")
    print("=" * 60)
    
    # Find all .txt files
    txt_files = sorted(data_dir.glob('*.txt'))
    
    if not txt_files:
        print(f"No .txt files found in {data_dir}")
        return
    
    results = []
    
    for filepath in txt_files:
        filename = filepath.name
        print(f"\nProcessing: {filename}")
        
        try:
            vertices, edges, old_midradius = parse_polyhedron_file(filepath)
            
            if not vertices or not edges:
                print(f"  Warning: No vertices or edges found, skipping")
                continue
            
            # Calculate new midradius
            new_midradius, min_edge, min_point = calculate_midradius(vertices, edges)
            
            print(f"  Vertices: {len(vertices)}")
            print(f"  Edges: {len(edges)}")
            print(f"  Old midradius: {old_midradius:.4f}" if old_midradius else "  Old midradius: (not found)")
            print(f"  New midradius: {new_midradius:.4f}")
            print(f"  Closest edge: {min_edge[0]} -> {min_edge[1]}")
            print(f"  Closest point: ({min_point[0]:.4f}, {min_point[1]:.4f}, {min_point[2]:.4f})")
            
            # Update the file
            update_midradius_in_file(filepath, new_midradius)
            print(f"  ✓ Updated {filename}")
            
            results.append({
                'file': filename,
                'old': old_midradius,
                'new': new_midradius,
                'diff': new_midradius - (old_midradius or 0)
            })
            
        except Exception as e:
            print(f"  Error processing {filename}: {e}")
            import traceback
            traceback.print_exc()
    
    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY:")
    print("=" * 60)
    print(f"{'File':<20} {'Old':>10} {'New':>10} {'Change':>10}")
    print("-" * 60)
    
    for result in results:
        old_str = f"{result['old']:.4f}" if result['old'] else "N/A"
        change_str = f"{result['diff']:+.4f}" if result['old'] else "N/A"
        print(f"{result['file']:<20} {old_str:>10} {result['new']:>10.4f} {change_str:>10}")
    
    print("\nAll files updated successfully!")

if __name__ == '__main__':
    main()

