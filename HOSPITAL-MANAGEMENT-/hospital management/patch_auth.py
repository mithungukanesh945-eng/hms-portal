import re
with open('frontend/js/app.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace login fetch
text = re.sub(
    r"const\s+response\s*=\s*await\s+fetch\('http://127\.0\.0\.1:5000/login',\s*\{[\s\S]*?body:\s*JSON\.stringify\(\{username,\s*password\}\)\s*\}\);[\s\S]*?if\(\!response\.ok\)\s*throw\s*new\s*Error\(res\.message\s*\|\|\s*'Login failed'\);",
    "const res = await API.auth.login(username, password);",
    text
)

# Replace register fetch
text = re.sub(
    r"const\s+response\s*=\s*await\s+fetch\('http://127\.0\.0\.1:5000/register',\s*\{[\s\S]*?body:\s*JSON\.stringify\(formData\)\s*\}\);[\s\S]*?if\(\!response\.ok\)\s*throw\s*new\s*Error\(res\.message\s*\|\|\s*'Registration failed'\);",
    "const res = await API.auth.register(formData);",
    text
)

with open('frontend/js/app.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("Auth patched")
