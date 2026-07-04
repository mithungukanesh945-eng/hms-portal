import os, re

files_to_patch = ['frontend/js/app.js', 'frontend/patient-portal.html']

for filename in files_to_patch:
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Simple replace
    content = content.replace('localStorage', 'MemStore')
    
    if filename == 'frontend/js/app.js':
        # Find document ready or similar block to inject MemStore init
        # We will inject it right after the file loads, ideally in an IIFE or at the top level awaited.
        # But top-level await is not supported in all browsers natively in non-module scripts.
        # Let's find: document.addEventListener('DOMContentLoaded', () => {
        # and change it to async () => { await MemStore.init(); ...
        
        match = re.search(r'document\.addEventListener\(\'DOMContentLoaded\', \(\) => \{', content)
        if match:
            # Replace it
            content = content.replace(
                "document.addEventListener('DOMContentLoaded', () => {",
                "document.addEventListener('DOMContentLoaded', async () => { await MemStore.init(); const __su = await API.auth.getUser(); if(__su){ MemStore.setItem('token','supa'); MemStore.setItem('role',__su.role); MemStore.setItem('name',__su.name); } else { MemStore.removeItem('token'); }"
            )
        else:
            # If not found, just append to bottom
            pass

    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)

print("Patch applied to localStorage references.")
