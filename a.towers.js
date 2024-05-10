var towers = {

    run: function(tower) {
        if (!tower) return;

        // Prioritize actions: Heal > Attack > Repair
        if (this.healCreeps(tower)) {
            return;
        }
 
        if (this.attackHostiles(tower)) {
            return;
        }



        this.repairStructures(tower);
    },

 attackHostiles: function(tower) {
    const hostiles = tower.room.find(FIND_HOSTILE_CREEPS);
    // Filter hostiles to find those with ATTACK or RANGED_ATTACK parts
    const aggressiveHostiles = hostiles.filter(creep => 
        creep.body.some(part => part.type === ATTACK || part.type === RANGED_ATTACK)
    );

    if (aggressiveHostiles.length > 0) {
        // Prioritize aggressive hostiles
        const target = tower.pos.findClosestByRange(aggressiveHostiles);
        tower.attack(target);
        return true; // Action taken
    } else if (hostiles.length > 0) {
        // Fallback to any hostile if no aggressive ones are found
        const target = tower.pos.findClosestByRange(hostiles);
        tower.attack(target);
        return true; // Action taken
    }

    return false; // No action taken
},

    healCreeps: function(tower) {
        const injuredCreeps = tower.room.find(FIND_MY_CREEPS, {
            filter: (creep) => creep.hits < creep.hitsMax
        });
        if (injuredCreeps.length > 0) {
            const target = tower.pos.findClosestByRange(injuredCreeps);
            tower.heal(target);
            return true; // Action taken
        }
        return false; // No action taken
    },

    repairStructures: function(tower) {
        // Proceed with repairs if the tower has more than 90% of its energy capacity
        if (tower.energy > (tower.energyCapacity * 0.8)) { 
            const criticalStructures = tower.room.find(FIND_STRUCTURES, {
                filter: (structure) => structure.hits < structure.hitsMax * 0.2 && // Target at-risk structures
                                        structure.structureType !== STRUCTURE_WALL &&
                                        structure.structureType !== STRUCTURE_RAMPART
            });
            if (criticalStructures.length > 0) {
                // Sort by lowest hits to prioritize the most damaged structure
                const target = _.min(criticalStructures, s => s.hits);
                tower.repair(target);
                return true; // Action taken
            }
        }
        return false; // No action taken due to insufficient energy or lack of targets
    },
    
};

module.exports = towers;
