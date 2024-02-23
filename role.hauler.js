//TODO
//Claimed Drops Memory Restructure
//Ensure deposit priority: Spawn> Extensions> ifTower> ifStorage
//Phase 1 - Claim Drops
//Phase 2 - Assign containers

var movement = require('a.movement');

var roleHauler = {
    run: function(creep) {
        this.manageDroppedEnergyClaims(creep);
        this.handleEnergyCollectionOrDelivery(creep);
    },
    
    
    
    handleEnergyCollectionOrDelivery: function(creep) {
        if (creep.store.getUsedCapacity() === 0) {
            creep.memory.isCollecting = true;
        } else if (creep.store.getFreeCapacity() === 0) {
            creep.memory.isCollecting = false;
        }

        if (creep.memory.isCollecting) {
            this.collectEnergy(creep);
        } else {
            this.deliverEnergy(creep);
        }
    },
    
    collectEnergy: function(creep) {
        if (creep.memory.claimedDrop) {
            let claimedTarget = Game.getObjectById(creep.memory.claimedDrop);
            if (claimedTarget) {
                this.moveToAndCollectEnergy(creep, claimedTarget);
                return true;
            }
        }

        let target = this.findEnergyCollectionTarget(creep);
        if (target) {
            this.moveToAndCollectEnergy(creep, target);
            return true;
        } else {
            this.waitStrategically(creep);
            return false;
        }
        
    },

    findEnergyCollectionTarget: function(creep) {
        // Updated logic to include a check before claiming
        let significantDrop = this.findSignificantDroppedEnergy(creep);
        if (significantDrop && !Memory.claimedDrops[significantDrop.id]) {
            this.claimDroppedEnergy(creep, significantDrop);
            return significantDrop;
        }

        let container = this.findClosestContainerWithEnergy(creep);
        if (container) return container;

        return null;
    },

    moveToAndCollectEnergy: function(creep, target) {
        // Adjust this method to use path caching
        if (target instanceof Resource && creep.pickup(target) === ERR_NOT_IN_RANGE ||
            target instanceof Tombstone && creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE ||
            target.structureType === STRUCTURE_CONTAINER && creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
            movement.moveToWithCache(creep, target); // Use cached path
            creep.say('🔄️');
        }
    },

    deliverEnergy: function(creep) {
        // Determine if spawns and extensions are full
        const spawnsAndExtensions = creep.room.find(FIND_MY_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType === STRUCTURE_SPAWN ||
                        structure.structureType === STRUCTURE_EXTENSION) && 
                       structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
            }
        });

        const priorityTowers = creep.room.find(FIND_MY_STRUCTURES, {
            filter: (s) => s.structureType === STRUCTURE_TOWER && 
                           (s.store.getUsedCapacity(RESOURCE_ENERGY) / s.store.getCapacity(RESOURCE_ENERGY) < 0.6)
        });
    
        let target;
    
        // If spawns and extensions are not full, prioritize them
        if (priorityTowers.length > 0) {
            target = creep.pos.findClosestByPath(priorityTowers);
        } else if (spawnsAndExtensions.length > 0) {
            target = creep.pos.findClosestByPath(spawnsAndExtensions);
        } else {
            // Otherwise, try to deliver to storage if it's not full
            const storage = creep.room.storage;
            if (storage && storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                target = storage;
            }
        }
    
        // If we have a target, attempt to transfer energy
        if (target) {
            if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                movement.moveToWithCache(creep, target);
                creep.say('🚚');
                return true; // Action taken
            }
        } else {
            // No valid target found, consider other actions or wait
            this.waitStrategically(creep);
            return false; // No action taken
        }
    },
    

    findSignificantDroppedEnergy: function(creep) {
        // Merged logic for dropped resources and tombstones
        return creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
            filter: r => r.resourceType === RESOURCE_ENERGY && r.amount >= 50
        }) || creep.pos.findClosestByPath(FIND_TOMBSTONES, {
            filter: t => t.store[RESOURCE_ENERGY] >= 50
        });
    },

    findClosestContainerWithEnergy: function(creep) {
        // Simplified container search
        return creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0
        });
    },

    waitStrategically: function(creep) {
        let waitNear = creep.room.storage || creep.room.find(FIND_MY_SPAWNS)[0];
        if (waitNear) {
            movement.moveToWithCache(creep, waitNear);
            creep.say('⌛');
        }
    },

    findEnergyDepositTarget: function(creep) {
        // First, try to find Towers with less than 60% energy capacity filled
        const priorityTowers = creep.room.find(FIND_MY_STRUCTURES, {
            filter: (s) => s.structureType === STRUCTURE_TOWER && 
                           (s.store.getUsedCapacity(RESOURCE_ENERGY) < s.store.getCapacity(RESOURCE_ENERGY))
        });
    
        if (priorityTowers.length > 0) {
            // If there are such towers, find the closest one
            return creep.pos.findClosestByPath(priorityTowers);
        }
    
        // If no priority towers are found, fallback to finding the closest structure that needs energy (Spawn, Extension, or any Tower)
        return creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
            filter: (s) => (s.structureType === STRUCTURE_SPAWN || 
                            s.structureType === STRUCTURE_EXTENSION ||
                            s.structureType === STRUCTURE_STORAGE) &&
                           s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
    },

    manageDroppedEnergyClaims: function(creep) {
        // Optimized claim management
        if (creep.memory.claimedDrop) {
            let claimedDrop = Game.getObjectById(creep.memory.claimedDrop);
            if (!claimedDrop || claimedDrop.amount === 0) {
                delete Memory.claimedDrops[creep.memory.claimedDrop];
                delete creep.memory.claimedDrop;
            }
        } else {
            // Attempt to claim if there's no current claim and capacity isn't full
            if (creep.store.getFreeCapacity() > 0) {
                
                this.claimDroppedEnergy(creep);
            } else {
                return false;
            }
        }
    },

    claimDroppedEnergy: function(creep, target) {
    if (!target) return false; // No target to claim
    
    // Calculate the maximum number of haulers based on the drop's energy
    const maxHaulersForDrop = Math.ceil(target.amount / 200);
    
    // Ensure the memory structure for claimed drops exists
    if (!Memory.claimedDrops[target.id]) {
        Memory.claimedDrops[target.id] = { energy: target.amount, haulers: [] };
    }
    
    // Get the current number of haulers assigned to this drop
    const currentHaulersCount = Memory.claimedDrops[target.id].haulers.length;
    
    // Check if more haulers can be assigned based on the drop's energy
    if (currentHaulersCount < maxHaulersForDrop) {
        // Add the creep to the haulers array if not already present
        if (!Memory.claimedDrops[target.id].haulers.includes(creep.id)) {
            Memory.claimedDrops[target.id].haulers.push(creep.id);
    
            // Assign the claimed drop to the creep
            creep.memory.claimedDrop = target.id;
            this.collectEnergy(creep);
            return true; // Successfully claimed
        }
    }
    
    return false; // No claim made or drop doesn't meet criteria or max haulers reached
    },


};

module.exports = roleHauler;