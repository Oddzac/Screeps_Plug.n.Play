var memories = require('a.memories');

var construction = {
    
    //Memory.rooms[room.name].phase.Phase
    
    manageConstruction: function(room) {
        
        const buildersCount = _.filter(Game.creeps, { memory: { role: 'builder' } }).length;
        const activeSites = Object.keys(Game.constructionSites).length;
        
        if (buildersCount < 1) {
            //console.log("Insufficient builders to initiate construction.");
            return;
        }

        if (this.checkExtensionsAvailable(room) > 0) {
            this.placeExtensionsAroundSpawn(room);
        }

        if (Memory.rooms[room.name].phase.Phase < 2) {
            this.connectAndTrackProgress(room);
            this.placeContainersNearSources(room);
            return;
        } else if (Memory.rooms[room.name].phase.Phase < 3) {
            // No Major Construction
            return;
        } else if (Memory.rooms[room.name].phase.Phase < 4 && memories.towersBuilt < 1) {
            this.placeTower(room);
            return;
        } else if (Memory.rooms[room.name].phase.Phase < 5 && memories.storageBuilt < 1) {
            this.placeStorage(room);
            return;
        }

    },
    
    removeAllConstructionSites: function(){
        for (let id in Game.constructionSites) {
            let site = Game.constructionSites[id];
            site.remove();
        }
        Memory.constructionRuns = 0;
        console.log("All construction sites have been removed.");
    },
    

    connectAndTrackProgress: function(room) {
        // Initialize or fetch memory structure for tracking construction progress
        if (!Memory.constructionProgress) {
            Memory.constructionProgress = { spawnToPOIsCompleted: false, allPOIsConnected: false };
        }
    
        // Run the logic to connect spawn to Points of Interest (POIs)
        if (!Memory.constructionProgress.spawnToPOIsCompleted) {
            this.connectSpawnToPOIs(room);
        }
    
        // Run the logic to connect all POIs with each other
        if (!Memory.constructionProgress.allPOIsConnected) {
            this.connectAllPOIs(room);
        }
    
        // Check if both tasks are marked as completed
        if (Memory.constructionProgress.spawnToPOIsCompleted && Memory.constructionProgress.allPOIsConnected) {
            console.log("All targets connected and all POIs connected. Incrementing construction runs.");
            Memory.constructionRuns = (Memory.constructionRuns || 0) + 1;
            Memory.constructionProgress = null; // Reset progress for future operations
        }
    },
    
// Site Placement Methods
//
//
//    
    connectSpawnToPOIs: function(room) {
        // Ensure memory initialization for construction progress tracking
        if (!Memory.constructionProgress) {
            Memory.constructionProgress = { spawnToPOIsCompleted: false, allPOIsConnected: false };
        }

        // Skip if already completed
        if (Memory.constructionProgress.spawnToPOIsCompleted) return;

        // Define Points of Interest (POIs): Room Controller, Sources, etc.
        const sources = room.find(FIND_SOURCES);
        const targets = [room.controller, ...sources];

        // Connect each target to the spawn
        targets.forEach(target => {
            const path = PathFinder.search(Game.spawns['Spawn1'].pos, { pos: target.pos, range: 1 }, {
                roomCallback: (roomName) => this.pathCostMatrix(roomName)
            }).path;

            // Place roads along the path
            path.forEach(pos => room.createConstructionSite(pos.x, pos.y, STRUCTURE_ROAD));
        });

        // Mark the task as completed
        Memory.constructionProgress.spawnToPOIsCompleted = true;
    },

    connectAllPOIs: function(room) {
        // Use the same memory structure for tracking
        if (!Memory.constructionProgress) {
            Memory.constructionProgress = { spawnToPOIsCompleted: false, allPOIsConnected: false };
        }
    
        // Skip if already completed
        if (Memory.constructionProgress.allPOIsConnected) return;
    
        const sources = room.find(FIND_SOURCES);
        const structures = room.find(FIND_MY_STRUCTURES, {
            filter: structure => [STRUCTURE_CONTAINER, STRUCTURE_EXTENSION].includes(structure.structureType)
        });
        const targets = [...sources, ...structures];
    
        // Generate all pairs of targets to connect
        let targetPairs = [];
        for (let i = 0; i < targets.length; i++) {
            for (let j = i + 1; j < targets.length; j++) {
                targetPairs.push({ start: targets[i], end: targets[j] });
            }
        }
    
        // Connect each pair with roads
        targetPairs.forEach(pair => {
            const path = PathFinder.search(pair.start.pos, { pos: pair.end.pos, range: 1 }, {
                roomCallback: (roomName) => this.pathCostMatrix(roomName)
            }).path;
    
            path.forEach(pos => room.createConstructionSite(pos.x, pos.y, STRUCTURE_ROAD));
        });
    
        // Mark the task as completed
        Memory.constructionProgress.allPOIsConnected = true;
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
    
        // Start with an initial radius. If not defined, start from 5 and will increase in odd increments.
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
     
    placeTower: function(room) {
        // Gather key structures
        const myTowers = room.find(FIND_MY_STRUCTURES, {
            filter: { structureType: STRUCTURE_TOWER }
        }).length;
        const spawns = room.find(FIND_MY_SPAWNS);
        const controller = room.controller;
        const sources = room.find(FIND_SOURCES);
        
        if (myTowers > 0) {
            //console.log(`${myTowers} tower already built`);
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
                        const result = room.createConstructionSite(x, y, STRUCTURE_TOWER);
                        if (result === OK) {
                            console.log(`Tower placed at (${x},${y}).`);
                            return; // Exit the function after placing the tower
                        }
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
    }
    
    
    

};

module.exports = construction;
