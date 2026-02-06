
import { IfcAgent } from '../server/agents/ifc-agent';
import * as path from 'path';

async function run() {
    const p = path.resolve(process.cwd(), 'server/wall polyline.ifc');
    console.log("Processing:", p);
    const agent = new IfcAgent();
    const res = await agent.process(p);
    console.log("Result:", JSON.stringify(res, null, 2));
}

run();
