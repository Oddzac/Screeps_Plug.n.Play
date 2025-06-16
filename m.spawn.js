//TODO
// Logic to periodically spawn scouts to track changes (possibly in main instead?)
// If phase > 7 && Spawn1 busy, try Spawn2
var memories = require('./m.memories');

var spawner = {

    

// Phase-based spawning counts
calculateDesiredCounts: function(room) {
    if (!room || !Memory.rooms[room.name]) return {};
    
    const roomMemory = Memory.rooms[room.name];
    
    // Check if required memory structures exist
    if (!roomMemory.phase || !roomMemory.construct || !roomMemory.construct.structureCount || !roomMemory.mapping) {
        return { harvester: 1, hauler: 1, upgrader: 1, builder: 1 }; // Minimal counts if memory is incomplete
    }
    
    const phase = roomMemory.phase.Phase;
    const structureCount = roomMemory.construct.structureCount;
    const energySources = roomMemory.mapping.sources ? roomMemory.mapping.sources.count : 1;
    
    // Get structure counts
    const linksBuilt = structureCount.links ? structureCount.links.built : 0;
    const extractorBuilt = structureCount.extractor ? structureCount.extractor.built : 0;
    const terminalBuilt = structureCount.terminal ? structureCount.terminal.built : 0;
    const storageBuilt = structureCount.storage ? structureCount.storage.built : 0;
    
    // Count construction sites to adjust builder count
    const constructionSites = room.find(FIND_CONSTRUCTION_SITES).length;
    
    // Check for hostiles to adjust defense needs
    const hostiles = room.find(FIND_HOSTILE_CREEPS, {
        filter: creep => creep.owner.username !== "Source Keeper"
    }).length;
    
    // Base counts adjusted for energy sources
    const baseHarvesters = Math.min(energySources * 2, 4); // 2 per source, max 4
    const baseHaulers = Math.min(energySources * 2, 5);    // 2 per source, max 5
    
    // Default desired counts
    let desiredCounts = {
        harvester: baseHarvesters,
        hauler: baseHaulers,
        upgrader: 1,
        builder: constructionSites > 0 ? 2 : 1
    };
    
    // Add defense if needed
    if (hostiles > 0) {
        desiredCounts.attacker = Math.min(hostiles, 2);
        desiredCounts.healer = Math.ceil(hostiles / 2);
    }
    
    // Phase-specific adjustments
    switch (phase) {
        case 1: // Early game - focus on building
            desiredCounts.builder = Math.max(desiredCounts.builder, 3);
            break;
            
        case 2: // Early expansion
            desiredCounts.upgrader = 2; // More upgraders to level up faster
            break;
            
        case 3: // Mid game
            if (constructionSites > 3) {
                desiredCounts.builder = 3; // More builders if lots of construction
            }
            break;
            
        case 4: // Storage phase
            if (storageBuilt > 0) {
                desiredCounts.hauler++; // Extra hauler for storage management
            }
            break;
            
        case 5: // Link phase
            if (linksBuilt > 0) {
                desiredCounts.hauler = Math.max(2, desiredCounts.hauler - 1); // Links reduce hauler needs
            }
            break;
            
        case 6: // Terminal phase
            if (extractorBuilt > 0) {
                desiredCounts.harvester++; // Extra harvester for mineral extraction
            }
            if (terminalBuilt > 0) {
                desiredCounts.hauler++; // Extra hauler for terminal management
            }
            break;
            
        case 7:
        case 8: // Late game
            if (extractorBuilt > 0 && terminalBuilt > 0) {
                desiredCounts.harvester = Math.max(3, desiredCounts.harvester);
                desiredCounts.hauler = Math.max(4, desiredCounts.hauler);
            }
            break;
    }
    
    // Check if we need scouts or claimers
    const scouted = roomMemory.scoutingComplete;
    const roomClaimsAvailable = Memory.conquest && Memory.conquest.roomClaimsAvailable ? Memory.conquest.roomClaimsAvailable : 0;
    
    // Allow scouting at any phase - information gathering is always useful
    if (!scouted) {
        const scouts = _.filter(Game.creeps, creep => creep.memory.role === 'scout' && creep.memory.home === room.name).length;
        if (scouts < 1) {
            desiredCounts.scout = 1;
        }
    }
    
    // Only spawn claimers at phase 5+ when we have storage and are more established
    // This is a reasonable time to expand to a second room
    if (phase >= 5 && roomClaimsAvailable > 0) {
        const claimers = _.filter(Game.creeps, creep => creep.memory.role === 'claimer' && creep.memory.home === room.name).length;
        if (claimers < 1) {
            desiredCounts.claimer = 1;
        }
    }
    
    // Store the calculated counts in memory
    if (roomMemory.spawning) {
        roomMemory.spawning.desiredCounts = desiredCounts;
    }
    
    return desiredCounts;
},




    manageCreepSpawning: function(room) {
        if (!room) return;
        
        // Check if room memory exists
        if (!Memory.rooms[room.name] || !Memory.rooms[room.name].phase) {
            // Only log this error periodically to reduce console spam
            if (Game.time % 100 === 0) {
                console.log(`Missing memory for room ${room.name}`);
            }
            return;
        }
        
        const energyAvailable = room.energyAvailable;
        const energyCapacity = room.energyCapacityAvailable;
        const phase = Memory.rooms[room.name].phase.Phase;
        
        // Get construction sites count to prioritize builders when needed
        const constructionSites = room.find(FIND_CONSTRUCTION_SITES).length;
        
        // Get desired and current counts
        const desiredCounts = this.calculateDesiredCounts(room);
        
        // More efficient filtering - do it once and reuse
        const creepsInRoom = _.filter(Game.creeps, creep => 
            creep.memory.home === room.name || 
            (creep.room.name === room.name && !creep.memory.home)
        );
        
        const currentCounts = _.countBy(creepsInRoom, creep => creep.memory.role);
        
        // Check for critical shortages first
        let nextSpawnRole = null;
        let priority = -1;
        
        // Priority order: harvester > hauler > upgrader > builder > others
        const rolePriorities = {
            'harvester': 5,
            'hauler': 4,
            'upgrader': 3,
            'builder': constructionSites > 0 ? 4 : 2, // Boost builder priority if construction sites exist
            'scout': 1,
            'claimer': 1,
            'attacker': 1,
            'healer': 1
        };
        
        // Find the role with the highest priority that needs spawning
        for (const [role, desiredCount] of Object.entries(desiredCounts)) {
            const currentCount = currentCounts[role] || 0;
            const difference = desiredCount - currentCount;
            const rolePriority = rolePriorities[role] || 0;
            
            // If we need this role and it has higher priority than current selection
            if (difference > 0 && rolePriority > priority) {
                priority = rolePriority;
                nextSpawnRole = role;
            }
        }
        
        // If no role needs spawning, we're done
        if (!nextSpawnRole) return;
        
        // Update memory with next spawn role
        Memory.rooms[room.name].spawning.nextSpawnRole = nextSpawnRole;
        
        // Determine spawn mode and energy to use
        memories.spawnMode(room, nextSpawnRole);
        let energyToUse = Memory.rooms[room.name].spawning.spawnMode.energyToUse;
        
        // Emergency mode - if we have no harvesters or haulers, use whatever energy we have
        const criticalRoles = ['harvester', 'hauler'];
        const hasCriticalCreeps = criticalRoles.some(role => (currentCounts[role] || 0) > 0);
        
        if (!hasCriticalCreeps && criticalRoles.includes(nextSpawnRole)) {
            energyToUse = Math.max(energyAvailable, 300); // Use at least 300 energy or whatever we have
        }
        
        // Check if we have enough energy
        if (energyAvailable < energyToUse) {
            // Only log this periodically to reduce console spam
            if (Game.time % 50 === 0 && nextSpawnRole) {
                console.log(`Waiting for energy to spawn ${nextSpawnRole} in ${room.name} (${energyAvailable}/${energyToUse})`);
            }
            return;
        }
        
        // Spawn the creep
        this.spawnCreepWithRole(nextSpawnRole, energyToUse, phase, room);
    }, 
    
    // Handles spawning after need and energy are determined.
    spawnCreepWithRole: function(role, energyToUse, phase, room) {
        if (!role || !room || !Game.rooms[room.name]) return;
        
        // Get spawn mode from memory
        const spawnMode = Memory.rooms[room.name].spawning.spawnMode.mode;
        
        // Generate body parts based on role, energy, phase, and mode
        const body = this.getBodyPartsForRole(role, energyToUse, phase, spawnMode);
        
        // If no valid body could be generated, exit
        if (!body || body.length === 0) {
            return;
        }
        
        // Create a unique name for the creep
        const name = `${room.name}_${role}_${Game.time}`;
        
        // Find available spawns in the room
        const spawns = Game.rooms[room.name].find(FIND_MY_SPAWNS, {
            filter: spawn => !spawn.spawning
        });
        
        if (spawns.length === 0) {
            // Try to find any spawn, even if busy
            const allSpawns = Game.rooms[room.name].find(FIND_MY_SPAWNS);
            if (allSpawns.length === 0) {
                return; // No spawns in the room
            }
            
            // If all spawns are busy, just return and try again next tick
            return;
        }
        
        // Use the first available spawn
        const spawn = spawns[0];
        
        // Set up memory for the new creep
        const creepMemory = { 
            role: role, 
            working: false, 
            home: room.name,
            born: Game.time
        };
        
        // Spawn the creep
        const spawnResult = spawn.spawnCreep(body, name, {
            memory: creepMemory
        });
        
        // Handle the spawn result
        if (spawnResult === OK) {
            // Log spawn success with minimal output
            const counts = _.countBy(body);
            const formattedParts = Object.entries(counts)
                .map(([part, count]) => `${part}:${count}`)
                .join(",");
            
            console.log(`Spawned ${role} in ${room.name} [${formattedParts}]`);
            
            // Only log detailed counts every 10 spawns to reduce console spam
            if (Game.time % 10 === 0) {
                const creepsInRoom = _.filter(Game.creeps, creep => 
                    creep.memory.home === room.name || 
                    (creep.room.name === room.name && !creep.memory.home)
                );
                
                const counts = _.countBy(creepsInRoom, creep => creep.memory.role);
                console.log(`Room ${room.name} creep counts: ${JSON.stringify(counts)}`);
            }
        } 
        else if (spawnResult !== ERR_BUSY) {
            // Only log errors other than "busy" and "not enough energy"
            if (spawnResult !== ERR_NOT_ENOUGH_ENERGY) {
                if (Game.time % 25 === 0) {
                    console.log(`Error spawning ${role} in ${room.name}: ${spawnResult}`);
                }
            }
        }
    },
    
    getBodyPartsForRole: function(role, energyToUse, phase, spawnMode) {
        if (!role || energyToUse <= 0) return null;
        
        const partsCost = BODYPART_COST;
        
        // Define optimal body part ratios for different roles
        const roleRatios = {
            harvester: { work: 2, carry: 1, move: 1 },  // Optimized for harvesting
            upgrader: { work: 1, carry: 1, move: 1 },   // Balanced for upgrading
            builder: { work: 1, carry: 1, move: 1 },    // Balanced for building
            hauler: { carry: 2, move: 1 },              // Optimized for carrying
            attacker: { tough: 1, attack: 2, move: 2 }, // Combat focused
            healer: { heal: 1, move: 1 },               // Healing focused
            scout: { move: 1 },                         // Just movement
            claimer: { claim: 1, move: 1 }              // Claiming focused
        };
        
        // Emergency mode - minimal viable creeps
        if (spawnMode === 'EmPower' || energyToUse < 300) {
            const emergencyBlueprints = {
                harvester: ["work", "carry", "move"],
                upgrader: ["work", "carry", "move"],
                builder: ["work", "carry", "move"],
                hauler: ["carry", "carry", "move"],
                attacker: ["attack", "move"],
                healer: ["heal", "move"],
                scout: ["move"],
                claimer: ["claim", "move"]
            };
            
            return emergencyBlueprints[role] || ["work", "carry", "move"];
        }
        
        // For normal operation, build creeps based on available energy and role
        let body = [];
        let energyRemaining = energyToUse;
        
        // Special case for claimer - just needs CLAIM and MOVE
        if (role === 'claimer') {
            if (energyRemaining >= BODYPART_COST.claim + BODYPART_COST.move) {
                return ['claim', 'move'];
            }
            return null;
        }
        
        // Special case for scout - just needs MOVE parts
        if (role === 'scout') {
            const moveParts = Math.min(Math.floor(energyRemaining / BODYPART_COST.move), 10);
            return Array(moveParts).fill('move');
        }
        
        // Get the appropriate ratio for this role
        const ratio = roleRatios[role] || { work: 1, carry: 1, move: 1 };
        
        // Calculate the cost of one "unit" of the ratio
        const unitCost = Object.entries(ratio).reduce((sum, [part, count]) => {
            return sum + (BODYPART_COST[part] * count);
        }, 0);
        
        // Calculate how many complete units we can build
        const units = Math.floor(energyRemaining / unitCost);
        
        // Build the body array based on the ratio and units
        if (units > 0) {
            for (const [part, count] of Object.entries(ratio)) {
                // Add parts according to ratio, respecting the 50 part limit
                const partsToAdd = Math.min(units * count, 50 - body.length);
                body = body.concat(Array(partsToAdd).fill(part));
                energyRemaining -= partsToAdd * BODYPART_COST[part];
            }
        }
        
        // If we have energy left, try to add more useful parts
        if (energyRemaining > 0) {
            // Prioritize parts based on role
            let priorityParts = [];
            
            switch (role) {
                case 'harvester':
                    priorityParts = ['work', 'move', 'carry'];
                    break;
                case 'hauler':
                    priorityParts = ['carry', 'move'];
                    break;
                case 'upgrader':
                case 'builder':
                    priorityParts = ['work', 'carry', 'move'];
                    break;
                case 'attacker':
                    priorityParts = ['attack', 'move', 'tough'];
                    break;
                case 'healer':
                    priorityParts = ['heal', 'move'];
                    break;
                default:
                    priorityParts = ['move', 'carry', 'work'];
            }
            
            // Add extra parts based on priority until we run out of energy or hit the part limit
            for (const part of priorityParts) {
                while (energyRemaining >= BODYPART_COST[part] && body.length < 50) {
                    body.push(part);
                    energyRemaining -= BODYPART_COST[part];
                }
            }
        }
        
        // Sort body parts to optimize performance (tough first, then non-move parts, then move parts)
        const sortedBody = [];
        
        // Add TOUGH parts first (if any)
        const toughParts = body.filter(part => part === 'tough');
        sortedBody.push(...toughParts);
        
        // Add non-MOVE and non-TOUGH parts
        const nonMoveParts = body.filter(part => part !== 'move' && part !== 'tough');
        sortedBody.push(...nonMoveParts);
        
        // Add MOVE parts last for better performance when injured
        const moveParts = body.filter(part => part === 'move');
        sortedBody.push(...moveParts);
        
        return sortedBody.length > 0 ? sortedBody : null;
    },
};

module.exports = spawner;