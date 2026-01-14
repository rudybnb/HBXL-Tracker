// Enhanced CSV Parser for Weekly Cash Flow Tracking
// Following Mandatory Rule #2: Authentic data only, no mock/placeholder data

interface EnhancedResource {
  orderDate: string;
  requiredDate: string;
  buildPhase: string;
  room?: string;
  resourceType: string;
  resourceType: string;
  supplier: string;
  description: string;
  quantity: number;
  unitPrice?: number;
  unit?: string;
  totalCost?: number;
}

interface WeeklyBreakdown {
  [date: string]: {
    labour: number;
    material: number;
    total: number;
  };
}

interface EnhancedJobData {
  phases: { [key: string]: any[] };
  financials: {
    totalLabour: number;
    totalMaterial: number;
    grandTotal: number;
    weeklyBreakdown: WeeklyBreakdown;
  };
  resources: EnhancedResource[];
}

export function parseEnhancedCSV(lines: string[]): EnhancedJobData | null {
  const enhancedFormatIndex = lines.findIndex((line: string) =>
    (line.includes('Order Date') || line.includes('Order')) &&
    (line.includes('Build Phase') || line.includes('Phase') || line.includes('Room') || line.includes('Location')) &&
    (line.includes('Resource Description') || line.includes('Type of Resource') || line.includes('Description'))
  );

  if (enhancedFormatIndex === -1) {
    return null; // Not enhanced format
  }

  const resources: EnhancedResource[] = [];
  let totalLabourCost = 0;
  let totalMaterialCost = 0;
  const phaseTaskData: { [key: string]: any[] } = {};
  const weeklyBreakdown: WeeklyBreakdown = {};
  const phases: string[] = [];

  console.log('🎯 Using ENHANCED CSV parsing for accounting format');

  // Dynamic Column Detection
  const headerLine = lines[enhancedFormatIndex];
  const headers = headerLine.split(',').map(h => h.trim().toLowerCase());

  const colMap = {
    orderDate: headers.findIndex(h => h.includes('order date') || h === 'date'),
    requiredDate: headers.findIndex(h => h.includes('required')),
    phase: headers.findIndex(h => h.includes('build phase') || h === 'phase'),
    room: headers.findIndex(h => h.includes('room') || h.includes('location') || h.includes('area')),
    type: headers.findIndex(h => h.includes('resource type') || h.includes('type')),
    supplier: headers.findIndex(h => h.includes('supplier') || h.includes('merchant')),
    desc: headers.findIndex(h => h.includes('description') || h === 'desc'),
    qty: headers.findIndex(h => h.includes('quantity') || h === 'qty'),
    unitCost: headers.findIndex(h => h.includes('unit cost') || h.includes('rate') || h.includes('price')),
    totalCost: headers.findIndex(h => h.includes('total') || h.includes('amount') || (h.includes('cost') && !h.includes('unit')))
  };

  console.log('🔍 Dynamic Column Mapping:', colMap);

  for (let i = enhancedFormatIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.trim() === '') continue;

    const parts = line.split(',').map(p => p.trim());
    if (parts.length < 3) continue;

    // Use mapped columns or fallbacks for standard HBXL format
    const resource: EnhancedResource = {
      orderDate: colMap.orderDate > -1 ? parts[colMap.orderDate] : (parts[0] || ''),
      requiredDate: colMap.requiredDate > -1 ? parts[colMap.requiredDate] : (parts[1] || ''),
      buildPhase: colMap.phase > -1 ? parts[colMap.phase] : (parts[2] || 'General'),
      room: colMap.room > -1 ? parts[colMap.room] : undefined,
      resourceType: colMap.type > -1 ? parts[colMap.type] : (parts[3] || ''),
      supplier: colMap.supplier > -1 ? parts[colMap.supplier] : (parts[4] || ''),
      description: colMap.desc > -1 ? parts[colMap.desc] : (parts[5] || ''),
      quantity: colMap.qty > -1 ? parseInt(parts[colMap.qty]) : (parseInt(parts[7]) || 0)
    };

    // Extract price from column OR description
    const priceMatch = resource.description.match(/£(\d+\.?\d*)/);
    const unitMatch = resource.description.match(/£\d+\.?\d*\/(\w+)/);

    // Prioritize column data, fallback to regex extraction
    if (colMap.unitCost > -1) {
      const rawPrice = parts[colMap.unitCost].replace(/[£,]/g, '');
      resource.unitPrice = parseFloat(rawPrice) || 0;
    } else if (priceMatch) {
      resource.unitPrice = parseFloat(priceMatch[1]);
    } else {
      resource.unitPrice = 0;
    }

    // Determine unit
    resource.unit = unitMatch ? unitMatch[1] : 'Each';

    // Calculate total if not provided
    if (colMap.totalCost > -1) {
      const rawTotal = parts[colMap.totalCost].replace(/[£,]/g, '');
      resource.totalCost = parseFloat(rawTotal) || (resource.unitPrice * resource.quantity);
    } else {
      resource.totalCost = resource.unitPrice * resource.quantity;
    }

    // Valid if we have a cost OR it's a valid item with quantity
    if ((resource.totalCost > 0 || resource.unitPrice > 0) && resource.quantity > 0) {

      // Track costs by type for accounting
      if (resource.resourceType.toLowerCase() === 'labour') {
        totalLabourCost += resource.totalCost;
      } else if (resource.resourceType.toLowerCase() === 'material') {
        totalMaterialCost += resource.totalCost;
      }

      // Build phase / Room task structure
      // PRIORITY: Use Room if available, otherwise Build Phase
      const groupKey = resource.room && resource.room.trim() !== '' ? resource.room : resource.buildPhase;

      if (groupKey && groupKey !== 'General' && groupKey.toLowerCase() !== 'material' && groupKey.toLowerCase() !== 'labour') {
        if (!phaseTaskData[groupKey]) {
          phaseTaskData[groupKey] = [];
        }
        phaseTaskData[groupKey].push({
          task: `${resource.resourceType}: ${resource.description}`,
          description: `${resource.quantity} × £${resource.unitPrice} = £${resource.totalCost.toFixed(2)}`,
          quantity: resource.quantity,
          unitPrice: resource.unitPrice,
          totalCost: resource.totalCost,
          supplier: resource.supplier,
          orderDate: resource.orderDate,
          resourceType: resource.resourceType,
          originalPhase: resource.buildPhase // Keep track of original phase if needed
        });

        if (!phases.includes(groupKey)) {
          phases.push(groupKey);
          console.log('🎯 Enhanced parser found group (Room/Phase):', groupKey);
        }
      }

      // Weekly cash flow breakdown
      if (resource.orderDate) {
        if (!weeklyBreakdown[resource.orderDate]) {
          weeklyBreakdown[resource.orderDate] = { labour: 0, material: 0, total: 0 };
        }
        const costType = resource.resourceType.toLowerCase();
        if (costType === 'labour' || costType === 'material') {
          weeklyBreakdown[resource.orderDate][costType] += resource.totalCost;
          weeklyBreakdown[resource.orderDate].total += resource.totalCost;
        }
      }
    }

    resources.push(resource);
  }

  console.log('🎯 Enhanced parsing results:', {
    phases: phases,
    resourceCount: resources.length,
    totalLabourCost,
    totalMaterialCost,
    grandTotal: totalLabourCost + totalMaterialCost,
    weeklyBreakdown
  });

  return {
    phases: phaseTaskData,
    financials: {
      totalLabour: totalLabourCost,
      totalMaterial: totalMaterialCost,
      grandTotal: totalLabourCost + totalMaterialCost,
      weeklyBreakdown
    },
    resources: resources.filter(r => r.unitPrice !== undefined)
  };
}