        /*
        PHASE STRUCTURE:

        Phase 1 (RCL 1)
        SPAWN
        X Base Worker Blueprint: [W,C,M]
        X Population Based Spawns: Hrv(20%) Hal(20%) Bld(30%) Upg(30%)
        MEMORY
        - Energy To Use: 100%
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
        - Energy To Use Splits Roles: Harvester (500) Other (80%)
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
        - Energy To Use: Harvester (600) Other (75%)
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


        var roleHarvester = require('role.harvester');
        var roleUpgrader = require('role.upgrader');
        var roleBuilder = require('role.builder');
        var roleHauler = require('role.hauler');
        var roleAttacker = require('role.attacker');
        var roleHealer = require('role.healer');
        //var roleClaimer = require('role.claimer');
        //var roleScout = require('role.scout');
        var spawner = require('a.spawn');
        var movement = require('a.movement');
        
        var memories = {
            
            immediateMemory: function(room) {
                
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
            },
                
            //Initialize Memory
            memInit: function() {
        
                for (const roomName in Game.rooms) {
                    const room = Game.rooms[roomName];
                
                    if (!Memory.rooms[room.name]) {
                        Memory.rooms[room.name] = {}
                    }



                    if (!Memory.rooms[room.name].phase) {
                        this.updateRoomPhase(room);
                    }
        
                    if (!Memory.rooms[room.name].spawnClock) {
                        Memory.rooms[room.name].spawnClock = {
                            lastSpawnInterval: 0,
                            averageInterval: 0,
                            intervalDifference: 0,
                            ticksSinceLastSpawn: 0
                        };
                    }

                    //Clocking
                    Memory.rooms[room.name].spawnClock.ticksSinceLastSpawn++;
        

                    

                    
                    Object.values(Game.rooms).forEach(room => {
                        if (!Memory.rooms) Memory.rooms = {};
                        if (!Memory.rooms[room.name]) Memory.rooms[room.name] = {};
                

                        if (!Memory.rooms[room.name].claimedDrops) {
                            Memory.rooms[room.name].claimedDrops = {};
                        }

                        if (!Memory.rooms[room.name].pathCache) {
                            Memory.rooms[room.name].pathCache = {};
                        }

                        if (!Memory.rooms[room.name].nextSpawnRole) {
                            Memory.rooms[room.name].nextSpawnRole = null;
                        }
        
                        const hostiles = room.find(FIND_HOSTILE_CREEPS).length;
                        Memory.rooms[room.name].underAttack = hostiles > 0;

                        if (typeof Memory.rooms[room.name].spawnMode !== 'object' || Memory.rooms[room.name].spawnMode === null) {
                            Memory.rooms[room.name].spawnMode = { mode: null, energyToUse: 0 };
                        }
                    });
                
                }
        
                
            },
            
            // Manage memory object that governs spawn behavior
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
                            } else if (nextRole === 'harvester' && energyAvailable >= 600) {
                                Memory.rooms[room.name].spawnMode.mode = 'Harvester';
                                Memory.rooms[room.name].spawnMode.energyToUse = 600;
                                return;
                            } else if (nextRole === 'harvester' && energyAvailable < 600) {
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
                                Memory.rooms[room.name].spawnMode.mode = 'Cap(90%)';
                                Memory.rooms[room.name].spawnMode.energyToUse = energyCapacity * .9; 
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
                                Memory.rooms[room.name].spawnMode.mode = 'Cap(75%)';
                                Memory.rooms[room.name].spawnMode.energyToUse = energyCapacity * .75;
                            }
                            break;

                        default:
                            if (Memory.rooms && Memory.rooms[roomName] && Memory.rooms[roomName].underAttack) {
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
                                Memory.rooms[room.name].spawnMode.energyToUse = energyCapacity * .75; // Let spawn manager handle
                            }                        
                            break;            

                    }
                }
                
            },   
        
            
            shortTerm: function() {
        
            
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
                
                //Reset spawnClock average
                console.log('AVG Interval Reset');
                Memory.rooms[room.name].spawnTicks = [];
            },
          
        
        
            updateRoomPhase: function(room) {
                // Ensure the phase object exists for the room
                if (!Memory.rooms[room.name].phase) {
                    Memory.rooms[room.name].phase = { Phase: 1, RCL: room.controller.level };
                }
            
                // Update the current RCL in memory (useful for tracking progress and phase changes)
                Memory.rooms[room.name].phase.RCL = room.controller.level;
            
                const containersBuilt = room.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_CONTAINER }}).length;
                const towersBuilt = room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER }}).length;
                const storageBuilt = room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_STORAGE }}).length;

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
                        cacheRoomCostMatrix(roomName);
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