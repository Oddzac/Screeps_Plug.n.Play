
var construction = require('a.construction');
var spawner = require('a.spawn');
var memories = require('a.memories');
var towers = require('a.towers');
var linker = require('a.links');

module.exports.loop = function() {

    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
   
        // Memory Cleanup
        memories.immediateMemory();
        
        // Short-Term Memory
        if (Game.time % 300 === 0) {
            memories.shortTerm();
        }
        
        // Long-Term Memory
        if (Game.time % 5000 === 0) {
            memories.longTerm();
        }

    // Count the number of harvesters and haulers specifically in this room
    const harvesters = _.filter(Game.creeps, (creep) => creep.memory.role === 'harvester' && creep.room.name === roomName);
    const haulers = _.filter(Game.creeps, (creep) => creep.memory.role === 'hauler' && creep.room.name === roomName);

    // Find available spawns in the room
    const availableSpawn = room.find(FIND_MY_SPAWNS, {
        filter: (spawn) => !spawn.spawning
    })[0]; // Get the first available spawn

    // Check if there is an available spawn in the room
    if (availableSpawn) {
        if (harvesters.length < 1) {
            // Spawn a harvester if there are less than 1
            availableSpawn.spawnCreep([MOVE, CARRY, WORK], `Harvester_${Game.time}`, {memory: {role: 'harvester', room: roomName}}); 
        } else if (haulers.length < 2) {
            // Spawn a hauler if there are less than 2
            availableSpawn.spawnCreep([CARRY, MOVE, MOVE], `Hauler_${Game.time}`, {memory: {role: 'hauler', room: roomName}});
        } else {
            // If the minimum numbers of harvesters and haulers are met, manage other creep spawning as needed
            spawner.manageCreepSpawning(room);
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
        const collectionRate = energy2Use / avgInterval;
        
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


