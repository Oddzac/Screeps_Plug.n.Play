var memories = require('a.memories');

var construction = {
    
    //TODO
    //placeLinks method - needs to check if there is already a link near given source and ignore if so (continue placing as able)
    
    manageConstruction: function(room) {
        
        const spawns = room.find(FIND_MY_SPAWNS);
        const buildersCount = _.filter(Game.creeps, { memory: { role: 'builder' } }).length;
        const activeSitesCount = Object.keys(Game.constructionSites).length;
        const activeSites = Object.keys(Game.constructionSites);
        const containersBuilt = Memory.rooms[room.name].containersBuilt;
        const containerSites = Object.values(Game.constructionSites).filter(site => site.structureType === STRUCTURE_CONTAINER && site.room.name === room).length;
        const storageBuilt = Memory.rooms[room.name].storageBuilt;
        const storageSites = Object.values(Game.constructionSites).filter(site => site.structureType === STRUCTURE_STORAGE && site.room.name === room).length;
        const linksBuilt = Memory.rooms[room.name].linksBuilt;
        const linkSites = Object.values(Game.constructionSites).filter(site => site.structureType === STRUCTURE_LINK && site.room.name === room).length;
        const towerSites = Object.values(Game.constructionSites).filter(site => site.structureType === STRUCTURE_TOWER && site.room.name === room).length;

        
        if (buildersCount < 1) {
            //console.log("Insufficient builders to initiate construction.");
            return;
        }

        if (this.checkExtensionsAvailable(room) > 0) {
            this.placeExtensionsAroundSpawn(room);
        }

        if (this.checkTowersAvailable(room) > 0) {
            this.placeTower(room);
        }

        if (Memory.rooms[room.name].phase.Phase < 2) {
            this.placeContainersNearSources(room);
            return;
        } else if (Memory.rooms[room.name].phase.Phase <3 && containersBuilt > 1) {
            //this.connectAndTrackProgress(room);
            return;
        } else if (Memory.rooms[room.name].phase.Phase < 5 && memories.storageBuilt < 1 && storageSites < 1) {
            this.placeStorage(room);
            return;
        } else if (Memory.rooms[room.name].phase.Phase < 6) {
            if (linksBuilt < 2) {
                //this.placeLinks(room);
            }
            return;
        }

    },
    
    removeAllConstructionSites: function(){
        for (let id in Game.constructionSites) {
            let site = Game.constructionSites[id];
            site.remove();
        }
        Memory.rooms[room.name].constructionRuns = 0;
        console.log("All construction sites have been removed.");
    },
    

    connectAndTrackProgress: function(room) {
        // Initialize or fetch memory structure for tracking construction progress
        if (!Memory.rooms[room.name].constructionProgress) {
            Memory.rooms[room.name].constructionProgress = { spawnToPOIsCompleted: false, allPOIsConnected: false };
        }
    
        // Run the logic to connect spawn to Points of Interest (POIs)
        if (!Memory.rooms[room.name].constructionProgress.spawnToPOIsCompleted) {
            this.connectSpawnToPOIs(room);
        }
    
        // Run the logic to connect all POIs with each other
        if (!Memory.rooms[room.name].constructionProgress.allPOIsConnected) {
            this.connectAllPOIs(room);
        }
    
        // Check if both tasks are marked as completed
        if (Memory.rooms[room.name].constructionProgress.spawnToPOIsCompleted && Memory.rooms[room.name].constructionProgress.allPOIsConnected) {
            console.log("All targets connected and all POIs connected. Incrementing construction runs.");
            Memory.rooms[room.name].constructionRuns = (Memory.rooms[room.name].constructionRuns || 0) + 1;
            Memory.rooms[room.name].constructionProgress = null; // Reset progress for future operations
        }
    },
    
// Site Placement Methods
//
//
//    
connectSpawnToPOIs: function(room) {
    // Ensure memory initialization for construction progress tracking
    if (!Memory.rooms[room.name].constructionProgress) {
        Memory.rooms[room.name].constructionProgress = { spawnToPOIsCompleted: false, allPOIsConnected: false, currentTargetIndex: 0, currentPathIndex: 0 };
    }
    if (Memory.rooms[room.name].constructionProgress.spawnToPOIsCompleted) return; // Skip if already completed

        const sources = room.find(FIND_SOURCES);
        const targets = [room.controller, ...sources];
        const startIndex = Memory.rooms[room.name].constructionProgress.currentTargetIndex || 0;
        const spawns = room.find(FIND_MY_SPAWNS);
        const spawn = spawns [0];

        for (let i = startIndex; i < targets.length; i++) {
            const target = targets[i];
            const path = PathFinder.search(spawn.pos, { pos: target.pos, range: 1 }, {
                roomCallback: (roomName) => this.pathCostMatrix(roomName)
            }).path;

            let pathIndex = Memory.rooms[room.name].constructionProgress.currentPathIndex || 0;
            for (; pathIndex < path.length; pathIndex++) {
                const pos = path[pathIndex];
                const result = room.createConstructionSite(pos.x, pos.y, STRUCTURE_ROAD);
                if (result === ERR_FULL) {
                    // Save progress and exit
                    Memory.rooms[room.name].constructionProgress.currentTargetIndex = i;
                    Memory.rooms[room.name].constructionProgress.currentPathIndex = pathIndex;
                    return; // Early return due to site limit
                } else if (result !== OK) {
                    console.log(`Failed to create road at (${pos.x},${pos.y}) in room ${room.name}, result: ${result}`);
                }
            }
            // Reset path index for the next target
            Memory.rooms[room.name].constructionProgress.currentPathIndex = 0;
        }

        // Mark the task as completed if all targets have been processed
        Memory.rooms[room.name].constructionProgress.spawnToPOIsCompleted = true;
        Memory.rooms[room.name].constructionProgress.currentTargetIndex = 0; // Reset for future operations
        Memory.rooms[room.name].constructionProgress.currentPathIndex = 0; // Reset for future operations
    },

    connectAllPOIs: function(room) {
        // Use the same memory structure for tracking, ensuring it's specific to the room
        if (!Memory.rooms[room.name].constructionProgress) {
            Memory.rooms[room.name].constructionProgress = { spawnToPOIsCompleted: false, allPOIsConnected: false, currentPairIndex: 0, currentPathIndex: 0 };
        }
    
        // Skip if already completed
        if (Memory.rooms[room.name].constructionProgress.allPOIsConnected) return;
    
        const sources = room.find(FIND_SOURCES);
        const structures = room.find(FIND_MY_STRUCTURES, {
            filter: structure => [STRUCTURE_CONTAINER, STRUCTURE_EXTENSION].includes(structure.structureType)
        });
        const targets = [...sources, ...structures];
    
        // Generate all pairs of targets to connect, if not already generated
        if (!Memory.rooms[room.name].constructionProgress.targetPairs || Memory.rooms[room.name].constructionProgress.targetPairs.length === 0) {
            Memory.rooms[room.name].constructionProgress.targetPairs = [];
            for (let i = 0; i < targets.length; i++) {
                for (let j = i + 1; j < targets.length; j++) {
                    Memory.rooms[room.name].constructionProgress.targetPairs.push({ start: targets[i].id, end: targets[j].id });
                }
            }
        }
    
        let pairIndex = Memory.rooms[room.name].constructionProgress.currentPairIndex || 0;
        let targetPairs = Memory.rooms[room.name].constructionProgress.targetPairs;
    
        // Resume or start connecting each pair with roads
        for (; pairIndex < targetPairs.length; pairIndex++) {
            const pair = targetPairs[pairIndex];
            const startTarget = Game.getObjectById(pair.start);
            const endTarget = Game.getObjectById(pair.end);
    
            const path = PathFinder.search(startTarget.pos, { pos: endTarget.pos, range: 1 }, {
                roomCallback: (roomName) => this.pathCostMatrix(roomName)
            }).path;
    
            let pathIndex = Memory.rooms[room.name].constructionProgress.currentPathIndex || 0;
            for (; pathIndex < path.length; pathIndex++) {
                const pos = path[pathIndex];
                const result = room.createConstructionSite(pos.x, pos.y, STRUCTURE_ROAD);
                if (result === ERR_FULL) {
                    // Save progress and exit
                    Memory.rooms[room.name].constructionProgress.currentPairIndex = pairIndex;
                    Memory.rooms[room.name].constructionProgress.currentPathIndex = pathIndex;
                    return; // Early return due to site limit
                } else if (result !== OK) {
                    console.log(`Failed to create road at (${pos.x},${pos.y}) in room ${room.name}, result: ${result}`);
                }
            }
            // Reset path index for the next target pair
            Memory.rooms[room.name].constructionProgress.currentPathIndex = 0;
        }
    
        // Mark the task as completed if all pairs have been processed
        Memory.rooms[room.name].constructionProgress.allPOIsConnected = true;
        Memory.rooms[room.name].constructionProgress.currentPairIndex = 0; // Reset for future operations
        Memory.rooms[room.name].constructionProgress.currentPathIndex = 0; // Reset for future operations
    },
    

    placeContainersNearSources: function(room) {
        const spawn = room.find(FIND_MY_SPAWNS)[0];
        if (!spawn) return;

        const sources = room.find(FIND_SOURCES);
        sources.forEach(source => {
            const path = PathFinder.search(spawn.pos, {pos: source.pos, range: 2}, {
                plainCost: 2,
                swampCost: 10,
                roomCallback: function(roomName) {
                    let costs = new PathFinder.CostMatrix();
                    Game.rooms[roomName].find(FIND_STRUCTURES).forEach(function(struct) {
                        if (struct.structureType === STRUCTURE_ROAD) {
                            costs.set(struct.pos.x, struct.pos.y, 1);
                        } else if (struct.structureType !== STRUCTURE_CONTAINER &&
                                struct.structureType !== STRUCTURE_RAMPART) {
                            costs.set(struct.pos.x, struct.pos.y, 0xff);
                        }
                    });
                    return costs;
                }
            });

            if (path.path.length > 0) {
                let targetTile = path.path[path.path.length - 1];
                if (!room.lookForAt(LOOK_STRUCTURES, targetTile.x, targetTile.y).length && 
                    !room.lookForAt(LOOK_CONSTRUCTION_SITES, targetTile.x, targetTile.y).length) {
                    room.createConstructionSite(targetTile.x, targetTile.y, STRUCTURE_CONTAINER);
                }
            }
        });
    },
    
    placeExtensionsAroundSpawn: function(room) {
        const spawn = room.find(FIND_MY_SPAWNS)[0];
        if (!spawn) return;
    
        // Start with an initial radius. Start from 1 and increase in odd increments.
        if (!room.memory.extensionRadius) room.memory.extensionRadius = 1;
    
        let radius = room.memory.extensionRadius;
        let placed = false;
        let attempts = 0; // Keep track of attempts to avoid infinite loops
    
        while (!placed && attempts < 10) { // Limit attempts to prevent infinite loop
            const angleStep = 2 * Math.PI / (Math.floor(radius * Math.PI)); // Adjust number of segments based on the radius
            for (let i = 0; i < Math.floor(radius * Math.PI); i++) { // Adjust loop to go through all segments
                const dx = Math.round(radius * Math.cos(angleStep * i));
                const dy = Math.round(radius * Math.sin(angleStep * i));
                const x = spawn.pos.x + dx;
                const y = spawn.pos.y + dy;
    
                if (x >= 0 && x < 50 && y >= 0 && y < 50) {
                    const terrain = room.getTerrain().get(x, y);
                    const isObstructed = room.lookForAt(LOOK_STRUCTURES, x, y).length > 0 || 
                                         room.lookForAt(LOOK_CONSTRUCTION_SITES, x, y).length > 0;
    
                    if (terrain !== TERRAIN_MASK_WALL && !isObstructed) {
                        const result = room.createConstructionSite(x, y, STRUCTURE_EXTENSION);
                        if (result === OK) {
                            console.log(`Extension construction site placed at (${x}, ${y}) with radius ${radius}.`);
                            room.memory.extensionRadius = 1;
                            placed = true;
                            break; // Exit the loop once a site is successfully placed
                        } else if (result === ERR_FULL) {
                            console.log('Construction site limit reached, halting extension placement.');
                            return; // Stop trying to place more if we hit the limit
                        }
                    }
                }
            }
    
            if (!placed) {
                radius += 2; // Only increment radius in odd steps if no place was found
                room.memory.extensionRadius = radius; // Update memory with new radius
            }
            attempts++;
        }
    
        if (!placed) {
            console.log('Failed to place new extensions after expanding radius, possibly due to lack of space or game limits.');
        }
        room.memory.roadConstructionProgress = { currentIndex: 0, completed: false };
    },
     
    placeSpawn: function(room) {
        const searchRadius = 5; // Define a search area around the weighted center

        // Calculate weighted center
        let sumX = 0, sumY = 0, count = 0;
        const controller = room.controller;
        const sources = room.find(FIND_SOURCES);
        sumX += controller.pos.x; sumY += controller.pos.y; count++;
        sources.forEach(s => { sumX += s.pos.x; sumY += s.pos.y; count++; });
        const weightedCenterX = Math.floor(sumX / count);
        const weightedCenterY = Math.floor(sumY / count);
        console.log(`Weighted Center: (${weightedCenterX}, ${weightedCenterY})`);


        // Generate all possible positions within the search radius
        let potentialPositions = [];
        for (let dx = -searchRadius; dx <= searchRadius; dx++) {
            for (let dy = -searchRadius; dy <= searchRadius; dy++) {
                let x = weightedCenterX + dx;
                let y = weightedCenterY + dy;
                // Ensure coordinates are within room bounds
                if (x >= 1 && x <= 48 && y >= 1 && y <= 48) {
                    potentialPositions.push({ x, y });
                }
            }
        }
    
        // Shuffle the array of potential positions to randomize the order
        for (let i = potentialPositions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [potentialPositions[i], potentialPositions[j]] = [potentialPositions[j], potentialPositions[i]]; // ES6 array destructuring to swap elements
        }
    
        // Iterate through the randomized potential positions
        for (let pos of potentialPositions) {
            const terrain = room.getTerrain().get(pos.x, pos.y);
            if (terrain !== TERRAIN_MASK_WALL) {
                const look = room.lookAt(pos.x, pos.y);
                if (!look.some(s => s.type === 'structure' || s.type === 'constructionSite')) {
                    // Check for valid spot
                    const result = room.createConstructionSite(pos.x, pos.y, STRUCTURE_SPAWN);
                    if (result === OK) {
                        console.log(`Spawn placed at (${pos.x},${pos.y}).`);
                        return; // Exit the function after placing the tower
                    }
                }
            }
        }
        console.log("No valid placement found for spawn");
    },



    placeTower: function(room) {
        // Count existing towers and tower construction sites in the room
        const myTowers = room.find(FIND_MY_STRUCTURES, {
            filter: { structureType: STRUCTURE_TOWER }
        }).length;
        const towersPlanned = room.find(FIND_MY_CONSTRUCTION_SITES, {
            filter: (site) => site.structureType === STRUCTURE_TOWER
        }).length;

        let searchRadius; // Define a search area around the weighted center
        let towerMax = 0;
        // Determine the maximum number of towers allowed based on room's controller level
        const controllerLevel = room.controller.level;
        if (controllerLevel >= 3 && controllerLevel < 5) {
            towerMax = 1; // Levels 3 and 4 can have 1 tower
            searchRadius = 3;
        } else if (controllerLevel == 5) {
            towerMax = 2; // Level 5 can have 2 towers
            searchRadius = 5;
        } else if (controllerLevel >= 6) {
            towerMax = 3; // Level 6+ can have 3 towers (simplify for example)
            searchRadius = 7;
        }

        // Check if the current number of towers plus planned towers is greater than or equal to the max
        if (myTowers + towersPlanned >= towerMax) {
            //console.log("Maximum number of towers reached or exceeded. No new tower placement attempted.");
            return; // Exit the function to prevent further tower placement
        }

        // Find structures to set weighted center
        const spawns = room.find(FIND_MY_SPAWNS);
        const controller = room.controller;
        const sources = room.find(FIND_SOURCES);

        // Calculate weighted center
        let sumX = 0, sumY = 0, count = 0;
        spawns.forEach(s => { sumX += s.pos.x; sumY += s.pos.y; count++; });
        sumX += controller.pos.x; sumY += controller.pos.y; count++;
        sources.forEach(s => { sumX += s.pos.x; sumY += s.pos.y; count++; });
        const weightedCenterX = Math.floor(sumX / count);
        const weightedCenterY = Math.floor(sumY / count);
        console.log(`Weighted Center: (${weightedCenterX}, ${weightedCenterY})`);


        // Generate all possible positions within the search radius
        let potentialPositions = [];
        for (let dx = -searchRadius; dx <= searchRadius; dx++) {
            for (let dy = -searchRadius; dy <= searchRadius; dy++) {
                let x = weightedCenterX + dx;
                let y = weightedCenterY + dy;
                // Ensure coordinates are within room bounds
                if (x >= 1 && x <= 48 && y >= 1 && y <= 48) {
                    potentialPositions.push({ x, y });
                }
            }
        }
    
        // Shuffle the array of potential positions to randomize the order
        for (let i = potentialPositions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [potentialPositions[i], potentialPositions[j]] = [potentialPositions[j], potentialPositions[i]]; // ES6 array destructuring to swap elements
        }
    
        // Iterate through the randomized potential positions
        for (let pos of potentialPositions) {
            const terrain = room.getTerrain().get(pos.x, pos.y);
            if (terrain !== TERRAIN_MASK_WALL) {
                const look = room.lookAt(pos.x, pos.y);
                if (!look.some(s => s.type === 'structure' || s.type === 'constructionSite')) {
                    // Check for valid spot
                    const result = room.createConstructionSite(pos.x, pos.y, STRUCTURE_TOWER);
                    if (result === OK) {
                        console.log(`Tower placed at (${pos.x},${pos.y}).`);
                        return; // Exit the function after placing the tower
                    }
                }
            }
        }
        console.log("No valid placement found for tower.");
    },

    placeStorage: function(room) {
        // Gather key structures
        const myStorage= room.find(FIND_MY_STRUCTURES, {
            filter: { structureType: STRUCTURE_STORAGE }
        }).length;
        const spawns = room.find(FIND_MY_SPAWNS);
        const controller = room.controller;
        const sources = room.find(FIND_SOURCES);

        if (myStorage > 0) {
            //console.log(`${myStorage} storage already built`);
            return;
        }
    
        // Calculate weighted center
        let sumX = 0, sumY = 0, count = 0;
        spawns.forEach(s => { sumX += s.pos.x; sumY += s.pos.y; count++; });
        sumX += controller.pos.x; sumY += controller.pos.y; count++;
        sources.forEach(s => { sumX += s.pos.x; sumY += s.pos.y; count++; });
        const weightedCenterX = Math.floor(sumX / count);
        const weightedCenterY = Math.floor(sumY / count);
    
        // Define a search area around the weighted center
        let searchRadius = 7; // Adjust based on room layout and preferences
        for (let dx = -searchRadius; dx <= searchRadius; dx++) {
            for (let dy = -searchRadius; dy <= searchRadius; dy++) {
                let x = weightedCenterX + dx;
                let y = weightedCenterY + dy;
                // Ensure coordinates are within room bounds
                if (x < 1 || x > 48 || y < 1 || y > 48) continue;
                
                const terrain = room.getTerrain().get(x, y);
                if (terrain !== TERRAIN_MASK_WALL) {
                    const look = room.lookAt(x, y);
                    if (!look.some(s => s.type === 'structure' || s.type === 'constructionSite')) {
                        // Check for valid spot
                        const result = room.createConstructionSite(x, y, STRUCTURE_STORAGE);
                        if (result === OK) {
                            console.log(`Storage placed at (${x},${y}).`);
                            return; // Exit the function after placing the tower
                        }
                    }
                }
            }
        }
        console.log("No valid placement found for storage");
    },



    //  I'M WORKIN' HERE!!!

    placeLinks: function(room) {
        // Ensure there's a storage structure from which to base link placement
        const storage = room.storage;
        if (!storage) return; // Exit if no storage exists in the room

        // Try to place the first link 2 tiles away from the storage
        this.tryLink(room, storage.pos, 2);

        // Proceed to place links near sources, also at a range of 2
        const sources = room.find(FIND_SOURCES);
        sources.forEach(source => {
            this.tryLink(room, source.pos, 2);
        });
    },

    tryLink: function(room, pos, range) {
        // Define an area around the position to search for a valid link placement spot
        for (let dx = -range; dx <= range; dx++) {
            for (let dy = -range; dy <= range; dy++) {
                // Skip the center tile and directly adjacent tiles
                if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) continue;
    
                let targetPos = new RoomPosition(pos.x + dx, pos.y + dy, room.name);
    
                // Check if the target position is suitable for construction
                if (this.isSuitableForConstruction(room, targetPos)) {
                    // Attempt to create a construction site for a link
                    const result = room.createConstructionSite(targetPos, STRUCTURE_LINK);
                    if (result === OK) {
                        console.log('Link construction site created at', targetPos);
                        return; // Exit after placing one link to avoid multiple placements in one call
                    }
                }
            }
        }
    },
    
    isSuitableForConstruction: function(room, pos) {
        // Check for obstructions like structures or construction sites
        const obstructions = room.lookForAt(LOOK_STRUCTURES, pos).concat(room.lookForAt(LOOK_CONSTRUCTION_SITES, pos));
        if (obstructions.length > 0) return false;
    
        // Check if the terrain is walkable (i.e., not a wall)
        const terrain = room.getTerrain().get(pos.x, pos.y);
        return terrain !== TERRAIN_MASK_WALL;
    },

    



    pathCostMatrix: function(roomName) {
        let room = Game.rooms[roomName];
        if (!room) return;
        let costs = new PathFinder.CostMatrix();

        room.find(FIND_STRUCTURES).forEach(function(struct) {
            if (struct.structureType === STRUCTURE_ROAD) {
                // Favor roads
                costs.set(struct.pos.x, struct.pos.y, 1);
            } else if (struct.structureType !== STRUCTURE_CONTAINER &&
                       struct.structureType !== STRUCTURE_RAMPART &&
                       !struct.my) {
                // Make non-walkable structures impassable
                costs.set(struct.pos.x, struct.pos.y, 0xff);
            }
        });

        room.find(FIND_CONSTRUCTION_SITES).forEach(function(site) {
            if (site.structureType === STRUCTURE_ROAD) {
                // Reduce cost slightly to encourage using future road sites
                costs.set(site.pos.x, site.pos.y, 2);
            } else if (site.structureType !== STRUCTURE_CONTAINER &&
                       site.structureType !== STRUCTURE_RAMPART) {
                // Avoid construction sites for non-walkable structures
                costs.set(site.pos.x, site.pos.y, 0xff);
            }
        });

        return costs;
    },

    getTerrainIndex: function(x, y) {
        return y * 50 + x; // Convert (x, y) position to index in the flat array
    },
    
    getPrioritizedSources: function(room) {
        const terrainData = Memory.terrainData[room.name];
        let sources = room.find(FIND_SOURCES).map(source => {
            let swampCount = 0;
            let wallCount = 0;
            const range = 2; // Define the range to check around each source
    
            for (let dx = -range; dx <= range; dx++) {
                for (let dy = -range; dy <= range; dy++) {
                    const x = source.pos.x + dx;
                    const y = source.pos.y + dy;
                    if (x >= 0 && x < 50 && y >= 0 && y < 50) {
                        const index = this.getTerrainIndex(x, y);
                        const terrainType = terrainData[index];
                        if (terrainType === TERRAIN_MASK_SWAMP) swampCount++;
                        if (terrainType === TERRAIN_MASK_WALL) wallCount++;
                    }
                }
            }
    
            return {
                source, // Reference to the source object
                terrainScore: { swampCount, wallCount }
            };
        });
    
        sources.sort((a, b) => b.terrainScore.swampCount - a.terrainScore.swampCount ||
                              b.terrainScore.wallCount - a.terrainScore.wallCount);
    
        return sources.map(item => item.source); // Return an array of sources for compatibility
    },
    

    checkExtensionsAvailable: function(room) {
        // Maximum extensions allowed by controller level
        const extensionsLimits = [0, 0, 5, 10, 20, 30, 40, 50, 60]; // Indexed by controller level
        const controllerLevel = room.controller.level;
    
        // Get current number of extensions and extension construction sites
        const extensions = room.find(FIND_MY_STRUCTURES, {
            filter: { structureType: STRUCTURE_EXTENSION }
        });
        const extensionSites = room.find(FIND_MY_CONSTRUCTION_SITES, {
            filter: { structureType: STRUCTURE_EXTENSION }
        });
        const totalExtensions = extensions.length + extensionSites.length;
    
        // Calculate the number of extensions that can still be built
        const extensionsAvailable = extensionsLimits[controllerLevel] - totalExtensions;
    
        return extensionsAvailable;
    },

    checkTowersAvailable: function(room) {
        // Maximum extensions allowed by controller level
        const towersLimits = [0, 0, 0, 1, 1, 2, 2, 3, 6]; // Indexed by controller level
        const controllerLevel = room.controller.level;
    
        // Get current number of extensions and extension construction sites
        const towers = room.find(FIND_MY_STRUCTURES, {
            filter: { structureType: STRUCTURE_TOWER }
        });
        const towerSites = room.find(FIND_MY_CONSTRUCTION_SITES, {
            filter: { structureType: STRUCTURE_TOWER }
        });
        const totalTowers = towers.length + towerSites.length;
    
        // Calculate the number of extensions that can still be built
        const towersAvailable = towersLimits[controllerLevel] - totalTowers;
    
        return towersAvailable;
    }
    
    
    

};

module.exports = construction;
