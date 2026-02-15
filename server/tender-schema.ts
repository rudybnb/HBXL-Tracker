
export interface TenderItem {
    itemId: string;
    itemType: "LABOUR";
    description: string;
    unit: "m2" | "m3" | "lm" | "nr" | "point" | "hour" | "day";
    quantity: number;
    quantityLocked: true;
    rate: number | null; // Must be null until contractor enters it
    completion?: {
        status: "NOT_STARTED" | "COMPLETED";
    };
}

export interface GlobalSection {
    sectionId: string;
    title: string;
    items: TenderItem[];
}

export interface RoomPackage {
    packageId: string;
    label: "FIRST_FIX" | "SECOND_FIX";
    items: TenderItem[];
}

export interface TenderRoom {
    roomId: string;
    name: string;
    areaM2: number;
    packages: RoomPackage[];
}

export interface TenderData {
    tenderId: string;
    projectName: string;
    currency: "GBP";
    tenderType: "LABOUR_ONLY";
    materialsExcluded: true;
    plantExcluded: true;
    paymentBasis: "ITEM_COMPLETE";
    quantitiesBasis: "IFC_DERIVED_LOCKED";
}

export interface TenderResponse {
    schemaVersion: "1.0.0";
    tender: TenderData;
    globalElements: GlobalSection[];
    rooms: TenderRoom[];
}
