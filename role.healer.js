//TODO
// Squad composition
// When conquering - Stay with squad (no retreat)

var movement = require('./src/u.movement');
var roleHealer = {

    run: function(creep) {
        this.healAllies(creep);
        this.avoidHostiles(creep);
    },

    healAllies: function(creep) {
        let toHeal = creep.pos.findClosestByRange(FIND_MY_CREEPS, {
            filter: (c) => c.hits < c.hitsMax && c.memory.role !== 'healer'
        });

        if (toHeal) {
            creep.say('🩹');
            if (creep.heal(toHeal) == ERR_NOT_IN_RANGE) {
                movement.moveToWithCache(creep, toHeal);
            } else if (creep.pos.getRangeTo(toHeal) > 1) {
                // Try to use ranged heal if the target is not adjacent
                creep.rangedHeal(toHeal);
            }
        } else {
            // Move towards attackers to stay in range if no one needs healing immediately
            const attacker = creep.pos.findClosestByRange(FIND_MY_CREEPS, {
                filter: (c) => c.memory.role === 'attacker'
            });
            if (attacker && !creep.pos.isNearTo(attacker)) {
                movement.moveToWithCache(creep, attacker);
            }
        }
    },

    // Utility function to keep the healer away from hostiles
    avoidHostiles: function(creep) {
        const hostiles = creep.room.find(FIND_HOSTILE_CREEPS);
        if (hostiles.length > 0) {
            // Find the closest hostile to determine if we need to flee
            const closestHostile = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
            if (closestHostile && creep.pos.getRangeTo(closestHostile) <= 5) {
                // Create a flee path away from the closest hostile
                const fleePath = PathFinder.search(creep.pos, {pos: closestHostile.pos, range: 5}, {flee: true}).path;
                if (fleePath.length > 0) {
                    creep.moveByPath(fleePath);
                    return; // Indicate that the creep is moving away
                }
            }
        }
        return; // Indicate no need to move away if no hostiles are close enough
    },
};

module.exports = roleHealer;
