var roleClaimer = {
    run: function(creep) {
        if (!Memory.claimRooms) Memory.claimRooms = {};

        if (!creep.memory.targetRoom) {
            const targetRoomName = Object.keys(Memory.claimRooms)[0];
            if (targetRoomName) {
                creep.memory.targetRoom = targetRoomName;
            } else {
                console.log(`[${creep.name}] No target room available.`);
                return;
            }
        }

        if (creep.room.name !== creep.memory.targetRoom) {
            const exitDir = creep.room.findExitTo(creep.memory.targetRoom);
            const exit = creep.pos.findClosestByRange(exitDir);
            creep.moveTo(exit, {visualizePathStyle: {stroke: '#ffffff'}});
            console.log(`[${creep.name}] Heading to target room: ${creep.memory.targetRoom}`);
        } else {
            console.log(`[${creep.name}] ROOM REACHED`);
            const controller = creep.room.controller;

            const path = PathFinder.search(creep.pos, { pos: controller.pos, range: 1 }, {
                plainCost: 2,
                swampCost: 10,
                roomCallback: function(roomName) {
                    let room = creep.room;
                    let costs = new PathFinder.CostMatrix;

                    room.find(FIND_STRUCTURES).forEach(function(struct) {
                        if (struct.structureType === STRUCTURE_WALL) {
                            costs.set(struct.pos.x, struct.pos.y, 5); // Treat walls as walkable
                        }
                    });

                    return costs;
                }
            });

            const nextPos = path.path[0];
            if (nextPos) {
                const look = creep.room.lookAt(nextPos.x, nextPos.y);
                const wall = look.find(l => l.type === 'structure' && l.structure.structureType === STRUCTURE_WALL);
                if (wall) {
                    if (creep.dismantle(wall.structure) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(wall.structure, {visualizePathStyle: {stroke: '#ff0000'}});
                    }
                } else {
                    // Attempt to claim the controller
                    const claimResult = creep.claimController(controller);
                    console.log(`Claim Result: ${claimResult}`);
                    if (claimResult == ERR_NOT_IN_RANGE) {
                        if (creep.pos.getRangeTo(controller) > 2) {
                            // Move to the controller if not in range
                            creep.moveByPath(path.path);
                        } else {
                            creep.moveTo(controller);
                        
                        }

                    } else if (claimResult == ERR_GCL_NOT_ENOUGH || claimResult == ERR_FULL) {
                        // If unable to claim due to GCL or room limit, try to reserve instead
                        const reserveResult = creep.reserveController(controller);
                        if (reserveResult == ERR_NOT_IN_RANGE) {
                            creep.moveByPath(path.path);
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
    }
}

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