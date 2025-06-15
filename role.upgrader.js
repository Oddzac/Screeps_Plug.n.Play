var utility = require('./u.utilities');
var movement = require('./u.movement');
var giveWay = require("./u.giveWay");
var collaboration = require('./u.collaboration');

var roleUpgrader = {
    run: function(creep) {
        if (!creep) return;
        
        // Check if we should switch roles based on colony needs
        const newRole = collaboration.evaluateRoleSwitch(creep);
        if (newRole) {
            creep.memory.role = newRole;
            creep.say(`Now ${newRole}`);
            return; // Let the next tick handle the new role's logic
        }
        
        // Initialize harvestingTicks if it doesn't exist
        if (!creep.memory.harvestingTicks) {
            creep.memory.harvestingTicks = 0;
        }

        // Generate pixel if CPU bucket is full - only check occasionally to save CPU
        if (Game.time % 20 === 0 && Game.cpu.bucket >= 10000) {
            this.genPix();
        }

        // State transitions for harvesting/upgrading
        if (creep.store.getUsedCapacity() === 0) {
            creep.memory.harvesting = true;
            creep.memory.working = false;
            
            // Register that we need energy
            collaboration.requestResource(creep, RESOURCE_ENERGY, 3); // Priority 3 for upgraders
        } else if (creep.store.getFreeCapacity() === 0 || 
                  (creep.store.getUsedCapacity() > creep.store.getCapacity() * 0.5 && 
                   creep.memory.harvestingTicks > 50)) {
            creep.memory.harvesting = false;
            creep.memory.harvestingTicks = 0;
            collaboration.fulfillRequest(creep); // No longer need energy
        }

        // Execute current state
        if (creep.memory.harvesting) {
            // If we're full, stop requesting
            if (creep.store.getFreeCapacity() === 0) {
                collaboration.fulfillRequest(creep);
            }
            utility.harvestEnergy(creep);
            creep.memory.harvestingTicks++;
        } else {
            this.upgradeController(creep);
        }
        
        // Give way to other creeps if needed
        creep.giveWay();
    },

    upgradeController: function(creep) {
        if (!creep || !creep.room || !creep.room.controller) return;
        
        const result = creep.upgradeController(creep.room.controller);
        
        if (result === ERR_NOT_IN_RANGE) {
            movement.moveToWithCache(creep, creep.room.controller, 3);
            creep.say('🔋');
            creep.memory.working = false;
        } else if (result === OK) {
            creep.memory.working = true;
            // Only say something occasionally to reduce CPU usage
            if (Game.time % 10 === 0) creep.say('⚡');
        } else {
            // Handle other error cases
            creep.memory.working = false;
        }
    },

    genPix: function() {
        // Track last pixel generation time to avoid spamming
        if (!Memory.lastPixelGeneration || Game.time - Memory.lastPixelGeneration > 1000) {
            if (Game.cpu.bucket >= 10000) {
                const result = Game.cpu.generatePixel();
                if (result === OK) {
                    console.log('Pixel generated successfully!');
                    Memory.lastPixelGeneration = Game.time;
                }
            }
        }
    },

  
};

module.exports = roleUpgrader;
