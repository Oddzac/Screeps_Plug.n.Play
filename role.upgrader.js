var utility = require('./u.utilities');
var movement = require('./u.movement');
var giveWay = require("./u.giveWay");

var roleUpgrader = {
    run: function(creep) {
        // Initialize harvestingTicks if it doesn't exist
        if (!creep.memory.harvestingTicks) {
            creep.memory.harvestingTicks = 0;
        }

        if (Game.time % 25 === 0) {
            if (Game.cpu.bucket === 10000) {
                this.genPix(creep);
            }
        }

        // Check if the creep is currently harvesting or needs to start harvesting
        if(creep.store.getUsedCapacity() === 0 && !creep.memory.harvesting) {
            creep.memory.harvesting = true;
        }

        // Switch to upgrading if the creep's store is more than 50% full and it has been trying to harvest for more than 10 ticks
        if (creep.store.getUsedCapacity() > creep.store.getCapacity() * 0.5 && creep.memory.harvestingTicks > 70) {
            creep.memory.harvesting = false;
            delete creep.memory.sourceId;
        }

        // If the creep is harvesting but its store is full, switch to not harvesting
        if (creep.memory.harvesting && creep.store.getFreeCapacity() === 0) {
            creep.memory.harvesting = false;
            // Reset harvestingTicks since the creep is now switching tasks
            creep.memory.harvestingTicks = 0;
        }

        if (creep.memory.harvesting) {
            // Check if spawner is available for energy withdrawal
            if (Memory.rooms[creep.room.name] && 
                Memory.rooms[creep.room.name].spawning && 
                Memory.rooms[creep.room.name].spawning.nextSpawnRole === null) {
                this.withdrawFromSpawner(creep);
            } else {
                utility.harvestEnergy(creep);
            }
            // Increment the harvestingTicks counter if still harvesting
            creep.memory.harvestingTicks++;
        } else {
            this.upgradeController(creep);
            // Reset harvestingTicks since the creep is now upgrading
            creep.memory.harvestingTicks = 0;
        }
        creep.giveWay();
    },
    
    withdrawFromSpawner: function(creep) {
        const spawns = creep.room.find(FIND_MY_SPAWNS);
        if (spawns.length > 0) {
            const spawn = spawns[0];
            if (spawn.store.getUsedCapacity(RESOURCE_ENERGY) > 200) { // Leave some energy for spawning
                if (creep.withdraw(spawn, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.say('🔌');
                    movement.moveToWithCache(creep, spawn.pos);
                } else {
                    creep.memory.harvesting = false;
                    creep.memory.harvestingTicks = 0;
                }
                return true;
            }
        }
        return false;
    },

    upgradeController: function(creep) {
        if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
            creep.say('🔋');
            movement.moveToWithCache(creep, creep.room.controller.pos);
            creep.memory.working = false;
        } else {
            creep.memory.working = true;
        }
    },

    genPix: function() {
    if (Game.cpu.bucket >= 10000) { // Ensure there is enough CPU in the bucket
        const result = Game.cpu.generatePixel();
        if (result === OK) {
            console.log('Pixel generated successfully!');
        } else {
            console.log('Failed to generate pixel:', result);
        }
    } else {
        console.log('Not enough CPU in the bucket to generate a pixel.');
    }
},

  
};

module.exports = roleUpgrader;
