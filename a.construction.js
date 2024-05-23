//TODO
// MAINTAIN ROAD CONNECTIONS 
// - EACH STRUCTURE TO EACH OTHER STRUCTURE


var memories = require('a.memories');

var construction = {
    
    //TODO
    //placeLinks method - needs to check if there is already a link near given source and ignore if so (continue placing as able)
    
    manageConstruction: function(room) {
        
        const spawns = room.find(FIND_MY_SPAWNS);
        const buildersCount = _.filter(Game.creeps, { memory: { role: 'builder' } }).length;
        //const activeSitesCount = Object.keys(Game.constructionSites).length;
        //const activeSites = Object.keys(Game.constructionSites);
        const structureCount = Memory.rooms[room.name].construct.structureCount;
        const containersBuilt = structureCount.containers.built; //Memory.rooms[room.name].containersBuilt;
        const containerSites = structureCount.containers.pending; //Object.values(Game.constructionSites).filter(site => site.structureType === STRUCTURE_CONTAINER && site.room.name === room).length;
        const storageBuilt = structureCount.storage.built; //Memory.rooms[room.name].storageBuilt;
        const storageSites = structureCount.storage.pending; //Object.values(Game.constructionSites).filter(site => site.structureType === STRUCTURE_STORAGE && site.room.name === room).length;
        const linksBuilt = structureCount.links.built; //Memory.rooms[room.name].linksBuilt;
        const linkSites = structureCount.links.pending; //Object.values(Game.constructionSites).filter(site => site.structureType === STRUCTURE_LINK && site.room.name === room).length;
        const towersBuilt = structureCount.towers.built; 
        const towerSites = structureCount.towers.pending; //Object.values(Game.constructionSites).filter(site => site.structureType === STRUCTURE_TOWER && site.room.name === room).length;

        
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
            
            return;
        } else if (Memory.rooms[room.name].phase.Phase < 5 && storageBuilt < 1 && storageSites < 1) {
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
        console.log("All construction sites have been removed.");
    },
    



//Construction Memories

// Count structures - Container, Storage, Extractor, Link, Terminal, Tower
countStructures: function(room) {
    // Initialize structure counts if necessary
    if (!Memory.rooms[room.name].construct.structureCount) {
        Memory.rooms[room.name].construct.structureCount = {
            extensions: {built: 0, pending: 0},
            containers: {built: 0, pending: 0},
            storage: {built: 0, pending: 0},
            extractor: {built: 0, pending: 0},
            links: {built: 0, pending: 0},
            terminal: {built: 0, pending: 0},
            towers: {built: 0, pending: 0},
        };
    }

    const structuresCount = Memory.rooms[room.name].construct.structureCount;
    if (!structuresCount.extensions) {
        structuresCount.extensions = {built: 0, pending: 0};
    }

    // Reset structure counts
    for (let key in structuresCount) {
        structuresCount[key].built = 0;
        structuresCount[key].pending = 0;
    }

    // Count built structures
    room.find(FIND_STRUCTURES).forEach(structure => {
        switch (structure.structureType) {
            case STRUCTURE_EXTENSION:
                structuresCount.extensions.built++;
            case STRUCTURE_CONTAINER:
                structuresCount.containers.built++;
                break;
            case STRUCTURE_STORAGE:
                structuresCount.storage.built++;
                break;
            case STRUCTURE_EXTRACTOR:
                structuresCount.extractor.built++;
                break;
            case STRUCTURE_LINK:
                structuresCount.links.built++;
                break;
            case STRUCTURE_TERMINAL:
                structuresCount.terminal.built++;
                break;
            case STRUCTURE_TOWER:
                structuresCount.towers.built++;
                break;
        }
    });

    // Count construction sites
    room.find(FIND_CONSTRUCTION_SITES).forEach(site => {
        switch (site.structureType) {
            case STRUCTURE_EXTENSION:
                structuresCount.extensions.pending++;
            case STRUCTURE_CONTAINER:
                structuresCount.containers.pending++;
                break;
            case STRUCTURE_STORAGE:
                structuresCount.storage.pending++;
                break;
            case STRUCTURE_EXTRACTOR:
                structuresCount.extractor.pending++;
                break;
            case STRUCTURE_LINK:
                structuresCount.links.pending++;
                break;
            case STRUCTURE_TERMINAL:
                structuresCount.terminal.pending++;
                break;
            case STRUCTURE_TOWER:
                structuresCount.towers.pending++;
                break;
        }
    });
},

//Weighted Center - Find central location based on Controller, Spawn, and Sources
findCenterWeighted: function(room) {

    if (!Memory.rooms[room.name].construct.weightedCenter) {
        Memory.rooms[room.name].construct.weightedCenter = {x: 0, y: 0}
    }

    const weightedCenter = Memory.rooms[room.name].construct.weightedCenter;

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
    weightedCenter.x = weightedCenterX
    weightedCenter.y = weightedCenterY
},

checkExtensionsAvailable: function(room) {
    // Maximum extensions allowed by controller level
    const extensionsLimits = [0, 0, 5, 10, 20, 30, 40, 50, 60]; // Indexed by controller level
    const controllerLevel = room.controller.level;

    // Get current number of extensions and extension construction sites
    const extensions = Memory.rooms[room.name].construct.structureCount.extensions.built;
    const extensionSites = Memory.rooms[room.name].construct.structureCount.extensions.pending;
    const totalExtensions = extensions + extensionSites;

    // Calculate the number of extensions that can still be built
    const extensionsAvailable = extensionsLimits[controllerLevel] - totalExtensions;

    return extensionsAvailable;
},

checkTowersAvailable: function(room) {
    // Maximum extensions allowed by controller level
    const towersLimits = [0, 0, 0, 1, 1, 2, 2, 3, 6]; // Indexed by controller level
    const controllerLevel = room.controller.level;

    // Get current number of extensions and extension construction sites
    const towers = Memory.rooms[room.name].construct.structureCount.towers.built;
    const towerSites = Memory.rooms[room.name].construct.structureCount.towers.pending;
    const totalTowers = towers + towerSites.length;

    // Calculate the number of extensions that can still be built
    const towersAvailable = towersLimits[controllerLevel] - totalTowers;

    return towersAvailable;
},

// Site Placement Methods
//
//
//    


connectExtensionsToStorage: function(roomName) {
    const room = Game.rooms[roomName];
    if (!room) {
        console.log('Connect: room not found');
        return;
    }

    const storagePos = room.storage ? room.storage.pos : null;
    if (!storagePos) {
        console.log('Connect: Storage not found in the room.');
        return;
    }

    const extensions = room.find(FIND_MY_STRUCTURES, {
        filter: { structureType: STRUCTURE_EXTENSION }
    });

    if (extensions.length === 0) {
        console.log('Connect: No extensions found in the room.');
        return;
    }

    for (let i = 0; i < extensions.length; i++) {
        const extension = extensions[i];
        const path = PathFinder.search(storagePos, { pos: extension.pos, range: 1 }, {
            plainCost: 2,
            swampCost: 10,
            roomCallback: function(roomName) {
                let room = Game.rooms[roomName];
                if (!room) return;
                let costs = new PathFinder.CostMatrix;

                room.find(FIND_STRUCTURES).forEach(function(struct) {
                    if (struct.structureType === STRUCTURE_ROAD) {
                        costs.set(struct.pos.x, struct.pos.y, 1);
                    } else if (struct.structureType !== STRUCTURE_CONTAINER &&
                               (struct.structureType !== STRUCTURE_RAMPART || !struct.my)) {
                        costs.set(struct.pos.x, struct.pos.y, 0xff);
                    }
                });
                return costs;
            },
        });

        for (let j = 0; j < path.path.length; j++) {
            const pos = path.path[j];
            room.createConstructionSite(pos, STRUCTURE_ROAD);
        }
    }
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
                Game.rooms[room.name].find(FIND_STRUCTURES).forEach(function(struct) {
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
    if (!room.memory.construct.extensionRadius) room.memory.construct.extensionRadius = 2;

    let radius = room.memory.construct.extensionRadius;
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
                        room.memory.construct.extensionRadius = 2;
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
            room.memory.construct.extensionRadius = radius; // Update memory with new radius
        }
        attempts++;
    }

    if (!placed) {
        console.log('Failed to place new extensions after expanding radius, possibly due to lack of space or game limits.');
    }
},
    
placeSpawn: function(room) {
    const searchRadius = 5; // Define a search area around the weighted center

    // Calculate weighted center
    if (!Memory.rooms[room.name].construct.weightedCenter) {
        this.findCenterWeighted(room);
    }

    const weightedCenterX = Memory.rooms[room.name].construct.weightedCenter.x;
    const weightedCenterY = Memory.rooms[room.name].construct.weightedCenter.y;


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


    if (!Memory.rooms[room.name].construct.weightedCenter) {
        this.findCenterWeighted(room);
    }

    const weightedCenterX = Memory.rooms[room.name].construct.weightedCenter.x;
    const weightedCenterY = Memory.rooms[room.name].construct.weightedCenter.y;


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
    if (!Memory.rooms[room.name].construct.weightedCenter) {
        this.findCenterWeighted(room);
    }

    const weightedCenterX = Memory.rooms[room.name].construct.weightedCenter.x;
    const weightedCenterY = Memory.rooms[room.name].construct.weightedCenter.y;

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
    const result = this.tryLink(room, storage.pos, 2);

    if (result === OK) {
        // Proceed to place links near sources, also at a range of 2
        const sources = room.find(FIND_SOURCES);
        sources.forEach(source => {
            this.tryLink(room, source.pos, 2);
        });
    }
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
    const obstructions = room.lookForAt(LOOK_STRUCTURES, pos).concat(room.lookForAt(LOOK_CONSTRUCTION_SITES, pos));
    if (obstructions.length > 0) return false;

    const terrain = Memory.rooms[room.name].mapping.terrainData[this.getTerrainIndex(pos.x, pos.y)];
    return terrain !== TERRAIN_MASK_WALL;
}, 

pathCostMatrix: function(roomName) {
    if (!Memory.rooms[roomName] || !Memory.rooms[roomName].mapping || !Memory.rooms[roomName].mapping.costMatrix) {
        console.log('Cost matrix for room not found:', roomName);
        return new PathFinder.CostMatrix();
    }

    return PathFinder.CostMatrix.deserialize(Memory.rooms[roomName].mapping.costMatrix);
},

getTerrainIndex: function(x, y) {
    return y * 50 + x; // Convert (x, y) position to index in the flat array
},
    
    

};

module.exports = construction;
