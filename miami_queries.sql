-- Miami Luxury Homes Database Example Queries
-- Run with: sqlite3 miami_homes.db < miami_queries.sql

-- Enable column headers
.headers on
.mode column

-- 1. View all properties
SELECT property_id, sale_price, address, bedrooms, bathrooms, square_footage
FROM luxury_homes;

-- 2. Top 5 most expensive properties
SELECT property_id, sale_price, address, bedrooms, bathrooms, square_footage
FROM luxury_homes
ORDER BY CAST(REPLACE(sale_price, '$', '') AS INTEGER) DESC
LIMIT 5;

-- 3. Properties by location
SELECT property_id, sale_price, address
FROM luxury_homes
WHERE address LIKE '%Miami Beach%';

-- 4. Properties with specific features
SELECT property_id, sale_price, address, features
FROM luxury_homes
WHERE features LIKE '%Home theater%';

-- 5. Average price by number of bedrooms
SELECT bedrooms, 
       COUNT(*) as count,
       '$' || ROUND(AVG(CAST(REPLACE(sale_price, '$', '') AS INTEGER)), 2) as avg_price
FROM luxury_homes
GROUP BY bedrooms
ORDER BY bedrooms;

-- 6. Price per square foot analysis
SELECT property_id, 
       address, 
       sale_price,
       square_footage,
       '$' || ROUND(CAST(REPLACE(sale_price, '$', '') AS REAL) / square_footage, 2) AS price_per_sqft
FROM luxury_homes
ORDER BY CAST(REPLACE(price_per_sqft, '$', '') AS REAL) DESC;

-- 7. Properties with more than 5 bedrooms
SELECT property_id, sale_price, address, bedrooms, bathrooms
FROM luxury_homes
WHERE bedrooms > 5;

-- 8. Properties with specific bathroom count
SELECT property_id, sale_price, address, bedrooms, bathrooms
FROM luxury_homes
WHERE bathrooms >= 7;

-- 9. Count properties by neighborhood
SELECT 
    CASE 
        WHEN address LIKE '%Miami Beach%' THEN 'Miami Beach'
        WHEN address LIKE '%Bal Harbour%' THEN 'Bal Harbour'
        WHEN address LIKE '%Key Biscayne%' THEN 'Key Biscayne'
        WHEN address LIKE '%Coral Gables%' THEN 'Coral Gables'
        WHEN address LIKE '%Coconut Grove%' THEN 'Coconut Grove'
        ELSE 'Other'
    END AS neighborhood,
    COUNT(*) as property_count,
    '$' || ROUND(AVG(CAST(REPLACE(sale_price, '$', '') AS INTEGER)), 2) as avg_price
FROM luxury_homes
GROUP BY neighborhood
ORDER BY property_count DESC;

-- 10. Find the property with the most features
SELECT property_id, sale_price, address, 
       LENGTH(features) - LENGTH(REPLACE(features, ',', '')) + 1 AS feature_count,
       features
FROM luxury_homes
ORDER BY feature_count DESC
LIMIT 1;