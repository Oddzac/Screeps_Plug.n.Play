var movement = require('a.movement'); // Assumed external movement utilities

var roleHauler = {
    run: function(creep) {
        if (creep.store.getUsedCapacity() === 0) {
            creep.memory.isCollecting = true;
            delete creep.memory.deliveryTarget; // Clear delivery target when switching to collecting
        } else if (creep.store.getFreeCapacity() === 0) {
            creep.memory.isCollecting = false;
            delete creep.memory.collectionTarget; // Clear collection target when switching to delivering
        }

        this.signRoom(creep);

        if (creep.memory.isCollecting) {
            this.handleCollection(creep);
        } else {
            this.handleDelivery(creep);
        }
    },

    signRoom: function(creep) {
        if (creep.room.controller && !creep.room.controller.sign) {
            const signText = "The oddz favor none 🎲";
            if (creep.signController(creep.room.controller, signText) === ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.controller);
            }
        }
    },

    handleCollection: function(creep) {
        let target = this.getCollectionTarget(creep);
        if (target) {
            this.collectResource(creep, target);
        } else {
            this.waitNear(creep);
        }
    },

    handleDelivery: function(creep) {
        let target = this.getDeliveryTarget(creep);
        if (target) {
            this.deliverResource(creep, target);
        } else {
            this.waitNear(creep);
        }
    },

    getCollectionTarget: function(creep) {
        // Implement logic to determine and return the best collection target based on the creep's task and room state
        // Placeholder logic: Find the closest non-empty container
        if (!creep.memory.collectionTarget) {
            let targets = creep.room.find(FIND_STRUCTURES, {
                filter: (structure) => {
                    return structure.structureType === STRUCTURE_CONTAINER &&
                           structure.store.getUsedCapacity() > 0;
                }
            });
            let target = creep.pos.findClosestByPath(targets);
            if (target) {
                creep.memory.collectionTarget = target.id;
            }
        }
        return Game.getObjectById(creep.memory.collectionTarget);
    },

    getDeliveryTarget: function(creep) {
        // Implement logic to dynamically select the best delivery target based on the room's needs and the creep's task
        // Placeholder logic: Prioritize spawns, then extensions, then towers
        if (!creep.memory.deliveryTarget) {
            let targets = _.sortBy(creep.room.find(FIND_MY_STRUCTURES, {
                filter: (s) => (s.structureType === STRUCTURE_SPAWN || 
                                s.structureType === STRUCTURE_EXTENSION || 
                                s.structureType === STRUCTURE_TOWER) && 
                                s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            }), s => (s.structureType === STRUCTURE_SPAWN ? 1 : 
                      s.structureType === STRUCTURE_EXTENSION ? 2 : 3));
            
            let target = targets.length > 0 ? targets[0] : null;
            if (target) {
                creep.memory.deliveryTarget = target.id;
            }
        }
        return Game.getObjectById(creep.memory.deliveryTarget);
    },

    collectResource: function(creep, target) {
        // Generalized function to collect resources from the target
        let actionResult = creep.withdraw(target, RESOURCE_ENERGY); // Simplified for example
        if (actionResult === ERR_NOT_IN_RANGE) {
            movement.moveToWithCache(creep, target);
            creep.say('🔄');
        }
    },

    deliverResource: function(creep, target) {
        // Generalized function to deliver resources to the target
        let actionResult = creep.transfer(target, RESOURCE_ENERGY); // Simplified for example
        if (actionResult === ERR_NOT_IN_RANGE) {
            movement.moveToWithCache(creep, target);
            creep.say('🚚');
        }
    },

    waitNear: function(creep) {
        // Placeholder logic: Wait near room's storage or center if no storage
        let waitPos = creep.room.storage ? creep.room.storage.pos : new RoomPosition(25, 25, creep.room.name);
        movement.moveToWithCache(creep, waitPos);
        creep.say('⌛');
    }
};

module.exports = roleHauler;
