# Miami Luxury Homes Database

This project creates a SQLite database from the Miami luxury homes CSV data and provides scripts to query the database.

## Database Structure

The database `miami_homes.db` contains a single table called `luxury_homes` with the following schema:

| Column         | Type    | Description                                      |
|----------------|---------|--------------------------------------------------|
| property_id    | TEXT    | Unique identifier for the property (Primary Key) |
| sale_price     | TEXT    | Sale price with dollar sign                      |
| address        | TEXT    | Full property address                            |
| square_footage | INTEGER | Property size in square feet                     |
| bedrooms       | INTEGER | Number of bedrooms                               |
| bathrooms      | REAL    | Number of bathrooms (can include half baths)     |
| features       | TEXT    | Comma-separated list of property features        |

## Scripts

### 1. create_miami_db.py

This script creates the SQLite database and imports data from the CSV file.

Usage:
```bash
python create_miami_db.py
```

The script will:
- Create a new database file named `miami_homes.db`
- Create the `luxury_homes` table with the appropriate schema
- Import all data from `miami_luxury_homes.csv`
- Display a summary of the imported data

### 2. query_miami_db.py

This script demonstrates how to query the database with various SQL queries.

Usage:
```bash
python query_miami_db.py
```

The script runs the following example queries:
- Top 5 most expensive properties
- All waterfront properties
- Average price by number of bedrooms
- Properties larger than 5000 square feet

## Example SQL Queries

Here are some example SQL queries you can run against the database:

### Find properties in a specific location:
```sql
SELECT * FROM luxury_homes 
WHERE address LIKE '%Miami Beach%'
```

### Find properties within a price range:
```sql
SELECT property_id, sale_price, address, bedrooms, bathrooms 
FROM luxury_homes 
WHERE CAST(REPLACE(sale_price, '$', '') AS INTEGER) 
BETWEEN 5000000 AND 10000000
```

### Find properties with specific features:
```sql
SELECT property_id, sale_price, address 
FROM luxury_homes 
WHERE features LIKE '%Home theater%'
```

### Calculate price per square foot:
```sql
SELECT property_id, address, 
       CAST(REPLACE(sale_price, '$', '') AS REAL) / square_footage AS price_per_sqft 
FROM luxury_homes 
ORDER BY price_per_sqft DESC
```

## Extending the Database

To add more data to the database, you can:

1. Append new records to the CSV file
2. Run the `create_miami_db.py` script again (it will recreate the database)

Alternatively, you can use SQL INSERT statements to add new records directly to the database.