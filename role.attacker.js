// TODO
// When conquering:
// Target structures that impede path
// Squad composition

var movement = require('./src/u.movement');

var roleAttacker = {

    run: function(creep) {
        this.kiteAndAttack(creep);
        this.hitsPerTickCalculation(creep);

        if (this.shouldRegroup(creep)) {
            this.regroupWithAllies(creep);
        } else if (this.needsHealing(creep)) {
            this.moveToHealer(creep);
        }
    },
    
    //Aggressive

    kiteAndAttack: function(creep) {
            // Find all hostiles and prioritize them
        const hostiles = creep.room.find(FIND_HOSTILE_CREEPS);
        const prioritizedTargets = hostiles.sort((a, b) => {
            const priorityA = this.getTargetPriority(a);
            const priorityB = this.getTargetPriority(b);
            return priorityA - priorityB || creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b);
        });
    
        const target = prioritizedTargets.length > 0 ? prioritizedTargets[0] : null;
        const hostilesNearby = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 3); // Check for hostiles within 3 tiles for mass attack
    
        if (hostilesNearby.length > 2 && creep.rangedMassAttack() === OK) {
            creep.say('💥');
        } else if (target) {
            if (creep.pos.getRangeTo(target) > 3) {
                // Too far, move closer but maintain distance
               movement.moveToWithCache(creep, target);
            /*} else if (creep.pos.getRangeTo(target) < 2) {
                // Too close, kite away
                const fleePath = PathFinder.search(creep.pos, {flee: true, range: 3, ...creep.memory.pathFindingOptions}).path;
                movement.moveByPath(fleePath);*/
            } else {
                // Optimal range, attack
                if (creep.rangedAttack(target) !== OK) {
                    movement.moveToWithCache(creep, target);
                }
            }
        }
    },
    
    getTargetPriority: function(target) {
        if (target.getActiveBodyparts(HEAL) > 0) return 1; // Highest priority
        if (target.getActiveBodyparts(RANGED_ATTACK) > 0) return 2;
        if (target.getActiveBodyparts(ATTACK) > 0) return 3;
        return 4; // Default priority for other creeps
    },
    
    
    //Evasive

    shouldRegroup: function(creep) {
        const hostilesNearby = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 5).length;
        const alliesNearby = creep.pos.findInRange(FIND_MY_CREEPS, 5, {
            filter: (c) => c.memory.role === 'attacker' && c.id !== creep.id
        }).length + 1; // Include self in the count
    
        const enemiesToAlliesRatio = hostilesNearby / alliesNearby;
        const tookSignificantDamage = creep.memory.hitsPerTick > (creep.hitsMax * 0.25);
    
        return enemiesToAlliesRatio > 2 || tookSignificantDamage;
    },


    regroupWithAllies: function(creep) {
        // Move towards the nearest allied attacker
        const ally = creep.pos.findClosestByRange(FIND_MY_CREEPS, {
            filter: (c) => c.memory.role === 'attacker' && c.id !== creep.id
        });
        if (ally) {
            movement.moveToWithCache(creep, ally);
        }
    },

    needsHealing: function(creep) {
        // Define threshold for when creep should seek healing
        return creep.hits < creep.hitsMax * 0.5; // Example: less than 50% health
    },

    moveToHealer: function(creep) {
        // Move towards the nearest healer creep
        const healer = creep.pos.findClosestByRange(FIND_MY_CREEPS, {
            filter: (c) => c.memory.role === 'healer'
        });
        if (healer) {
            movement.moveToWithCache(creep, healer);
        }
    },

    hitsPerTickCalculation: function(creep) {
        if (!creep.memory.lastHits) {
            creep.memory.lastHits = creep.hits;
        }

        const hitsLostThisTick = creep.memory.lastHits - creep.hits;
        creep.memory.hitsPerTick = hitsLostThisTick; // Store for decision making
        creep.memory.lastHits = creep.hits; // Update for next tick's calculation
    },
};

module.exports = roleAttacker;
