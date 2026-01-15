/**
 * Cleanup Script: Remove phase-based rooms (AGENTS.md Compliance)
 * 
 * Run with: npx tsx server/cleanup-phase-rooms.ts
 * 
 * This removes incorrectly created rooms like "General Works", "Utility", "External"
 * that were created from HBXL phases instead of from drawing extraction.
 */

import { db } from './db';
import { rooms, roomElements, payableItems } from '@shared/schema';
import { eq, inArray } from 'drizzle-orm';

const PHASE_BASED_ROOMS = [
    'General Works',
    'Utility',
    'External',
    // These are valid room names that should ONLY come from drawings:
    // 'Lounge', 'Bathroom', 'Kitchen', 'Bedroom' - keep these if from drawing
];

async function cleanupPhaseRooms() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🧹 AGENTS.md COMPLIANCE - Cleaning up phase-based rooms');
    console.log('═══════════════════════════════════════════════════════════════');

    // Find all rooms that have phase-based names
    const allRooms = await db.select().from(rooms);

    console.log(`📊 Found ${allRooms.length} total rooms in database`);

    const phaseRooms = allRooms.filter(room =>
        PHASE_BASED_ROOMS.includes(room.name)
    );

    console.log(`🗑️  Found ${phaseRooms.length} phase-based rooms to delete:`);
    for (const room of phaseRooms) {
        console.log(`   - ${room.name} (${room.id})`);
    }

    if (phaseRooms.length === 0) {
        console.log('✅ No phase-based rooms found. Database is clean.');
        return;
    }

    // Delete payable items first
    for (const room of phaseRooms) {
        const elements = await db.select().from(roomElements).where(eq(roomElements.roomId, room.id));

        for (const element of elements) {
            await db.delete(payableItems).where(eq(payableItems.elementId, element.id));
        }

        // Delete room elements
        await db.delete(roomElements).where(eq(roomElements.roomId, room.id));

        // Delete room
        await db.delete(rooms).where(eq(rooms.id, room.id));

        console.log(`   ✓ Deleted room: ${room.name}`);
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✅ Cleanup complete! Phase-based rooms removed.');
    console.log('   Rooms should now only come from drawing extraction.');
    console.log('═══════════════════════════════════════════════════════════════');
}

cleanupPhaseRooms().catch(console.error);
