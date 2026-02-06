import * as fs from 'fs';
import * as path from 'path';

// --- TYPES FROM SPEC ---

export type HBXLLine = {
    job_code: string;
    phase_code: string | null;
    item_id: number;
    type: "LABOUR" | "MATERIAL" | "PLANT" | "SUBCONTRACTOR" | "PRELIM" | "FEE";
    description: string;
    category: string;
    qty: number;
    unit: string;
    hbxl_unit_rate_pence: number;
    hbxl_total_pence: number;
    contractor_unit_rate_pence?: number | null;
    contractor_total_pence?: number | null;
    notes?: string | null;
};

export type RoomConfig = {
    room_code: string;
    room_name: string;
    area_m2?: number | null;
    include_patterns?: string[];
};

export type JobConfig = {
    job_code: string;
    client_name: string | null;
    project_type: string | null;
    postcode: string | null;
    address: string | null;
    rooms: RoomConfig[];
    default_material_lead_days: number;
};

export type TaskPayload = {
    task_id: string;
    room_code: string;
    phase_code: string | null;
    description: string;
    type: "LABOUR" | "MATERIAL" | "PLANT" | "PRELIM" | "SUBCONTRACTOR";
    qty: number;
    unit: string;
    hbxl_unit_rate_pence: number;
    hbxl_total_pence: number;
    contractor_unit_rate_pence: number | null;
    contractor_total_pence: number | null;
    status: "PLANNED" | "IN_PROGRESS" | "DONE" | "CANCELLED";
    planned_start_date: string | null;
    planned_finish_date: string | null;
    material_required_date: string | null;
    subcontractor_id: string | null;
    trade: string | null;
    notes: string | null;
};

export type RoomPayload = {
    room_code: string;
    room_name: string;
    tasks: TaskPayload[];
    sums: {
        labour_pence: number;
        materials_pence: number;
        plant_pence: number;
        total_pence: number;
    };
};

export type JobPayload = {
    job: {
        job_code: string;
        client_name: string | null;
        project_type: string | null;
        postcode: string | null;
        address: string | null;
    };
    rooms: RoomPayload[];
    totals: {
        labour_pence: number;
        materials_pence: number;
        plant_pence: number;
        prelims_pence: number;
        fees_pence: number;
        grand_total_pence: number;
    };
};

type RoomLine = HBXLLine & { room_code: string | null };

// --- CORE LOGIC ---

export class HBXLRoomJobBuilder {

    static buildJobPayload(lines: HBXLLine[], config: JobConfig): JobPayload {
        // Step 1: Already normalised (assumed)

        // Step 2 & 3: Partition and Map to Rooms
        const roomLines: RoomLine[] = lines.map(line => {
            const room = this.findRoomForLine(line, config.rooms);
            return { ...line, room_code: room ? room.room_code : "UNALLOCATED" };
        });

        // Step 4: Build Pay Items (Tasks) per Room
        const roomsMap = new Map<string, TaskPayload[]>();

        // Initialize rooms from config to ensure they exist even if empty
        config.rooms.forEach(r => roomsMap.set(r.room_code, []));
        roomsMap.set("UNALLOCATED", []);

        // Grouping
        const groupedStuff = this.groupLines(roomLines);

        // Create Tasks
        for (const group of groupedStuff) {
            const task = this.createTaskFromGroup(group, config);
            const list = roomsMap.get(task.room_code) || [];
            list.push(task);
            roomsMap.set(task.room_code, list);
        }

        // Step 7: Summaries
        const roomPayloads: RoomPayload[] = [];
        let grandLab = 0, grandMat = 0, grandPlant = 0, grandPrelim = 0, grandFee = 0;

        for (const [rCode, tasks] of roomsMap.entries()) {
            if (tasks.length === 0 && rCode === "UNALLOCATED") continue;

            const rConfig = config.rooms.find(r => r.room_code === rCode);
            const rName = rConfig ? rConfig.room_name : "Unallocated Items";

            const sums = {
                labour_pence: 0,
                materials_pence: 0,
                plant_pence: 0,
                total_pence: 0
            };

            for (const t of tasks) {
                // Use Contractor Total if present, else HBXL Total
                const cost = t.contractor_total_pence ?? t.hbxl_total_pence;

                sums.total_pence += cost;
                if (t.type === 'LABOUR') sums.labour_pence += cost;
                else if (t.type === 'MATERIAL') sums.materials_pence += cost;
                else if (t.type === 'PLANT') sums.plant_pence += cost;

                // Globals
                if (t.type === 'LABOUR') grandLab += cost;
                else if (t.type === 'MATERIAL') grandMat += cost;
                else if (t.type === 'PLANT') grandPlant += cost;
                else if (t.type === 'PRELIM') grandPrelim += cost;
                else if (t.type === 'FEE') grandFee += cost;
            }

            roomPayloads.push({
                room_code: rCode,
                room_name: rName,
                tasks,
                sums
            });
        }

        const grandTotal = grandLab + grandMat + grandPlant + grandPrelim + grandFee;

        return {
            job: {
                job_code: config.job_code,
                client_name: config.client_name,
                project_type: config.project_type,
                postcode: config.postcode,
                address: config.address
            },
            rooms: roomPayloads,
            totals: {
                labour_pence: grandLab,
                materials_pence: grandMat,
                plant_pence: grandPlant,
                prelims_pence: grandPrelim,
                fees_pence: grandFee,
                grand_total_pence: grandTotal
            }
        };
    }

    private static findRoomForLine(line: HBXLLine, rooms: RoomConfig[]): RoomConfig | null {
        const text = (line.description + " " + line.category + " " + (line.notes || "")).toLowerCase();

        // 1. Check patterns
        for (const room of rooms) {
            if (room.include_patterns) {
                for (const pattern of room.include_patterns) {
                    if (text.includes(pattern.toLowerCase())) {
                        return room;
                    }
                }
            }
        }

        // 2. Fallback logic could go here (e.g. intelligent guessing)
        return null;
    }

    private static groupLines(lines: RoomLine[]): RoomLine[][] {
        // Simple grouping by: Room + Type + Description
        // This aggregates multiple identical items (e.g. 50 screws + 50 screws) into one line
        // OR keeps distinct items distinct.
        // For now, let's group by a Key
        const map = new Map<string, RoomLine[]>();

        for (const line of lines) {
            // We want to group closely related items into a PAY ITEM.
            // E.g. "Skirting" + "Skirting Labour" might be separate in HBXL but could be one Task?
            // SPEC says: "Group lines into pay items... By description + type"
            // Let's stick to strict grouping for now to avoid merging Labour and Material unless requested.
            // Actually, Pay Items usually separate Labour and Material to different people/codes.
            const key = `${line.room_code}|${line.type}|${line.description}|${line.phase_code}`;
            const existing = map.get(key) || [];
            existing.push(line);
            map.set(key, existing);
        }

        return Array.from(map.values());
    }

    private static createTaskFromGroup(group: RoomLine[], config: JobConfig): TaskPayload {
        const head = group[0];

        let totalQty = 0;
        let totalHbxlPence = 0;

        // Aggregate values
        for (const item of group) {
            totalQty += item.qty;
            totalHbxlPence += item.hbxl_total_pence;
        }

        // Generate stable ID
        const hash = this.simpleHash(`${config.job_code}-${head.room_code}-${head.description}-${head.type}`);
        const taskId = `${head.room_code}-${head.type.substring(0, 3)}-${hash}`;

        return {
            task_id: taskId,
            room_code: head.room_code || "UNALLOCATED",
            phase_code: head.phase_code,
            description: head.description,
            type: head.type,
            qty: parseFloat(totalQty.toFixed(2)),
            unit: head.unit,
            hbxl_unit_rate_pence: totalQty > 0 ? Math.round(totalHbxlPence / totalQty) : 0,
            hbxl_total_pence: Math.round(totalHbxlPence),
            contractor_unit_rate_pence: null,
            contractor_total_pence: Math.round(totalHbxlPence),
            status: "PLANNED",
            planned_start_date: null,
            planned_finish_date: null,
            material_required_date: null,
            subcontractor_id: null,
            trade: null,
            notes: null
        };
    }

    private static simpleHash(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(16).substring(0, 6).toUpperCase();
    }
}
