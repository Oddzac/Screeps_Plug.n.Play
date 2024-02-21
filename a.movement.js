var movement = {

    // PATH CACHING AND MOVEMENT
    //
    //
    //
    //
        
        // Method to find or cache a path
        findCachedPath: function(creep, target) {
            const pathKey = `${creep.pos.roomName}_${creep.pos.x},${creep.pos.y}_${target.x},${target.y}`;
            if (!Memory.rooms[room.name].pathCache) Memory.rooms[room.name].pathCache = {};
            if (Memory.rooms[room.name].pathCache[pathKey] && Memory.rooms[room.name].pathCache[pathKey].time + 1500 > Game.time) {
                return PathFinder.deserializePath(Memory.rooms[room.name].pathCache[pathKey].path);
            } else {
                const path = creep.pos.findPathTo(target, {serialize: true, range: 1});
                Memory.rooms[room.name].pathCache[pathKey] = {
                    path: path,
                    time: Game.time
                };
                return path;
            }
        },
    
        // Method for creep movement using cached paths
        moveCreepByCachedPath: function(creep, target, defaultRange = 1) {
            const targetPos = target.pos || target; 
            const effectiveRange = target.range !== undefined ? target.range : defaultRange;
            const pathKey = `${creep.pos.roomName}_${targetPos.x}_${targetPos.y}_${effectiveRange}`;
            const roomName = creep.room.name;
        
    //        console.log(`[${creep.name}] PathKey for movement: ${pathKey}`);
        
            if (!Memory.rooms[roomName].pathCache) Memory.rooms[roomName].pathCache = {};
        
            // Check if the path is cached and still valid
            if (Memory.rooms[roomName].pathCache[pathKey] && Memory.rooms[roomName].pathCache[pathKey].time + 1500 > Game.time) {
    //            console.log(`[${creep.name}] Using cached path.`);
                // Deserialize the path before using it
                const path = Room.deserializePath(Memory.rooms[roomName].pathCache[pathKey].path);
                const moveResult = creep.moveByPath(path);
                if (moveResult !== OK) {
    //                console.log(`[${creep.name}] moveByPath failed with code: ${moveResult}`);
                    // Clear the cache if the path is invalid and find a new path immediately
                    delete Memory.rooms[roomName].pathCache[pathKey];
                    // Optionally, find a new path immediately and move along it
                    //const newPath = creep.pos.findPathTo(targetPos, {range: effectiveRange});
                    //creep.moveByPath(newPath);
                }
            } else {
    //            console.log(`[${creep.name}] Generating new path.`);
                const newPath = creep.pos.findPathTo(targetPos, {range: effectiveRange});
                // Serialize the new path for caching
                const serializedPath = Room.serializePath(newPath);
                Memory.rooms[roomName].pathCache[pathKey] = { path: serializedPath, time: Game.time };
                // Attempt to move along the newly created path
                const moveResult = creep.moveByPath(newPath);
                if (moveResult !== OK) {
    //                console.log(`[${creep.name}] moveByPath (new path) failed with code: ${moveResult}`);
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
    
       // Enhanced moveToTarget method to handle dynamic pathfinding
        moveToWithCache: function(creep, target, range = 0) {
            const targetPos = (target instanceof RoomPosition) ? target : target.pos;
            if (!targetPos) {
    //            console.error(`[moveToTarget] Invalid target passed for ${creep.name}.`);
                return;
            }
        
    //        console.log(`[${creep.name}] Moving to target at ${targetPos} with range ${range}.`);
            this.moveCreepByCachedPath(creep, { pos: targetPos, range: range });
        },    
        // Method to find and cache a new path if the current one is obstructed
        findAndCacheNewPath: function(creep, targetPos, range) {
            const pathKey = this.generatePathKey(creep.pos, targetPos, range);
            const path = creep.pos.findPathTo(targetPos, { range: range });
            const serializedPath = Room.serializePath(path);
            const roomName = creep.room.name;
            Memory.rooms[roomName].pathCache[pathKey] = { path: serializedPath, time: Game.time };
        },
        
        // Utility method to generate a unique key for caching paths
        generatePathKey: function(fromPos, toPos, range) {
            return `${fromPos.roomName}_${fromPos.x},${fromPos.y}_${toPos.x},${toPos.y}_${range}`;
        },
    
    };
    
    module.exports = movement