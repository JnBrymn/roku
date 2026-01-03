#!/usr/bin/env python3
"""
Download a polyhedron from polyhedronisme using browser automation.

This script accepts any valid Conway polyhedral notation recipe and downloads
the corresponding polyhedron from polyhedronisme.

Usage:
    python3 download_polyhedronisme.py RECIPE [output_dir]
    
Examples:
    # Basic recipes
    python3 download_polyhedronisme.py C200etT
    python3 download_polyhedronisme.py C1000qtI
    python3 download_polyhedronisme.py C500aatD
    
    # Without canonicalization
    python3 download_polyhedronisme.py atI
    python3 download_polyhedronisme.py stD
    
    # Complex recipes
    python3 download_polyhedronisme.py C2000aatstI
    python3 download_polyhedronisme.py C1000datdatD
    
    # Specify output directory
    python3 download_polyhedronisme.py C200etT IGNORED
    
Conway Notation:
    Format: [C{N}][operations][base]
    
    Base shapes: T (tetrahedron), C (cube), O (octahedron), 
                 I (icosahedron), D (dodecahedron), P_N, A_N, Y_N, J_N
    
    Operations: a (ambo), t (truncate), at, aat, st (snub), 
                j (join), b (bevel), c (chamfer), k (kis), 
                e (explode), g (gyro), r (reflect), 
                p (propellor), w (whirl), q (quinto)
    
    Canonicalization: C{N} = canonicalize N times (optional)
    
    See scripts/CONWAY_NOTATION_GUIDE.md for full documentation.
    
Requirements:
    pip install playwright
    playwright install firefox  # or chromium
"""

import sys
import time
import asyncio
from pathlib import Path

try:
    from playwright.async_api import async_playwright
    HAS_PLAYWRIGHT = True
except ImportError:
    HAS_PLAYWRIGHT = False
    print("Error: Playwright not installed.")
    print("Install with: pip install playwright")
    print("Then run: playwright install chromium")
    print("\nAlternatively, use the manual browser console method:")
    print("1. Navigate to: https://levskaya.github.io/polyhedronisme/?recipe=RECIPE")
    print("2. Open browser console (F12)")
    print("3. Wait for 'canonicalization done' message")
    print("4. Run the download script from README_POLYHEDRA.md")
    sys.exit(1)

def validate_recipe(recipe: str):
    """
    Basic validation of Conway notation recipe.
    Returns (is_valid, error_message)
    """
    if not recipe or not recipe.strip():
        return False, "Recipe cannot be empty"
    
    recipe = recipe.strip()
    
    # Check for valid base shapes at the end
    valid_bases = ['T', 'C', 'O', 'I', 'D']
    # Also allow P_N, A_N, Y_N, J_N patterns
    import re
    
    # Check if ends with valid base
    base_pattern = r'(T|C|O|I|D|P\d+|A\d+|Y\d+|J\d+)$'
    if not re.search(base_pattern, recipe):
        return False, f"Recipe must end with a valid base shape (T, C, O, I, D, P_N, A_N, Y_N, or J_N)"
    
    return True, ""

def suggest_slug(recipe: str) -> str:
    """
    Suggest a slug name based on the recipe.
    """
    import re
    
    # Remove canonicalization prefix
    clean_recipe = re.sub(r'^C\d+', '', recipe)
    
    # Map operations to readable names
    op_map = {
        'a': 'ambo',
        't': 'truncated',
        'at': 'truncated',
        'aat': 'expanded_truncated',
        'st': 'snub',
        'j': 'joined',
        'jt': 'joined_truncated',
        'b': 'beveled',
        'bt': 'beveled_truncated',
        'c': 'chamfered',
        'ct': 'chamfered_truncated',
        'k': 'kis',
        'kt': 'kis_truncated',
        'e': 'exploded',
        'et': 'exploded_truncated',
        'r': 'reflected',
        'rt': 'reflected_truncated',
        'g': 'gyro',
        'gt': 'gyro_truncated',
        'p': 'propellor',
        'pt': 'propellor_truncated',
        'w': 'whirl',
        'wt': 'whirl_truncated',
        'q': 'quinto',
        'qt': 'quinto_truncated',
    }
    
    # Map bases to names
    base_map = {
        'T': 'tetrahedron',
        'C': 'cube',
        'O': 'octahedron',
        'I': 'icosahedron',
        'D': 'dodecahedron',
    }
    
    # Extract base
    base_match = re.search(r'(T|C|O|I|D|P\d+|A\d+|Y\d+|J\d+)$', clean_recipe)
    if base_match:
        base = base_match.group(1)
        base_name = base_map.get(base, base.lower())
        
        # Extract operations (everything before base)
        ops = clean_recipe[:base_match.start()] if base_match.start() > 0 else ''
        
        # Try to find matching operation
        op_name = None
        for op_key, op_val in sorted(op_map.items(), key=lambda x: -len(x[0])):
            if ops.endswith(op_key):
                op_name = op_val
                break
        
        if op_name:
            return f"{op_name}_{base_name}"
        elif ops:
            return f"{ops}_{base_name}".replace('_', '_').lower()
        else:
            return base_name
    
    # Fallback
    return recipe.lower().replace('C', 'canonicalized_').replace('_', '_')

async def download_polyhedron_async(recipe: str, output_dir: Path = None):
    """
    Download a polyhedron from polyhedronisme using Playwright.
    Accepts any valid Conway notation recipe.
    """
    # Validate recipe
    is_valid, error_msg = validate_recipe(recipe)
    if not is_valid:
        print(f"Error: Invalid recipe '{recipe}': {error_msg}")
        print("\nValid recipes follow Conway notation:")
        print("  Format: [C{N}][operations][base]")
        print("  Examples: C200etT, C1000qtI, atI, stD")
        return None
    
    if output_dir is None:
        output_dir = Path.home() / 'Downloads'
    else:
        output_dir = Path(output_dir)
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    url = f"https://levskaya.github.io/polyhedronisme/?recipe={recipe}"
    
    print(f"Downloading polyhedron: {recipe}")
    print(f"URL: {url}")
    print(f"Output directory: {output_dir}")
    
    # Suggest a name for the polyhedron
    suggested_slug = suggest_slug(recipe)
    print(f"Suggested name: {suggested_slug}")
    
    async with async_playwright() as p:
        print("\nStarting browser...")
        browser = None
        # Try Firefox first (often more reliable), then Chromium
        for browser_type in [p.firefox, p.chromium]:
            try:
                browser = await browser_type.launch(headless=True)
                print(f"✓ Launched {browser_type.name}")
                break
            except Exception as e:
                print(f"  Failed to launch {browser_type.name}: {e}")
                continue
        
        if not browser:
            raise Exception("Could not launch any browser. Try: playwright install firefox")
        
        context = await browser.new_context()
        page = await context.new_page()
        
        try:
            print("Loading page...")
            # Use 'domcontentloaded' instead of 'networkidle' for faster initial load
            await page.goto(url, wait_until="domcontentloaded")
            
            print("Waiting for polyhedron to generate...")
            # Try to extract immediately - some recipes don't need canonicalization
            quick_check = await page.evaluate("""
                () => {
                    return typeof globPolys !== 'undefined' && globPolys.length > 0;
                }
            """)
            
            if quick_check:
                print("  → Polyhedron already available!")
            else:
                # Wait for polyhedron to generate
                # Check console for "canonicalization done" or other completion messages
                max_wait = 120  # Maximum 120 seconds (some recipes take longer)
                start_time = time.time()
                ready = False
                
                async def check_console(msg):
                    nonlocal ready
                    text = msg.text.lower()
                    # Check for various completion indicators
                    if any(indicator in text for indicator in [
                        'canonicalization done',
                        'canonicalize',
                        'done',
                        'ready'
                    ]):
                        if 'canonicalization done' in text or 'canonicalize' in text:
                            ready = True
                            print("  → Canonicalization complete!")
                
                page.on("console", check_console)
                
                print("  Waiting for polyhedron generation...")
                # Check periodically if polyhedron is ready
                check_interval = 1.0  # Check every second instead of 0.5
                while time.time() - start_time < max_wait:
                    # Check if polyhedron is available
                    available = await page.evaluate("""
                        () => typeof globPolys !== 'undefined' && globPolys.length > 0
                    """)
                    
                    if available or ready:
                        if available:
                            print("  → Polyhedron available!")
                        break
                    
                    await asyncio.sleep(check_interval)
                else:
                    # Check one more time before giving up
                    available = await page.evaluate("""
                        () => typeof globPolys !== 'undefined' && globPolys.length > 0
                    """)
                    if not available:
                        print("Warning: Timeout waiting for polyhedron generation.")
                        print("  Attempting to extract anyway...")
            
            # Execute JavaScript to extract OBJ content directly
            print("Extracting OBJ content...")
            result = await page.evaluate(f"""
                () => {{
                    if (typeof globPolys !== 'undefined' && globPolys.length > 0) {{
                        const objtxt = globPolys[0].toOBJ();
                        const spec = document.getElementById('spec')?.value || '{recipe}';
                        const filename = `polyhedronisme-${{spec.split(/\\s+/g)[0].replace(/\\([^\\)]+\\)/g, "")}}.obj`;
                        
                        return {{ 
                            success: true, 
                            filename: filename, 
                            content: objtxt,
                            size: objtxt.length 
                        }};
                    }} else {{
                        return {{ success: false, error: 'globPolys not available' }};
                    }}
                }}
            """)
            
            if result and result.get('success'):
                filename = result['filename']
                content = result['content']
                size = result.get('size', len(content))
                
                print(f"✓ OBJ content extracted: {filename} ({size} bytes)")
                
                # Save to file
                filepath = output_dir / filename
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(content)
                
                print(f"✓ File saved to: {filepath}")
                await browser.close()
                return filepath
            else:
                error_msg = result.get('error', 'Unknown error') if result else 'No result'
                print(f"Error: Could not extract OBJ. {error_msg}")
                await browser.close()
                return None
                
        except Exception as e:
            print(f"Error: {e}")
            import traceback
            traceback.print_exc()
            await browser.close()
            return None

def download_polyhedron(recipe: str, output_dir: Path = None):
    """
    Synchronous wrapper for async download function.
    """
    return asyncio.run(download_polyhedron_async(recipe, output_dir))

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 download_polyhedronisme.py RECIPE [output_dir]")
        print("\nDownload any polyhedron from polyhedronisme using Conway notation.")
        print("\nExamples:")
        print("  python3 download_polyhedronisme.py C200etT")
        print("  python3 download_polyhedronisme.py C1000qtI")
        print("  python3 download_polyhedronisme.py atI")
        print("  python3 download_polyhedronisme.py C500aatD IGNORED")
        print("\nConway Notation Format: [C{N}][operations][base]")
        print("  Base: T, C, O, I, D, P_N, A_N, Y_N, J_N")
        print("  Operations: a, t, at, aat, st, j, b, c, k, e, g, r, p, w, q, etc.")
        print("  Canonicalization: C{N} (optional, e.g., C1000)")
        print("\nSee scripts/CONWAY_NOTATION_GUIDE.md for full documentation.")
        sys.exit(1)
    
    recipe = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else None
    
    filepath = download_polyhedron(recipe, output_dir)
    
    if filepath:
        print(f"\n✓ Success! File: {filepath}")
        
        # Suggest conversion command
        suggested_slug = suggest_slug(recipe)
        suggested_name = suggested_slug.replace('_', ' ').title()
        
        print(f"\nNext step: Convert using:")
        print(f"  python3 scripts/convert_polyhedronisme.py {filepath} {suggested_slug} \"{suggested_name}\"")
        print(f"\nOr manually:")
        print(f"  python3 scripts/convert_polyhedronisme.py {filepath} <output_name> \"<Display Name>\"")
    else:
        print("\n✗ Download failed.")
        print("\nTroubleshooting:")
        print("  1. Check that the recipe is valid Conway notation")
        print("  2. Try the recipe in browser: https://levskaya.github.io/polyhedronisme/?recipe=" + recipe)
        print("  3. Some recipes may fail or take very long to compute")
        print("  4. Try manual browser console method (see README_POLYHEDRA.md)")
        sys.exit(1)

if __name__ == '__main__':
    main()

