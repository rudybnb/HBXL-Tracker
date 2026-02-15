// Enhanced CSV Parser for Weekly Cash Flow Tracking
// Following Mandatory Rule #2: Authentic data only, no mock/placeholder data

interface EnhancedResource {
  orderDate: string;
  requiredDate: string;
  buildPhase: string;
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
  const enhancedFormatIndex = lines.findIndex(line => 
    line.includes('Order Date') && line.includes('Build Phase') && (line.includes('Resource Description') || line.includes('Type of Resource'))
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

  for (let i = enhancedFormatIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.trim() === '') continue;

    const parts = line.split(',').map(p => p.trim());
    if (parts.length < 8) continue;

    const resource: EnhancedResource = {
      orderDate: parts[0] || '',
      requiredDate: parts[1] || '',
      buildPhase: parts[2] || 'General',
      resourceType: parts[3] || '',
      supplier: parts[4] || '',
      description: parts[5] || '',
      quantity: parseInt(parts[7]) || 0
    };

    // Extract price using regex - MANDATORY RULE: authentic data only
    const priceMatch = resource.description.match(/£(\d+\.?\d*)/);
    const unitMatch = resource.description.match(/£\d+\.?\d*\/(\w+)/);

    if (priceMatch && resource.quantity > 0) {
      resource.unitPrice = parseFloat(priceMatch[1]);
      resource.unit = unitMatch ? unitMatch[1] : 'Each';
      resource.totalCost = resource.unitPrice * resource.quantity;

      // Track costs by type for accounting
      if (resource.resourceType.toLowerCase() === 'labour') {
        totalLabourCost += resource.totalCost;
      } else if (resource.resourceType.toLowerCase() === 'material') {
        totalMaterialCost += resource.totalCost;
      }

      // Build phase task structure for compatibility
      if (resource.buildPhase && resource.buildPhase !== 'General' && resource.buildPhase.toLowerCase() !== 'material' && resource.buildPhase.toLowerCase() !== 'labour') {
        if (!phaseTaskData[resource.buildPhase]) {
          phaseTaskData[resource.buildPhase] = [];
        }
        phaseTaskData[resource.buildPhase].push({
          task: `${resource.resourceType}: ${resource.description}`,
          description: `${resource.quantity} × £${resource.unitPrice} = £${resource.totalCost.toFixed(2)}`,
          quantity: resource.quantity,
          unitPrice: resource.unitPrice,
          totalCost: resource.totalCost,
          supplier: resource.supplier,
          orderDate: resource.orderDate,
          resourceType: resource.resourceType
        });
        
        if (!phases.includes(resource.buildPhase)) {
          phases.push(resource.buildPhase);
          console.log('🎯 Enhanced parser found phase:', resource.buildPhase);
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