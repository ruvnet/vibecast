# Airtable Base Structure: Conveyor-Dev

**Base ID**: `appzNTISE6DHpfh9x`
**Permission Level**: create
**Analysis Date**: 2025-11-17

## Token Status

✅ **Token Working**: Yes
✅ **Schema Access**: Yes (`schema.bases:read` scope)
⚠️ **Data Access**: No (`data.records:read` scope needed)

### Current Token Capabilities
- ✅ List accessible bases
- ✅ Read base schema (tables, fields, field types)
- ❌ Read actual records from tables
- ❌ Write data to tables

### To Enable Data Access
Add the `data.records:read` scope to your token at: https://airtable.com/create/tokens

---

## Base Overview

**Total Tables**: 11

| # | Table Name | Table ID | Fields | Purpose |
|---|------------|----------|--------|---------|
| 1 | Managed Cases | tblK7Ia5xz9KwGFA9 | 494 | Primary case management |
| 2 | Referred Cases | tbl0koLOlII4TZMjS | 43 | Cases referred to partners |
| 3 | Co-Counsel & Referral Partners 🧑‍⚖️🦺 | tblPULhzeVtJg8lBW | 24 | Partner/attorney directory |
| 4 | Invoices | tblhfqBB0pX6f62tO | 11 | Billing and invoicing |
| 5 | Payments | tblEBJZZhWzkVqZHP | 7 | Payment tracking |
| 6 | Emails | tblcv5IUvDXJ0qwIt | 4 | Email correspondence log |
| 7 | Client Folders | tblHeShnsxCTy5P82 | 3 | Document organization |
| 8 | Conveyor Users 👤 | tblhc5cOc5Y4ZlbP2 | 19 | Internal user management |
| 9 | Professional Partners 🧑‍💻 | tblM6tUoMn6bqQyaK | 15 | Professional service providers |
| 10 | Contacts | tblEpmFmsQkFogqEw | 11 | Contact database |
| 11 | Users | tblJlOIKBsHBVjEO9 | 15 | User accounts |

---

## Detailed Table Structures

### 1. Managed Cases (tblK7Ia5xz9KwGFA9)
**Purpose**: Primary case management system
**Total Fields**: 494
**Primary Field**: Case Number (formula field)

#### Field Type Breakdown:
- Checkboxes: 102
- Formulas: 77
- Attachments: 77
- Dates: 46
- Single Select: 40
- Currency: 31
- Percent: 31
- Lookups: 13
- Links: 11
- Rich Text: 11
- DateTime: 9
- Multiple Selects: 8
- And more...

#### Key Fields:
- **Case Number**: Formula field (Primary)
- **Claim State**: US State selection (51 options)
- **Referred Firm**: Link to Co-Counsel table
- **Associate Counsel**: Multiple select (6 options)
- **Resolutions Specialist**: Single select (7 options)
- **Paralegal**: Single select (Brittany Owens, Kristie Fogner, La'Keisha Massey, Marisol Rivera, Tammy Quigley)
- **Department**: Single select (Onboarding, Retained, Settled, Claim Closed, Lead, Dead Lead)
- **Case Status**: Single select (16 status options)
- **Next Steps**: Multiple select (106 workflow steps)
- **Due Dates**: OS, RS, PL, Attorney due dates
- **Recent Client Comm Date**: Date field
- **Category Type**: Multiple select (Cat 1-4)
- **Attorney Rep'd**: Checkbox
- **DA/OC**: Desk Adjuster or Opposing Counsel
- **Law Firm Notes**: Multiline text
- **Resolutions Notes**: Rich text
- **Email Correspondence PDF**: Multiple attachments

#### Case Status Options:
1. Referral
2. Pre-Litigation
3. Appraisal
4. Appraisal - Lit
5. Re-Inspection
6. Litigation
7. Settled
8. Settled - Paid
9. Settled with Release
10. Settled with Release - Paid
11. Settled with Appraisal Award
12. Settled with Appraisal Award - Paid
13. Closed No Service
14. Dead Lead - Confirmed
15. Non-Responsive
16. Closed - New Claim

---

### 2. Referred Cases (tbl0koLOlII4TZMjS)
**Purpose**: Cases referred to external partners
**Total Fields**: 43
**Primary Field**: Client Name

#### Field Type Breakdown:
- Attachments: 13 (Insurance docs, estimates, reports, contracts)
- Text: 9
- Multiple Selects: 4
- Single Select: 4
- Multiline Text: 3
- URLs: 2
- Other: 8

#### Key Fields:
- **Client Name**: Single line text (Primary)
- **Create Managed Case**: Checkbox to convert to managed case
- **Associated Case**: Link to Managed Cases table
- **Document Attachments**:
  - Insurance Estimate & Docs
  - Insurance Checks
  - JPA Estimate
  - JPA Strategy Docs
  - Insurance Policy PDF
  - Contract
  - Roof Report
  - Contractor Photos
  - Hail Report
  - Inspection Report
  - LOR (Letter of Representation)
- **Claim State**: Multiple select (15 states)
- **Property Type**: Residential or Commercial
- **Insurance Company**: Single select (176 companies!)
- **Cause of Loss**: Multiple select (21 causes including hail, wind, water, fire, etc.)
- **Address**: Multiline text

---

### 3. Co-Counsel & Referral Partners 🧑‍⚖️🦺 (tblPULhzeVtJg8lBW)
**Purpose**: Attorney and referral partner directory
**Total Fields**: 24
**Primary Field**: Partner Name

#### Field Type Breakdown:
- Rich Text: 5
- Single Select: 3
- Phone Numbers: 3
- Record Links: 3
- Text: 2
- Attachments: 2
- Email: 2
- Other: 4

#### Key Fields:
- **Partner Name**: Text (Primary)
- **Status**: New, Reviewing, Approved, Active, Rejected
- **Partner Type**: Co-Counsel, Referral Partner, Build
- **Logo**: Attachment
- **Attorney Name**: Text
- **RP Contact Name**: Rich text
- **License States**: Multiple select (51 states)
- **CLG Email**: Email
- **Email**: Email
- **Office Number**: Phone
- **Mobile Number**: Phone
- **Fax Number**: Phone
- **Physical Address**: Rich text
- **Mailing Address**: Rich text
- **Bar No.**: Rich text
- **Domain**: URL
- **W9**: Attachment
- **Additional Details**: Rich text
- **RP Fee Percentages**: 20% / 30%, 25% / 35%, 30% / 35%
- **Counsel ID**: Formula

---

### 4. Invoices (tblhfqBB0pX6f62tO)
**Purpose**: Billing and invoicing system
**Total Fields**: 11
**Primary Field**: Invoice Number

#### Key Fields:
- **Invoice Number**: Text (Primary)
- **Reference Number**: Text
- **Amount**: Currency
- **Invoice Status**: Draft, Sent, Paid, Partially Paid, Void
- **Attachement**: Multiple attachments
- **QBO ID**: QuickBooks Online ID
- **Associated Case**: Link to Managed Cases
- **Associated Payments**: Link to Payments table
- **Sent Date**: Date
- **Create Date**: Created time
- **Invoice ID**: Formula

---

### 5. Payments (tblEBJZZhWzkVqZHP)
**Purpose**: Payment tracking and reconciliation
**Total Fields**: 7
**Primary Field**: Payment Index (formula)

#### Key Fields:
- **Payment Index**: Formula (Primary)
- **Payment Notes**: Multiline text
- **Payment Date**: Date
- **Payment Amount**: Currency
- **Payment Type**: ACH, Cash, Check, Credit Card
- **Associated Invoice**: Link to Invoices table
- **Payment ID**: Formula

---

### 6. Emails (tblcv5IUvDXJ0qwIt)
**Purpose**: Email correspondence tracking
**Total Fields**: 4
**Primary Field**: Email Subject

#### Key Fields:
- **Email Subject**: Text (Primary)
- **Body**: Multiline text
- **Received Date**: Date
- **Associated Case**: Link to Managed Cases

---

### 7. Client Folders (tblHeShnsxCTy5P82)
**Purpose**: Document folder organization
**Total Fields**: 3
**Primary Field**: Folder Name

#### Key Fields:
- **Folder Name**: Text (Primary)
- **Folder Status**: Active, Archived
- **Folder ID**: Formula

---

### 8. Conveyor Users 👤 (tblhc5cOc5Y4ZlbP2)
**Purpose**: Internal user management
**Total Fields**: 19
**Primary Field**: User name or ID

*Detailed structure available in schema file*

---

### 9. Professional Partners 🧑‍💻 (tblM6tUoMn6bqQyaK)
**Purpose**: Professional service provider directory
**Total Fields**: 15
**Primary Field**: Partner identifier

*Detailed structure available in schema file*

---

### 10. Contacts (tblEpmFmsQkFogqEw)
**Purpose**: General contact database
**Total Fields**: 11
**Primary Field**: Contact name/ID

*Detailed structure available in schema file*

---

### 11. Users (tblJlOIKBsHBVjEO9)
**Purpose**: User account management
**Total Fields**: 15
**Primary Field**: User identifier

*Detailed structure available in schema file*

---

## Table Relationships

### Relationship Diagram:

```
Managed Cases (tblK7Ia5xz9KwGFA9)
├── Links to → Co-Counsel & Referral Partners (Referred Firm)
├── Links to → Emails (Email correspondence)
├── Links from ← Referred Cases (can be converted)
└── Links from ← Invoices (billing)

Invoices (tblhfqBB0pX6f62tO)
├── Links to → Managed Cases
└── Links to → Payments

Payments (tblEBJZZhWzkVqZHP)
└── Links to → Invoices

Referred Cases (tbl0koLOlII4TZMjS)
└── Links to → Managed Cases (when converted)

Emails (tblcv5IUvDXJ0qwIt)
└── Links to → Managed Cases
```

---

## Data Access Examples

### Get Base Schema
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.airtable.com/v0/meta/bases/appzNTISE6DHpfh9x/tables"
```

### List Records (requires data.records:read scope)
```bash
# List managed cases
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.airtable.com/v0/appzNTISE6DHpfh9x/Managed%20Cases?maxRecords=10"

# List co-counsel partners
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.airtable.com/v0/appzNTISE6DHpfh9x/Co-Counsel%20%26%20Referral%20Partners%20%F0%9F%A7%91%E2%80%8D%E2%9A%96%EF%B8%8F%F0%9F%A6%BA?maxRecords=10"
```

### Create Record (requires data.records:write scope)
```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.airtable.com/v0/appzNTISE6DHpfh9x/Managed%20Cases" \
  -d '{
    "fields": {
      "Client Name": "John Doe",
      "Claim State": "CA",
      "Department": "Lead"
    }
  }'
```

---

## Files Generated

1. **airtable-schema.json** - Complete base schema with all tables and fields
2. **check-token-scopes.sh** - Script to verify token capabilities
3. **fetch-all-data.py** - Python script to explore base and fetch sample data
4. **test-airtable.js** - Node.js token verification script

---

## Next Steps

### To fully access your data:

1. Go to https://airtable.com/create/tokens
2. Edit your existing token or create a new one
3. Add these scopes:
   - `data.records:read` - To read records
   - `data.records:write` - To create/update records (optional)
4. Ensure the token has access to the "Conveyor-Dev" base
5. Update `.env` with the new token
6. Run: `./check-token-scopes.sh` to verify

---

## Summary

This is a comprehensive **case management system** for a law firm handling insurance claims. The system tracks:

- **Cases** through multiple stages (lead → onboarding → litigation → settlement)
- **Client communications** and documents
- **Partner relationships** with co-counsel and referral sources
- **Financial data** (invoices and payments)
- **Team assignments** (paralegals, specialists, attorneys)
- **Workflow management** with 106+ possible next steps

The **Managed Cases** table is the heart of the system with 494 fields tracking every aspect of a case lifecycle, from initial lead capture through settlement and payment.
