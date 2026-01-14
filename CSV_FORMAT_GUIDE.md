# Improved CSV Format for JobFlow System

## Recommended Format (Option 1: Simplified Table Format)
```csv
Name,Address,Postcode,ProjectType,BuildPhases
Xavier jones,Erith,DA7 6HJ,New Build,"Masonry Shell,Joinery 1st Fix"
John Smith,London,SE1 2AB,Renovation,"Foundation,Roof Structure,Ground Floor"
Maria Garcia,Manchester,M1 3CD,Extension,"Masonry Shell,Joinery 1st Fix,Kitchen Fitting"
```

### Advantages:
- ✅ **Simple table format** - easy to create in Excel/Sheets
- ✅ **Handles multiple jobs** - up to 10 jobs per file
- ✅ **Consistent parsing** - no manual header/data section separation
- ✅ **Clear data structure** - each row is one complete job
- ✅ **Build phases in quotes** - comma-separated phases in single field

## Current Format (Option 2: Header + Data Format)
```csv
Name,Xavier jones
Address,Erith  
Post code,da7 6hj
Project Type,New Build

Order Date,Date Required,Build Phase,Type of Resource,Resource Type,Resource Description,Order Quantity
01/09/2025,01/09/2025,Masonry Shell,Material,Carcassing,Timt Sawn Softwood,34
02/09/2025,02/09/2025,Joinery 1st Fix,Material,Door Furniture,Georgian Brass,1
```

### Current Format Issues:
- ❌ **Single job only** - requires multiple files for multiple jobs
- ❌ **Complex parsing** - needs header/data section logic
- ❌ **Manual checking** - harder to validate multiple jobs

## Recommendation
**Use Option 1 (Simplified Table Format)** for better automation and less manual checking.

### Migration Benefits:
1. **No manual checking needed** - system can validate all jobs automatically
2. **Bulk job creation** - upload up to 10 jobs at once
3. **Easier to create** - standard CSV format in any spreadsheet
4. **More reliable parsing** - consistent table structure
5. **Better preview** - shows all jobs before upload

Would you like to switch to this improved format?