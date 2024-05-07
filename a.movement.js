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
        const pathCache = Memory.pathCache;
        if (!pathCache) return;

        const pathKeys = Object.keys(pathCache);
        for (const pathKey of pathKeys) {
            if (pathCache[pathKey].time + 50 < Game.time) {
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
        //console.log(`[FCP] ${creep}, Target: ${targetPos}`);


        const roomName = creep.memory.home; // Use home room for path caching
        if (!Memory.pathCache) {
            Memory.pathCache = {};
        }
        const pathCache = Memory.pathCache;
        const pathKey = this.generatePathKey(creep.pos, targetPos, effectiveRange);

        this.cleanupOldPaths(roomName); // Clean up old paths before trying to find
    
        // Check if the path is cached and still valid
        if (pathCache[pathKey] && pathCache[pathKey].time + 50 > Game.time) {
            // Deserialize the path before using it
            const path = pathCache[pathKey].path;



            //HANDLE CREEP IN PATH

  /*          
            //const nextPos = path[0]; // Get the next step in the path
            console.log(`${JSON.stringify(nextPos)}`);
            //const blockingCreep = creep.room.lookForAt(LOOK_CREEPS, nextPos.x, nextPos.y)[0];

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


            } else { */
                //console.log(`Deserialized Path: ${JSON.stringify(path)}`);
                const moveResult = creep.moveByPath(path);
                creep.giveWay();
                if (moveResult !== OK) {
                    // Clear the cache if the path is invalid and find a new path immediately
                    delete pathCache[pathKey];
                }
                
            //}

        } else {
            //const newPath = creep.pos.findPathTo(targetPos, {
             //   range: effectiveRange,
                //REMOVE COMMENT AFTER TRAFFIC
                //ignoreCreeps: true,
             //   });

               

                const PFPath = PathFinder.search(creep.pos, targetPos, {
                    plainCost: 2,
                    swampCost: 10,
                    roomCallback: this.getCostMatrix
 
                    }).path;

            //console.log(`PF PATH: ${JSON.stringify(PFPath)}`);


            const serialPF = JSON.stringify(PFPath.map(pos=> ({x: pos.x, y: pos.y})));
            //console.log(`Serialized Path: ${serialPF}`);
            const parseTest = JSON.parse(serialPF);
            const parseResult = parseTest.map(coord => new RoomPosition(coord.x, coord.y, creep.room.name));
            



            // Serialize the new path for caching
            const serializedPath = parseResult;
            //console.log(`SPATH: ${JSON.stringify(serializedPath)}`);

            
            pathCache[pathKey] = { path: serializedPath, time: Game.time };
            const moveResult = creep.moveByPath(parseResult);
            creep.giveWay();
            if (moveResult !== OK) {
                
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
    


};

module.exports = movement 
