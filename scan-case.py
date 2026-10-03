import json
import os
import re

# Load db schema
with open('db-schema.json', 'r') as f:
    db_columns = json.load(f)

# Build map of lowercase -> exact case
col_map = {}
for col in db_columns:
    col_map[col['COLUMN_NAME'].lower()] = col['COLUMN_NAME']

src_dir = '/Users/aait/Documents/Development/DIEZ-OMS/oms-backend/src'

mismatches = []

for root, _, files in os.walk(src_dir):
    for file in files:
        if file.endswith('.ts'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Find all words in the file
            words = re.findall(r'\b[a-zA-Z_][a-zA-Z0-9_]*\b', content)
            
            # We want to check if any word matches a DB column case-insensitively but not exactly.
            # But wait, typescript variables also use camelCase (e.g. is_active -> isActive, user_id -> userId).
            # We only care about words inside SQL queries!
            # Let's extract SQL queries using backticks
            sqls = re.findall(r'`(.*?)`', content, re.DOTALL)
            
            for sql in sqls:
                if 'SELECT' in sql.upper() or 'UPDATE' in sql.upper() or 'INSERT' in sql.upper() or 'DELETE' in sql.upper():
                    sql_words = set(re.findall(r'\b[a-zA-Z_][a-zA-Z0-9_]*\b', sql))
                    for w in sql_words:
                        w_lower = w.lower()
                        if w_lower in col_map:
                            expected = col_map[w_lower]
                            if w != expected:
                                # Some columns have both cases across different tables (like is_active and IsActive)
                                # Let's just collect them all
                                mismatches.append((path, w, expected))

# Print unique mismatches
unique = set(mismatches)
for m in sorted(unique):
    print(f"{m[0]}: found '{m[1]}', DB has '{m[2]}'")
