
import * as WebIFC from "web-ifc";
async function main() {
    const ifcApi = new WebIFC.IfcAPI();
    console.log("Calling Init...");
    const p = ifcApi.Init();
    console.log("Returned:", p);
    if (p instanceof Promise) {
        console.log("It IS a promise. Waiting...");
        await p;
        console.log("Init done.");
    } else {
        console.log("It is NOT a promise.");
    }
}
main().catch(console.error);
