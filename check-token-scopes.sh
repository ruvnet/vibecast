#!/bin/bash

# Check Airtable Token Scopes and Capabilities

source .env

echo "🔐 Airtable Token Scope Checker"
echo "================================"
echo ""

# Check if we can list bases
echo "1️⃣  Testing: List accessible bases..."
BASES_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -H "Authorization: Bearer $AIRTABLE_PERSONAL_ACCESS_TOKEN" "https://api.airtable.com/v0/meta/bases")
HTTP_STATUS=$(echo "$BASES_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
BODY=$(echo "$BASES_RESPONSE" | sed '/HTTP_STATUS:/d')

if [ "$HTTP_STATUS" = "200" ]; then
    echo "   ✅ Can list bases"
    echo "$BODY" | python3 -m json.tool
else
    echo "   ❌ Cannot list bases (Status: $HTTP_STATUS)"
    echo "$BODY" | python3 -m json.tool
fi

echo ""
echo "2️⃣  Testing: Get base schema (requires schema.bases:read)..."
SCHEMA_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -H "Authorization: Bearer $AIRTABLE_PERSONAL_ACCESS_TOKEN" "https://api.airtable.com/v0/meta/bases/appzNTISE6DHpfh9x/tables")
HTTP_STATUS=$(echo "$SCHEMA_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
BODY=$(echo "$SCHEMA_RESPONSE" | sed '/HTTP_STATUS:/d')

if [ "$HTTP_STATUS" = "200" ]; then
    echo "   ✅ Can read base schema"
    echo "$BODY" | python3 -m json.tool
else
    echo "   ❌ Cannot read base schema (Status: $HTTP_STATUS)"
    echo "   Reason: Token likely missing 'schema.bases:read' scope"
    echo "$BODY" | python3 -m json.tool
fi

echo ""
echo "📋 WHAT TO DO:"
echo "=============="
echo ""
echo "Your token needs the following scopes to fully explore the base:"
echo "  • schema.bases:read  - To list tables and field schemas"
echo "  • data.records:read  - To read records from tables"
echo "  • data.records:write - To create/update records (if needed)"
echo ""
echo "To add these scopes:"
echo "  1. Go to: https://airtable.com/create/tokens"
echo "  2. Edit your existing token or create a new one"
echo "  3. Add the required scopes"
echo "  4. Select the 'Conveyor-Dev' base"
echo "  5. Update the .env file with the new token"
echo ""
