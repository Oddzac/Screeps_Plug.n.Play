//TODO
//Transfer method - all resources



var utility = require('a.utilities'); // Utility functions like phase checks
var movement = require('a.movement'); // Movement functions

var roleHauler = {
    run: function(creep) {
        this.initializeMemory(creep);

        if (creep.memory.isCollecting) {
            if (!creep.memory.task) {
                this.assignCollectionTask(creep);
            }
            this.assignCollectionTarget(creep);
            
        } else {
            this.deliverResources(creep);
        }
    },

    initializeMemory: function(creep) {
        if (creep.store.getUsedCapacity() === 0) {
            creep.memory.isCollecting = true;
        } else if (creep.store.getFreeCapacity() === 0) {
            creep.memory.isCollecting = false;
        }
    },

    assignCollectionTask: function(creep) {
        // Determine task based on room phase and structure availability
        const phase = Memory.rooms[creep.room.name].phase.Phase;
        const spawnHaulers = _.sum(Game.creeps, (c) => c.memory.role === 'hauler' && c.memory.task === 'spawnHauler');
        const linkHaulers = _.sum(Game.creeps, (c) => c.memory.role === 'hauler' && c.memory.task === 'linkHauler');
        const containersBuilt = Memory.rooms[creep.room.name].containersBuilt;
        const storageBuilt = Memory.rooms[creep.room.name].storageBuilt;
        const linksBuilt = Memory.rooms[creep.room.name].linksBuilt;

        let target;

        //ifLink: assign 1 linkHauler > ifStorage: assign 1 spawnHauler > ifContainers: 
        if (linkHaulers < 1 && linksBuilt > 1) {
            creep.memory.task = 'linkHauler';

        } else if (spawnHaulers < 1 && storageBuilt > 0) {
            creep.memory.task = 'spawnHauler';

        } else if (containersBuilt > 0) {
            creep.memory.task = 'collector';
            if (!creep.memory.containerId) {
                this.assignContainer(creep);
            }

        } else {
            creep.memory.task = 'collector';
            return; //Early Return For !target
        }

        this.assignCollectionTarget(creep);
    },

    assignContainer: function(creep) {
        const containers = creep.room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_CONTAINER && 
                         s.store[RESOURCE_ENERGY] > 0
        });
    
        if (containers.length > 0) {
            const containerAssignments = containers.map(container => ({
                id: container.id,
                count: _.sum(Game.creeps, c => c.memory.containerId === container.id && c.memory.role === 'hauler')
            }));
    
            const leastAssigned = _.min(containerAssignments, 'count');
            if (leastAssigned && leastAssigned.id) {
                creep.memory.containerId = leastAssigned.id;
            }
        }
    },



    //IMPLEMENT SWITCH CASE VIA ROLE
    assignCollectionTarget: function(creep) {
        let targets = [];
        const phase = Memory.rooms[creep.room.name].phase.Phase;
        const storageBuilt = Memory.rooms[creep.room.name].storageBuilt > 0;
        const containersBuilt = Memory.rooms[creep.room.name].containersBuilt > 0;
        //const task = Game.getObjectById(creep.memory.task);
    
        switch (creep.memory.task) {

            case 'linkHauler':

                 // Check if we already have a link assigned in memory
                if (!creep.memory.linkId) {
                    // Find the storage structure
                    const storage = creep.room.storage;
                    if (!storage) {
                        console.log('Storage not found for', creep.name);
                        return; // Exit if there's no storage
                    }
            
                    // Find links within a range of 3 tiles from storage
                    const links = storage.pos.findInRange(FIND_STRUCTURES, 3, {
                        filter: {structureType: STRUCTURE_LINK}
                    });
            
                    // Assign the closest link (if any) to the creep's memory
                    if (links.length > 0) {
                        creep.memory.linkId = links[0].id;
                    } else {
                        console.log('No link found within range for', creep.name);
                        return; // Exit if no link is found within range
                    }
                }

                let target = Game.getObjectById(creep.memory.linkId);

                break;

            case 'spawnHauler':
                //Collect from room storage
                let target = creep.room.storage;

                break;

            default:
                // Adjust target selection based on room phase and storage construction
                if (containersBuilt) {
                    const containers = creep.room.find(FIND_STRUCTURES, {
                        filter: s => s.structureType === STRUCTURE_CONTAINER && 
                                     s.store[RESOURCE_ENERGY] > 0
                    });
                
                    if (containers.length > 0) {
                        const containerAssignments = containers.map(container => ({
                            id: container.id,
                            count: _.sum(Game.creeps, c => c.memory.containerId === container.id && c.memory.role === 'hauler')
                        }));
                
                        const leastAssigned = _.min(containerAssignments, 'count');
                        if (leastAssigned && leastAssigned.id) {
                            creep.memory.containerId = leastAssigned.id;
                        }
                    }
                }
                if (storageBuilt) {
                    // Post-Storage: Consider all resource types
                    targets = creep.room.find(FIND_DROPPED_RESOURCES).concat(
                        creep.room.find(FIND_TOMBSTONES, {
                            filter: (t) => _.sum(t.store) > 0
                        }),
                        creep.room.find(FIND_STRUCTURES, {
                            filter: (s) => (s.structureType === STRUCTURE_CONTAINER) &&
                                        _.sum(s.store) > 0
                        })
                    );
                } else {
                    // Pre-Storage: Focus on energy
                    targets = creep.room.find(FIND_DROPPED_RESOURCES, {
                        filter: (r) => r.resourceType === RESOURCE_ENERGY && r.amount > 50
                    }).concat(
                        creep.room.find(FIND_STRUCTURES, {
                            filter: (s) => s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0
                        })
                    );
                } 
                // Find the closest valid target
                let target = creep.pos.findClosestByPath(targets);
        }

    
        
        if (target) {
            //Got our target, go get it.
            this.moveToAndCollect(creep, target);
        } else {
            //No targets available
            this.waitNear(creep);
        }
    },

    moveToAndCollect: function(creep, target) {
        let actionResult;
    
        if (target instanceof Resource) {
            actionResult = creep.pickup(target);
        } else if (target.store) {
            // Withdraw the most abundant resource for post-storage, or energy for pre-storage
            let resourceType = Object.keys(target.store).reduce((a, b) => target.store[a] > target.store[b] ? a : b, RESOURCE_ENERGY);
            actionResult = creep.withdraw(target, resourceType);
        }
    
        if (actionResult === ERR_NOT_IN_RANGE) {
            movement.moveToWithCache(creep, target);
            creep.say('🔄');
        } else if (actionResult !== OK) {
            // Handle any issues, like the target becoming empty
            this.waitNear(creep); //Hold tight. Conditions may change
            //this.assignCollectionTask(creep); // Re-evaluate collection task
        }

    },

    deliverResources: function(creep) {

        const storageBuilt = Memory.rooms[creep.room.name].storageBuilt > 0;
        let target;
        let targets = [];

        switch (creep.memory.task) {
            case 'spawnHauler':
                //spawnHaulers distribute energy to any structure that requires it to function.
                targets = creep.room.find(FIND_MY_STRUCTURES, {
                    filter: structure => (
                        (structure.structureType === STRUCTURE_SPAWN || 
                        structure.structureType === STRUCTURE_EXTENSION || 
                        structure.structureType === STRUCTURE_TOWER) &&
                        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                    )
                });

                target = creep.pos.findClosestByPath(targets);
                break;

            case 'linkHauler':
                //linkHaulers only deposit energy into storage
                target = creep.room.storage && creep.room.storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0 ? creep.room.storage : null;
                break;


            default:
                //All other haulers follow this logic to deposit
                if (storageBuilt && creep.room.storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                    target = creep.room.storage && creep.room.storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0 ? creep.room.storage : null; 
                } else {
                    targets = creep.room.find(FIND_MY_STRUCTURES, {
                        filter: structure => (
                            (structure.structureType === STRUCTURE_SPAWN || 
                            structure.structureType === STRUCTURE_EXTENSION ||
                            structure.structureType === STRUCTURE_TOWER || 
                            structure.structureType === STRUCTURE_STORAGE) &&
                            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                        )
                    }).sort((a, b) => this.getDeliveryPriority(a) - this.getDeliveryPriority(b));
    
                    target = targets.length ? targets[0] : null;
                }
                break;
        }
    
        if (target) {
            this.transferResources(creep, target);
        } else {
            this.waitNear(creep);
        }
    },

    getDeliveryPriority: function(structure) {
        const priorities = {
            [STRUCTURE_SPAWN]: 1,
            [STRUCTURE_EXTENSION]: 2,
            [STRUCTURE_TOWER]: 3,
            [STRUCTURE_STORAGE]: 4
        };
        return priorities[structure.structureType] || 5;
    },

    transferResources: function(creep, target) {
        // Iterate over all resources in the creep's cargo
        for (const resourceType in creep.store) {
            let result = creep.transfer(target, resourceType);
            
            if (result === ERR_NOT_IN_RANGE) {
                // Move to the target if it's not in range
                movement.moveToWithCache(creep, target);
                creep.say('🚚');
                return; // Exit the loop since we need to move closer
            } else if (result === OK) {
                // If the transfer was successful and the creep has emptied its cargo
                if (creep.store.getUsedCapacity() === 0) {
                    // Set the creep to start collecting again
                    creep.memory.isCollecting = true;
                    break; // Exit the loop as the cargo is empty
                }
            } else if (result === ERR_FULL) {
                // If the target is full, find a new target or re-evaluate the task
                if (creep.memory.task === 'spawnHauler' || 'collector') {
                    this.deliverResources(creep);
                }
                this.waitNear(creep); // Or any other appropriate method to handle this case
                break; // Exit the loop as the target cannot accept more resources
            }
            // Note: If the transfer result is ERR_FULL, and there are multiple resource types,
            // this will exit after trying to transfer the first type.
        }
    },



    waitNear: function(creep) {
        let waitLocation;
    
        // Check for containerId and linkId in memory to set waitLocation near them
        if (creep.memory.containerId) {
            const container = Game.getObjectById(creep.memory.containerId);
            if (container) {
                waitLocation = container.pos;
            }
        } else if (creep.memory.linkId) {
            const link = Game.getObjectById(creep.memory.linkId);
            if (link) {
                waitLocation = link.pos;
            }
        }
    
        // If no container or link is assigned, wait near the room's spawn or at room center
        if (!waitLocation) {
            const spawn = creep.room.find(FIND_MY_SPAWNS)[0]; // Get the first spawn in the room
            if (spawn) {
                waitLocation = spawn.pos;
            } else {
                // Default to room center if no spawn is found
                waitLocation = new RoomPosition(25, 25, creep.room.name);
            }
        }
    
        movement.moveToWithCache(creep, waitLocation);
        creep.say('⌛');
    },
    
};

module.exports = roleHauler;
