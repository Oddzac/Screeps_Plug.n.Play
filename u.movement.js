// TODO


//////////////////////////////
var movement = {

// PATH CACHING AND MOVEMENT
//
//
//
//






    // Main Pathfinding Call
moveToWithCache: function(creep, target, range = 1) {
    if (!creep || !target) return ERR_INVALID_ARGS;
    
    const targetPos = (target instanceof RoomPosition) ? target : target.pos;
    if (!targetPos) return ERR_INVALID_TARGET;
    
    // Initialize home room if not set
    if (!creep.memory.home) {
        const nameParts = creep.name.split('_');
        if (nameParts.length > 1 && Game.rooms[nameParts[0]]) {
            creep.memory.home = nameParts[0];
        } else {
            creep.memory.home = creep.room.name;
        }
    }

    // Call the path finding function
    return this.findCachedPath(creep, { pos: targetPos, range: range });
},

cleanupOldPaths: function() {
    const pathCache = Memory.pathCache;
    if (!pathCache) return;

    const currentTime = Game.time;
    const pathKeys = Object.keys(pathCache);
    for (const pathKey of pathKeys) {
        if (pathCache[pathKey].time + 100 < currentTime) {
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
    // Validate inputs
    if (!creep || !target) return;
    
    const targetPos = target.pos || target;
    if (!targetPos) return;
    
    // Check if target is in the same room
    if (targetPos.roomName !== creep.room.name) {
        // Handle inter-room movement
        const exitDir = creep.room.findExitTo(targetPos.roomName);
        if (exitDir === ERR_NO_PATH) return;
        
        const exit = creep.pos.findClosestByPath(exitDir);
        if (!exit) return;
        
        return creep.moveTo(exit);
    }
    
    const effectiveRange = target.range !== undefined ? target.range : defaultRange;
    const pathKey = this.generatePathKey(creep.pos, targetPos, effectiveRange); 
    const roomName = creep.room.name;

    if (!Memory.pathCache) Memory.pathCache = {};

    let path, moveResult;
    if (Memory.pathCache[pathKey] && Memory.pathCache[pathKey].time + 100 > Game.time) {
        // Deserialize the path
        path = Room.deserializePath(Memory.pathCache[pathKey].path);
    } else {
        // Generate new path
        path = creep.pos.findPathTo(targetPos, {
            range: effectiveRange,
            ignoreCreeps: true,
        });
        
        if (!path || path.length === 0) return; // No path found
        
        const serializedPath = Room.serializePath(path);
        Memory.pathCache[pathKey] = { path: serializedPath, time: Game.time };
    }

    // Identify the next position on the path
    if (path && path.length > 0) {
        const nextPos = new RoomPosition(path[0].x, path[0].y, roomName);

        // Look for creeps at the next position
        const creepsAtNextPos = nextPos.lookFor(LOOK_CREEPS);

        // Check if any of the creeps are working
        const isBlocking = creepsAtNextPos.some(c => c && c.memory && c.memory.working);

        if (isBlocking) {
            // Handle next position is blocked by working creep
            creep.say("👀");
            // Use moveTo with ignoreCreeps:false for this move only
            creep.moveTo(targetPos, {
                range: effectiveRange,
                ignoreCreeps: false,
                reusePath: 0 // Don't cache this path
            });
        } else {
            // Execute movement
            moveResult = creep.moveByPath(path);
            if (moveResult !== OK && moveResult !== ERR_TIRED) {
                // Clear the cache if the path is invalid
                delete Memory.pathCache[pathKey];
                
                // Try direct movement as fallback
                creep.moveTo(targetPos, {
                    range: effectiveRange,
                    reusePath: 5
                });
            }
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
