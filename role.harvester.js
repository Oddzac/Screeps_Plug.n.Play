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
        const haulers = _.filter(Game.creeps, (c) => c.memory.role === 'hauler' && c.room.name === creep.room.name).length;

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

        const roomName = creep.room.name;
        const minerals = creep.room.find(FIND_MINERALS);
        const extractors = creep.room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_EXTRACTOR});
        const extractingHarvesters = _.sum(Game.creeps, (c) => c.memory.role === 'harvester' && c.room.name === roomName && c.memory.task === 'extractHarvest');
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
    
        if (minerals.length > 0 && extractors.length > 0 && extractingHarvesters < 1) {
            creep.memory.task = 'extractHarvest';
            creep.memory.sourceId = minerals[0].id;
            return;
        }
        // Sort the safe sources by the number of creeps targeting them, and pick the one with the fewest creeps
        const sortedSources = _.sortBy(sourceCount, 'count');
        if (sortedSources.length > 0) {
            creep.memory.sourceId = sortedSources[0].id; // Assign the ID of the least targeted safe source
        }
    },

    transferResources: function(creep) {
        var target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType === STRUCTURE_SPAWN || 
                        structure.structureType === STRUCTURE_EXTENSION ||
                        structure.structureType === STRUCTURE_CONTAINER || 
                        structure.structureType === STRUCTURE_LINK) && 
                        _.sum(structure.store) < structure.storeCapacity; // Checks if the structure is not full
            }
        });
        if(target) {
            // Attempt to transfer each resource type the creep is carrying
            for(const resourceType in creep.carry) {
                if(creep.transfer(target, resourceType) === ERR_NOT_IN_RANGE) {
                    movement.moveToWithCache(creep, target);
                    creep.say('📥');
                    break; // Exit after attempting to transfer the first found resource
                }
            }
        }
    },
    

    passEnergy: function(creep) {
        // First, check if there are containers within 20 tiles of the creep.
        var containers = creep.pos.findInRange(FIND_STRUCTURES, 5, {
            filter: { structureType: STRUCTURE_CONTAINER }
        });

        var links = creep.pos.findInRange(FIND_STRUCTURES, 5, {
            filter: { structureType: STRUCTURE_LINK }
        });

        // If there are containers available, try to deposit energy in the nearest one.
        if (links.length > 0) {
            // Find the closest link.
            var closestLink = creep.pos.findClosestByPath(links);
    

            for(const resourceType in creep.carry) {
                if(creep.transfer(closestLink, resourceType) === ERR_NOT_IN_RANGE) {
                    movement.moveToWithCache(creep, closestLink);
                    creep.say('📦');
                    break;
                }
            }

        } else if (containers.length > 0) {
            // Find the closest container.
            var closestContainer = creep.pos.findClosestByPath(containers);
    
            for(const resourceType in creep.carry) {
                if(creep.transfer(closestContainer, resourceType) === ERR_NOT_IN_RANGE) {
                    movement.moveToWithCache(creep, closestContainer);
                    creep.say('📦');
                    break;
                }
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
