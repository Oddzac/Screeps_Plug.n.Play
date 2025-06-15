/*
PHASE STRUCTURE:

Phase 1 (RCL 1)
SPAWN
X Base Worker Blueprint: [W,C,M]
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
// 

var roleHarvester = require('./role.harvester');
var roleUpgrader = require('./role.upgrader');
var roleBuilder = require('./role.builder');
var roleHauler = require('./role.hauler');
var roleAttacker = require('./role.attacker');
var roleHealer = require('./role.healer');
var roleClaimer = require('./role.claimer');
var roleScout = require('./role.scout');
var movement = require('./u.movement');
//var spawner = require('a.spawn');

var memories = {
    
    immediateMemory: function() {
        this.memInit();
        this.cleanupMemory();

        const roomsControlled = Object.values(Game.rooms).filter(room => room.controller && room.controller.my).length;
        const roomsAvailableToClaim = Game.gcl.level - roomsControlled;
        // Update claims available
        if (roomsAvailableToClaim != Memory.conquest.roomClaimsAvailable) {
            console.log('Updating available claims...');
            Memory.conquest.roomClaimsAvailable = roomsAvailableToClaim;
        }
        
        //Assign Creep roles
        for (const name in Game.creeps) {
            const creep = Game.creeps[name];
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

        for (const roomName in Memory.conquest.claimRooms) {
            // Check if the Game object has the room, and if so, whether you own the controller
            if (Game.rooms[roomName] && Game.rooms[roomName].controller && Game.rooms[roomName].controller.my) {
                // Room is claimed by you, so remove it from Memory.conquest.claimRooms
                delete Memory.conquest.claimRooms[roomName];
                console.log('Removing claimed room from memory:', roomName);
            }

            // Check for hostiles in visible rooms
            if (Game.rooms[roomName]) {
                const room = Game.rooms[roomName];
                Memory.rooms[roomName].underAttack = room.find(FIND_HOSTILE_CREEPS, {
                    filter: (creep) => creep.owner.username !== "Source Keeper"
                }).length > 0;
            }
        }
    },
    
    cleanupMemory: function() {
        // Clean up creep memory
        for (const name in Memory.creeps) {
            if (!Game.creeps[name]) {
                delete Memory.creeps[name];
                console.log('Clearing creep memory:', name);
            }
        }
        
        // Clean up path cache - remove old paths
        if (Memory.pathCache) {
            const currentTime = Game.time;
            for (const pathKey in Memory.pathCache) {
                if (Memory.pathCache[pathKey].time + 100 < currentTime) {
                    delete Memory.pathCache[pathKey];
                }
            }
        }
        
        // Clean up cost matrices that are too old
        if (Memory.costMatrices) {
            const currentTime = Game.time;
            for (const roomName in Memory.costMatrices) {
                if (Memory.costMatrices[roomName].time + 10000 < currentTime) {
                    delete Memory.costMatrices[roomName];
                }
            }
        }
        
        // Clean up room memory for rooms that no longer exist or are not visible
        for (const roomName in Memory.rooms) {
            // Keep memory for rooms we own or have visibility of
            if (Game.rooms[roomName]) continue;
            
            // For rooms we can't see, keep minimal data and clean up the rest
            if (Memory.rooms[roomName]) {
                // Keep essential data like sources, but clean up temporary data
                if (Memory.rooms[roomName].spawning) {
                    Memory.rooms[roomName].spawning.nextSpawnRole = null;
                }
            }
        }
    },

        
    //Initialize Memory
    memInit: function() {
        // Initialize global memory structures
        if (!Memory.rooms) Memory.rooms = {};
        
        // Initialize path cache
        if (!Memory.pathCache) Memory.pathCache = {};
        
        // Initialize cost matrices
        if (!Memory.costMatrices) Memory.costMatrices = {};

        // Conquest - Attack, Claim, Scout targets
        if (!Memory.conquest) {
            Memory.conquest = {
                claimRooms: {},
                targetRooms: {},
                scoutedRooms: {},
                roomClaimsAvailable: 0,
            };
        }

        // Market Data
        if (!Memory.marketData) {
            Memory.marketData = {
                PL: {lastCredits: 0, PL: 0},
                marketSummary: {soldQuantities: {}, purchasedQuantities: {}},
                resources: {},
            };

            // Populate all resources
            RESOURCES_ALL.forEach(resource => {
                Memory.marketData.resources[resource] = {
                    avgPrice: 0,
                    costBasis: 0,
                    averagePrices: [],
                    orders: {},
                    lastUpdate: Game.time
                };
            });
        }
        
        // Initialize room memory for each visible room
        Object.keys(Game.rooms).forEach(roomName => {
            const room = Game.rooms[roomName];
            if (!room) return;
            
            // Skip rooms without controllers or that we don't own
            if (!room.controller) return;

            // Initialize room memory object if it doesn't exist
            if (!Memory.rooms[roomName]) {
                Memory.rooms[roomName] = {
                    phase: {Phase: 1, RCL: room.controller.level},
                    underAttack: false,
                    scoutingComplete: false,
                    signed: false,
                    spawning: {
                        nextSpawnRole: null,
                        spawnMode: {mode: null, energyToUse: 0},
                        desiredCounts: {} 
                    },
                    construct: {
                        extensionRadius: 0,
                        structureCount: {
                            extensions: {built: 0, pending: 0},
                            containers: {built: 0, pending: 0},
                            storage: {built: 0, pending: 0},
                            extractor: {built: 0, pending: 0},
                            links: {built: 0, pending: 0},
                            terminal: {built: 0, pending: 0},
                            towers: {built: 0, pending: 0},
                        },
                        weightedCenter: {x: 0, y: 0}
                    },
                    mapping: {
                        sources: {},
                        terrainData: {},
                        costMatrix: {}
                    }
                };
            }

            // Ensure all required memory structures exist
            const roomMem = Memory.rooms[roomName];
            
            // Initialize sources data if missing
            if (!roomMem.mapping.sources || !roomMem.mapping.sources.id) {
                const sources = room.find(FIND_SOURCES);
                roomMem.mapping.sources = {
                    count: sources.length,
                    id: sources.map(source => source.id)
                };
            }

            // Initialize terrain data if missing
            if (!roomMem.mapping.terrainData) {
                this.updateRoomTerrainData(room);
            }

            // Initialize weighted center if missing
            if (!roomMem.construct.weightedCenter) {
                this.findCenterWeighted(room);
            }
            
            // Ensure structure counts are initialized
            if (!roomMem.construct.structureCount) {
                roomMem.construct.structureCount = {
                    extensions: {built: 0, pending: 0},
                    containers: {built: 0, pending: 0},
                    storage: {built: 0, pending: 0},
                    extractor: {built: 0, pending: 0},
                    links: {built: 0, pending: 0},
                    terminal: {built: 0, pending: 0},
                    towers: {built: 0, pending: 0},
                };
            }
        });
    },
    

    
    shortTerm: function() {
        // Refresh Construction Energy Reqs / Room Phase
        Object.values(Game.rooms).forEach(room => {
            console.log(`Checking ${room.name}`);
            console.log('Checking phase...');
            this.updateRoomPhase(room);
        });
        
    },
        
    
    
    longTerm: function() {
        
        // Update cost matrices for all rooms
        console.log('Updating cost matrices for all rooms...');
        this.updateRoomTerrainData();
        
    },
    


    updateRoomPhase: function(room) {
        if (!room || !room.controller) return;
        
        // Update the current RCL in memory
        const rcl = room.controller.level;
        const roomMemory = Memory.rooms[room.name];
        
        if (!roomMemory || !roomMemory.phase) return;
        
        // Store previous phase for transition detection
        const previousPhase = roomMemory.phase.Phase;
        
        // Update RCL in memory
        roomMemory.phase.RCL = rcl;
        
        // Update phase based on RCL and structure requirements
        const structureCount = roomMemory.construct.structureCount;
        const containersBuilt = structureCount.containers.built;
        const storageBuilt = structureCount.storage.built;
        const extractorBuilt = structureCount.extractor.built;
        const linksBuilt = structureCount.links.built;
        const terminalBuilt = structureCount.terminal.built;
        const towersBuilt = structureCount.towers.built;
        
        let newPhase = rcl; // Default to RCL as phase
        let transitioned = false;
        
        // Phase transition logic with proper comparison operators
        switch (previousPhase) {
            case 1:
                // Phase 1 to Phase 2 transition: RCL reaches 2
                if (rcl >= 2) {
                    newPhase = 2;
                    transitioned = (previousPhase !== newPhase);
                }
                break;
            case 2:
                // Phase 2 to Phase 3 transition: RCL reaches 3
                if (rcl >= 3) {
                    newPhase = 3;
                    transitioned = (previousPhase !== newPhase);
                }
                break;
            case 3:
                // Phase 3 to Phase 4 transition: RCL reaches 4
                if (rcl >= 4) {
                    newPhase = 4;
                    transitioned = (previousPhase !== newPhase);
                }
                break;
            case 4:
                // Phase 4 to Phase 5 transition: RCL reaches 5
                if (rcl >= 5) {
                    newPhase = 5;
                    transitioned = (previousPhase !== newPhase);
                }
                break;
            case 5:
                if (rcl >= 6) {
                    newPhase = 6;
                    transitioned = (previousPhase !== newPhase);
                }
                break;
            case 6:
                if (rcl >= 7) {
                    newPhase = 7;
                    transitioned = (previousPhase !== newPhase);
                }
                break;
            case 7:
                if (rcl >= 8) {
                    newPhase = 8;
                    transitioned = (previousPhase !== newPhase);
                }
                break;
            default:
                newPhase = rcl;
                break;
        }
        
        // Update phase in memory
        roomMemory.phase.Phase = newPhase;
        
        // Log phase transition and perform actions
        if (transitioned) {
            console.log(`Room ${room.name} has advanced to Phase ${newPhase}.`);
            this.handlePhaseTransitionActions(room, newPhase);
        }
    },
    
    handlePhaseTransitionActions: function(room, newPhase) {
        if (!room) return;
        
        console.log(`Performing transition actions for Room ${room.name} to Phase ${newPhase}.`);
        
        // Phase-specific actions
        switch (newPhase) {
            case 2:
                // Phase 2 actions - focus on extensions and containers
                break;
            case 3:
                // Phase 3 actions - focus on tower placement
                break;
            case 4:
                // Phase 4 actions - focus on storage
                break;
            case 5:
                // Phase 5 actions - links
                break;
            case 6:
                // Phase 6 actions - terminal and extractor
                break;
            case 7:
                // Phase 7 actions - more advanced structures
                break;
            case 8:
                // Phase 8 actions - end game structures
                break;
        }
    },
        

// MAPPING METHODS
//

    //Weighted Center - Find central location based on Controller, Spawn, and Sources
    findCenterWeighted: function(room) {

        if (!Memory.rooms[room.name].construct.weightedCenter) {
            Memory.rooms[room.name].construct.weightedCenter = {x: 0, y: 0}
        }

        const weightedCenter = Memory.rooms[room.name].construct.weightedCenter;

        // Find structures to set weighted center
        const spawns = room.find(FIND_MY_SPAWNS);
        const controller = room.controller;
        const sources = room.find(FIND_SOURCES);

        // Calculate weighted center
        let sumX = 0, sumY = 0, count = 0;
        spawns.forEach(s => { sumX += s.pos.x; sumY += s.pos.y; count++; });
        if (controller) { sumX += controller.pos.x; sumY += controller.pos.y; count++; }
        sources.forEach(s => { sumX += s.pos.x; sumY += s.pos.y; count++; });
        
        if (count > 0) {
            const weightedCenterX = Math.floor(sumX / count);
            const weightedCenterY = Math.floor(sumY / count);
            console.log(`Weighted Center: (${weightedCenterX}, ${weightedCenterY})`);
            weightedCenter.x = weightedCenterX;
            weightedCenter.y = weightedCenterY;
        }
    },
    
    updateRoomTerrainData: function(room) {
        console.log('Calling UpTerr..');
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            // Check if we already have the terrain data stored

            if (!Memory.rooms[room.name].mapping.terrainData) {
                console.log('Generating Terrain data...');
                
                // If not, retrieve and store it
                const terrain = room.getTerrain();
                Memory.rooms[roomName].mapping.terrainData = Memory.rooms[roomName].mapping.terrainData || {};
                Memory.rooms[roomName].mapping.terrainData = [];
                for (let y = 0; y < 50; y++) {
                    for (let x = 0; x < 50; x++) {
                        const terrainType = terrain.get(x, y);
                        // Store terrain type; 0: plain, 1: wall, 2: swamp
                        Memory.rooms[roomName].mapping.terrainData.push(terrainType);
                    }
                }
                console.log(`Terrain data cached for room: ${roomName}`);
                
            }
            this.cacheRoomCostMatrix(roomName);
        }
    },

    cacheRoomCostMatrix: function(roomName) {
        if (!Memory.rooms[roomName] || !Memory.rooms[roomName].mapping || !Memory.rooms[roomName].mapping.terrainData) {
            console.log('Terrain data for room not found:', roomName);
            return;
        }
    
        var terrain = Memory.rooms[roomName].mapping.terrainData;
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
    
        Memory.rooms[roomName].mapping.costMatrix = costMatrix.serialize();
    },

    

    // Manage memory governing spawn behavior
    spawnMode: function(room, nextRole) {
        const roomMemory = Memory.rooms[room.name];
        const phase = roomMemory.phase.Phase;
        const energyCapacity = room.energyCapacityAvailable;
        const energyAvailable = room.energyAvailable;
        const energySources = roomMemory.mapping.sources.count;

        if (nextRole === null) {
            roomMemory.spawning.spawnMode = { mode: 'Null', energyToUse: 0 };
            return;
        }

        const totalCreeps = _.filter(Game.creeps, (creep) => creep.room.name === room.name).length;
        if (totalCreeps <= 5) {
            roomMemory.spawning.spawnMode = { mode: 'EmPower', energyToUse: energyAvailable };
            return;
        }

        /*if (roomMemory.underAttack) {
            roomMemory.spawning.spawnMode = { mode: 'Defense', energyToUse: energyAvailable };
            return;
        }*/

        const setSpawnMode = (mode, energy) => {
            roomMemory.spawning.spawnMode = { mode, energyToUse: energy };
        };

        const phaseConfigs = {
            1: { energyCap: 300, harvester: energyAvailable, harvesterLite: energyAvailable, cap: 1 },
            2: { energyCap: 550, harvester: 500, harvesterLite: energyAvailable, cap: 1 },
            3: { energyCap: 800, harvester: 600, harvesterLite: 500, claimer: 700, cap: 0.7 },
            4: { energyCap: 1300, harvester: 600, claimer: 700, cap: 0.55 },
            5: { energyCap: 1800, harvester: 600, claimer: 700, cap: 0.45 },
            6: { energyCap: 2300, harvester: 650, claimer: 700, cap: 0.35 },
            7: { energyCap: 5600, harvester: 700, claimer: 700, cap: 0.25 },
            default: { energyCap: 12900, harvester: 700, claimer: 700, cap: 0.15 }
        };

        const config = phaseConfigs[phase] || phaseConfigs.default;

        if (nextRole === 'harvester') {
            setSpawnMode('Harvester', config.harvester);
        } else if (nextRole === 'claimer') {
            setSpawnMode('Claimer', config.claimer || 700);
        } else {
            setSpawnMode(`${config.cap}`, energyCapacity * config.cap);
        }
    }   
    
};

module.exports = memories;