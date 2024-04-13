// TODO
// IMPLEMENT MATRIX 
// - UNOWNED WALLS MORE PASSABLE THAN NATURAL WALLS

var movement = {

// PATH CACHING AND MOVEMENT
//
//
//
//

    // Main Pathfinding Call
    moveToWithCache: function(creep, target, range = 0) {
        const targetPos = (target instanceof RoomPosition) ? target : target.pos;
        if (!targetPos) {
            return;
        }

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