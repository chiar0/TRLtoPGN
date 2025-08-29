#!/usr/bin/env python3
import re

# Read the original semantic report and analyze setScore_add patterns
with open('semantic_report_summary.csv', 'r') as f:
    lines = f.readlines()

print("Key -> New_setScore_add -> Ref_setScore_add -> Ref_Wants")
print("=" * 60)

for line in lines:
    if '"setscore_add",' in line:
        # Extract key
        key_match = re.search(r'"([^"]+)"', line)
        if not key_match:
            continue
        key = key_match.group(1)
        
        # Extract setScore_add values
        # New is first, Ref is second
        setScore_matches = re.findall(r"setScore_add': (True|False)", line)
        if len(setScore_matches) >= 2:
            new_value = setScore_matches[0]
            ref_value = setScore_matches[1]
            ref_wants = "TRUE" if ref_value == "True" else "FALSE"
            print(f"{key} -> {new_value} -> {ref_value} -> REF_WANTS_{ref_wants}")