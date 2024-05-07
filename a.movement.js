// TODO
// IMPLEMENT MATRIX 
// - UNOWNED WALLS MORE PASSABLE THAN NATURAL WALLS








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
        // Initialize home room if not already set
        //console.log(`[MTWC] ${creep}, Target: ${target}`);

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
            if (pathCache[pathKey].time + 5 < Game.time) {
                delete pathCache[pathKey]; // Delete paths older than 100 ticks
            }
        }
    },


/*
    // Method for creep movement using cached paths
    findCachedPath: function(creep, target, defaultRange = 1) {
        const targetPos = target.pos || target; 
        const effectiveRange = target.range !== undefined ? target.range : defaultRange;
        //console.log(`[FCP] ${creep}, Target: ${targetPos}`);


        const roomName = creep.memory.home; // Use home room for path caching
        if (!Memory.rooms[roomName].pathCache) {
            Memory.rooms[roomName].pathCache = {};
        }
        const pathKey = this.generatePathKey(creep.pos, targetPos, effectiveRange);
        //const pathKey = `${roomName}_${targetPos.x}_${targetPos.y}_${effectiveRange}`;

        this.cleanupOldPaths(roomName); // Clean up old paths before trying to find a new one
    
        // Check if the path is cached and still valid
        if (Memory.rooms[roomName].pathCache[pathKey] && Memory.rooms[roomName].pathCache[pathKey].time + 50 > Game.time) {
            // Deserialize the path before using it
            const path = Room.deserializePath(Memory.rooms[roomName].pathCache[pathKey].path);

//
            const nextStep = path[0]; // Get the next step in the path

            if (nextStep && creep.room.lookForAt(LOOK_CREEPS, nextStep.x, nextStep.y).length) {
                // Path is blocked by another creep
                creep.say("!!!");
                // Attempt to move to an adjacent free space
                const freeSpace = creep.pos.findClosestByRange(FIND_MY_CREEPS, {
                    filter: (otherCreep) => otherCreep.id !== creep.id && creep.pos.getRangeTo(otherCreep) === 1
                });
                if (freeSpace) {
                    creep.moveTo(freeSpace, {visualizePathStyle: {stroke: '#ffaa00'}});
                }
            } else { 

//
                // If the path is clear, move by the path
                const moveResult = creep.moveByPath(path);
                if (moveResult !== OK) {
                    // Clear the cache if the path is invalid and find a new path immediately
                    delete Memory.rooms[roomName].pathCache[pathKey];
     //           }
            }

        } else {
           // const newPath = creep.pos.findPathTo(targetPos, {range: effectiveRange});

            const newPath = creep.pos.findPathTo(targetPos, {
            range: effectiveRange,
            ignoreCreeps: false,
            //ignoreRoads: false,
            costCallback: (roomName, costMatrix) => this.getCostMatrix(roomName)
        });

            //console.log(`PF PATH: ${JSON.stringify(newPath)}`);

            // Serialize the new path for caching
            const serializedPath = Room.serializePath(newPath);
            //console.log(`Serialized Path: ${serializedPath}`);
            Memory.rooms[roomName].pathCache[pathKey] = { path: serializedPath, time: Game.time };
            const moveResult = creep.moveByPath(newPath);
            if (moveResult !== OK) {

            }
        }
    },

*/


    // Method for creep movement using cached paths
    findCachedPath: function(creep, target, defaultRange = 1) {
        const targetPos = target.pos || target; 
        const effectiveRange = target.range !== undefined ? target.range : defaultRange;
        //console.log(`[FCP] ${creep}, Target: ${targetPos}`);


        const roomName = creep.memory.home; // Use home room for path caching
        if (!Memory.rooms[roomName].pathCache) {
            Memory.rooms[roomName].pathCache = {};
        }
        const pathKey = this.generatePathKey(creep.pos, targetPos, effectiveRange);

        this.cleanupOldPaths(roomName); // Clean up old paths before trying to find a new one
    
        // Check if the path is cached and still valid
        if (Memory.rooms[roomName].pathCache[pathKey] && Memory.rooms[roomName].pathCache[pathKey].time + 50 > Game.time) {
            // Deserialize the path before using it
            const path = Room.deserializePath(Memory.rooms[roomName].pathCache[pathKey].path);
            const nextStep = path[0];

            //HANDLE CREEP IN PATH

            
            const nextPos = path[0]; // Get the next step in the path
            const blockingCreep = this.room.lookForAt(LOOK_CREEPS, nextPos.x, nextPos.y)[0];

            if (nextStep && blockingCreep.length > 1) {
                // Path is blocked by another creep
                creep.say("💢");
                // Attempt to move to an adjacent free space
                const freeSpace = creep.pos.findClosestByRange(FIND_MY_CREEPS, {
                    filter: (otherCreep) => otherCreep.id !== creep.id && creep.pos.getRangeTo(otherCreep) === 1
                });
                if (freeSpace) {
                    creep.moveTo(freeSpace, {visualizePathStyle: {stroke: '#ffaa00'}});
                }

            } else { 
                //console.log(`Desrialized Path: ${JSON.stringify(path)}`);
                const moveResult = creep.moveByPath(path);
                if (moveResult !== OK) {
                    // Clear the cache if the path is invalid and find a new path immediately
                    delete Memory.rooms[roomName].pathCache[pathKey];
                }
                creep.giveWay();
            }

        } else {
            const newPath = creep.pos.findPathTo(targetPos, {
                range: effectiveRange,
                //REMOVE COMMENT AFTER TRAFFIC
                ignoreCreeps: true,
                });


            //Potential Shift to PF for CPU
            /*const newPath = PathFinder.search(
                creep.pos, { pos: targetPos, range: effectiveRange },
                {
                    roomCallback: () => this.getCostMatrix(roomName),
                    plainCost: 2,
                    swampCost: 10,
                    maxRooms: 1
                }
            ).path;*/

            //console.log(`PF PATH: ${JSON.stringify(newPath)}`);

            // Serialize the new path for caching
            const serializedPath = Room.serializePath(newPath);
            //console.log(`Serialized Path: ${JSON.stringify(serializedPath)}`);
            Memory.rooms[roomName].pathCache[pathKey] = { path: serializedPath, time: Game.time };
            const moveResult = creep.moveByPath(newPath);
            if (moveResult !== OK) {
                creep.giveWay();

            }
            
        }
    
        
    },

    
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
