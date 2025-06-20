//TODO
// Phase 1 - Self-Transfer / Drop Energy If Haulers / Deposit Energy If Containers 
// Phase 2 - Assign Sources

var utility = require('./u.utilities');
var movement = require('./u.movement');
var giveWay = require("./u.giveWay");


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
                creep.memory.working = false;
                creep.say('⛏️');
            } else {
                creep.memory.working = true;
            }
            
        } else {
            creep.memory.working = false;
            this.manageEnergy(creep, haulers);
        
        }
        creep.giveWay();
    },

    manageEnergy: function(creep, haulers) {
        if (haulers < 1) {
            // Transfer energy directly to the spawn or other structures
            this.transferResources(creep);
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
        const harvesters = _.sum(Game.creeps, (c) => c.memory.role === 'harvester' && c.room.name === roomName);
        const extractingHarvesters = _.sum(Game.creeps, (c) => c.memory.role === 'harvester' && c.room.name === roomName && c.memory.task === 'extractHarvest');
        const sources = Memory.rooms[roomName].mapping.sources.id;
        const sourceCount = sources.map(sourceId => {
        const source = Game.getObjectById(sourceId);
            if (!source) return null;
            // Check for hostiles within 10 tiles of the source
            const hostilesNearSource = source.pos.findInRange(FIND_HOSTILE_CREEPS, 10);
            return {
                id: source.id,
                count: _.filter(Game.creeps, (c) => c.memory.sourceId === source.id).length,
                isSafe: hostilesNearSource.length === 0 // Only consider the source safe if no hostiles are near
            };
        }).filter(source => source && source.isSafe); // Filter out sources that are not safe or no longer exist
    
        if (harvesters > sources.length && extractors.length > 0 && extractingHarvesters < 1) {
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
        // First priority: spawns and extensions
        let target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType === STRUCTURE_SPAWN || 
                        structure.structureType === STRUCTURE_EXTENSION) && 
                        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
            }
        });
        
        // Second priority: links, containers, storage
        if(!target) {
            target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (structure) => {
                    return (structure.structureType === STRUCTURE_LINK || 
                            structure.structureType === STRUCTURE_CONTAINER ||
                            structure.structureType === STRUCTURE_STORAGE) && 
                            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }
            });
        }
        
        if(target) {
            // Attempt to transfer each resource type the creep is carrying
            for(const resourceType in creep.store) {
                if(creep.transfer(target, resourceType) === ERR_NOT_IN_RANGE) {
                    movement.moveToWithCache(creep, target);
                    creep.say('📥');
                    break; // Exit after attempting to transfer the first found resource
                }
            }
        } else {
            // If no valid targets found (all are full), drop the energy
            // This prevents the harvester from getting stuck
            creep.drop(RESOURCE_ENERGY);
            creep.say('⏬');
            
            // Move toward controller to avoid clogging the source
            if (creep.room.controller) {
                movement.moveToWithCache(creep, creep.room.controller, 3);
            }
        }
    },
    

passEnergy: function(creep) {
    let targets;
        if (creep.memory.task === "extractHarvest") {
            targets = creep.pos.findInRange(FIND_STRUCTURES, 3, {
                filter: (structure) => {
                    return [STRUCTURE_LINK, STRUCTURE_STORAGE, STRUCTURE_CONTAINER].includes(structure.structureType);
               }
            }).sort((a, b) => {
                const priority = [STRUCTURE_LINK, STRUCTURE_CONTAINER, STRUCTURE_STORAGE];
                return priority.indexOf(a.structureType) - priority.indexOf(b.structureType);
            });
        } else {
            targets = creep.pos.findInRange(FIND_STRUCTURES, 3, {
                filter: (structure) => {
                    return [STRUCTURE_LINK, STRUCTURE_CONTAINER].includes(structure.structureType);
               }
            }).sort((a, b) => {
                const priority = [STRUCTURE_LINK, STRUCTURE_CONTAINER];
                return priority.indexOf(a.structureType) - priority.indexOf(b.structureType);
            });
        }

    if(targets.length > 0) {
        for(const target of targets) {
            for(const resourceType in creep.store) {
                let transferResult = creep.transfer(target, resourceType);
                if(transferResult == ERR_NOT_IN_RANGE) {
                    movement.moveToWithCache(creep, target);
                    creep.say('📦');
                    return; // Exit after the first attempt to move/transfer
                } else if(transferResult == OK) {
                    return; // Successful transfer, exit the method
                }
            }
        }
    } else {
        // If no suitable targets, attempt to drop the resource.
        creep.drop(RESOURCE_ENERGY);
        creep.say('⏬');
    }
},
};

module.exports = roleHarvester;
