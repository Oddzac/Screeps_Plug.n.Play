// TODO


//////////////////////////////
var giveWay = require("a.giveWay");
var movement = {

// PATH CACHING AND MOVEMENT
//
//
//
//






    // Main Pathfinding Call
moveToWithCache: function(creep, target, range = 1) {
    const targetPos = (target instanceof RoomPosition) ? target : target.pos;
    if (!targetPos) {
        return;
    }
    // Initialize home room
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

    this.findCachedPath(creep, { pos: targetPos, range: range });
},

cleanupOldPaths: function(roomName) {
    const pathCache = Memory.pathCache;
    if (!pathCache) return;

    const pathKeys = Object.keys(pathCache);
    for (const pathKey of pathKeys) {
        if (pathCache[pathKey].time + 10 < Game.time) {
            delete pathCache[pathKey]; // Delete paths older than 100 ticks
        }
    }
},

// Utility method to generate a unique key for caching paths
generatePathKey: function(fromPos, toPos, range) {
    return `${fromPos.roomName}_${fromPos.x},${fromPos.y}_${toPos.x},${toPos.y}_${range}`;
},
    
// Method for creep movement using cached paths
findCachedPath: function(creep, target, defaultRange = 1) {
    const targetPos = target.pos || target; 
    const effectiveRange = target.range !== undefined ? target.range : defaultRange;
    const pathKey = this.generatePathKey(creep.pos, targetPos, effectiveRange); // Use generatePathKey
    const roomName = creep.room.name;

    if (!Memory.pathCache) Memory.pathCache = {};

    this.cleanupOldPaths(roomName); // Clean up old paths before trying to find a new one

    // Check if the path is cached and still valid
    if (Memory.pathCache[pathKey] && Memory.pathCache[pathKey].time + 10 > Game.time) {
        // Deserialize the path before using it
        const path = Room.deserializePath(Memory.pathCache[pathKey].path);
        const moveResult = creep.moveByPath(path);
        creep.giveWay();
        if (moveResult !== OK) {
            // Clear the cache if the path is invalid and find a new path immediately
            delete Memory.pathCache[pathKey];
        }
    } else {
        let newPath;
        //Budget Traffic Bandaid
        if (roomName === 'E25S18') {
            newPath = creep.pos.findPathTo(targetPos, {
                range: effectiveRange,
                ignoreCreeps: true,
            });
        } else {
            newPath = creep.pos.findPathTo(targetPos, {
                range: effectiveRange,
                ignoreCreeps: false,
            });
        }
        // Serialize the new path for caching
        const serializedPath = Room.serializePath(newPath);
        Memory.pathCache[pathKey] = { path: serializedPath, time: Game.time };
        const moveResult = creep.moveByPath(newPath);

        if (moveResult !== OK) {
            // Handle if moveByPath fails
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




};

module.exports = movement 
