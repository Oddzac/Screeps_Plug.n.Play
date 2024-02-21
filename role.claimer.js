var roleClaimer = {
    run: function(creep) {
        const targetRoom = 'E24S19';

        // Ensure the target room is persisted in memory
        if (!creep.memory.targetRoom) {
            creep.memory.targetRoom = targetRoom;
        }

        // Check if the creep has reached its target room
        if (creep.room.name !== creep.memory.targetRoom) {
            // Move towards the target room's exit
            const exitDir = creep.room.findExitTo(creep.memory.targetRoom);
            const exit = creep.pos.findClosestByRange(exitDir);
            creep.moveTo(exit);
            console.log(`[${creep.name}] Heading to target room: ${creep.memory.targetRoom}`);
        } else {
            // Once in the target room, mark that the room has been reached
            console.log(`[${creep.name}] ROOM REACHED`);
            const controller = creep.room.controller;

            if (controller && creep.claimController(controller) == ERR_NOT_IN_RANGE) {
                creep.moveTo(controller);
                console.log(`[${creep.name}] MOVING TO CONTROLLER FOR ROOM (${creep.room.name}), ${controller}`);
            }
        }
    }
};

module.exports = roleClaimer;
