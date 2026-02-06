# Tender Pricing & Labour Quoting Implementation Strategy

## Objective
Transform the visual IFC Viewer into a **Commercial Tendering Tool** that automatically generates priced "Room Work Packages" and labour quotes.

## The Core Technical Challenge
To price "per room", we must bridge the gap between **Global Geometry** (a list of walls/sockets) and **Spatial Context** (which items belong to "Kitchen", "Lounge", etc.).

## 3-Step Implementation Roadmap

### Phase 1: Spatial "Containment" Engine (The "Room Scanner")
We cannot rely solely on IFC metadata because exports are often messy. We will implement **Geometric Containment**:
1.  **Identify Rooms**: Find all `IFCSPACE` entities and calculate their 3D Bounding Boxes.
2.  **Map Elements**: Iterate through every Wall, Socket, Window, and Misc item.
3.  **Collision Test**: Check which Room's bounding box contains the center point of each item.
    *   *Result*: We get a list like `Lounge: [Wall #1, Socket #4, Socket #5]`.

### Phase 2: Quantity Take-Off (QTO)
Once grouped by room, we convert raw geometry into billable units:
*   **Walls**: Calculate `Length x Height` = **Area (m²)** (Paint/Plaster/Boarding).
*   **Floors**: Calculate `Length x Width` = **Area (m²)** (Tiling/Laminate).
*   **MEP (Electrical)**: Count the items = **Each (No.)** (First Fix/Second Fix).
*   **Skirting**: Calculate Room Perimeter = **Linear Meter (LM)**.

### Phase 3: The Pricing Engine (Rate Card)
We will introduce a `RateCard` system (JSON or Database) to apply costs:
*   **Labour**: e.g., "Install Socket: £25.00/ea", "Paint Wall: £8.00/m²".
*   **Material**: e.g., "Double Socket Faceplate: £4.50".

## Proposed UI Workflow
1.  **"Generate Tender" Button**: User clicks this in the viewer.
2.  **Processing**: System runs the "Room Scanner" (Phase 1) and "QTO" (Phase 2).
3.  **Preview Panel**: A table appears below the viewer:
    *   **Room: Kitchen**
        *   Walls (Paint): 45m² @ £8 = £360
        *   Floor (Tile): 12m² @ £40 = £480
        *   Sockets: 6 @ £30 = £180
        *   **Total Room Cost: £1,020**
4.  **Export**: Button to download as CSV/PDF for the client.

## Immediate Next Step (For Version 31.0)
I can implement **Phase 1 (The Room Scanner)** right now.
I will add a `Generata Room Report` function that:
1.  Finds all Rooms.
2.  Mathematically places your Red/Cyan elements into those rooms.
3.  Shows a "Room Inventory" in the console or a simple UI panel.

**Shall I proceed with building the Room Scanner?**
