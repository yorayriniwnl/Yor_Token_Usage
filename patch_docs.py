import re

with open('PRIVACY.md', 'r', encoding='utf-8') as f:
    content = f.read()

# Update permissions list if mentioned
content = content.replace('alarms, notifications, tabs', 'alarms, notifications')
content = content.replace('alarms, notifications, and tabs', 'alarms and notifications')

with open('PRIVACY.md', 'w', encoding='utf-8') as f:
    f.write(content)
