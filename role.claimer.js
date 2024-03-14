var roleClaimer = {
    run: function(creep) {
        const targetRoom = Memory.claimRooms[0];
        // Ensure the target room is persisted in memory
        if (!creep.memory.targetRoom) {
            creep.memory.targetRoom = targetRoom;
        }

        // Move towards the target room if not already there
        if (creep.room.name !== creep.memory.targetRoom) {
            const exitDir = creep.room.findExitTo(creep.memory.targetRoom);
            const exit = creep.pos.findClosestByRange(exitDir);
            creep.moveTo(exit, {visualizePathStyle: {stroke: '#ffffff'}});
            console.log(`[${creep.name}] Heading to target room: ${creep.memory.targetRoom}`);
        } else {
            // Log once the room is reached
            console.log(`[${creep.name}] ROOM REACHED`);
            const controller = creep.room.controller;

            if (controller) {
                // Attempt to claim the controller
                const claimResult = creep.claimController(controller);
                if (claimResult == ERR_NOT_IN_RANGE) {
                    // Move to the controller if not in range
                    creep.moveTo(controller, {visualizePathStyle: {stroke: '#ffaa00'}});
                } else if (claimResult == ERR_GCL_NOT_ENOUGH || claimResult == ERR_FULL) {
                    // If unable to claim due to GCL or room limit, try to reserve instead
                    const reserveResult = creep.reserveController(controller);
                    if (reserveResult == ERR_NOT_IN_RANGE) {
                        creep.moveTo(controller, {visualizePathStyle: {stroke: '#ffaa00'}});
                    } else if (reserveResult == ERR_INVALID_TARGET) {
                        Game.notify(`Room ${creep.room.name} Claimed`);
                        creep.suicide();
                    } else if (reserveResult != OK) {
                        console.log(`[${creep.name}] RESERVING ERROR: ${reserveResult}`);
                    }
                } else if (claimResult != OK) {
                    console.log(`[${creep.name}] CLAIMING ERROR: ${claimResult}`);
                }
            }
        }
    }
};

module.exports = roleClaimer;