//TODO
// case logic for 2 spawn haulers at phase 7



var utility = require('a.utilities'); // Utility functions like phase checks
var movement = require('a.movement'); // Movement functions

var roleHauler = {
    run: function(creep) {



        if (creep.store.getUsedCapacity() === 0) {
            creep.memory.isCollecting = true;

        } else if (creep.memory.task === 'linkHauler' || creep.memory.task === 'spawnHauler' && creep.store.getUsedCapacity() > 0) {
            creep.memory.isCollecting = false;

        } else if (creep.store.getFreeCapacity() === 0) {
            creep.memory.isCollecting = false;
        }

        this.signRoom (creep);

        if (Game.time % 50 === 0 && creep.memory.task !== 'spawnHauler' && creep.memory.task !== 'linkHauler') {
            this.assignCollectionTask(creep);
        }
        
        if (creep.memory.isCollecting) {
            if (!creep.memory.task) {
                this.assignCollectionTask(creep);
            }
            this.assignCollectionTarget(creep);
            
        } else {
            this.deliverResources(creep);
        }
    },

    signRoom: function(creep) {
        if(creep.room.controller && !Memory.rooms[creep.room.name].signed) {
            const signResult = creep.signController(creep.room.controller, "The oddz favor none 🎲");
            if(signResult == ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.controller);
            } else if(signResult == OK) {
                Memory.rooms[creep.room.name].signed = true;
            }
        }
    },

    assignCollectionTask: function(creep) {
        // Determine task based on room phase and structure availability
        const roomName = creep.room.name;
        const phase = Memory.rooms[creep.room.name].phase.Phase;
        
        const haulers = _.sum(Game.creeps, (c) => c.memory.role === 'hauler' && c.room.name === roomName);
        const spawnHaulers = _.sum(Game.creeps, (c) => c.memory.role === 'hauler' && c.room.name === roomName && c.memory.task === 'spawnHauler');
        const linkHaulers = _.sum(Game.creeps, (c) => c.memory.role === 'hauler' && c.room.name === roomName && c.memory.task === 'linkHauler');
        const terminalHauler = _.sum(Game.creeps, (c) => c.memory.role === 'hauler' && c.room.name === roomName && c.memory.task === 'terminalHauler');

        const energySources = creep.room.find(FIND_SOURCES).length;
        const containersBuilt = Memory.rooms[creep.room.name].containersBuilt;
        const storageBuilt = Memory.rooms[creep.room.name].storageBuilt;
        const linksBuilt = Memory.rooms[creep.room.name].linksBuilt;
        const terminalBuilt = Memory.rooms[creep.room.name].terminalBuilt;
        const extensions = creep.room.find(FIND_MY_STRUCTURES, {
            filter: { structureType: STRUCTURE_EXTENSION }
        });



        let target;

        //ifLink: assign 1 linkHauler > ifStorage: assign 1 spawnHauler > ifContainers: 
        
        if (linkHaulers < 1 && linksBuilt > 1) {
            creep.memory.task = 'linkHauler';

        } else if (phase >= 6 && energySources > 1 && spawnHaulers < 2) {
            creep.memory.task = 'spawnHauler';

        } else if (energySources < 2 && extensions > 30 && spawnHaulers < 2) {
            creep.memory.task = 'spawnHauler';

        } else if (spawnHaulers < 1 && storageBuilt > 0) {
            creep.memory.task = 'spawnHauler';

        } else if (terminalHauler < 1 && terminalBuilt > 0) {
            creep.memory.task = 'terminalHauler';


        } else {
            creep.memory.task = 'collector';
            delete creep.memory.linkId;
            this.assignContainer(creep);
            return; //Early Return For !target
        }

        this.assignCollectionTarget(creep);
    },

    assignContainer: function(creep) {
        const sourcesAndMinerals = creep.room.find(FIND_SOURCES).concat(creep.room.find(FIND_MINERALS));
        const containers = creep.room.find(FIND_STRUCTURES, {
            filter: (s) => {
                if (s.structureType !== STRUCTURE_CONTAINER || _.sum(s.store) <= 0) {
                    return false;
                }
                // Check if the container is within 3 tiles of any source or mineral
                return sourcesAndMinerals.some(sourceOrMineral => 
                    s.pos.inRangeTo(sourceOrMineral, 3)
                );
            }
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

        const phase = Memory.rooms[creep.room.name].phase.Phase;
        const storageBuilt = Memory.rooms[creep.room.name].storageBuilt > 0;
        const containersBuilt = Memory.rooms[creep.room.name].containersBuilt > 0;
        //const task = Game.getObjectById(creep.memory.task);
        let targets = [];
        let target;
    


        if (creep.memory.task === 'linkHauler') {
            delete creep.memory.containerId;
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

            target = Game.getObjectById(creep.memory.linkId);

        } else if (creep.memory.task === 'spawnHauler' || creep.memory.task === 'terminalHauler' ) {
            //Collect from room storage exclusively
            delete creep.memory.linkId;
            target = creep.room.storage;
            

} else {
    // Clear any irrelevant memory assignments.
    delete creep.memory.linkId;

    // Initialize targets array.
    targets = [];

    // Add dropped resources and tombstones with resources to the targets list.
    droppedResources = creep.room.find(FIND_DROPPED_RESOURCES, {
        filter: (r) => (storageBuilt && r.amount > 20) || (!storageBuilt && r.resourceType === RESOURCE_ENERGY && r.amount > 20)
    });
    const tombstonesWithResources = creep.room.find(FIND_TOMBSTONES, {
        filter: (t) => _.sum(t.store) > 0
    });
    const ruinssWithResources = creep.room.find(FIND_RUINS, {
        filter: (t) => _.sum(t.store) > 0
    });

    targets = targets.concat(droppedResources, tombstonesWithResources, ruinssWithResources);

    // Directly work with the assigned container if specified and valid.
    if (creep.memory.containerId) {
        const assignedContainer = Game.getObjectById(creep.memory.containerId);
        if (assignedContainer && _.sum(assignedContainer.store) > 0 && !targets.includes(assignedContainer)) {
            targets.push(assignedContainer);
        }
    }

    // Find the closest target and prioritize it.
    if (targets.length > 0) {
        target = creep.pos.findClosestByPath(targets);
    } else if (!creep.memory.containerId || creep.memory.task !== 'spawnHauler' && creep.memory.task !== 'linkHauler') {
        // If no targets and no specific task, consider finding a new container to assign.
        const containers = creep.room.find(FIND_STRUCTURES, {
            filter: (s) => s.structureType === STRUCTURE_CONTAINER && _.sum(s.store) > 0
        });

        if (containers.length > 0) {
            // Assign the creep to the least assigned container if not already assigned.
            if (!creep.memory.containerId) {
                let containerAssignments = containers.map(container => ({
                    id: container.id,
                    count: _.sum(Game.creeps, c => c.memory.containerId === container.id && c.memory.role === 'hauler')
                }));

                let leastAssigned = _.min(containerAssignments, 'count');
                creep.memory.containerId = leastAssigned.id;
            }
        }
    }
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
    
        if (creep.memory.task === 'spawnHauler') {
            // target = room storage
            actionResult = creep.withdraw(target, RESOURCE_ENERGY);

        } else if (creep.memory.task === 'terminalHauler') {
            let resourceType = RESOURCE_ENERGY; // Default to energy
            let totalMinerals = _.sum(creep.room.storage.store) - creep.room.storage.store[RESOURCE_ENERGY]; // Calculate total minerals in storage
        
            if (totalMinerals > 0) {
                // If there are minerals, find one to withdraw with quantity greater than 1000
                for(const resource in creep.room.storage.store) {
                    if(resource !== RESOURCE_ENERGY && creep.room.storage.store[resource] > 1000) {
                        resourceType = resource;
                        break; // Withdraw the first found surplus mineral
                    }
                }
                // Check if a surplus mineral was found, if not and energy is surplus, proceed with energy
                if (resourceType === RESOURCE_ENERGY && creep.room.storage.store[RESOURCE_ENERGY] <= 5000) {
                    // If there's not enough surplus energy, do not proceed to withdraw
                    this.waitNear(creep); // Wait if conditions are not met
                    return; // Exit the function
                }
            } else if (creep.room.storage.store[RESOURCE_ENERGY] <= 1000) {
                // If there's not enough energy, do not proceed to withdraw
                this.waitNear(creep); // Wait if conditions are not met
                return; // Exit the function
            }
            // Proceed to withdraw the selected surplus resource
            actionResult = creep.withdraw(target, resourceType);

        } else if (target instanceof Resource) {
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
            // Typically when assigned source becomes empty
            this.waitNear(creep); // Hold tight. Conditions may change
            //this.assignCollectionTask(creep); // Re-evaluate collection task
        }

    },

    deliverResources: function(creep) {

        const storageBuilt = Memory.rooms[creep.room.name].storageBuilt > 0;
        let target;
        let targets = [];

        switch (creep.memory.task) {
            case 'spawnHauler':
                // Prioritize spawns and extensions first, then towers, by their need for energy.
                targets = creep.room.find(FIND_MY_STRUCTURES, {
                    filter: (structure) => {
                        return (structure.structureType === STRUCTURE_SPAWN ||
                                structure.structureType === STRUCTURE_EXTENSION) &&
                                structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                    }
                });
    
                if (targets.length === 0) {
                    // If all spawns and extensions are full, then look at towers.
                    targets = creep.room.find(FIND_MY_STRUCTURES, {
                        filter: (structure) => {
                            return structure.structureType === STRUCTURE_TOWER &&
                                   structure.store.getFreeCapacity(RESOURCE_ENERGY) > 190;
                        }
                    });
                }
    
                target = creep.pos.findClosestByPath(targets);
                break;

            case 'terminalHauler':
                target = creep.room.terminal
                break;

            case 'linkHauler':
                //linkHaulers only deposit energy into storage
                target = creep.room.storage
                break;


            default:
                // Check if storage is built and has free capacity
                if (storageBuilt && creep.room.storage && creep.room.storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                    target = creep.room.storage;
                } else {
                    // Check for spawns, extensions, and towers with free capacity
                    targets = creep.room.find(FIND_MY_STRUCTURES, {
                        filter: structure => (
                            (structure.structureType === STRUCTURE_SPAWN || 
                            structure.structureType === STRUCTURE_EXTENSION ||
                            structure.structureType === STRUCTURE_TOWER) &&
                            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                        )
                    });

                    // If spawns, extensions, and towers are full or not present, find containers
                        // When looking for containers, exclude the assigned container
                    if (targets.length === 0) {
                        const assignedContainerId = creep.memory.containerId;
                        let containers = creep.room.find(FIND_STRUCTURES, {
                            filter: (structure) => {
                                return structure.structureType === STRUCTURE_CONTAINER &&
                                    structure.id !== assignedContainerId &&
                                    structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                            }
                        });

                        // Find the container closest to the room's controller
                        if (containers.length > 0) {
                            let controller = creep.room.controller;
                            target = controller ? controller.pos.findClosestByPath(containers) : null;
                        }
                    } else {
                        // If there are spawns, extensions, or towers with free capacity, use the closest one
                        target = creep.pos.findClosestByPath(targets);
                    }
                }
                break;
        }
    
        if (target) {
            this.transferResources(creep, target);
        } else {
            if (!creep.memory.home) {
                // Try to parse the room name from the creep's name
                const nameParts = creep.name.split('_');
                if (nameParts.length > 1 && Game.rooms[nameParts[0]]) {
                    // Validate if the room exists in the game
                    creep.memory.home = nameParts[0];
                } else {
                    // Fallback to the current room if parsing fails or room is not accessible
                    creep.memory.home = creep.room.name;
                }
            }
            
            const homeRoom = Game.rooms[creep.memory.home];
            if (!homeRoom) {
                console.log('Home room not accessible:', creep.memory.home);
                return;
            }
            
            // Retrieve spawns in the home room
            const spawns = homeRoom.find(FIND_MY_SPAWNS);
            if (spawns.length === 0) {
                console.log('No spawns found in home room:', creep.memory.home);
                return;
            }
            
            const spawn = spawns[0]; // Get the first spawn
            movement.moveToWithCache(creep, spawn);

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
                // If the transfer was successful
                if (creep.store.getUsedCapacity() === 0) {
                    // Set the creep to start collecting again
                    creep.memory.isCollecting = true;
                    
                    break; // Exit the loop as the cargo is empty
                }
            } else if (result === ERR_FULL) {
                // If the target is full, find a new target or re-evaluate the task
                
                this.waitNear(creep);
                break; // Try to distribute any remaining energy
            }
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
            const storage = creep.room.storage;
            if (storage) {
                waitLocation = storage.pos;
            } else {
                
            }
        }
    
        movement.moveToWithCache(creep, waitLocation);
        creep.say('⌛');
    },
    
};

module.exports = roleHauler;
