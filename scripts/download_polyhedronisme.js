// JavaScript to run in browser console on polyhedronisme pages
// This will trigger the OBJ download

// Wait for page to fully load
setTimeout(function() {
    // Check if the button exists and click it
    const objButton = document.getElementById('objsavebutton');
    if (objButton) {
        console.log('Found OBJ save button, clicking...');
        objButton.click();
    } else {
        // Try alternative: directly trigger the download
        if (typeof globPolys !== 'undefined' && globPolys.length > 0) {
            const objtxt = globPolys[0].toOBJ();
            const spec = document.getElementById('spec')?.value || 'polyhedron';
            const filename = `polyhedronisme-${spec.split(/\s+/g)[0].replace(/\([^\)]+\)/g, "")}.obj`;
            
            // Create download
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
            console.log('Could not find polyhedron data. Make sure the page has fully loaded.');
        }
    }
}, 2000);

