// TODO
// IMPLEMENT MATRIX 
// - UNOWNED WALLS MORE PASSABLE THAN NATURAL WALLS


/*





/*
var movement = {
    // Main Pathfinding Call
    moveToWithCache: function(creep, target, range = 0, specifiedRoomName = null) {
        const targetPos = (target instanceof RoomPosition) ? target : target.pos;
        if (!targetPos) {
            return;
        }

        // Use the specified room name if provided, otherwise default to the target position's room
        const roomName = specifiedRoomName || targetPos.roomName;
        this.findCachedPath(creep, { pos: targetPos, range: range }, roomName);
    },

    cleanupOldPaths: function(roomName) {
        if (!Memory.rooms[roomName] || !Memory.rooms[roomName].pathCache) return;

        const pathCache = Memory.rooms[roomName].pathCache;
        const pathKeys = Object.keys(pathCache);
        for (const pathKey of pathKeys) {
            if (pathCache[pathKey].time + 50 < Game.time) {
                delete pathCache[pathKey]; // Delete paths older than 100 ticks
            }
        }
    },


    // Method for creep movement using cached paths
    findCachedPath: function(creep, target, roomName, defaultRange = 1) {
        const targetPos = target.pos || target;
        const effectiveRange = target.range !== undefined ? target.range : defaultRange;
        const pathKey = `${creep.pos.roomName}_${targetPos.x}_${targetPos.y}_${effectiveRange}`;

        if (!Memory.rooms[roomName]) Memory.rooms[roomName] = { pathCache: {} };
        this.cleanupOldPaths(roomName); // Clean up old paths before trying to find a new one

        // Check if the path is cached and still valid
        if (Memory.rooms[roomName].pathCache[pathKey] && Memory.rooms[roomName].pathCache[pathKey].time + 100 > Game.time) {
            const path = Room.deserializePath(Memory.rooms[roomName].pathCache[pathKey].path);
            const moveResult = creep.moveByPath(path);
            if (moveResult !== OK) {
                delete Memory.rooms[roomName].pathCache[pathKey];
            }
        } else {
            const newPath = PathFinder.search(
                creep.pos, { pos: targetPos, range: effectiveRange },
                {
                    roomCallback: () => this.getCostMatrix(roomName),
                    plainCost: 2,
                    swampCost: 10,
                    maxRooms: 1
                }
            ).path;

            const serializedPath = Room.serializePath(newPath);
            Memory.rooms[roomName].pathCache[pathKey] = { path: serializedPath, time: Game.time };
            const moveResult = creep.moveByPath(newPath);
            if (moveResult !== OK) {
                // Handle cases where path movement fails
            }
        }
    },

    // Method to generate and cache room cost matrices for more efficient pathfinding
    getCostMatrix: function(roomName) {
        if (!Memory.costMatrices) Memory.costMatrices = {};
        if (Memory.costMatrices[roomName] && Memory.costMatrices[roomName].time + 10000 > Game.time) {
            return PathFinder.CostMatrix.deserialize(Memory.costMatrices[roomName].matrix);
        } else {
            const room = Game.rooms[roomName];
            let costs = new PathFinder.CostMatrix();

            if (room) {
                room.find(FIND_STRUCTURES).forEach(function(struct) {
                    if (struct.structureType === STRUCTURE_ROAD) {
                        costs.set(struct.pos.x, struct.pos.y, 1);
                    } else if (struct.structureType !== STRUCTURE_CONTAINER &&
                               (struct.structureType !== STRUCTURE_RAMPART || !struct.my)) {
                        costs.set(struct.pos.x, struct.pos.y, 0xff);
                    }
                });
            }

            Memory.costMatrices[roomName] = {
                matrix: costs.serialize(),
                time: Game.time
            };
            return costs;
        }
    }
};

module.exports = movement;*/








//////////////////////////////

var movement = {

// PATH CACHING AND MOVEMENT
//
//
//
//






    // Main Pathfinding Call
    moveToWithCache: function(creep, target, range = 0) {
        // Initialize home room if not already set
        if (!creep.memory.home) {
            const nameParts = creep.name.split('_');
            if (nameParts.length > 1 && Game.rooms[nameParts[0]]) {
                creep.memory.home = nameParts[0];
            } else {
                creep.memory.home = creep.room.name;
            }
        }

        const homeRoom = Game.rooms[creep.memory.home];
        if (!homeRoom) {
            console.log('Home room not accessible:', creep.memory.home);
            return;
        }

        // Determine the target position
    const targetPos = (target instanceof RoomPosition) ? target : target.pos;
    if (!targetPos) {
        console.log('Invalid or undefined target position for:', target);
        return;
    }

        // If target room is different from home and no range is provided, assume target is in home room
        if (!('roomName' in targetPos) || targetPos.roomName !== homeRoom.name) {
            targetPos.roomName = homeRoom.name;
            //console.log(`${creep} holding target room: ${homeRoom.name}`);
        }

        // Proceed to find or use cached path
        this.findCachedPath(creep, { pos: targetPos, range: range });
    },

    cleanupOldPaths: function(roomName) {
        const pathCache = Memory.rooms[roomName].pathCache;
        if (!pathCache) return;

        const pathKeys = Object.keys(pathCache);
        for (const pathKey of pathKeys) {
            if (pathCache[pathKey].time + 50 < Game.time) {
                delete pathCache[pathKey]; // Delete paths older than 100 ticks
            }
        }
    },

    // Method for creep movement using cached paths
    findCachedPath: function(creep, target, defaultRange = 1) {
        // Implementation adjusted for clarity and caching in home room
        const targetPos = target.pos || target; 
        const effectiveRange = target.range !== undefined ? target.range : defaultRange;
        const pathKey = this.generatePathKey(creep.pos, targetPos, effectiveRange);

        const roomName = creep.memory.home; // Use home room for path caching
        if (!Memory.rooms[roomName].pathCache) {
            Memory.rooms[roomName].pathCache = {};
        }

        this.cleanupOldPaths(roomName); // Clean up old paths before trying to find a new one
    
        // Check if the path is cached and still valid
        if (Memory.rooms[roomName].pathCache[pathKey] && Memory.rooms[roomName].pathCache[pathKey].time + 50 > Game.time) {
            // Deserialize the path before using it
            const path = Room.deserializePath(Memory.rooms[roomName].pathCache[pathKey].path);
            const moveResult = creep.moveByPath(path);
            if (moveResult !== OK) {
                // Clear the cache if the path is invalid and find a new path immediately
                delete Memory.rooms[roomName].pathCache[pathKey];
            }
        } else {
            const newPath = creep.pos.findPathTo(targetPos, {range: effectiveRange});
            // Serialize the new path for caching
            const serializedPath = Room.serializePath(newPath);
            Memory.rooms[roomName].pathCache[pathKey] = { path: serializedPath, time: Game.time };
            const moveResult = creep.moveByPath(newPath);
            if (moveResult !== OK) {

            }
        }
    },


    /*
      // Method for creep movement using cached paths
    findCachedPath: function(creep, target, defaultRange = 1) {
        const targetPos = target.pos || target; 
        const effectiveRange = target.range !== undefined ? target.range : defaultRange;
        const pathKey = `${creep.pos.roomName}_${targetPos.x}_${targetPos.y}_${effectiveRange}`;
        const roomName = creep.room.name;
    
        if (!Memory.rooms[roomName].pathCache) Memory.rooms[roomName].pathCache = {};

        this.cleanupOldPaths(roomName); // Clean up old paths before trying to find a new one
    
        // Check if the path is cached and still valid
        if (Memory.rooms[roomName].pathCache[pathKey] && Memory.rooms[roomName].pathCache[pathKey].time + 100 > Game.time) {
            // Deserialize the path before using it
            const path = Room.deserializePath(Memory.rooms[roomName].pathCache[pathKey].path);
            const moveResult = creep.moveByPath(path);
            if (moveResult !== OK) {
                // Clear the cache if the path is invalid and find a new path immediately
                delete Memory.rooms[roomName].pathCache[pathKey];
            }
        } else {
            const newPath = creep.pos.findPathTo(targetPos, {range: effectiveRange});
            // Serialize the new path for caching
            const serializedPath = Room.serializePath(newPath);
            Memory.rooms[roomName].pathCache[pathKey] = { path: serializedPath, time: Game.time };
            const moveResult = creep.moveByPath(newPath);
            if (moveResult !== OK) {

            }
        }
    },
    */
    
    // Optional: Method to generate and cache room cost matrices for more efficient pathfinding
    getCostMatrix: function(roomName) {
        if (!Memory.costMatrices) Memory.costMatrices = {};
        if (Memory.costMatrices[roomName] && Memory.costMatrices[roomName].time + 10000 > Game.time) {
            return PathFinder.CostMatrix.deserialize(Memory.costMatrices[roomName].matrix);
        } else {
            const room = Game.rooms[roomName];
            let costs = new PathFinder.CostMatrix();

            if (room) { // Check if the room is visible
                room.find(FIND_STRUCTURES).forEach(function(struct) {
                    if (struct.structureType === STRUCTURE_ROAD) {
                        // Favor roads
                        costs.set(struct.pos.x, struct.pos.y, 1);
                    } else if (struct.structureType !== STRUCTURE_CONTAINER &&
                            (struct.structureType !== STRUCTURE_RAMPART || !struct.my)) {
                        // Avoid non-walkable structures
                        costs.set(struct.pos.x, struct.pos.y, 0xff);
                    }
                });
            } else {
                
    //            console.log('getCostMatrix: Room not visible', roomName);
                
            }

            Memory.costMatrices[roomName] = {
                matrix: costs.serialize(),
                time: Game.time
            };
            return costs;
        }
    },
    
    // Utility method to generate a unique key for caching paths
    generatePathKey: function(fromPos, toPos, range) {
        return `${fromPos.roomName}_${fromPos.x},${fromPos.y}_${toPos.x},${toPos.y}_${range}`;
    },

};

module.exports = movement 
