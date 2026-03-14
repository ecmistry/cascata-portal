### Cascade Model Configuration Questions

- Built configuration page with 10 key questions for setup
- Core questions identified:
  1. Which field determines when someone became an SQL?
  2. How do you select your teams? (Property admin pod field)
  3. What type of SQLs do you track?
  4. What date field tracks conversion to opportunity? (for contacts vs deals)
  5. How do you select teams for opportunities?
  6. What field captures ARR?
  7. What field tracks close date?
  8. What field tracks if deal is won?
- Removed question about SQL-opportunity mapping
  - Not needed - just requires calculation of numbers on each side

### Cascade Model Logic & Structure

- Spreadsheet contains 10+ tabs for different motions
- Tab naming convention: [Motion] Cascade [Region] (e.g., “Inbound Cascade EMEA North”)
- Motion types: Inbound, Outbound, Event, Partner
- Historical analysis approach:
  - Count SQLs within given quarter using SQL date field
  - Track conversion using “Property Admin First Became Opportunity Date”
  - Calculate conversion rates and timing probabilities
- Probability matrix concept:
  - Column B: Number of SQLs per quarter
  - Column C: Conversion percentage
  - Cascade shows timing probability (same quarter vs future quarters)

### Technical Implementation Requirements

- Connect to HubSpot via SQL queries
- Build pivot tables for each motion separately
  - Each motion has different conversion rates
- Calculate historical performance:
  - SQL generation by quarter
  - Conversion rates by quarter
  - Time-based conversion probability
- Create visual UI similar to spreadsheet but cleaner
- Enable manual editing capabilities for future projections

### Development Approach

- First version focus:
  1. Connect to HubSpot
  2. Answer configuration questions
  3. Calculate first portion of cascade
  4. Present in UI similar to spreadsheet format
- Built in Cursor for collaborative iteration
- Second cascade portion will follow similar logic once first is complete

### Next Steps

- Rory to build first version with HubSpot connection
- Create probability matrix calculations
- Develop visual interface
- Ping for review once first portion complete
- Iterate together on improvements

---