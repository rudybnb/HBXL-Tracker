# DATA CLEANUP COMMANDS

## Safe Data Cleanup Options

### Remove All James Test Data (Keep Original)
```sql
DELETE FROM work_sessions 
WHERE contractor_name = 'James' 
AND id != 'test-session-today';
```

### Remove ALL James Data (Complete Reset)
```sql
DELETE FROM work_sessions 
WHERE contractor_name = 'James';
```

### View Current Data Before Cleanup
```sql
SELECT id, DATE(start_time) as date, TO_CHAR(start_time, 'HH24:MI') as time, total_hours
FROM work_sessions 
WHERE contractor_name = 'James' 
ORDER BY start_time;
```

### Remove Specific Sessions by ID
```sql
DELETE FROM work_sessions WHERE id = 'session-id-here';
```

## Data Control Philosophy
- You have full control over your data
- Test data can always be removed
- Only keep what you need
- Database cleanup prevents accumulation
- Your original work is always preserved unless you choose to remove it

## Current Status
- Original session: `test-session-today` (your 8:45-5:00 work day)
- Test data: Removed as requested
- System: Clean and under your control