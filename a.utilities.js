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
        
        const structureCount = Memory.rooms[creep.room.name].construct.structureCount
        const storage = creep.room.storage;
        const storageEnergy = creep.room.storage.store[RESOURCE_ENERGY]
        if (!storage) {
            const containerCount = structureCount.containers.built
            // Attempt to find a container with energy
            const containersWithEnergy = creep.room.find(FIND_STRUCTURES, {
                filter: (s) => (s.structureType === STRUCTURE_CONTAINER) &&
                                s.store[RESOURCE_ENERGY] > 100 // Only withdraw if sufficient reserve
            });
        }

        // Attempt to find storage with energy
        if (storage) {
            if (storageEnergy > 500) {
                return this.attemptEnergyWithdrawal(creep, storage);
            } else {
                this.waitStrategically(creep);
            }

        } else if (containerCount > 1) {
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
            let source;
            if (!creep.memory.sourceId) {
                // If no sourceId is in memory, choose a new source
                source = this.chooseSource(creep);
                creep.memory.sourceId = source.id;
                creep.memory.sourceType = 'source';
            } else {
                // If a sourceId is already in memory, use it to get the source object
                source = Game.getObjectById(creep.memory.sourceId);
                if (!source) {
                    // If the source cannot be found (e.g., it might be depleted), choose a new one
                    source = this.chooseSource(creep);
                    creep.memory.sourceId = source.id;
                }
                creep.memory.sourceType = 'source';
            }
    
            return this.attemptEnergyWithdrawal(creep, source);
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
        let waitNear = Game.flags[creep.room.name];
        if (waitNear) {
            movement.moveToWithCache(creep, waitNear, 1);
            creep.memory.working = false;
            creep.say('⌛');
        }
    },

    
    chooseSource: function(creep) {
        const roomMem = Memory.rooms[creep.room.name];
        const sources = roomMem.mapping.sources.id;
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
