
var construction = require('a.construction');
var spawner = require('a.spawn');
var memories = require('a.memories');
var towers = require('a.towers');
var linker = require('a.links');
var terminals = require('a.terminal');
var movement = require('a.movement');

const profiler = require('screeps-profiler');

// This line monkey patches the global prototypes.
profiler.enable();
module.exports.loop = function() {
    profiler.wrap(function() {

        //Globals
        
        memories.immediateMemory();
        terminals.cleanupOldOrders();
        terminals.globalMarketManagement();
        
        if (Game.time % 10 === 0) {
            console.log(`Bucket CPU: ${Game.cpu.bucket}`);
            
        }
        // Short-Term Memory (30min)
        if (Game.time % 600 === 0) {
            memories.shortTerm();

        }
        // Med-Term (1hr)
        if (Game.time % 1200 === 0) {
        
        }
        // Long-Term Memory (5hr)
        if (Game.time % 6000 === 0) {
            memories.longTerm();
        }

        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
    
            memories.spawnMode(room);
            construction.countStructures(room);
            // Memory Cleanup

            // Room Terminal MGMT
            if (Game.time % 200 === 0) {
                terminals.handleRoomTerminal(room);
            }

            // Short-Term (30min)
            if (Game.time % 600 === 0) {
                construction.countStructures(room);
            }

            // Med-Term (1hr)
            if (Game.time % 1200 === 0) {
                 
            }
            
            // Long-Term Memory (5hr)
            if (Game.time % 6000 === 0) {

            }

            // Count the number of harvesters and haulers specifically in this room
            const harvesters = _.filter(Game.creeps, (creep) => creep.memory.role === 'harvester' && creep.memory.home === roomName);
            const haulers = _.filter(Game.creeps, (creep) => creep.memory.role === 'hauler' && creep.memory.home === roomName);
            // Check the number of energy sources in the room
            const energySources = room.find(FIND_SOURCES).length;
            // Find available spawns in the room
            const availableSpawn = room.find(FIND_MY_SPAWNS, {
                filter: (spawn) => !spawn.spawning
            })[0]; // Get the first available spawn

            // Check if there is an available spawn in the room
            if (availableSpawn) {
                    spawner.manageCreepSpawning(room);
            }
            

        
            // Construction management, including checking for spawn construction
            if (room.controller && room.controller.my) {
                const spawns = room.find(FIND_MY_SPAWNS);
                const spawnSites = room.find(FIND_CONSTRUCTION_SITES, {
                    filter: { structureType: STRUCTURE_SPAWN }
                });

                if (spawns.length === 0 && spawnSites.length === 0) {
                    construction.placeSpawn(room); // If no spawn in controlled room, place one
                } else {
                    construction.manageConstruction(room); // Handle other construction tasks
                }
            }

            // Towers
            const myTowers = room.find(FIND_MY_STRUCTURES, {
                filter: { structureType: STRUCTURE_TOWER }
            });

            myTowers.forEach(tower => {
                towers.run(tower);
            });
            //Manage Links
            const myLinksCount = room.find(FIND_MY_STRUCTURES, {
                filter: { structureType: STRUCTURE_LINK }
            });

            if (myLinksCount.length > 1) {

                //console.log(`calling linker for ${room}`);
                linker.manageLinks(room);
            }
            
        }
    });

}


// Console Calls
/**
 * Connect two points in a room with a road, using simplified point references.
 * @param {string} roomName - The name of the room.
 * @param {string} pointA - The identifier for the starting point (e.g., 'controller', 'storage').
 * @param {string} pointB - The identifier for the ending point.
 */
global.Connect = function(roomName, pointA, pointB) {
    const room = Game.rooms[roomName];
    if (!room) {
        console.log('Connect: room not found');
        return;
    }

    // Function to resolve point names to actual RoomPosition objects
    function resolvePoint(room, pointName) {
        switch (pointName) {
            case 'controller':
                return room.controller.pos;
            case 'storage':
                return room.storage ? room.storage.pos : null;
            case 'spawn': // Assuming you want to connect to the first spawn
                let spawns = room.find(FIND_MY_SPAWNS);
                return spawns.length > 0 ? spawns[0].pos : null;
            case 'extractor':
                let extractors = room.find(FIND_STRUCTURES, {
                    filter: { structureType: STRUCTURE_EXTRACTOR }
                });
                return extractors.length > 0 ? extractors[0].pos : null;
            case 'terminal':
                let terminals = room.find(FIND_STRUCTURES, {
                    filter: { structureType: STRUCTURE_TERMINAL }
                });
            return terminals.length > 0 ? terminals[0].pos : null;
            // Handling sources dynamically, assuming 'source1', 'source2', ...
            default:
                if (pointName.startsWith('source')) {
                    let index = parseInt(pointName.slice(6)) - 1; // Convert 'source1' to 0, 'source2' to 1, etc.
                    let sources = room.find(FIND_SOURCES);
                    if (index >= 0 && index < sources.length) {
                        return sources[index].pos;
                    }
                }
                console.log(`Unrecognized point: ${pointName}`);
                return null;
            
        }
    }

    const startPos = resolvePoint(room, pointA);
    const endPos = resolvePoint(room, pointB);

    if (!startPos || !endPos) {
        console.log('Connect: Unable to resolve start or end point.');
        return;
    }

    // Use PathFinder to find the path and place construction sites
    const path = PathFinder.search(startPos, { pos: endPos, range: 1 }, {
        plainCost: 2,
        swampCost: 10,
        roomCallback: function(roomName) {
            let room = Game.rooms[roomName];
            if (!room) return;
            let costs = new PathFinder.CostMatrix;

            room.find(FIND_STRUCTURES).forEach(function(struct) {
                if (struct.structureType === STRUCTURE_ROAD) {
                    costs.set(struct.pos.x, struct.pos.y, 1);
                } else if (struct.structureType !== STRUCTURE_CONTAINER &&
                           (struct.structureType !== STRUCTURE_RAMPART || !struct.my)) {
                    costs.set(struct.pos.x, struct.pos.y, 0xff);
                }
            });
            return costs;
        },
    });

    for (let i = 0; i < path.path.length; i++) {
        const pos = path.path[i];
        room.createConstructionSite(pos, STRUCTURE_ROAD);
    }
}





global.Refresh = function() {
    movement.cleanupOldPaths();
    memories.immediateMemory();
    memories.shortTerm();
    memories.longTerm();
    terminals.updateMarketPrices();
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];

        if(room.terminal && room.controller && room.controller.my) {
            terminals.adjustPrices(room);

        }
    }
}

global.Rebuild = function(roomName) {
    construction.connectExtensionsToStorage(roomName);
}

global.RACS = function() {
    construction.removeAllConstructionSites();   
}

global.SPAWN = function(role) {
    const room = Object.keys(Game.rooms)[0];
    const energyToUse = room.energyAvailable;
    const phase = Memory.rooms[room.name].phase.Phase;
    
    spawner.spawnCreepWithRole(role, energyToUse, phase, room);
}


