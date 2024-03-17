// TODO
// AGE BASED PATH INVALIDATION

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
    
            this.moveCreepByCachedPath(creep, { pos: targetPos, range: range });
        }, 
        
        // Method to find or cache a path
        findCachedPath: function(creep, target) {
            const pathKey = `${creep.pos.roomName}_${creep.pos.x},${creep.pos.y}_${target.x},${target.y}`;
            const roomName = creep.room.name;
            if (!Memory.rooms[roomName].pathCache) Memory.rooms[roomName].pathCache = {};
            
            this.cleanupOldPaths(roomName); // Clean up old paths before trying to find a new one
            
            if (Memory.rooms[roomName].pathCache[pathKey] && Memory.rooms[roomName].pathCache[pathKey].time + 1000 > Game.time) {
                Memory.rooms[roomName].pathCache[pathKey].lastUsed = Game.time; // Update last used time
                return Room.deserializePath(Memory.rooms[roomName].pathCache[pathKey].path);
            } else {
                const path = creep.pos.findPathTo(target, {serialize: true, range: 1});
                Memory.rooms[roomName].pathCache[pathKey] = {
                    path: path,
                    time: Game.time,
                    lastUsed: Game.time // Set initial last used time
                };
                return path;
            }
        },
    
        // Method for creep movement using cached paths
        moveCreepByCachedPath: function(creep, target, defaultRange = 1) {
            const targetPos = target.pos || target;
            const effectiveRange = target.range !== undefined ? target.range : defaultRange;
            const roomName = creep.room.name;
        
            if (!Memory.rooms[roomName].pathCache) Memory.rooms[roomName].pathCache = {};
        
            this.cleanupOldPaths(roomName);
        
            let path = this.findCachedPath(creep, { pos: targetPos, range: effectiveRange });
        
            if (!path) {
                // No path is cached or it's expired, find and cache a new path, then use it
                const serializedPath = this.findAndCacheNewPath(creep, targetPos, effectiveRange);
                path = Room.deserializePath(serializedPath); // Deserialize the new path for use
            }
        
            if (path) {
                const moveResult = creep.moveByPath(path);
                if (moveResult !== OK) {
                    console.log(`[${creep.name}] moveByPath failed with code: ${moveResult}`);
                    // Handle movement failures as needed
                }
            }
        },
    
        // Invalidate Old Paths
        cleanupOldPaths: function(roomName) {
            const pathCache = Memory.rooms[roomName].pathCache;
            if (!pathCache) return;
    
            const pathKeys = Object.keys(pathCache);
            for (const pathKey of pathKeys) {
                if (pathCache[pathKey].lastUsed + 100 < Game.time) {
                    delete pathCache[pathKey]; // Delete paths older than 100 ticks
                }
            }
        },
    
        // Method to find and cache a new path if the current one is obstructed
        findAndCacheNewPath: function(creep, targetPos, range) {
            const pathKey = this.generatePathKey(creep.pos, targetPos, range);
            const path = creep.pos.findPathTo(targetPos, { range: range });
            const serializedPath = Room.serializePath(path);
            const roomName = creep.room.name;
            Memory.rooms[roomName].pathCache[pathKey] = {
                path: serializedPath,
                time: Game.time,
                lastUsed: Game.time
            };
            return serializedPath; // Return the serialized path for immediate use
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