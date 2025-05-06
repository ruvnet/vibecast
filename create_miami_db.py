#!/usr/bin/env python3
"""
Script to create a SQLite database from the Miami luxury homes CSV file.
"""
import csv
import sqlite3
import os

# Database file name
DB_FILE = 'miami_homes.db'

# Remove existing database if it exists
if os.path.exists(DB_FILE):
    os.remove(DB_FILE)
    print(f"Removed existing {DB_FILE}")

# Connect to the SQLite database
conn = sqlite3.connect(DB_FILE)
cursor = conn.cursor()

# Create the table with appropriate schema
cursor.execute('''
CREATE TABLE luxury_homes (
    property_id TEXT PRIMARY KEY,
    sale_price TEXT,
    address TEXT,
    square_footage INTEGER,
    bedrooms INTEGER,
    bathrooms REAL,
    features TEXT
)
''')

# Read the CSV file and insert data into the database
with open('miami_luxury_homes.csv', 'r') as csv_file:
    csv_reader = csv.reader(csv_file)
    next(csv_reader)  # Skip the header row
    
    for row in csv_reader:
        # Handle potential commas in the features field
        if len(row) > 7:
            # Reconstruct the features field if it was split due to commas
            features = ','.join(row[6:])
            row = row[:6] + [features]
        
        cursor.execute('''
        INSERT INTO luxury_homes 
        (property_id, sale_price, address, square_footage, bedrooms, bathrooms, features)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', row)

# Commit the changes and close the connection
conn.commit()

# Verify the data was imported correctly
print("\nVerifying database contents:")
cursor.execute("SELECT COUNT(*) FROM luxury_homes")
count = cursor.fetchone()[0]
print(f"Total records imported: {count}")

print("\nSample data from the database:")
cursor.execute("SELECT * FROM luxury_homes LIMIT 5")
rows = cursor.fetchall()
for row in rows:
    print(row)

# Close the connection
conn.close()

print(f"\nDatabase '{DB_FILE}' created successfully!")