// Import role modules

var construction = require('a.construction');
var spawner = require('a.spawn');
var memories = require('a.memories');
var towers = require('a.towers');

// This line monkey patches the global prototypes.

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

        // Automatically spawn creeps as needed, maintain at least 3 harvesters
        if (_.filter(Game.creeps, (creep) => creep.memory.role === 'harvester').length < 1 && !Game.spawns['Spawn1'].spawning && Memory.spawnClock.ticksSinceLastSpawn > 200) {
            Game.spawns['Spawn1'].spawnCreep([MOVE, CARRY, WORK], Game.time, {memory: {role: 'harvester'}}); 
        } else {
            spawner.manageCreepSpawning(room);
        }
        
        // Construction 
        construction.manageConstruction(room);
        
        // Towers
        const myTowers = room.find(FIND_MY_STRUCTURES, {
            filter: { structureType: STRUCTURE_TOWER }
        });

        myTowers.forEach(tower => {
            towers.run(tower);
        });
    }

}


// Console Calls
global.RACS = function() {
    construction.removeAllConstructionSites();   
}

global.STATS = function() {
    const room = Game.rooms[Object.keys(Game.rooms)[0]];
    memories.shortTerm();
        console.log(` `);
        
    for (const roomName in Game.rooms) {
        console.log(`Room: ${roomName}`);
        console.log(` `);
    }

    console.log(`  `);
    console.log('Population Statistics:');
    const upgraders = _.filter(Game.creeps, (creep) => creep.memory.role === 'upgrader').length;
    const harvesters = _.filter(Game.creeps, (creep) => creep.memory.role === 'harvester').length;
    const builders = _.filter(Game.creeps, (creep) => creep.memory.role === 'builder').length;
    const haulers = _.filter(Game.creeps, (creep) => creep.memory.role === 'hauler').length;
    const totalCreeps = Object.keys(Game.creeps).length;
    console.log(`- Total: ${totalCreeps}`); 
    console.log(`- Worker counts: Hv: ${harvesters}, Hl: ${haulers}, B: ${builders}, U: ${upgraders}`);
    console.log(`  `);
    
    
    
    console.log('Spawning Statistics:');
    const maxEnergy = Game.spawns['Spawn1'].room.energyCapacityAvailable;
    const currentEnergy = Game.spawns['Spawn1'].room.energyAvailable;
    const energy2Use = Memory.spawnMode.energyToUse
    const avgInterval = Memory.spawnClock.averageInterval;
    const collectionRate = energy2Use / avgInterval;
    
    console.log(`- Spawn mode: ${Memory.spawnMode.mode}`);
    console.log(`- Energy to use: ${energy2Use}`);
    console.log(`- Energy available: ${currentEnergy}`);
    console.log(`- Maximum energy: ${maxEnergy}`);
    console.log(`- Spawn rate: ${Memory.spawnClock.averageInterval} ticks`);
    console.log(`- Last spawn: ${Memory.spawnClock.ticksSinceLastSpawn} ticks ago`);
    //console.log(`- Collection Rate: ${collectionRate} energy per tick`);
    console.log(`- Spawn trend: ${Memory.spawnClock.intervalDifference}`);
    if (Memory.nextSpawnRole) {
        console.log(`- Next spawn: ${Memory.nextSpawnRole}`);
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


