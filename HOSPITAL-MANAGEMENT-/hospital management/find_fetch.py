import re
with open('frontend/js/app.js', 'r', encoding='utf-8') as f:
    text = f.read()

print(re.findall(r'fetch\(.*127\.0\.0\.1.*', text))
print(re.findall(r'fetch\(.*api.*', text))
