/*
PHASE STRUCTURE:

Phase 1 (RCL 1)
SPAWN
X Base Worker Blueprint: [W,C,M]
X Population Based Spawns: Hrv(20%) Hal(20%) Bld(30%) Upg(30%)
MEMORY
X Energy To Use: 100%
ROLE
- Harvesters Drop Energy Until Containers
- Haulers Manage Drop Claims Until Containers
- B/Us Harvest Themselves
CONSTRUCTION
X Initial Road Placement
X Container Placement


Phase 2 (RCL 2)
SPAWN
X Spawning Shift: Hrv(4) Hal(6) Bld((Const. Energy Required / 100) * 0.002)) Upg(30%)
X Focus Harvester Shift: [W,W,W,W,C,M]
MEMORY
X Energy To Use Splits Roles: Harvester (500) Other (80%)
ROLE
- Harvesters Assigned Sources
- Bld/Upg Prioritize Containers, Harvest When Needed
- Haulers Withdraw Energy - Assign Containers
CONSTRUCTION
X Extension Circles Begin Adjacent To Spawn (5, 550 CAP) x


Phase 3 (RCL 3)
SPAWN
X Full Harvester Shift: [W,W,W,W,W,C,M]
X Spawning Shift: Hrv(2) Hal(6) Bld((Const. Energy Required / 100) * 0.002)) Upg(2)
MEMORY
X Energy To Use: Harvester (600) Other (75%)
ROLE
- Bld/Upg Withdraw Exclusively From Containers
- Haulers Fill Spawn Then Extensions (then tower) 
CONSTRUCTION
X Tower Placed
X Additional Extensions Placed (+5, 800 CAP)


Phase 4 (RCL 4)
SPAWN
MEMORY
ROLE
- Haulers Deposit Energy With Priority (Spawn > Extension > Tower > Storage)
- Bld/Upg Withdraw Exclusively From Storage (containers until built)
CONSTRUCTION
X Storage Placed
*/




//TODO
// Claimed Drop stored in room object

var roleHarvester = require('role.harvester');
var roleUpgrader = require('role.upgrader');
var roleBuilder = require('role.builder');
var roleHauler = require('role.hauler');
var roleAttacker = require('role.attacker');
var roleHealer = require('role.healer');
var roleClaimer = require('role.claimer');
var roleScout = require('role.scout');
var spawner = require('a.spawn');
var movement = require('a.movement');

var memories = {
    
    immediateMemory: function() {
        
        this.memInit();
        this.spawnMode();

        
        
        //Dearly departed, we are gathered here today... (clear creep names)
        for (var name in Memory.creeps) {
            if (!Game.creeps[name]) {
                delete Memory.creeps[name];
                console.log('Clearing creep memory:', name);
            }
        } 
        

        
        //Clean and maintain Hauler drop claims
        for (const [dropId, dropInfo] of Object.entries(Memory.claimedDrops)) {
        const drop = Game.getObjectById(dropId);
            if (!drop || drop.amount === 0) {
                delete Memory.claimedDrops[dropId];
            } else {
                dropInfo.energy = drop.amount;
    
                // Ensure haulers array is initialized
                if (!dropInfo.haulers) {
                    dropInfo.haulers = [];
                } else {
                    // Clean up the list of haulers
                    dropInfo.haulers = dropInfo.haulers.filter(haulerId => Game.getObjectById(haulerId));
                    if (dropInfo.haulers.length === 0) {
                        delete Memory.claimedDrops[dropId];
                    }
                }
            }
        }
        
        //Assign Creep roles
        for (var name in Game.creeps) {
            var creep = Game.creeps[name];
            switch (creep.memory.role) {
                case 'harvester': roleHarvester.run(creep); break;
                case 'upgrader': roleUpgrader.run(creep); break;
                case 'builder': roleBuilder.run(creep); break;
                case 'attacker': roleAttacker.run(creep); break;
                case 'healer': roleHealer.run(creep); break;
                case 'hauler': roleHauler.run(creep); break;
                case 'scout': roleScout.run(creep); break;
                case 'claimer': roleClaimer.run(creep); break;
                // No default case needed 
            }
        }

        

        for (const roomName in Memory.claimRooms) {
            // Check if the Game object has the room, and if so, whether you own the controller
            if (Game.rooms[roomName] && Game.rooms[roomName].controller && Game.rooms[roomName].controller.my) {
                // Room is claimed by you, so remove it from Memory.claimRooms
                delete Memory.claimRooms[roomName];
                console.log('Removing claimed room from memory:', roomName);
            }
        }


    },

        
    //Initialize Memory
    memInit: function() {
        // Initialize global memory objects if they don't exist
        if (!Memory.claimedDrops) Memory.claimedDrops = {};
        if (!Memory.terrainData) Memory.terrainData = {};
        if (!Memory.costMatrices) Memory.costMatrices = {};
        if (!Memory.rooms) Memory.rooms = {};
        if (!Memory.claimRooms) Memory.claimRooms = {};
        if (!Memory.scoutedRooms) Memory.scoutedRooms = {};
        if (!Memory.roomClaimsAvailable) Memory.roomClaimsAvailable = 0;
        if (!Memory.marketData) {
            Memory.marketData = {};
            
            // Initialize P&L tracking object
            Memory.marketData.PL = {
                lastCredits: 0,
                PL: 0
            };

            RESOURCES_ALL.forEach(resource => {
                Memory.marketData[resource] = {
                    avgPrice: 0,
                    averagePrices: [],
                    orders: {},
                    lastUpdate: Game.time
                };
            });
        

        }
        
        
    
        // Loop through each room to initialize or update room-specific memory
        Object.keys(Game.rooms).forEach(roomName => {
            const room = Game.rooms[roomName];
    
            //if (!Memory.rooms[room.name].tradeSummary) {
                //Memory.rooms[room.name].tradeSummary = { creditsEarned: 0, lastUpdate: Game.time };
            //}
            // Initialize room memory object if it doesn't exist
            if (!Memory.rooms[roomName]) {
                Memory.rooms[roomName] = {
                    phase: { Phase: 1, RCL: room.controller.level },
                    underAttack: room.find(FIND_HOSTILE_CREEPS).length > 0,
                    scoutingComplete: false,
                    nextSpawnRole: null,
                    spawnMode: { mode: null, energyToUse: 0 },
                    tradeSummary:{ creditsEarned: 0, lastUpdate: Game.time },
                    constructionRuns: 0,
                    constructionEnergyRequired: 0,
                    containersBuilt: 0,
                    storageBuilt: 0,
                    extractorBuilt: 0,
                    linksBuilt: 0,
                    terminalBuilt: 0,
                    towersBuilt: 0,
                    pathCache: {},
                    claimedDrops: {},
                };
            } else {
                // Update existing room memory objects
                Memory.rooms[roomName].underAttack = room.find(FIND_HOSTILE_CREEPS, {
                    filter: (creep) => creep.owner.username !== "Source Keeper"
                }).length > 0;
                // Additional updates can be made here as needed
            }
        });
    
        // Other memory initialization or cleanup tasks can be added here
    },
    
    // Manage memory governing spawn behavior
    spawnMode: function() {
        
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            const phase = Memory.rooms[room.name].phase.Phase;
            const energyCapacity = room.energyCapacityAvailable;
            const energyAvailable = room.energyAvailable;
            const nextRole = Memory.rooms[room.name].nextSpawnRole;

            switch (phase) {
                case 1:
                    //Energy Cap: 300
                    if (Memory.rooms[roomName].underAttack) {
                        //Respond to hostile presence
                        Memory.rooms[room.name].spawnMode.mode = 'Defense';
                        Memory.rooms[room.name].spawnMode.energyToUse = energyAvailable;
                        return;
                    } else {
                        // No minimum threshold. Spawn as quickly as possible
                        Memory.rooms[room.name].spawnMode.mode = 'NoMin';
                        Memory.rooms[room.name].spawnMode.energyToUse = energyAvailable; 
                    }
                    break;
                
                case 2:
                    //Energy Cap: 550
                    if (Memory.rooms[roomName].underAttack) {
                        //Respond to hostile presence
                        Memory.rooms[room.name].spawnMode.mode = 'Defense';
                        Memory.rooms[room.name].spawnMode.energyToUse = energyAvailable;
                        return;
                    } else if (nextRole === 'harvester' && energyCapacity >= 500) {
                        Memory.rooms[room.name].spawnMode.mode = 'Harvester';
                        Memory.rooms[room.name].spawnMode.energyToUse = 500;
                        return;
                    } else if (nextRole === 'harvester' && energyCapacity < 500) {
                        Memory.rooms[room.name].spawnMode.mode = 'HarvesterLite';
                        Memory.rooms[room.name].spawnMode.energyToUse = energyAvailable;
                        return;
                    } else {
                        // No minimum threshold. Spawn as quickly as possible
                        Memory.rooms[room.name].spawnMode.mode = 'NoMin';
                        Memory.rooms[room.name].spawnMode.energyToUse = energyAvailable; 
                    }
                    break;

                case 3:
                    //Energy Cap: 800
                    if (Memory.rooms[roomName].underAttack) {
                        //Respond to hostile presence
                        Memory.rooms[room.name].spawnMode.mode = 'Defense';
                        Memory.rooms[room.name].spawnMode.energyToUse = energyAvailable;
                        return;
                    } else if (nextRole === 'harvester' && energyCapacity >= 600) {
                        Memory.rooms[room.name].spawnMode.mode = 'Harvester';
                        Memory.rooms[room.name].spawnMode.energyToUse = 600;
                        return;
                    } else if (nextRole === 'harvester' && energyCapacity < 600) {
                        Memory.rooms[room.name].spawnMode.mode = 'HarvesterLite';
                        Memory.rooms[room.name].spawnMode.energyToUse = 500;
                        return;
                    } else if (nextRole === 'claimer') {
                        //console.log('Spawn Mode: Claimer');
                        Memory.rooms[room.name].spawnMode.mode = 'Claimer';
                        Memory.rooms[room.name].spawnMode.energyToUse = 700;
                        return;
                    } else {
                        //Begin Efficiency Cap
                        Memory.rooms[room.name].spawnMode.mode = 'Cap(70%)';
                        Memory.rooms[room.name].spawnMode.energyToUse = energyCapacity * .7; 
                    }
                    break;

                case 4:
                    //Energy Cap: 1300
                    if (Memory.rooms[roomName].underAttack) {
                        //Respond to hostile presence
                        Memory.rooms[room.name].spawnMode.mode = 'Defense';
                        Memory.rooms[room.name].spawnMode.energyToUse = energyAvailable;
                        return;
                    } else if (nextRole === 'harvester') {
                        Memory.rooms[room.name].spawnMode.mode = 'Harvester';
                        Memory.rooms[room.name].spawnMode.energyToUse = 600;
                        return;
                    } else if (nextRole === 'claimer') {
                        //console.log('Spawn Mode: Claimer');
                        Memory.rooms[room.name].spawnMode.mode = 'Claimer';
                        Memory.rooms[room.name].spawnMode.energyToUse = 700;
                        return;
                    } else {
                        // Lower Cap to 75%
                        Memory.rooms[room.name].spawnMode.mode = 'Cap(60%)';
                        Memory.rooms[room.name].spawnMode.energyToUse = energyCapacity * .6;
                    }
                    break;

                case 5:
                    //console.log(`Phase ${phase} // Next Role: ${nextRole}`)
                    //Energy Cap: 1800
                    if (Memory.rooms[roomName].underAttack) {
                        //Respond to hostile presence
                        Memory.rooms[room.name].spawnMode.mode = 'Defense';
                        Memory.rooms[room.name].spawnMode.energyToUse = energyAvailable;
                        return;
                    } else if (nextRole === 'harvester') {
                        Memory.rooms[room.name].spawnMode.mode = 'Harvester';
                        Memory.rooms[room.name].spawnMode.energyToUse = 600;
                        return;
                    } else if (nextRole === 'claimer') {
                        Memory.rooms[room.name].spawnMode.mode = 'Claimer';
                        Memory.rooms[room.name].spawnMode.energyToUse = 700;
                        return;
                    } else {
                        // Lower Cap to 50%
                        Memory.rooms[room.name].spawnMode.mode = 'Cap(60%)';
                        Memory.rooms[room.name].spawnMode.energyToUse = energyCapacity * .6;
                    }
                    break;

                case 6:
                    if (Memory.rooms[roomName].underAttack) {
                        //Respond to hostile presence
                        Memory.rooms[room.name].spawnMode.mode = 'Defense';
                        Memory.rooms[room.name].spawnMode.energyToUse = energyAvailable;
                        return;
                    } else if (nextRole === 'harvester') {
                        Memory.rooms[room.name].spawnMode.mode = 'Harvester';
                        Memory.rooms[room.name].spawnMode.energyToUse = 600;
                        return;
                    } else if (nextRole === 'claimer') {
                        Memory.rooms[room.name].spawnMode.mode = 'Claimer';
                        Memory.rooms[room.name].spawnMode.energyToUse = 700;
                        return;
                    } else {
                        // Lower Cap to 50%
                        Memory.rooms[room.name].spawnMode.mode = 'Cap(45%)';
                        Memory.rooms[room.name].spawnMode.energyToUse = energyCapacity * .45;
                    }
                break;
                    
                default:
                    console.log('Spawn Mode: Default case');
                    if (Memory.rooms[roomName].underAttack) {
                        //Respond to hostile presence
                        Memory.rooms[room.name].spawnMode.mode = 'Defense';
                        Memory.rooms[room.name].spawnMode.energyToUse = energyAvailable;
                        return;
                    } else if (nextRole === 'harvester') {
                        Memory.rooms[room.name].spawnMode.mode = 'Harvester';
                        Memory.rooms[room.name].spawnMode.energyToUse = 600;
                        return;
                    } else if (nextRole === 'claimer') {
                        //console.log('Spawn Mode: Claimer');
                        Memory.rooms[room.name].spawnMode.mode = 'Claimer';
                        Memory.rooms[room.name].spawnMode.energyToUse = 700;
                        return;
                    } else {
                        // Default Cap: 75%
                        Memory.rooms[room.name].spawnMode.mode = 'Cap(75%)';
                        Memory.rooms[room.name].spawnMode.energyToUse = energyCapacity * .5; // Let spawn manager handle
                    }                        
                    break;            

            }
        }
        
    },   

    
    shortTerm: function() {

        const roomsControlled = Object.values(Game.rooms).filter(room => room.controller && room.controller.my).length;
        const roomsAvailableToClaim = Game.gcl.level - roomsControlled;
        // Update claims available
        console.log('Updating available claims...');
        Memory.roomClaimsAvailable = roomsAvailableToClaim;
        //Refresh pathCache Memory / Construction Energy Reqs / Room Phase
        Object.values(Game.rooms).forEach(room => {
            const constructionSites = _.filter(Game.constructionSites, site => site.my);
            let totalEnergyRequired = 0;
            
            constructionSites.forEach(site => {totalEnergyRequired += site.progressTotal;});
            Memory.rooms[room.name].constructionEnergyRequired = totalEnergyRequired;
            
            console.log(`Checking ${room.name}`);
            console.log('Path caches reset...');
            delete Memory.rooms[room.name].pathCache;
            console.log('Checking phase...');
            this.updateRoomPhase(room);
        });
        
    },
    
    
    longTerm: function() {
        
        // Update cost matrices for all rooms
        console.log('Updating cost matrices for all rooms...');
        this.updateRoomTerrainData();
        for (const roomName in Game.rooms) {
            this.cacheRoomCostMatrix(roomName); // Assuming this function updates the cost matrix
        }
        
    },
    


    updateRoomPhase: function(room) {

        // Update the current RCL in memory (useful for tracking progress and phase changes)
        Memory.rooms[room.name].phase.RCL = room.controller.level;
    
        const containersBuilt = room.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_CONTAINER }}).length;
        const towersBuilt = room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER }}).length;
        const storageBuilt = room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_STORAGE }}).length;
        const linksBuilt = room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_LINK }}).length;
        const extractorBuilt = room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_EXTRACTOR }}).length;
        const terminalBuilt = room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TERMINAL }}).length;


        Memory.rooms[room.name].containersBuilt = containersBuilt;
        Memory.rooms[room.name].towersBuilt = towersBuilt;
        Memory.rooms[room.name].storageBuilt = storageBuilt;
        Memory.rooms[room.name].linksBuilt = linksBuilt;
        Memory.rooms[room.name].extractorBuilt = extractorBuilt;
        Memory.rooms[room.name].terminalBuilt = terminalBuilt;


        const currentPhase = Memory.rooms[room.name].phase.Phase;
        const rcl = room.controller.level;
        let transitioned = false;
    
        switch (currentPhase) {
            case 1:
                // Phase 1 to Phase 2 transition: RCL reaches 2
                if (rcl >= 2) {
                    Memory.rooms[room.name].phase.Phase = 2;
                    console.log(`Room ${room.name} has advanced to Phase 2.`);
                    transitioned = true;
                }
                break;
            case 2:
                // Phase 2 to Phase 3 transition: RCL reaches 3, and containers are built
                if (rcl >= 3 && containersBuilt > 1) {
                    Memory.rooms[room.name].phase.Phase = 3;
                    console.log(`Room ${room.name} has advanced to Phase 3.`);
                    transitioned = true;
                }
                break;
            case 3:
                // Phase 3 to Phase 4 transition: RCL reaches 4, and a tower is built
                if (rcl >= 4 && towersBuilt > 0) {
                    Memory.rooms[room.name].phase.Phase = 4;
                    console.log(`Room ${room.name} has advanced to Phase 4.`);
                    transitioned = true;
                }
                break;
            case 4:
                // Phase 4 to Phase 5 transition: RCL reaches 5, and storage is built
                if (rcl >= 5 && storageBuilt > 0) {
                    Memory.rooms[room.name].phase.Phase = 5;
                    console.log(`Room ${room.name} has advanced to Phase 5.`);
                    transitioned = true;
                }
                break;

            case 5:
                if (rcl >= 6 && linksBuilt > 1) {
                    Memory.rooms[room.name].phase.Phase = 6;
                    console.log(`Room ${room.name} has advanced to Phase 6.`);
                    transitioned = true;
                }
                break;

            // Further phases as necessary...
            default:
                break;

        }
    
        // Additional actions upon phase transition
        if (transitioned) {
            // Perform specific actions like adjusting spawn priorities, placing new construction sites, etc.
            this.handlePhaseTransitionActions(room);
        }
    },
    
    
    handlePhaseTransitionActions: function(room) {
        // Placeholder for actions to perform upon entering a new phase
        console.log(`Performing transition actions for Room ${room.name}.`);
    },
        

// MAPPING METHODS
//

    updateRoomTerrainData: function(room) {
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            // Check if we already have the terrain data stored
            if (!Memory.terrainData || !Memory.terrainData[roomName]) {
                // If not, retrieve and store it
                const terrain = room.getTerrain();
                Memory.terrainData = Memory.terrainData || {};
                Memory.terrainData[roomName] = [];
                for (let y = 0; y < 50; y++) {
                    for (let x = 0; x < 50; x++) {
                        const terrainType = terrain.get(x, y);
                        // Store terrain type; 0: plain, 1: wall, 2: swamp
                        Memory.terrainData[roomName].push(terrainType);
                    }
                }
                console.log(`Terrain data cached for room: ${roomName}`);
                this.cacheRoomCostMatrix(roomName);
            }
        }
    },

    cacheRoomCostMatrix: function(roomName) {
        if (!Memory.terrainData || !Memory.terrainData[roomName]) {
            console.log('Terrain data for room not found:', roomName);
            return;
        }
    
        var terrain = Memory.terrainData[roomName];
        var costMatrix = new PathFinder.CostMatrix();
    
        for (let y = 0; y < 50; y++) {
            for (let x = 0; x < 50; x++) {
                var index = y * 50 + x;
                if (terrain[index] === TERRAIN_MASK_WALL) {
                    costMatrix.set(x, y, 255); // Impassable
                } else if (terrain[index] === TERRAIN_MASK_SWAMP) {
                    costMatrix.set(x, y, 10); // Costly to move through
                } else {
                    costMatrix.set(x, y, 2); // Normal cost
                }
            }
        }
    
        Memory.costMatrices = Memory.costMatrices || {};
        Memory.costMatrices[roomName] = costMatrix.serialize();
    },

    
    
    

    
    
    
    
};

module.exports = memories;