var utility = require('./u.utilities');
var movement = require('./u.movement');
var giveWay = require("./u.giveWay");

var roleBuilder = {
    run: function(creep) {
        if(creep.memory.harvesting && creep.store.getFreeCapacity() === 0) {
            creep.memory.harvesting = false;
            delete creep.memory.sourceId;
            delete creep.memory.waitStartTime;
            this.assignTask(creep);
            // Register energy request as soon as we start building
            this.registerEnergyRequest(creep);
        } else if(!creep.memory.harvesting && creep.store[RESOURCE_ENERGY] === 0) {
            // Check if there are haulers in the room
            const haulers = _.filter(Game.creeps, c => c.memory.role === 'hauler' && c.room.name === creep.room.name).length;
            
            // If no haulers, go harvest immediately
            if (haulers === 0) {
                creep.memory.harvesting = true;
                delete creep.memory.task;
                delete creep.memory.waitStartTime;
                this.clearRequest(creep);
            } else {
                // Start waiting timer if not already set
                if (!creep.memory.waitStartTime) {
                    creep.memory.waitStartTime = Game.time;
                    // Register energy request
                    this.registerEnergyRequest(creep);
                    creep.say('⏳');
                }
                
                // Check if we've waited long enough
                if (Game.time - creep.memory.waitStartTime > 30) {
                    creep.memory.harvesting = true;
                    delete creep.memory.task;
                    delete creep.memory.waitStartTime;
                    this.clearRequest(creep);
                    creep.say('⌛');
                } else {
                    // Stay near the work site while waiting
                    this.waitNearWorksite(creep);
                    return; // Skip the rest of the function
                }
            }
        }
    
        if(creep.memory.harvesting) {
            utility.harvestEnergy(creep);
        } else {
            // Register energy request when below 90% capacity while working
            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) < creep.store.getCapacity() * 0.90) {
                this.registerEnergyRequest(creep);
            }
            this.performTask(creep);
        }
        creep.giveWay();
    },
    
    registerEnergyRequest: function(creep) {
        // Initialize the energy request registry if it doesn't exist
        if (!Memory.rooms[creep.room.name].energyRequests) {
            Memory.rooms[creep.room.name].energyRequests = {};
        }
        
        // Create or update request with additional information
        Memory.rooms[creep.room.name].energyRequests[creep.id] = {
            id: creep.id,
            pos: {x: creep.pos.x, y: creep.pos.y, roomName: creep.room.name},
            amount: creep.store.getFreeCapacity(RESOURCE_ENERGY),
            timestamp: Game.time,
            task: creep.memory.task || 'unknown',
            working: creep.memory.working || false,
            lastUpdated: Game.time
        };
    },
    
    clearRequest: function(creep) {
        // Clear the request when no longer needed
        if (Memory.rooms[creep.room.name].energyRequests && 
            Memory.rooms[creep.room.name].energyRequests[creep.id]) {
            delete Memory.rooms[creep.room.name].energyRequests[creep.id];
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
        
        // Update position in energy request if it exists
        if (Memory.rooms[creep.room.name].energyRequests && 
            Memory.rooms[creep.room.name].energyRequests[creep.id]) {
            Memory.rooms[creep.room.name].energyRequests[creep.id].pos = {
                x: creep.pos.x, 
                y: creep.pos.y, 
                roomName: creep.room.name
            };
            Memory.rooms[creep.room.name].energyRequests[creep.id].lastUpdated = Game.time;
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
            // Check if the creep is standing on a road
            const isOnRoad = creep.pos.lookFor(LOOK_STRUCTURES).some(s => s.structureType === STRUCTURE_ROAD);
            
            // If we're on a road and within range to build, find a better position
            if (isOnRoad && creep.pos.inRangeTo(targetSite, 3)) {
                // Find positions around the construction site that aren't roads
                const positions = this.findNonRoadPositionsNearTarget(creep, targetSite);
                
                if (positions.length > 0) {
                    // Move to the best non-road position
                    creep.say('🚶‍♂️');
                    movement.moveToWithCache(creep, positions[0]);
                    return;
                }
            }
            
            // Build if in range, otherwise move to target
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
    
    // Helper function to find non-road positions near a target
    findNonRoadPositionsNearTarget: function(creep, target) {
        const positions = [];
        const range = 3; // Build range
        
        // Check positions in a square around the target
        for (let x = Math.max(0, target.pos.x - range); x <= Math.min(49, target.pos.x + range); x++) {
            for (let y = Math.max(0, target.pos.y - range); y <= Math.min(49, target.pos.y + range); y++) {
                // Skip positions that are too far (outside the build range)
                const pos = new RoomPosition(x, y, target.pos.roomName);
                if (!pos.inRangeTo(target, range)) continue;
                
                // Skip the position if it's a road or has a creep
                const hasRoad = pos.lookFor(LOOK_STRUCTURES).some(s => s.structureType === STRUCTURE_ROAD);
                const hasCreep = pos.lookFor(LOOK_CREEPS).length > 0;
                const isWall = pos.lookFor(LOOK_TERRAIN)[0] === 'wall';
                
                if (!hasRoad && !hasCreep && !isWall) {
                    // Calculate score based on distance to target and terrain
                    let score = pos.getRangeTo(target); // Lower is better
                    
                    // Prefer plain terrain over swamp
                    if (pos.lookFor(LOOK_TERRAIN)[0] === 'swamp') {
                        score += 2;
                    }
                    
                    positions.push({
                        pos: pos,
                        score: score
                    });
                }
            }
        }
        
        // Sort positions by score (lower is better)
        positions.sort((a, b) => a.score - b.score);
        
        // Return the positions
        return positions.map(p => p.pos);
    },


    performUpgrade: function(creep) {
        if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
            var target = creep.room.controller
            movement.moveToWithCache(creep, target);
            creep.memory.working = false;
        } else {
            creep.memory.working = true;
        }
    },
    
    waitNearWorksite: function(creep) {
        let target = null;
        
        // Find the appropriate target based on the creep's task
        switch(creep.memory.task) {
            case "building":
                // Find the construction site the creep was working on
                const sites = creep.room.find(FIND_CONSTRUCTION_SITES);
                if (sites.length > 0) {
                    // Use the same prioritization logic as in performBuild
                    let prioritizedSites = sites.map(site => {
                        let priority = 0;
                        if ([STRUCTURE_CONTAINER, STRUCTURE_STORAGE, STRUCTURE_TOWER, STRUCTURE_EXTENSION, STRUCTURE_LINK].includes(site.structureType)) {
                            priority -= 700;
                        }
                        let completionPercentage = site.progress / site.progressTotal;
                        priority += (1 - completionPercentage) * 100;
                        return { site, priority };
                    }).sort((a, b) => a.priority - b.priority);
                    
                    target = prioritizedSites[0].site;
                }
                break;
                
            case "repairing":
                // Find the structure the creep was repairing
                const priorities = [STRUCTURE_TOWER, STRUCTURE_SPAWN, STRUCTURE_EXTENSION, STRUCTURE_STORAGE];
                const priorityTarget = creep.room.find(FIND_STRUCTURES, {
                    filter: s => priorities.includes(s.structureType) && s.hits < s.hitsMax
                })[0];
                
                if (priorityTarget) {
                    target = priorityTarget;
                } else {
                    const damagedStructures = creep.room.find(FIND_STRUCTURES, {
                        filter: s => s.hits < s.hitsMax
                    });
                    if (damagedStructures.length > 0) {
                        target = damagedStructures[0];
                    }
                }
                break;
                
            case "upgrading":
                target = creep.room.controller;
                break;
        }
        
        // If we found a target, wait near it
        if (target) {
            // Check if the creep is standing on a road
            const isOnRoad = creep.pos.lookFor(LOOK_STRUCTURES).some(s => s.structureType === STRUCTURE_ROAD);
            
            // If on a road, try to move off
            if (isOnRoad) {
                this.moveOffRoad(creep, target);
            } else if (creep.pos.getRangeTo(target) > 3) {
                movement.moveToWithCache(creep, target, 3);
            }
            
            creep.say('⏳' + (30 - (Game.time - creep.memory.waitStartTime)));
        }
    },
    
    // Helper function to move a creep off a road while staying in range of the target
    moveOffRoad: function(creep, target) {
        // Check all adjacent positions
        const directions = [TOP, TOP_RIGHT, RIGHT, BOTTOM_RIGHT, BOTTOM, BOTTOM_LEFT, LEFT, TOP_LEFT];
        
        // Shuffle directions to add randomness
        for (let i = directions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [directions[i], directions[j]] = [directions[j], directions[i]];
        }
        
        for (const direction of directions) {
            // Calculate the new position
            const dx = [0, 1, 1, 1, 0, -1, -1, -1][direction - 1];
            const dy = [-1, -1, 0, 1, 1, 1, 0, -1][direction - 1];
            const newX = creep.pos.x + dx;
            const newY = creep.pos.y + dy;
            
            // Skip if out of bounds
            if (newX < 0 || newX > 49 || newY < 0 || newY > 49) {
                continue;
            }
            
            const newPos = new RoomPosition(newX, newY, creep.room.name);
            
            // Check if the new position is in range of the target
            if (!newPos.inRangeTo(target, 3)) {
                continue;
            }
            
            // Check if the new position has a road or is blocked
            const structures = creep.room.lookForAt(LOOK_STRUCTURES, newX, newY);
            const hasRoad = structures.some(s => s.structureType === STRUCTURE_ROAD);
            const hasCreep = creep.room.lookForAt(LOOK_CREEPS, newX, newY).length > 0;
            const terrain = Game.map.getRoomTerrain(creep.room.name);
            const isWall = terrain.get(newX, newY) === TERRAIN_MASK_WALL;
            
            // If the position is valid, move there
            if (!hasRoad && !hasCreep && !isWall) {
                creep.move(direction);
                creep.say('🚶');
                return true;
            }
        }
        
        return false;
    }
};

module.exports = roleBuilder;