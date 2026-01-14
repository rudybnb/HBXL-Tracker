import { QSCalculator } from "./qs-calculator";

// Mock Job Data simulating a Clean Import
const mockJob = {
    id: 123,
    title: "Test Job",
    phaseTaskData: JSON.stringify({
        phases: {
            "Foundations": [
                { description: "Readymix Concrete GEN 1 (m3)", quantity: 10, unit: "m³", totalCost: 1500, unitPrice: 150 }
            ],
            "Masonry Shell": [
                { description: "Facing Bricks", quantity: 5000, unit: "nr", totalCost: 6000 }
            ],
            "Roof Structure": [
                { description: "Trusses", quantity: 12, unit: "nr", totalCost: 1200 }
            ]
        }
    })
};

console.log("--- RUNNING QS CALCULATOR TEST ---");
// @ts-ignore
const result = QSCalculator.calculate(mockJob);

console.log(`Project: ${result.projectName}`);
console.log(`Grand Total: £${result.grandTotal}`);

result.sections.forEach(section => {
    console.log(`\n[SECTION ${section.id}] ${section.title} (£${section.total})`);
    section.items.forEach(item => {
        console.log(` - ${item.element}: ${item.quantity} ${item.unit} @ £${item.rate} = £${item.total} [Calculated: ${item.isCalculated}]`);
    });
});
