
var construction = require('a.construction');
var spawner = require('a.spawn');
var memories = require('a.memories');
var towers = require('a.towers');
var linker = require('a.links');
var terminals = require('a.terminal');
var movement = require('a.movement');

module.exports.loop = function() {

    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
   
        // Memory Cleanup
        memories.immediateMemory();
        terminals.cleanupOldOrders();

        // Market Awareness Memory
        if (Game.time % 200 === 0) {
            terminals.updateMarketPrices();
        }

        // Short-Term Memory
        if (Game.time % 300 === 0) {
            memories.shortTerm();
            
        }

        // 1-hr Memory
        if (Game.time % 1200 === 0) {
            //terminals.generateMarketSummary();
            
        }
        
        // Long-Term Memory
        if (Game.time % 5000 === 0) {
            memories.longTerm();
        }

        // Count the number of harvesters and haulers specifically in this room
        const harvesters = _.filter(Game.creeps, (creep) => creep.memory.role === 'harvester' && creep.room.name === roomName);
        const haulers = _.filter(Game.creeps, (creep) => creep.memory.role === 'hauler' && creep.room.name === roomName);
        // Check the number of energy sources in the room
        const energySources = room.find(FIND_SOURCES).length;
        // Find available spawns in the room
        const availableSpawn = room.find(FIND_MY_SPAWNS, {
            filter: (spawn) => !spawn.spawning
        })[0]; // Get the first available spawn

        // Check if there is an available spawn in the room
        if (availableSpawn) {

            

            // Handle Spawning if there is only one energy source
            if (energySources === 1) {
                if (harvesters.length < 1 && haulers.length < 2) {
                // Spawn a harvester if there are less than 1
                availableSpawn.spawnCreep([MOVE, CARRY, WORK], `Harvester_${Game.time}`, {memory: {role: 'harvester', room: roomName}}); 
            }
                if (haulers.length < 2) {
                    // Spawn a hauler if there are less than... additional logic needed since limit is 1
                    availableSpawn.spawnCreep([CARRY, MOVE, MOVE], `Hauler_${Game.time}`, {memory: {role: 'hauler', room: roomName}});
                } else {


                    // If the minimum numbers of harvesters and haulers are met, manage other creep spawning as needed
                    spawner.manageCreepSpawning(room);
                }

            } else {
                if (harvesters.length < 1) {
                    // Spawn a harvester if there are less than 1
                    availableSpawn.spawnCreep([MOVE, CARRY, WORK], `Harvester_${Game.time}`, {memory: {role: 'harvester', room: roomName}}); 
                }  else if (haulers.length < 2) {
                    // Spawn a hauler if there are less than 2
                    availableSpawn.spawnCreep([CARRY, MOVE, MOVE], `Hauler_${Game.time}`, {memory: {role: 'hauler', room: roomName}});
                } else {
                    // If the minimum numbers of harvesters and haulers are met, manage other creep spawning as needed
                    spawner.manageCreepSpawning(room);
                }
            }
        }
    
        //Terminal Management

        if (!room.terminal || room.terminal.cooldown > 0) {
            //console.log('Terminal is busy or cooling down.');

        } else if(room.terminal && room.controller && room.controller.my) {



            //Manage Buys
            if (Game.time % 10 === 0) {
                terminals.manageTerminal(room); 
                terminals.updatePL();  
            }

            //Check P&L & Manage Buys
            if (Game.time % 50 === 0) {
                terminals.adjustPrices(room);
                terminals.purchaseUnderpricedResources(room);
            }

            //Manage Sell Prices
            if (Game.time % 1200 === 0) {
                Memory.marketData.PL.lastCredits = Game.market.credits;
                
            }

            
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

global.RACS = function() {
    construction.removeAllConstructionSites();   
}

global.SPAWN = function(role) {
    const room = Object.keys(Game.rooms)[0];
    const energyToUse = room.energyAvailable;
    const phase = Memory.rooms[room.name].phase.Phase;
    
    spawner.spawnCreepWithRole(role, energyToUse, phase, room);
}

global.STATS = function() {
    terminals.updateMarketPrices();
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        console.log(`Room: ${roomName}`);
        console.log(` `);
        memories.shortTerm();
        console.log(` `);
        


        console.log(`  `);
        console.log('Global Population Statistics:');
        const upgraders = _.filter(Game.creeps, (creep) => creep.memory.role === 'upgrader').length;
        const harvesters = _.filter(Game.creeps, (creep) => creep.memory.role === 'harvester').length;
        const builders = _.filter(Game.creeps, (creep) => creep.memory.role === 'builder').length;
        const haulers = _.filter(Game.creeps, (creep) => creep.memory.role === 'hauler').length;
        const totalCreeps = Object.keys(Game.creeps).length;
        console.log(`- Total: ${totalCreeps}`); 
        console.log(`- Worker counts: Hv: ${harvesters}, Hl: ${haulers}, B: ${builders}, U: ${upgraders}`);
        console.log(`  `);
        
        
        
        console.log('Spawning Statistics:');
        const maxEnergy = room.energyCapacityAvailable;
        const currentEnergy = room.energyAvailable;
        const energy2Use = Memory.rooms[room.name].spawnMode.energyToUse
                
        console.log(`- Spawn mode: ${Memory.rooms[room.name].spawnMode.mode}`);
        console.log(`- Energy to use: ${energy2Use}`);
        console.log(`- Energy available: ${currentEnergy}`);
        console.log(`- Maximum energy: ${maxEnergy}`);
        //console.log(`- Collection Rate: ${collectionRate} energy per tick`);
        if (Memory.rooms[room.name].nextSpawnRole) {
            console.log(`- Next spawn: ${Memory.rooms[room.name].nextSpawnRole}`);
        } else {
            console.log("No Creep Role Scheduled for Next Spawn.");
        }

        console.log(`  `);



        const constructionSites = _.filter(Game.constructionSites, site => site.my);
        const totalSites = constructionSites.length;
        const structuresCount = {
            road: { built: 0, pending: 0 },
            extension: { built: 0, pending: 0 },
            container: { built: 0, pending: 0 },
            rampart: { built: 0, pending: 0 },
            wall: { built: 0, pending: 0 },
            storage: { built: 0, pending: 0 },
            tower: { built: 0, pending: 0 },
            observer: { built: 0, pending: 0 },
            powerSpawn: { built: 0, pending: 0 },
            extractor: { built: 0, pending: 0 },
            lab: { built: 0, pending: 0 },
            terminal: { built: 0, pending: 0 },
            link: { built: 0, pending: 0 },
            nuker: { built: 0, pending: 0 },
            factory: { built: 0, pending: 0 }
        };

        // Count built structures
        room.find(FIND_STRUCTURES).forEach(structure => {
            if (structuresCount.hasOwnProperty(structure.structureType)) {
                structuresCount[structure.structureType].built += 1;
            }
        });
        
        // Count construction sites
        room.find(FIND_CONSTRUCTION_SITES).forEach(site => {
            if (structuresCount.hasOwnProperty(site.structureType)) {
                structuresCount[site.structureType].pending += 1;
            }
        });


        console.log('Construction Progress:');
        
        if (totalSites === 0) {
            console.log("- No construction sites currently active.");
        } else {
            let totalEnergyRequired = 0;
            let totalEnergyInvested = 0;
        
            constructionSites.forEach(site => {
                totalEnergyRequired += site.progressTotal;
                totalEnergyInvested += site.progress;
            });
        
            console.log(`- Energy Requirements: (${totalEnergyInvested}/${totalEnergyRequired} energy)`);
            console.log(`- Sites Remaining: ${totalSites}`);
            // Log the counts
            Object.keys(structuresCount).forEach(type => {
                if (structuresCount[type].built > 0 || structuresCount[type].pending > 0) {
                    console.log(`- ${type.charAt(0).toUpperCase() + type.slice(1)} Built: ${structuresCount[type].built} // Pending: ${structuresCount[type].pending}`);
                }
            });
        
        }

        console.log(`  `);
    }


}


