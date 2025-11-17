#!/usr/bin/env python3

import json
import os
import urllib.request
import urllib.error

TOKEN = os.environ.get('AIRTABLE_PERSONAL_ACCESS_TOKEN')
BASE_ID = 'appzNTISE6DHpfh9x'

def fetch_table_data(table_name, max_records=5):
    """Fetch sample records from a table"""
    url = f"https://api.airtable.com/v0/{BASE_ID}/{urllib.parse.quote(table_name)}?maxRecords={max_records}"

    req = urllib.request.Request(url)
    req.add_header('Authorization', f'Bearer {TOKEN}')

    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode())
    except urllib.error.HTTPError as e:
        return {"error": f"HTTP {e.code}: {e.reason}"}

# Load schema
with open('airtable-schema.json', 'r') as f:
    schema = json.load(f)

print("=" * 80)
print("AIRTABLE BASE: Conveyor-Dev - COMPLETE DATA STRUCTURE")
print("=" * 80)

all_data = {}

for table in schema['tables']:
    table_name = table['name']
    table_id = table['id']

    print(f"\n{'='*80}")
    print(f"TABLE: {table_name} ({table_id})")
    print(f"{'='*80}")

    # Show field structure
    print(f"\n📋 FIELDS ({len(table['fields'])} total):\n")

    field_summary = {}
    for field in table['fields']:
        field_type = field['type']
        field_summary[field_type] = field_summary.get(field_type, 0) + 1

        # Show first 20 fields in detail
        if len([f for f in table['fields'] if table['fields'].index(f) < table['fields'].index(field)]) < 20:
            print(f"  • {field['name']}")
            print(f"    Type: {field['type']}")
            print(f"    ID: {field['id']}")

            # Show options for select fields
            if field['type'] in ['singleSelect', 'multipleSelects'] and 'options' in field:
                choices = field['options'].get('choices', [])
                if len(choices) <= 5:
                    print(f"    Choices: {', '.join([c['name'] for c in choices])}")
                else:
                    print(f"    Choices: {len(choices)} options")

            # Show linked table info
            if field['type'] == 'multipleRecordLinks' and 'options' in field:
                linked_table = field['options'].get('linkedTableId', 'Unknown')
                print(f"    Links to: {linked_table}")

            print()

    if len(table['fields']) > 20:
        print(f"  ... and {len(table['fields']) - 20} more fields")
        print(f"\n  Field Type Summary:")
        for ftype, count in sorted(field_summary.items(), key=lambda x: -x[1]):
            print(f"    - {ftype}: {count}")

    # Fetch sample data
    print(f"\n📦 SAMPLE DATA (up to 5 records):\n")
    data = fetch_table_data(table_name, max_records=5)

    if 'error' in data:
        print(f"  ⚠️  Could not fetch data: {data['error']}")
    elif 'records' in data:
        all_data[table_name] = data

        print(f"  Total records fetched: {len(data['records'])}")

        if len(data['records']) > 0:
            print(f"\n  Sample Record 1:")
            sample_record = data['records'][0]
            print(f"  Record ID: {sample_record['id']}")
            print(f"  Created: {sample_record.get('createdTime', 'N/A')}")
            print(f"\n  Fields with data:")

            # Show non-empty fields
            for field_name, field_value in sample_record['fields'].items():
                if field_value:  # Only show non-empty fields
                    value_str = str(field_value)
                    if len(value_str) > 100:
                        value_str = value_str[:100] + "..."
                    print(f"    • {field_name}: {value_str}")

            if len(data['records']) > 1:
                print(f"\n  (Plus {len(data['records']) - 1} more records)")

# Save all data
with open('airtable-data-sample.json', 'w') as f:
    json.dump(all_data, f, indent=2)

print(f"\n{'='*80}")
print(f"✅ Complete data structure saved to:")
print(f"   - airtable-schema.json (full schema)")
print(f"   - airtable-data-sample.json (sample records from all tables)")
print(f"{'='*80}\n")
