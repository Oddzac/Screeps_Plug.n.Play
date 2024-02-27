//TODO
// Phase 1 - Self-Transfer / Drop Energy If Haulers / Deposit Energy If Containers 
// Phase 2 - Assign Sources

var utility = require('a.utilities');
var movement = require('a.movement');

var roleHarvester = {
    run: function(creep) {
        
        if (!creep.memory.sourceId) {
            this.assignSource(creep);
        }
        const source = Game.getObjectById(creep.memory.sourceId);
        const haulers = _.countBy(_.filter(Game.creeps, (creep) => creep.room.name === room.name), (c) => c.memory.role === 'hauler').length;

        // Decision-making process for harvesting or energy management
        if (creep.store.getFreeCapacity() > 0) {
            if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                // Move towards the source if not in range.
                movement.moveToWithCache(creep, source);
                creep.say('⛏️');
            }
        } else {
            this.manageEnergy(creep, haulers);
        
        }
    },

    manageEnergy: function(creep, haulers) {
        if (haulers < 1) {
            // Transfer energy directly to the spawn or other structures
            this.transferEnergy(creep);
        } else {
            // Move towards spawn for 10 ticks then drop energy
            this.passEnergy(creep);
        }
    },
    
    assignSource: function(creep) {
        const sources = creep.room.find(FIND_SOURCES);
        const sourceCount = sources.map(source => {
            // Check for hostiles within 10 tiles of the source
            const hostilesNearSource = source.pos.findInRange(FIND_HOSTILE_CREEPS, 10);
            return {
                id: source.id,
                count: _.filter(Game.creeps, (c) => c.memory.sourceId === source.id).length,
                isSafe: hostilesNearSource.length === 0 // Only consider the source safe if no hostiles are near
            };
        }).filter(source => source.isSafe); // Filter out sources that are not safe
    
        // Sort the safe sources by the number of creeps targeting them, and pick the one with the fewest creeps
        const sortedSources = _.sortBy(sourceCount, 'count');
        if (sortedSources.length > 0) {
            creep.memory.sourceId = sortedSources[0].id; // Assign the ID of the least targeted safe source
        }
    },

    transferEnergy: function(creep) {
        var target = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType === STRUCTURE_SPAWN || 
                        structure.structureType === STRUCTURE_EXTENSION ||
                        structure.structureType === STRUCTURE_CONTAINER || 
                        structure.structureType === STRUCTURE_LINK) && 
                        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
            }
        });
        if (target && creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
            movement.moveToWithCache(creep, target);
            creep.say('📥');
        }
    },

    passEnergy: function(creep) {
        // First, check if there are containers within 20 tiles of the creep.
        var containers = creep.pos.findInRange(FIND_STRUCTURES, 10, {
            filter: { structureType: STRUCTURE_CONTAINER }
        });

        var links = creep.pos.findInRange(FIND_STRUCTURES, 10, {
            filter: { structureType: STRUCTURE_LINK }
        });

        // If there are containers available, try to deposit energy in the nearest one.
        if (links.length > 0) {
            // Find the closest link.
            var closestLink = creep.pos.findClosestByPath(links);
    
            if (closestLink && creep.transfer(closestLink, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE && closestLink.store.getFreeCapacity() > 0) {
                    movement.moveToWithCache(creep, closestLink);
                    creep.say('📦');
                }

        } else if (containers.length > 0) {
            // Find the closest container.
            var closestContainer = creep.pos.findClosestByPath(containers);
    
            if (closestContainer && creep.transfer(closestContainer, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE && closestContainer.store.getFreeCapacity() > 0) {
                    movement.moveToWithCache(creep, closestContainer);
                    creep.say('📦');
                }

        } else {
            // If no links or containers are found within range or cannot deposit for some reason, fallback to dropping energy.
            // This section might be reached if, for example, all containers are full or too far away.
            if (!creep.memory.moveTicks) {
                creep.memory.moveTicks = 0;
            }
    
            if (creep.memory.moveTicks < 5) { // Keeping your original logic for moving towards the spawn before dropping.
                var spawn = creep.room.find(FIND_MY_SPAWNS)[0];
                if (spawn) {
                    movement.moveToWithCache(creep, spawn); // Move towards the spawn
                    creep.say('🧭');
                    creep.memory.moveTicks++;
                }
            } else {
                // Drop energy if not near a container or unable to transfer to it.
                creep.drop(RESOURCE_ENERGY);
                creep.say('⏬');
                creep.memory.moveTicks = 0; // Reset for the next cycle
            }
        }
    },
};

module.exports = roleHarvester;
