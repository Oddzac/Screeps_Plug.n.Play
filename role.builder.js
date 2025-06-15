var utility = require('./u.utilities');
var movement = require('./u.movement');
var giveWay = require("./u.giveWay");
var collaboration = require('./u.collaboration');

var roleBuilder = {
    run: function(creep) {
        // Check if we should switch roles based on colony needs
        const newRole = collaboration.evaluateRoleSwitch(creep);
        if (newRole) {
            creep.memory.role = newRole;
            creep.say(`Now ${newRole}`);
            return; // Let the next tick handle the new role's logic
        }
        
        if(creep.memory.harvesting && creep.store.getFreeCapacity() === 0) {
            creep.memory.harvesting = false;
            delete creep.memory.sourceId;
            this.assignTask(creep);
        } else if(!creep.memory.harvesting && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.harvesting = true;
            delete creep.memory.task; // Clear task when harvesting
            
            // Register that we need energy
            collaboration.requestResource(creep, RESOURCE_ENERGY, 2); // Priority 2 for builders
        }
    
        if(creep.memory.harvesting) {
            // If we're full or have been harvesting too long, stop requesting
            if (creep.store.getFreeCapacity() === 0) {
                collaboration.fulfillRequest(creep);
            }
            utility.harvestEnergy(creep);
        } else {
            collaboration.fulfillRequest(creep); // No longer need energy
            this.performTask(creep);
        }
        creep.giveWay();
    },

    
    // Establish priority
    calculateConstructionPriority: function(creep, site) {
        // Priority calculation based on specified rules
        let priority = 0;
    
        // Closest to completion gets highest priority
        let completionRatio = (site.progressTotal - site.progress) / site.progressTotal;
        priority += completionRatio * 100; // Smaller is better, so we subtract from a base value
    
        // Check if the site is directly adjacent to sources
        let sources = Memory.rooms[creep.room.name].mapping.sources.id;
        let isAdjacentToSource = false;
        if (sources) {
            isAdjacentToSource = sources.some(sourceId => {
                const source = Game.getObjectById(sourceId);
                return source && site.pos.inRangeTo(source, 2);
            });
        }
        priority += isAdjacentToSource ? -500 : 0;
    
        // Prioritize containers or extensions
        if (site.structureType === STRUCTURE_LINK) {
            priority -= 1000;
        }

        if (site.structureType === STRUCTURE_CONTAINER || site.structureType === STRUCTURE_EXTENSION  || site.structureType === STRUCTURE_TOWER) {
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
        let spawnSites = 0; //find spawn construction sites
        const towers = creep.room.find(FIND_MY_STRUCTURES, {
            filter: { structureType: STRUCTURE_TOWER }
        });
        let roomsWithSpawnSites = []; // Array to hold names of rooms with spawn sites

        for (const roomName in Game.rooms) {
            let room = Game.rooms[roomName];
            
            // Find all construction sites for spawns in the current room
            let spawnSite = room.find(FIND_CONSTRUCTION_SITES, {
                filter: {structureType: STRUCTURE_SPAWN}
            });
            
            // Check if there are spawn sites in the current room
            if (spawnSite.length > 0) {
                // Add the room name to the array
                roomsWithSpawnSites.push(roomName);
                
                // Optionally, add to the count of spawn sites
                spawnSites += spawnSite.length;
            }
        }


        // Count the number of builders currently repairing / building spawns
        const awayTeamCount = _.sum(Game.creeps, (c) => c.memory.role === 'builder' && c.memory.task === 'awayTeam');
        const repairingBuildersCount = _.sum(Game.creeps, (c) => c.memory.role === 'builder' && c.memory.task === 'repairing');
    
        if(repairingBuildersCount < 1 && structuresNeedingRepair.length > 0) { // Limit builders focused on maintenance 
            creep.say("🛠️");
            creep.memory.task = "repairing";
        } else if (awayTeamCount < 1 && spawnSites > 0) {
            creep.say("🗺️");
            creep.memory.task = "awayTeam";
            creep.memory.targetRoom = roomsWithSpawnSites[0]
            console.log(`${creep.name} assigned to away team`);
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
            case "awayTeam":
                this.performAway(creep);
                break;

        }
    },

//DYNAMICALLY SET TARGET ROOM
    performAway: function(creep) {
        // Define the target room for the away team
        const claimRooms = Object.keys(Memory.conquest.claimRooms).filter(roomName => Memory.conquest.claimRooms[roomName] === true);
        const targetRoom = creep.memory.targetRoom; 
        // Check if the creep is in the target room
        if (creep.room.name !== targetRoom) {
            // Not in target room, find and move towards the exit to target room
            const exitDir = creep.room.findExitTo(targetRoom);
            const exit = creep.pos.findClosestByRange(exitDir);
            creep.moveTo(exit, {visualizePathStyle: {stroke: '#ff69b4'}});
            creep.say('🚀');
        } else {
            // In target room, find spawn construction sites
            const spawnSites = creep.room.find(FIND_CONSTRUCTION_SITES, {
                filter: {structureType: STRUCTURE_SPAWN}
            });
    
            if(spawnSites.length) {
                // If there are spawn sites, move to and build the closest one
                if(creep.build(spawnSites[0]) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(spawnSites[0], {visualizePathStyle: {stroke: '#ffffff'}});
                    creep.say('🚧');
                }
            } else {
                // No spawn construction sites, could assign other tasks or return to home room
                creep.say('🏠');
                creep.suicide();
                // Additional logic here for when no spawn sites are available in the target room
            }
        }
    },
    
    performRepair: function(creep) {
        let priorities = [STRUCTURE_TOWER, STRUCTURE_SPAWN,STRUCTURE_EXTENSION, STRUCTURE_STORAGE];
        let priorityRepairTarget = creep.room.find(FIND_STRUCTURES, {
            filter: (structure) => priorities.includes(structure.structureType) && structure.hits < structure.hitsMax
        }).sort((a, b) => (b.hits / b.hitsMax) - (a.hits / a.hitsMax))[0]; // Prioritize by most damaged
    
        if (priorityRepairTarget) {
            if (creep.repair(priorityRepairTarget) === ERR_NOT_IN_RANGE) {
                movement.moveToWithCache(creep,priorityRepairTarget);
                creep.memory.working = false;
                creep.say('!🔧!');
            } else {
                creep.memory.working = true;
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
                    creep.memory.working = false;
                    creep.say('🔧');
                } else {
                    creep.memory.working = true;
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
            if ([STRUCTURE_CONTAINER, STRUCTURE_STORAGE, STRUCTURE_TOWER, STRUCTURE_EXTENSION, STRUCTURE_LINK].includes(site.structureType)) {
                priority -= 700; // High priority
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
                creep.memory.working = false;
                creep.say('🚧');
            } else {
                creep.memory.working = true;
            }
        } else {
            // If no construction sites, consider repairing or upgrading
            this.performRepair(creep) || this.performUpgrade(creep);
        }
    },


    performUpgrade: function(creep) {
        if (!creep || !creep.room || !creep.room.controller) return;
        
        const result = creep.upgradeController(creep.room.controller);
        
        if (result === ERR_NOT_IN_RANGE) {
            movement.moveToWithCache(creep, creep.room.controller, 3);
            creep.memory.working = false;
            creep.say('🔋');
        } else if (result === OK) {
            creep.memory.working = true;
        }
    },

};

module.exports = roleBuilder;