var spawner = {

    

    // Adjusted phase-based spawning method
    calculateDesiredCounts: function() {
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            const phase = Memory.rooms[room.name].phase.Phase;
            const totalCreeps = Object.keys(Game.creeps).length;
            let desiredCounts = {};
            const totalEnergyRequired = Memory.rooms[room.name].constructionEnergyRequired;

        



            if (Memory.rooms && Memory.rooms[room.name] && Memory.rooms[room.name].underAttack) {
                // Count hostiles in the specific room under attack
                totalHostiles = room.find(FIND_HOSTILE_CREEPS).length;
        
                const healersNeeded = totalHostiles; // 1 healer for every hostile
                const attackersNeeded = totalHostiles * 2; // 2 attackers for every hostile
        
                return {
                    healer: healersNeeded,
                    attacker: attackersNeeded,
                    // It might be more dynamic to adjust worker roles based on remaining capacity rather than a fixed ratio
                    harvester: 2, // Minimal sustaining number during an attack
                    hauler: 2, // Minimal sustaining number
                };

            } else {


                switch (phase) {
                case 1:
                    // Phase 1 logic
                    desiredCounts = {
                        harvester: Math.ceil(totalCreeps * .2),
                        hauler: Math.ceil(totalCreeps * .2),
                        builder: Math.ceil(totalCreeps * .3),
                        upgrader: Math.ceil(totalCreeps * .3)
                    };
                    break;
                case 2:
                    // Phase 2 logic
                    desiredCounts = {
                        harvester: 4,
                        hauler: 6,
                        builder: 4,
                        upgrader: 2
                    };
                    break;
                case 3:
                    // Phase 3 logic
                    desiredCounts = {
                        harvester: 2, // Adjusted for the full harvester blueprint
                        hauler: 6,
                        builder: Math.ceil((totalEnergyRequired / 100) * 0.002) + 1,
                        upgrader: 2
                    };
                    break;
                case 4:
                    // Phase 4 logic
                    desiredCounts = {
                        harvester: 2, // Adjusted for the full harvester blueprint
                        hauler: 6,
                        builder: 2,
                        upgrader: 1
                    };
                    break;
                // Additional phases as needed
                }
            }
        
            return desiredCounts;
        }
    },
    


    manageCreepSpawning: function() {
        const energyAvailable = Game.spawns['Spawn1'].room.energyAvailable;
        // Determine spawn mode and adjust energyToUse based on this mode
        let energyToUse = Memory.spawnMode.energyToUse;
        //console.log('MCS Called');
        
    
        const desiredCounts = this.calculateDesiredCounts();
        const currentCounts = _.countBy(Game.creeps, 'memory.role');
    
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
        Memory.nextSpawnRole = nextSpawnRole;
    
        // Check if the available energy meets the requirement for the current spawn mode
        if (energyAvailable < energyToUse) {
            //console.log("[manageCreepSpawning] Waiting for more energy.");
            return; // Exit the function early to wait for more energy
        }
        
        if (nextSpawnRole) {
            const sinceLast = Memory.spawnClock.ticksSinceLastSpawn
            console.log(`Time since last spawn: ${sinceLast}`);
            this.spawnCreepWithRole(nextSpawnRole, energyToUse);
        } else {
            //console.log("[manageCreepSpawning] Population Acceptable. Storing");
        }
    }, 
    
    // Handles spawning after need and energy are determined.
    spawnCreepWithRole: function(role, energyAvailable) {
        //console.log(`[spawnCreepWithRole] Attempting to spawn: ${role} with ${energyAvailable} energy`);
        
        const body = this.getBodyPartsForRole(role, energyAvailable);
    
        if (!body) {
            // Log or handle the situation when not enough energy is available
            //console.log(`[spawnCreepWithRole] Waiting for more energy to spawn ${role}.`);
            return; // Exit the function early
        }
        
        const name = `${role}_${Game.time}`;
       
    
        //console.log(`[spawnCreepWithRole] Spawning ${role} with body:`, JSON.stringify(body));
        const spawnResult = Game.spawns['Spawn1'].spawnCreep(body, name, {
            memory: { role: role, working: false }
        });
        if (spawnResult == OK) {
            // Logging the successful spawn with current counts
            const avgInterval = this.spawnClock();
            const upgraders = _.filter(Game.creeps, (creep) => creep.memory.role === 'upgrader').length;
            const harvesters = _.filter(Game.creeps, (creep) => creep.memory.role === 'harvester').length;
            const builders = _.filter(Game.creeps, (creep) => creep.memory.role === 'builder').length;
            const haulers = _.filter(Game.creeps, (creep) => creep.memory.role === 'hauler').length;
            const totalCreeps = Object.keys(Game.creeps).length;
            console.log(`[spawnCreepWithRole] Spawned ${role} with ${JSON.stringify(body)}`)
            console.log(`[spawnCreepWithRole] Current Worker Counts - Total: ${totalCreeps}, Hv: ${harvesters}, Hl: ${haulers}, B: ${builders}, U: ${upgraders}`);
            Memory.spawnTicks.push(Game.time);
            Memory.spawnClock.ticksSinceLastSpawn = 0;
            
            
        } else {
            
            console.log(`[spawnCreepWithRole] Failed to spawn ${role}: ${name}, Error: ${spawnResult}`);
        }
    },
    
    getBodyPartsForRole: function(role, energyAvailable) {
        const partsCost = BODYPART_COST;
        const roleBlueprints = {
            
            harvester: ["work", "work","work", "work", "work", "carry", "move"], // MAX HARVEST
            upgrader: ["work", "move", "carry"],
            builder: ["work", "move", "carry"],
            hauler: ["carry", "move", "move"],
            //Defensive Units
            attacker: ["tough", "move", "move", "ranged_attack"],
            healer: ["move","heal"],
            //
            scout: ["move"],
            claimer: ["claim", "move"],
        };
    
        let body = [];
        let energyUsed = 0;
    
        // Calculate the energy cost for the base blueprint
        const baseCost = roleBlueprints[role].reduce((total, part) => total + partsCost[part], 0);
    
        if (energyAvailable < baseCost) {
            //console.log(`Insufficient energy to spawn a viable ${role}. Required: ${baseCost}, Available: ${energyAvailable}`);
            return null; // Not enough energy for even a base blueprint
        }
    
        // Build the base blueprint
        roleBlueprints[role].forEach(part => {
            if (energyUsed + partsCost[part] <= energyAvailable) {
                body.push(part);
                energyUsed += partsCost[part];
            }
        });
    
        // Function to add parts in a balanced manner
        const addPartsBalanced = () => {
            const blueprint = roleBlueprints[role];
            let added = false;
    
            for (let i = 0; i < blueprint.length && energyUsed < energyAvailable; i++) {
                const part = blueprint[i];
                if (energyUsed + partsCost[part] <= energyAvailable) {
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
    
    spawnClock: function() {
        // Initialize Memory Object for spawnClock if not present
        if (!Memory.spawnClock) {
            Memory.spawnClock = {
                lastSpawnInterval: 0,
                averageInterval: 0,
                intervalDifference: 0,
                ticksSinceLastSpawn: 0
            };
        }
        
        if (!Memory.spawnTicks) {
            Memory.spawnTicks = [];
        }
        
        // Calculate the average spawn interval
        if (Memory.spawnTicks.length > 1) {
            let totalIntervals = 0;
            for (let i = 1; i < Memory.spawnTicks.length; i++) {
                totalIntervals += (Memory.spawnTicks[i] - Memory.spawnTicks[i - 1]);
            }
            let averageInterval = totalIntervals / (Memory.spawnTicks.length - 1);
    
            // Calculate the difference from the last stored interval
            let intervalDifference = averageInterval - Memory.spawnClock.lastSpawnInterval;
    
            // Update the spawnClock memory object
            Memory.spawnClock = {
                lastSpawnInterval: Memory.spawnClock.averageInterval, // Update lastSpawnInterval to the previous average
                averageInterval: averageInterval, // Update with the new average
                intervalDifference: intervalDifference // Store the difference
            };
    
            // Optionally, log the update for monitoring
            console.log(`Average spawn interval: ${averageInterval.toFixed(2)} ticks (Difference: ${intervalDifference.toFixed(2)} ticks)`);
            
            return averageInterval;
        } else {
            console.log('Not enough data to calculate average spawn interval.');
            return 255; // Return a high default value to indicate insufficient data
        }
    },
};

module.exports = spawner;