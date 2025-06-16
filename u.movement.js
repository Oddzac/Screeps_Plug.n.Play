/**
 * Movement Module - Enhanced with path caching and traffic management
 */

var movement = {
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
            if (pathCache[pathKey].time + 50 < Game.time) {
                delete pathCache[pathKey]; // Delete paths older than 50 ticks
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
        const pathKey = this.generatePathKey(creep.pos, targetPos, effectiveRange); 
        const roomName = creep.room.name;

        if (!Memory.pathCache) Memory.pathCache = {};

        this.cleanupOldPaths(roomName);

        // Add randomness to path finding to prevent traffic jams
        // Every 20 ticks, force a new path calculation with different settings
        const shouldRecomputePath = Game.time % 20 === creep.id.charCodeAt(0) % 20;
        
        let path, moveResult;
        if (!shouldRecomputePath && Memory.pathCache[pathKey] && Memory.pathCache[pathKey].time + 100 > Game.time) {
            // Deserialize the path
            path = Room.deserializePath(Memory.pathCache[pathKey].path);
        } else {
            // Generate new path with some randomness in the cost matrix
            const pathfindingOptions = {
                range: effectiveRange,
                ignoreCreeps: true,
                plainCost: 2,
                swampCost: 10
            };
            
            path = creep.pos.findPathTo(targetPos, pathfindingOptions);
            const serializedPath = Room.serializePath(path);
            Memory.pathCache[pathKey] = { path: serializedPath, time: Game.time };
        }

        // Identify the next position on the path
        if (path && path.length > 0) {
            const nextPos = new RoomPosition(path[0].x, path[0].y, roomName);

            // Look for creeps at the next position
            const creepsAtNextPos = nextPos.lookFor(LOOK_CREEPS);

            // Check if any of the creeps are working or if there are multiple creeps
            const isBlocking = creepsAtNextPos.some(c => c.memory.working) || creepsAtNextPos.length > 1;

            if (isBlocking) {
                // Handle next position is blocked by working creep
                creep.say("👀");
                
                // Try to find an alternative path
                const altPathOptions = {
                    range: effectiveRange,
                    ignoreCreeps: false,
                    plainCost: 2,
                    swampCost: 10,
                    maxRooms: 1
                };
                
                // If we're stuck for multiple ticks, be more aggressive about finding a new path
                if (creep.memory.stuckCount && creep.memory.stuckCount > 3) {
                    // Allow moving through swamps more easily when stuck
                    altPathOptions.swampCost = 5;
                    creep.say("🔄");
                }
                
                path = creep.pos.findPathTo(targetPos, altPathOptions);
                
                // If we still can't find a path, try a more direct approach
                if (!path.length) {
                    // Just try to move in the general direction of the target
                    const direction = creep.pos.getDirectionTo(targetPos);
                    moveResult = creep.move(direction);
                    
                    // Track being stuck
                    creep.memory.stuckCount = (creep.memory.stuckCount || 0) + 1;
                    return;
                }
                
                // Reset stuck counter if we found a path
                delete creep.memory.stuckCount;
                
                // Update the cache with the new path
                const serializedPath = Room.serializePath(path);
                Memory.pathCache[pathKey] = { path: serializedPath, time: Game.time };
            } else {
                // Execute movement
                moveResult = creep.moveByPath(path);
                if (moveResult !== OK) {
                    // Clear the cache if the path is invalid and find a new path immediately
                    delete Memory.pathCache[pathKey];
                    
                    // Track being stuck
                    creep.memory.stuckCount = (creep.memory.stuckCount || 0) + 1;
                } else {
                    // Reset stuck counter on successful movement
                    delete creep.memory.stuckCount;
                }
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
            }

            Memory.costMatrices[roomName] = {
                matrix: costs.serialize(),
                time: Game.time
            };
            return costs;
        }
    }
};

module.exports = movement;