//TODO
//Ensure deposit priority: Spawn> Extensions> ifTower> ifStorage
//Energy collection priority: ifDropped > (ifLink && <1 hauler assigned to it) > ifContainer
//If links > 0, assign 1 hauler to the link closest to storage. If 1 hauler already assigned to link task, assign container.
//If containers > 0, assign container with fewest haulers targeting. Haulers only deviates if dropped energy/tombstone 

var movement = require('a.movement');

var roleHauler = {
    run: function(creep) {
        
        
        if (creep.store.getUsedCapacity() === 0) {
            creep.memory.isCollecting = true;
            if (!creep.memory.linkId && Memory.rooms[creep.room.name].linksBuilt > 0 /*&& link assigned < 1*/) {
                this.assignLink(creep);

            } else if (!creep.memory.containerId && Memory.rooms[creep.room.name].containersBuilt > 0) {
                this.assignContainer(creep);
            }
        } else if (creep.store.getFreeCapacity() === 0) {
            creep.memory.isCollecting = false;
            delete creep.memory.containerId; // Reset container assignment when going to deliver
        }

        if (creep.memory.isCollecting) {
            this.collectEnergy(creep);
        } else {
            this.deliverEnergy(creep);
        }
    },

    assignLink: function (creep) {
        //Placeholder method for link assignment
    },

    assignContainer: function(creep) {
        const containers = creep.room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_CONTAINER && 
                         s.store[RESOURCE_ENERGY] > 0
        });

        const containerAssignments = containers.map(container => ({
            id: container.id,
            count: _.sum(Game.creeps, c => c.memory.containerId === container.id && c.memory.role === 'hauler')
        }));

        const leastAssigned = _.min(containerAssignments, 'count');
        if (leastAssigned && leastAssigned.id) {
            creep.memory.containerId = leastAssigned.id;
        }
    },

    collectEnergy: function(creep) {
        let target;
        if (this.findEnergyCollectionTarget(creep)) {
            target = target = this.findEnergyCollectionTarget(creep);
        } else if (creep.memory.containerId) {
            target = Game.getObjectById(creep.memory.containerId);
        }

        if (target) {
            this.moveToAndCollectEnergy(creep, target);
        } else {
            this.waitStrategically(creep);
        }
    },

    findEnergyCollectionTarget: function(creep) {
        // Combine finding dropped resources and containers with energy
        let targets = creep.room.find(FIND_DROPPED_RESOURCES).concat(
            creep.room.find(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_CONTAINER && _.sum(s.store) > 0
            })
        );

        // Prioritize targets by proximity and amount
        let target = creep.pos.findClosestByPath(targets);
        if (target) {
            // Claim target if it's a dropped resource and not yet claimed
            if (!target.structureType && !Memory.claimedDrops[target.id]) {
                Memory.claimedDrops[target.id] = creep.id;
            }
            return target;
        }
        return null;
    },

    moveToAndCollectEnergy: function(creep, target) {
        let actionResult;
        if (target instanceof Resource) {
            actionResult = creep.pickup(target);
        } else {
            actionResult = creep.withdraw(target, RESOURCE_ENERGY);
        }

        if (actionResult === ERR_NOT_IN_RANGE) {
            movement.moveToWithCache(creep, target);
            creep.say('🔄️');
        }
    },

    deliverEnergy: function(creep) {
        let target = this.selectDeliveryTarget(creep);
        if (target) {
            if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                movement.moveToWithCache(creep, target);
                creep.say('🚚');
            }
        } else {
            this.waitStrategically(creep);
        }
    },

    selectDeliveryTarget: function(creep) {
        // Determine targets by priority: SPAWN, EXTENSION, TOWER, STORAGE
        const targets = creep.room.find(FIND_MY_STRUCTURES, {
            filter: structure => (
                (structure.structureType === STRUCTURE_SPAWN || structure.structureType === STRUCTURE_EXTENSION || structure.structureType === STRUCTURE_TOWER || structure.structureType === STRUCTURE_STORAGE) &&
                structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            )
        }).sort((a, b) => this.getDeliveryPriority(a) - this.getDeliveryPriority(b));

        return targets.length ? targets[0] : null;
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

    waitStrategically: function(creep) {
        this.assignContainer(creep);
        let waitNear;
        if (!creep.memory.containerId) {
            let waitNear = creep.room.storage || creep.room.find(FIND_MY_SPAWNS)[0];
        } else {
            let waitNear = Game.getObjectById(creep.memory.containerId) || creep.room.storage;
        }

        if (waitNear) {
            movement.moveToWithCache(creep, waitNear);
            creep.say('⌛');
        }
    }
};

module.exports = roleHauler;