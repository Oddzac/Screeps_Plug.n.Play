//TODO
//Phase 1 - Self harvest
//Phase 2 - Prioritize Containers
//Phase 3 - Container Withdraw Exclusively (assign?)
//Phase 4 - If Storage, Withdraw Exclusively

var movement = require('a.movement');

var utilities = {
    
    harvestEnergy: function(creep) {
        // Check for hostiles and handle avoiding them as before
        var hostiles = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 15);
        if (hostiles.length > 0 && !creep.memory.avoidingHostiles) {
            console.log(`[${creep.name}] Avoiding hostiles, re-evaluating source.`);
            creep.memory.avoidingHostiles = true;
            delete creep.memory.sourceId;
        } else if (hostiles.length === 0 && creep.memory.avoidingHostiles) {
            console.log(`[${creep.name}] No longer avoiding hostiles.`);
            creep.memory.avoidingHostiles = false;
        }
    
            

        //Structure counts (> 0 determines behavior)
        const containerCount = creep.room.find(FIND_STRUCTURES, {
            filter: (s) => (s.structureType === STRUCTURE_CONTAINER)
        }).length;
        const storageCount = creep.room.find(FIND_STRUCTURES, {
            filter: (s) => (s.structureType === STRUCTURE_STORAGE)
        }).length;
        
        // Attempt to find a container with energy
        const containersWithEnergy = creep.room.find(FIND_STRUCTURES, {
            filter: (s) => (s.structureType === STRUCTURE_CONTAINER) &&
                            s.store[RESOURCE_ENERGY] > 100 // Only withdraw if sufficient reserve
        });

        // Attempt to find storage with energy
        const storageWithEnergy = creep.room.find(FIND_STRUCTURES, {
            filter: (s) => (s.structureType === STRUCTURE_STORAGE) &&
                            s.store[RESOURCE_ENERGY] > 100 // Only withdraw if sufficient reserve
        });

        if (storageCount > 0) {
            if (storageWithEnergy.length > 0) {
                // If storage with energy is found, prioritize the closest one
                const closestStorage = creep.pos.findClosestByPath(storageWithEnergy);
                if (closestStorage) {
                    creep.memory.sourceId = closestStorage.id;
                    creep.memory.sourceType = 'storage';
                    // No need to re-select a source if one is found
                    return this.attemptEnergyWithdrawal(creep, closestStorage);
                }
            } else {
                this.waitStrategically(creep);
            }

        } else if (containerCount > 0) {
            if (containersWithEnergy.length > 0) {
                // If containers with energy are found, prioritize the closest one
                const closestContainer = creep.pos.findClosestByPath(containersWithEnergy);
                if (closestContainer) {
                    creep.memory.sourceId = closestContainer.id;
                    creep.memory.sourceType = 'container';
                    // No need to re-select a source if one is found
                    return this.attemptEnergyWithdrawal(creep, closestContainer);
                }
            } else {
                this.waitStrategically(creep);
            }
        } else {
            
            let source = creep.memory.sourceId || null;
            

            if (creep.memory.sourceId === null) {
                const source = this.chooseSource(creep);
                creep.memory.sourceId = source.id;
                
            } else {
                const source = creep.memory.sourceId;
                creep.memory.sourceType = 'source';
                
            }
            

            return- this.attemptEnergyWithdrawal(creep, source);
        }
    
        this.waitStrategically(creep);
    },
    
    attemptEnergyWithdrawal: function(creep, target) {
        let actionResult;
        if (creep.memory.sourceType === 'source') {
            actionResult = creep.harvest(target);
            creep.say('⛏️');
        } else { // This includes 'container' and any other 'structure' types
            actionResult = creep.withdraw(target, RESOURCE_ENERGY);
            creep.say('✨');
        }
        
        if (actionResult === ERR_NOT_IN_RANGE) {
            movement.moveToWithCache(creep, target);
        } else if (actionResult !== OK) {
            delete creep.memory.sourceId;
            delete creep.memory.sourceType;
        }
    },

    waitStrategically: function(creep) {
        let waitNear = _.find(Game.flags, (flag) => flag.name === "WaitFlag");
        if (waitNear) {
            movement.moveToWithCache(creep, waitNear);
            creep.say('⌛');
        }
    },

    
    chooseSource: function(creep) {
        const sources = creep.room.find(FIND_SOURCES);
        let bestScore = -Infinity; // Initialize with a very low score
        let bestSource = null;
    
        sources.forEach(source => {
            // Check for hostiles within 10 tiles of the source
            const hostilesNearSource = source.pos.findInRange(FIND_HOSTILE_CREEPS, 10);
            // Skip this source if any hostiles are found
            if (hostilesNearSource.length > 0) {
                return;
            }
    
            // Look at the terrain and structures in the area around the source
            const terrainAndStructures = creep.room.lookForAtArea(LOOK_TERRAIN,
                source.pos.y - 1, source.pos.x - 1,
                source.pos.y + 1, source.pos.x + 1, true
            ).concat(
                creep.room.lookForAtArea(LOOK_STRUCTURES,
                    source.pos.y - 1, source.pos.x - 1,
                    source.pos.y + 1, source.pos.x + 1, true
                )
            );
            
            // Calculate source available energy and convert to score
            const sourceEnergyScore = source.energy / source.energyCapacity * 5;
    
            // Calculate accessible tiles as those not being walls or having roads
            const accessibleTiles = terrainAndStructures.filter(t =>
                t.terrain !== 'wall' ||
                (t.structure && t.structure.structureType === STRUCTURE_ROAD)
            ).length;
    
            // Count creeps targeting this source
            const targetingCreeps = _.filter(Game.creeps, (c) => c.memory.sourceId === source.id).length;
    
            // Calculate the score
            const score = accessibleTiles - targetingCreeps + sourceEnergyScore;
    
            // Higher scores are better, indicating more accessibility and less competition
            if (score > bestScore) {
                bestScore = score;
                bestSource = source;
            }
        });
    
        if (bestSource) {
            return bestSource;
        }
    
        // Fallback to any source if no best source found
        return sources[0];
    },
    
};

module.exports = utilities;
