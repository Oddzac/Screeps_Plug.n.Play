
var utility = require('a.utilities');
var movement = require('a.movement');

var roleBuilder = {
    run: function(creep) {
        if(creep.memory.harvesting && creep.store.getFreeCapacity() === 0) {
            creep.memory.harvesting = false;
            delete creep.memory.sourceId;
            this.assignTask(creep);
        } else if(!creep.memory.harvesting && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.harvesting = true;
            delete creep.memory.task; // Clear task when harvesting
        }
    
        if(creep.memory.harvesting) {
            utility.harvestEnergy(creep);
        } else {
            this.performTask(creep); // Ensure task execution is correctly called
        }
    },

    
    // Establish priority
    calculateConstructionPriority: function(creep, site) {
        // Priority calculation based on specified rules
        let priority = 0;
    
        // Closest to completion gets highest priority
        let completionRatio = (site.progressTotal - site.progress) / site.progressTotal;
        priority += completionRatio * 100; // Smaller is better, so we subtract from a base value
    
        // Check if the site is directly adjacent to sources
        let sources = creep.room.find(FIND_SOURCES);
        let isAdjacentToSource = sources.some(source => site.pos.inRangeTo(source, 2));
        priority += isAdjacentToSource ? -500 : 0;
    
        // Prioritize containers or extensions
        if (site.structureType === STRUCTURE_CONTAINER || site.structureType === STRUCTURE_EXTENSION  || site.structureType === STRUCTURE_LINK || site.structureType === STRUCTURE_TOWER) {
            priority -= 800;
        }
    
        // Check for proximity to swamp or wall tiles for roads
        if (site.structureType === STRUCTURE_ROAD) {
            let surroundingTerrain = creep.room.lookForAtArea(LOOK_TERRAIN, 
                Math.max(site.pos.y - 1, 0), Math.max(site.pos.x - 1, 0), 
                Math.min(site.pos.y + 1, 49), Math.min(site.pos.x + 1, 49), true);
    
            let isNearSwamp = surroundingTerrain.some(t => t.terrain === 'swamp');
            let isNearWall = surroundingTerrain.some(t => t.terrain === 'wall');
            priority += isNearSwamp ? -500 : 0;
            priority += isNearWall ? -250 : 0;
        }
    
        return priority;
    },


    //Manage task assignment
    assignTask: function(creep) {
        var structuresNeedingRepair = creep.room.find(FIND_STRUCTURES, {
            filter: (structure) => structure.hits < structure.hitsMax
        });
        var constructionSites = creep.room.find(FIND_CONSTRUCTION_SITES);
        
        // Count the number of builders currently repairing

        const repairingBuildersCount = _.sum(Game.creeps, (c) => c.memory.role === 'builder' && c.memory.task === 'repairing');
    
        if(repairingBuildersCount < 1 && structuresNeedingRepair.length > 0) { // Limit builders focused on maintenance 
            creep.say("🛠️");
            creep.memory.task = "repairing";
        } else if(constructionSites.length > 0) {
            creep.say("🚧");
            creep.memory.task = "building";
        } else {
            creep.say("⚡");
            creep.memory.task = "upgrading";
        }
        
        this.performTask(creep);
    },
    
    performTask: function(creep) {
        if (!creep.memory.task) {
            this.assignTask(creep);
        }
        // Execute based on assigned task
        switch(creep.memory.task) {
            case "repairing":                
                this.performRepair(creep);
                break;
            case "building":                
                this.performBuild(creep);
                break;
            case "upgrading":
                this.performUpgrade(creep);
                break;
        }
    },


    performRepair: function(creep) {
        let priorities = [STRUCTURE_TOWER, STRUCTURE_CONTAINER, STRUCTURE_EXTENSION];
        let priorityRepairTarget = creep.room.find(FIND_STRUCTURES, {
            filter: (structure) => priorities.includes(structure.structureType) && structure.hits < structure.hitsMax
        }).sort((a, b) => (b.hitsMax - b.hits) - (a.hitsMax - a.hits))[0]; // Prioritize by most damaged
    
        if (priorityRepairTarget) {
            if (creep.repair(priorityRepairTarget) === ERR_NOT_IN_RANGE) {
                movement.moveToWithCache(creep,priorityRepairTarget);
                creep.say('🔧');
            }
        } else {
            // Find the most damaged structure, not just the closest
            let allDamagedStructures = creep.room.find(FIND_STRUCTURES, {
                filter: (structure) => structure.hits < structure.hitsMax
            }).sort((a, b) => (b.hitsMax - b.hits) - (a.hitsMax - a.hits));
    
            if (allDamagedStructures.length > 0) {
                let mostDamagedStructure = allDamagedStructures[0]; // Most damaged structure
                if (creep.repair(mostDamagedStructure) === ERR_NOT_IN_RANGE) {
                    movement.moveToWithCache(creep, mostDamagedStructure);
                    creep.say('🔧');
                }
            } else {
                // If no structures need repair, check for construction sites or upgrade
                let constructionSites = creep.room.find(FIND_CONSTRUCTION_SITES);
                if (constructionSites.length > 0) {
                    this.performBuild(creep);
                } else {
                    this.performUpgrade(creep);
                }
            }
        }
    },
    
    performBuild: function(creep) {
        let constructionSites = creep.room.find(FIND_CONSTRUCTION_SITES);
    
        let prioritizedSites = constructionSites.map(site => {
            let priority = 0;
    
            // Prioritize containers, towers, and extensions
            if ([STRUCTURE_CONTAINER, STRUCTURE_STORAGE, STRUCTURE_TOWER, STRUCTURE_EXTENSION].includes(site.structureType)) {
                priority -= 500; // High priority
            }
    
            // Next, prioritize based on completion percentage, closer to completion is higher
            let completionPercentage = site.progress / site.progressTotal;
            priority += (1 - completionPercentage) * 100; // Subtracting to prioritize higher completion rates
    
            // Finally, check for proximity to sources, walls, and swamps
            let isNearImportantFeatures = site.pos.findInRange(FIND_SOURCES, 2).length > 0 || 
                                          site.pos.findInRange(FIND_STRUCTURES, 2, {filter: s => s.structureType === STRUCTURE_WALL}).length > 0 ||
                                          site.room.lookForAtArea(LOOK_TERRAIN, site.pos.y - 1, site.pos.x - 1, site.pos.y + 1, site.pos.x + 1, true).some(t => t.terrain === 'swamp');
            if (isNearImportantFeatures) {
                priority -= 300; // Increase priority for being near sources, walls, or swamps
            }
    
            return {
                site,
                priority
            };
        }).sort((a, b) => a.priority - b.priority); // Sort by priority, higher first
    
        let targetSite = prioritizedSites.length > 0 ? prioritizedSites[0].site : null;
    
        if (targetSite) {
            if (creep.build(targetSite) === ERR_NOT_IN_RANGE) {
                movement.moveToWithCache(creep, targetSite);
                creep.say('🚧');
            }
        } else {
            // If no construction sites, consider repairing or upgrading
            this.performRepair(creep) || this.performUpgrade(creep);
        }
    },


    performUpgrade: function(creep) {
        if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
            var target = creep.room.controller
            movement.moveToWithCache(creep, target);
        }
    },

};

module.exports = roleBuilder;
