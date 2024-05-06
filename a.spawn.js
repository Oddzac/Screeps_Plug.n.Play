//TODO
// Logic to periodically spawn scouts to track changes (possibly in main instead?)
// If phase > 7 && Spawn1 busy, try Spawn2
var memories = require('a.memories');

var spawner = {

    

// Phase-based spawning counts
calculateDesiredCounts: function(room) {
    const phase = Memory.rooms[room.name].phase.Phase;
    const totalHostiles = room.find(FIND_HOSTILE_CREEPS).length;
    const linksBuilt = Memory.rooms[room.name].linksBuilt;
    const extractorBuilt = Memory.rooms[room.name].extractorBuilt;
    const terminalBuilt = Memory.rooms[room.name].terminalBuilt;
    const scouted = Memory.rooms[room.name].scoutingComplete;
    const roomClaimsAvailable = Memory.roomClaimsAvailable;
    const claimers = _.filter(Game.creeps, (creep) => creep.name.startsWith(room.name + "_claimer")).length;
    const scouts = _.filter(Game.creeps, (creep) => creep.name.startsWith(room.name + "_scout")).length;
    let desiredCounts = {};


    // Check the number of energy sources in the room
    const energySources = room.find(FIND_SOURCES).length;

        // Adjust desired counts if there is only one energy source
        if (energySources === 1) {
            return {
                harvester: 2,
                hauler: 4,
                builder: 1,
                upgrader: 1
            };
        }

        /*if (Memory.rooms[room.name].underAttack) {
    
            const healersNeeded = Math.ceil(totalHostiles / 2); // 1 healer for every hostile
            const attackersNeeded = totalHostiles * 2; // 2 attackers for every hostile
    
            return {
                attacker: attackersNeeded,
                healer: healersNeeded,

                harvester: 2, // Minimal sustaining number during an attack
                hauler: 2, // Minimal sustaining number
            };

        } else if (scouted === false && scouts < 1) {
            //Begin Scouting
            return {
                scout: 1,
            };
        } else if (scouted === true && roomClaimsAvailable > 0 && claimers < 1 && phase > 3) {                         
            // Scouting Complete & Can Claim
            desiredCounts = {
                claimer: 1
            };

        } else {*/

            switch (phase) {
                case 1:
                    // Phase 1
                    desiredCounts = {
                        harvester: 2,
                        hauler: 3,
                        upgrader: 1,
                        builder: 4,
                        
                    };
                    break;
                case 2:
                    // Phase 2
                    desiredCounts = {
                        harvester: 2,
                        hauler: 3,
                        upgrader: 2,
                        builder: 3,
                        
                    };
                    break;
                case 3:
                    // Phase 3
                    desiredCounts = {
                        harvester: 2, 
                        hauler: 4,
                        upgrader: 2,
                        builder: 3,
                        
                    };
                    break;
                case 4:
                    
                    desiredCounts = {
                        harvester: 2,
                        hauler: 5,
                        upgrader: 2,
                        builder: 3,
                        
                    };
                    break;

                case 5:
                
                    desiredCounts = {
                        harvester: 2,
                        hauler: 5,
                        upgrader: 1,
                        builder: 3,
                        
                    };
                
                    break;

                case 6:
                    
                    if (extractorBuilt > 0 && terminalBuilt < 1) {
                        desiredCounts = {
                            harvester: 3,
                            hauler: 3,
                            upgrader: 1,
                            builder: 2,
                            
                        };
                    } else if (extractorBuilt > 0 && terminalBuilt > 0) {
                        desiredCounts = {
                            harvester: 3,
                            hauler: 4,
                            upgrader: 1,
                            builder: 3,
                            
                        };

                    } else {
                        desiredCounts = {
                            harvester: 2,
                            hauler: 3,
                            upgrader: 1,
                            builder: 3,
                            
                        };

                    }
                    break;

                 case 7:
                    
                    if (extractorBuilt > 0 && terminalBuilt > 0) {
                        desiredCounts = {
                            harvester: 3,
                            hauler: 5,
                            upgrader: 1,
                            builder: 2,
                            
                        };

                    } else {
                        desiredCounts = {
                            harvester: 2,
                            hauler: 4,
                            upgrader: 1,
                            builder: 3,
                            
                        };

                    }
                    break;
                // More as needed
                default:
                    desiredCounts = {
                        harvester: 3,
                        hauler: 5,
                        upgrader: 1,
                        builder: 2,
                        
                    };
                    break;
            }
        }
        //console.log(`${totalEnergyRequired}`);
        //console.log(`${JSON.stringify(desiredCounts)}`);
        Memory.rooms[room.name].desiredCounts = desiredCounts;
        return desiredCounts;
        
    },
    


    manageCreepSpawning: function(room) {
        const energyAvailable = room.energyAvailable;
        const phase = Memory.rooms[room.name].phase.Phase;
        
        //console.log('MCS Called');
        
    
        const desiredCounts = this.calculateDesiredCounts(room);
        const currentCounts = _.countBy(_.filter(Game.creeps, (creep) => creep.memory.home === room.name), (creep) => creep.memory.role);
        
    
        let nextSpawnRole = null;
    
        // Determine which role is most in need of spawning
        for (const [role, desiredCount] of Object.entries(desiredCounts)) {
            const currentCount = currentCounts[role] || 0;
            const difference = desiredCount - currentCount;
            if (difference > 0) {
                nextSpawnRole = role; // Store the role to spawn next
                break; // Found a role to spawn, exit the loop
            }
        }
        // Broadcast planned spawn
        Memory.rooms[room.name].nextSpawnRole = nextSpawnRole;

        memories.spawnMode(room, nextSpawnRole);

        // Determine spawn mode and adjust energyToUse based on this mode
        let energyToUse = Memory.rooms[room.name].spawnMode.energyToUse;
    
        // Check if the available energy meets the requirement for the current spawn mode
        if (energyAvailable < energyToUse) {
            //console.log("[manageCreepSpawning] Waiting for more energy.");
            return;
        }
        
        if (nextSpawnRole) {
           //console.log(`${room} MS: ${nextSpawnRole}, EA ${energyAvailable}, E2U ${energyToUse}, Phase ${phase}`)
            this.spawnCreepWithRole(nextSpawnRole, energyToUse, phase, room);
        } else {
            //console.log("[manageCreepSpawning] Population Acceptable.");
        }
    }, 
    
    // Handles spawning after need and energy are determined.
    spawnCreepWithRole: function(role, energyToUse, phase, room) {
       //console.log(`[spawnCreepWithRole] ${room} Attempting to spawn: ${role} with ${energyToUse} energy`);
        
        const body = this.getBodyPartsForRole(role, energyToUse, phase);
    
        if (!body) {
            // Log or handle the situation when not enough energy is available
           //console.log(`[spawnCreepWithRole] ${room} Waiting for more energy to spawn ${role}.`);
            return; // Exit the function early
        }
        
        const name = `${room}_${role}_${Game.time}`;
       
        // Find spawns in the specified room
        const spawns = Game.rooms[room.name].find(FIND_MY_SPAWNS);
        const mainSpawn = spawns[0];
        const backupSpawn = spawns[1];


        const spawnResult = mainSpawn.spawnCreep(body, name, {
            memory: { role: role, working: false }
        });

        if (spawnResult == ERR_BUSY) {
            const secondSpawnResult = backupSpawn.spawnCreep(body, name, {
                memory: { role: role, working: false }
            });

            if (secondSpawnResult == OK) {
                // Logging the successful spawn with current counts
                
                const creepsInRoom = _.filter(Game.creeps, (creep) => creep.room.name === room.name);
                const upgraders = 
                _.filter(Game.creeps, (creep) => creep.room.name === room.name && creep.memory.role === 'upgrader').length;
                const harvesters = _.filter(Game.creeps, (creep) => creep.room.name === room.name && creep.memory.role === 'harvester').length;
                const builders =  _.filter(Game.creeps, (creep) => creep.room.name === room.name && creep.memory.role === 'builder').length;
                const haulers = _.filter(Game.creeps, (creep) => creep.room.name === room.name && creep.memory.role === 'hauler').length;
                const totalCreeps = Object.keys(Game.creeps).length;
                // Count the body parts and prepare output format
                const counts = _.countBy(body); // Count each type of body part
                const formattedParts = Object.entries(counts)
                    .map(([part, count]) => `"${part}": ${count}`)
                    .join(", ");

                console.log(`Room: ${room.name} Total: ${creepsInRoom.length}`);
                console.log(`[spawnCreepWithRole] Spawned ${role} with ${formattedParts}`);
                console.log(`[spawnCreepWithRole] Current Worker Counts - Hv: ${harvesters}, Hl: ${haulers}, B: ${builders}, U: ${upgraders}`);
                
            } else {
                return;
            }
        } else if (spawnResult == OK) {
            // Logging the successful spawn with current counts
            
            const creepsInRoom = _.filter(Game.creeps, (creep) => creep.room.name === room.name);
            const upgraders = 
            _.filter(Game.creeps, (creep) => creep.room.name === room.name && creep.memory.role === 'upgrader').length;
            const harvesters = _.filter(Game.creeps, (creep) => creep.room.name === room.name && creep.memory.role === 'harvester').length;
            const builders =  _.filter(Game.creeps, (creep) => creep.room.name === room.name && creep.memory.role === 'builder').length;
            const haulers = _.filter(Game.creeps, (creep) => creep.room.name === room.name && creep.memory.role === 'hauler').length;
            const totalCreeps = Object.keys(Game.creeps).length;
            // Count the body parts and prepare output format
            const counts = _.countBy(body); // Count each type of body part
            const formattedParts = Object.entries(counts)
                .map(([part, count]) => `"${part}": ${count}`)
                .join(", ");

            console.log(`Room: ${room.name} Total: ${creepsInRoom.length}`);
            console.log(`[spawnCreepWithRole] Spawned ${role} with ${formattedParts}`);
            console.log(`[spawnCreepWithRole] Current Worker Counts - Hv: ${harvesters}, Hl: ${haulers}, B: ${builders}, U: ${upgraders}`);
            
            
        } else {
            
            console.log(`[spawnCreepWithRole] Failed to spawn ${role}: ${name}, Error: ${spawnResult}`);
        }
    },
    
    getBodyPartsForRole: function(role, energyToUse, phase) {
        const partsCost = BODYPART_COST;
        let roleBlueprints;
    
        // Adjust blueprint based on the phase
        switch (phase) {
            case 1:
                roleBlueprints = {
                    harvester: ["work", "carry", "carry", "move"], // Basic setup for early game
                    upgrader: ["work", "move", "carry"],
                    builder: ["work", "move", "carry"],
                    hauler: ["carry", "move", "move"],
                    //Defensive Units
                    attacker: ["tough", "move", "move", "ranged_attack"],
                    healer: ["move","heal"],
                    //Recon
                    scout: ["move"],
                    claimer: ["claim", "move", "work"],
                };
                break;
            case 2:
                if (energyToUse >= 500) {
                    roleBlueprints = {
                        harvester: ["work", "work", "work", "work", "carry", "move"], // More efficient harvesting
                        upgrader: ["work", "move", "carry"],
                        builder: ["work", "move", "carry"],
                        hauler: ["carry", "move", "move"],
                        //Defensive Units
                        attacker: ["tough", "move", "move", "ranged_attack"],
                        healer: ["move","heal"],
                        //Recon
                        scout: ["move"],
                        claimer: ["claim", "move", "work"],
                    }
                } else {
                    roleBlueprints = {
                        harvester: ["work", "carry", "move"], // Basic setup for early game
                        upgrader: ["work", "move", "carry"],
                        builder: ["work", "move", "carry"],
                        hauler: ["carry", "move", "move"],
                        //Defensive Units
                        attacker: ["tough", "move", "move", "ranged_attack"],
                        healer: ["move","heal"],
                        //Recon
                        scout: ["move"],
                        claimer: ["claim", "move", "work"],
                    };
                }
                break;
            case 3:
                
                if (energyToUse >= 600) {
                    
                    roleBlueprints = {
                        harvester: ["work", "work", "work", "work", "work", "carry", "move"], // MAX HARVEST
                        upgrader: ["work", "move", "move", "carry"],
                        builder: ["work", "move", "move", "carry"],
                        hauler: ["carry", "move", "move"],
                        //Defensive Units
                        attacker: ["tough", "move", "move", "ranged_attack"],
                        healer: ["move","heal"],
                        //Recon
                        scout: ["move"],
                        claimer: ["claim", "move", "work"],
                    };
                    
                } else {
                    roleBlueprints = {
                        harvester: ["work", "carry", "move"], // Basic setup for early game
                        upgrader: ["work", "move", "carry"],
                        builder: ["work", "move", "carry"],
                        hauler: ["carry", "move", "move"],
                        //Defensive Units
                        attacker: ["tough", "move", "move", "ranged_attack"],
                        healer: ["move","heal"],
                        //Recon
                        scout: ["move"],
                        claimer: ["claim", "move", "work"],
                    };
                }
                break;

            case 6:
                roleBlueprints = {
                    harvester: ["work", "work", "work", "work", "work", "carry", "move", "move"], 
                    upgrader: ["work", "move", "carry"],
                    builder: ["work", "move", "carry"],
                    hauler: ["carry", "move", "move"],
                    //Defensive Units
                    attacker: ["tough", "move", "move", "ranged_attack"],
                    healer: ["move","heal"],
                    //Recon
                    scout: ["move"],
                    claimer: ["claim", "move", "work"],
                };
                break;

            case 7:
                roleBlueprints = {
                    harvester: ["work", "work", "work", "work", "work", "carry", "move", "move", "move"], 
                    upgrader: ["work", "move", "carry"],
                    builder: ["work", "move", "carry"],
                    hauler: ["carry", "move", "move"],
                    //Defensive Units
                    attacker: ["tough", "move", "move", "ranged_attack"],
                    healer: ["move","heal"],
                    //Recon
                    scout: ["move"],
                    claimer: ["claim", "move", "work"],
                };
                break;

            // Additional phases handled by default
            default:
                roleBlueprints = {
                    harvester: ["work", "work", "work", "work", "work", "carry", "move"], // MAX HARVEST
                    upgrader: ["work", "move", "move", "carry"],
                    builder: ["work", "move", "move", "carry"],
                    hauler: ["carry", "move"],
                    //Defensive Units
                    attacker: ["tough", "move", "move", "ranged_attack"],
                    healer: ["move","heal"],
                    //Recon
                    scout: ["move"],
                    claimer: ["claim", "move", "work"],
                };
                break;
        }
    
        let body = [];
        let energyUsed = 0;
    
        // Calculate the energy cost for the base blueprint
        const baseCost = roleBlueprints[role].reduce((total, part) => total + partsCost[part], 0);
       //console.log(`${role} :: ${baseCost}`);
    
        if (energyToUse < baseCost) {
           //console.log(`Insufficient energy to spawn a viable ${role}. Required: ${baseCost}, Available: ${energyToUse}`);
            return null; // Not enough energy for even a base blueprint
        }

        // Build the base blueprint
        roleBlueprints[role].forEach(part => {
            if (energyUsed + partsCost[part] <= energyToUse) {
                body.push(part);
                energyUsed += partsCost[part];
            }
        });

        // Function to add parts in a balanced manner
        const addPartsBalanced = () => {
            const blueprint = roleBlueprints[role];
            let added = false;
    
            for (let i = 0; i < blueprint.length && energyUsed < energyToUse; i++) {
                const part = blueprint[i];
                if (energyUsed + partsCost[part] <= energyToUse) {
                    body.push(part);
                    energyUsed += partsCost[part];
                    added = true;
                    // Cycle through parts in blueprint order for balance
                    i = (i + 1) % blueprint.length - 1;
                }
            }
    
            return added;
        };
    
        // Continue adding parts in a balanced way until no more can be added
        while (addPartsBalanced()) {}
    
        return body;
    },
};

module.exports = spawner;