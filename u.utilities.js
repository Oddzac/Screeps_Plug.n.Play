//TODO
//Phase 1 - Self harvest
//Phase 2 - Prioritize Containers
//Phase 3 - Container Withdraw Exclusively (assign?)
//Phase 4 - If Storage, Withdraw Exclusively

var movement = require('./u.movement');

var utilities = {
    
    harvestEnergy: function(creep) {
        if (!creep || !creep.room) return;
        
        // Check for hostiles and handle avoiding them
        const hostiles = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 15);
        if (hostiles.length > 0 && !creep.memory.avoidingHostiles) {
            creep.memory.avoidingHostiles = true;
            delete creep.memory.sourceId;
        } else if (hostiles.length === 0 && creep.memory.avoidingHostiles) {
            creep.memory.avoidingHostiles = false;
        }
        
        // Check if room memory exists
        if (!Memory.rooms[creep.room.name] || 
            !Memory.rooms[creep.room.name].construct || 
            !Memory.rooms[creep.room.name].construct.structureCount) {
            return this.directHarvest(creep);
        }
        
        const structureCount = Memory.rooms[creep.room.name].construct.structureCount;
        const storage = creep.room.storage;
        
        // Check for storage with sufficient energy
        if (storage && storage.store && storage.store[RESOURCE_ENERGY] > 500) {
            return this.attemptEnergyWithdrawal(creep, storage);
        }
        
        // Check for containers with energy
        const containerCount = structureCount.containers ? structureCount.containers.built : 0;
        if (containerCount > 0) {
            const containersWithEnergy = creep.room.find(FIND_STRUCTURES, {
                filter: (s) => s.structureType === STRUCTURE_CONTAINER && 
                               s.store[RESOURCE_ENERGY] > 100
            });
            
            if (containersWithEnergy.length > 0) {
                const closestContainer = creep.pos.findClosestByPath(containersWithEnergy);
                if (closestContainer) {
                    creep.memory.sourceId = closestContainer.id;
                    creep.memory.sourceType = 'container';
                    return this.attemptEnergyWithdrawal(creep, closestContainer);
                }
            }
        }
        
        // Fall back to direct harvesting
        return this.directHarvest(creep);
    },
    
    directHarvest: function(creep) {
        let source;
        
        if (!creep.memory.sourceId) {
            // Choose a new source
            source = this.chooseSource(creep);
            if (!source) {
                this.waitStrategically(creep);
                return;
            }
            creep.memory.sourceId = source.id;
            creep.memory.sourceType = 'source';
        } else {
            // Use existing source
            source = Game.getObjectById(creep.memory.sourceId);
            if (!source) {
                source = this.chooseSource(creep);
                if (!source) {
                    this.waitStrategically(creep);
                    return;
                }
                creep.memory.sourceId = source.id;
            }
            creep.memory.sourceType = 'source';
        }
        
        return this.attemptEnergyWithdrawal(creep, source);
    },
    
    attemptEnergyWithdrawal: function(creep, target) {
        if (!creep || !target) return ERR_INVALID_ARGS;
        
        let actionResult;
        
        if (creep.memory.sourceType === 'source') {
            actionResult = creep.harvest(target);
            // Only say something occasionally to reduce CPU usage
            if (Game.time % 5 === 0) creep.say('⛏️');
        } else { // This includes 'container' and any other 'structure' types
            actionResult = creep.withdraw(target, RESOURCE_ENERGY);
            // Only say something occasionally to reduce CPU usage
            if (Game.time % 5 === 0) creep.say('✨');
        }
        
        switch (actionResult) {
            case OK:
                creep.memory.working = true;
                return OK;
                
            case ERR_NOT_IN_RANGE:
                movement.moveToWithCache(creep, target);
                creep.memory.working = false;
                return ERR_NOT_IN_RANGE;
                
            case ERR_NOT_ENOUGH_RESOURCES:
                // Source is empty, find a new one next time
                delete creep.memory.sourceId;
                delete creep.memory.sourceType;
                return ERR_NOT_ENOUGH_RESOURCES;
                
            case ERR_INVALID_TARGET:
                // Invalid target, clear memory
                delete creep.memory.sourceId;
                delete creep.memory.sourceType;
                return ERR_INVALID_TARGET;
                
            default:
                // For any other error, clear memory
                if (actionResult !== OK) {
                    delete creep.memory.sourceId;
                    delete creep.memory.sourceType;
                }
                return actionResult;
        }
    },

    waitStrategically: function(creep) {
        if (!creep) return;
        
        // First check for a room-specific waiting flag
        let waitNear = Game.flags[creep.room.name];
        
        // If no room flag, check for a generic waiting area
        if (!waitNear) {
            waitNear = Game.flags["WaitArea"];
        }
        
        // If still no flag, try to find a good waiting spot
        if (!waitNear) {
            // Try to wait near storage if it exists
            if (creep.room.storage) {
                movement.moveToWithCache(creep, creep.room.storage, 3);
                creep.memory.working = false;
                if (Game.time % 10 === 0) creep.say('⌛');
                return;
            }
            
            // Try to wait near spawn if it exists
            const spawns = creep.room.find(FIND_MY_SPAWNS);
            if (spawns.length > 0) {
                movement.moveToWithCache(creep, spawns[0], 3);
                creep.memory.working = false;
                if (Game.time % 10 === 0) creep.say('⌛');
                return;
            }
            
            // If no good spot found, just stay put
            creep.memory.working = false;
            if (Game.time % 10 === 0) creep.say('⌛');
            return;
        }
        
        // Move to the waiting area
        movement.moveToWithCache(creep, waitNear, 2);
        creep.memory.working = false;
        if (Game.time % 10 === 0) creep.say('⌛');
    },

    
    chooseSource: function(creep) {
        if (!creep || !creep.room) return null;
        
        // Check if room memory exists and has source data
        if (!Memory.rooms[creep.room.name] || 
            !Memory.rooms[creep.room.name].mapping || 
            !Memory.rooms[creep.room.name].mapping.sources || 
            !Memory.rooms[creep.room.name].mapping.sources.id) {
            
            // Fallback: find sources directly if memory isn't available
            const sources = creep.room.find(FIND_SOURCES);
            if (sources.length === 0) return null;
            
            // Return the first source with energy
            for (const source of sources) {
                if (source.energy > 0) return source;
            }
            return sources[0];
        }
        
        const sources = Memory.rooms[creep.room.name].mapping.sources.id;
        if (!sources || sources.length === 0) return null;
        
        let bestScore = -Infinity;
        let bestSource = null;
        
        // Cache creeps targeting each source to avoid repeated filtering
        const creepsPerSource = {};
        for (const sourceId of sources) {
            creepsPerSource[sourceId] = _.filter(Game.creeps, c => c.memory.sourceId === sourceId).length;
        }
    
        for (const sourceId of sources) {
            const source = Game.getObjectById(sourceId);
            if (!source || !source.pos) continue;
            
            // Skip sources with no energy
            if (source.energy === 0) continue;
            
            // Check for hostiles near the source
            const hostilesNearSource = source.pos.findInRange(FIND_HOSTILE_CREEPS, 10);
            if (hostilesNearSource.length > 0) continue;
            
            // Calculate score based on energy, accessibility, and competition
            const sourceEnergyScore = source.energy / source.energyCapacity * 5;
            const targetingCreeps = creepsPerSource[sourceId] || 0;
            
            // Simple distance score - closer is better
            const distanceScore = 50 - Math.min(50, creep.pos.getRangeTo(source));
            
            // Calculate final score
            const score = sourceEnergyScore + distanceScore - (targetingCreeps * 10);
            
            if (score > bestScore) {
                bestScore = score;
                bestSource = source;
            }
        }
    
        // Return best source or first available source as fallback
        if (bestSource) return bestSource;
        
        // Last resort - try to get any valid source
        for (const sourceId of sources) {
            const source = Game.getObjectById(sourceId);
            if (source) return source;
        }
        
        return null;
    },
    
};

module.exports = utilities;
