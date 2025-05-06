#!/usr/bin/env python3
"""
Script to query the Miami luxury homes database.
"""
import sqlite3
import sys

def connect_to_db():
    """Connect to the SQLite database."""
    try:
        conn = sqlite3.connect('miami_homes.db')
        conn.row_factory = sqlite3.Row  # This enables column access by name
        return conn
    except sqlite3.Error as e:
        print(f"Database connection error: {e}")
        sys.exit(1)

def display_results(rows, title):
    """Display query results in a formatted table."""
    if not rows:
        print("No results found.")
        return
    
    print(f"\n{title}")
    print("-" * 100)
    
    # Get column names from the first row
    if isinstance(rows[0], sqlite3.Row):
        columns = rows[0].keys()
        
        # Print header
        header = " | ".join(columns)
        print(header)
        print("-" * len(header))
        
        # Print rows
        for row in rows:
            values = [str(row[col]) for col in columns]
            print(" | ".join(values))
    else:
        # Handle case where rows are tuples
        for row in rows:
            print(" | ".join(str(x) for x in row))
    
    print("-" * 100)

def run_basic_queries(conn):
    """Run some basic queries to demonstrate the database."""
    cursor = conn.cursor()
    
    # Query 1: Get all properties sorted by price (descending)
    cursor.execute("""
    SELECT property_id, sale_price, address, bedrooms, bathrooms, square_footage
    FROM luxury_homes
    ORDER BY CAST(REPLACE(sale_price, '$', '') AS INTEGER) DESC
    LIMIT 5
    """)
    display_results(cursor.fetchall(), "Top 5 Most Expensive Properties")
    
    # Query 2: Get properties with specific features
    cursor.execute("""
    SELECT property_id, sale_price, address, features
    FROM luxury_homes
    WHERE features LIKE '%Waterfront%'
    """)
    display_results(cursor.fetchall(), "Waterfront Properties")
    
    # Query 3: Get average price by number of bedrooms
    cursor.execute("""
    SELECT bedrooms, 
           COUNT(*) as count,
           '$' || ROUND(AVG(CAST(REPLACE(sale_price, '$', '') AS INTEGER)), 2) as avg_price
    FROM luxury_homes
    GROUP BY bedrooms
    ORDER BY bedrooms
    """)
    display_results(cursor.fetchall(), "Average Price by Number of Bedrooms")
    
    # Query 4: Get properties with more than 5000 square feet
    cursor.execute("""
    SELECT property_id, sale_price, address, square_footage
    FROM luxury_homes
    WHERE square_footage > 5000
    ORDER BY square_footage DESC
    """)
    display_results(cursor.fetchall(), "Large Properties (>5000 sq ft)")

def main():
    """Main function to run the queries."""
    conn = connect_to_db()
    try:
        run_basic_queries(conn)
    finally:
        conn.close()

if __name__ == "__main__":
    main()