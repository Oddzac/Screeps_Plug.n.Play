var roleClaimer = {
    run: function(creep) {
        // Initialize Memory.claimRooms if it doesn't exist
        if (!Memory.claimRooms) Memory.claimRooms = {};

        // Set the target room if not already set
        if (!creep.memory.targetRoom) {
            const targetRoomName = Object.keys(Memory.claimRooms)[0]; // Get the first room name
            if (targetRoomName) {
                creep.memory.targetRoom = targetRoomName;
            } else {
                console.log(`[${creep.name}] No target room available.`);
                return; // Exit if no rooms to claim
            }
        }

        // Move towards the target room if not already there
        if (creep.room.name !== creep.memory.targetRoom) {
            const exitDir = creep.room.findExitTo(creep.memory.targetRoom);
            const exit = creep.pos.findClosestByRange(exitDir);
            creep.moveTo(exit, {visualizePathStyle: {stroke: '#ffffff'}});
            console.log(`[${creep.name}] Heading to target room: ${creep.memory.targetRoom}`);
        } else {
            // Once in the target room
            console.log(`[${creep.name}] ROOM REACHED`);
            const controller = creep.room.controller;
            const path = creep.pos.findPathTo(controller);

            // Check the path for walls
            const walls = path.filter(step => {
                const pos = new RoomPosition(step.x, step.y, creep.room.name);
                const structures = pos.lookFor(LOOK_STRUCTURES);
                return structures.some(s => s.structureType === STRUCTURE_WALL);
            });

            if (walls.length > 0) {
                // Move to the first wall if not in range to dismantle
                const wall = walls[0];
                const pos = new RoomPosition(wall.x, wall.y, creep.room.name);
                const wallStructure = pos.lookFor(LOOK_STRUCTURES).find(s => s.structureType === STRUCTURE_WALL);
                if (creep.dismantle(wallStructure) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(pos, {
                        visualizePathStyle: { stroke: '#ff0000' },
                        ignoreDestructibleStructures: false
                    });
                }
            } else {
                // No walls blocking the path, proceed to claim or reserve controller
                if (creep.claimController(controller) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(controller, {
                        visualizePathStyle: { stroke: '#ffaa00' },
                        ignoreCreeps: true,
                        ignoreDestructibleStructures: false
                    });
                } else if (claimResult == ERR_GCL_NOT_ENOUGH || claimResult == ERR_FULL) {
                    // If unable to claim due to GCL or room limit, try to reserve instead
                    const reserveResult = creep.reserveController(controller);
                    if (reserveResult == ERR_NOT_IN_RANGE) {
                        creep.moveTo(controller, {
                            visualizePathStyle: { stroke: '#ffaa00' },
                            ignoreCreeps: true,
                            ignoreDestructibleStructures: false
                        });
                    } else if (reserveResult == ERR_INVALID_TARGET) {
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




////////////////////////////////////////////////////////////////
/*
var roleClaimer = {
    run: function(creep) {
        // Check if targetRoom is already set or if claimRooms is undefined
        if (!creep.memory.targetRoom || !Memory.claimRooms) {
            // Initialize Memory.claimRooms if it doesn't exist
            if (!Memory.claimRooms) Memory.claimRooms = {};

            // Find the first room in Memory.claimRooms to claim
            const targetRoomName = Object.keys(Memory.claimRooms)[0]; // Get the first room name
            if (targetRoomName) {
                creep.memory.targetRoom = targetRoomName;
            } else {
                console.log(`[${creep.name}] No target room available.`);
                return; // Exit if no rooms to claim
            }
        }

        const targetRoom = creep.memory.targetRoom;
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

module.exports = roleClaimer; */