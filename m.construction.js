var memories = require('./m.memories');

var construction = {
    
    manageConstruction: function(room) {
        if (!room) return;
        
        // Check if room memory exists
        if (!Memory.rooms[room.name] || 
            !Memory.rooms[room.name].phase) {
            console.log(`Room ${room.name} missing memory or phase information`);
            return;
        }
        
        // Initialize construct if it doesn't exist
        if (!Memory.rooms[room.name].construct) {
            Memory.rooms[room.name].construct = {};
        }
        
        // Initialize structureCount if it doesn't exist
        if (!Memory.rooms[room.name].construct.structureCount) {
            this.countStructures(room);
        }
        
        // Check if we have builders available
        const buildersCount = _.filter(Game.creeps, c => c.memory.role === 'builder' && (c.memory.home === room.name || !c.memory.home)).length;
        if (buildersCount < 1) {
            return;
        }
        
        // Get structure counts
        const structureCount = Memory.rooms[room.name].construct.structureCount;
        const phase = Memory.rooms[room.name].phase.Phase;
        
        // Log current phase and structure counts for debugging
        if (Game.time % 100 === 0) {
            console.log(`Room ${room.name} Phase: ${phase}, Extensions: ${structureCount.extensions.built}/${structureCount.extensions.pending}`);
        }
        
        // Check for construction sites - limit total number to avoid CPU waste
        const constructionSites = room.find(FIND_CONSTRUCTION_SITES);
        if (constructionSites.length >= 5) {
            return; // Too many construction sites already
        }
        
        // Prioritize construction based on room phase
        console.log(`Room ${room.name} - Managing construction for phase ${phase}`);
        
        // Always check for extensions first if available
        const extensionsAvailable = this.checkExtensionsAvailable(room);
        if (extensionsAvailable > 0) {
            console.log(`Room ${room.name} - Attempting to place extensions (${extensionsAvailable} available)`);
            if (this.placeExtensions(room)) {
                return; // Successfully placed an extension
            }
        }
        
        switch (phase) {
            case 1:
                // Phase 1: Focus on containers near sources
                this.placeContainersNearSources(room);
                break;
                
            case 2:
            case 3:
                // Phase 2-3: Ensure containers are built, then place extensions
                if ((structureCount.containers.built + structureCount.containers.pending) < 2) {
                    this.placeContainersNearSources(room);
                }
                break;
                
            case 4:
                // Phase 4: Place storage if needed
                if (structureCount.storage.built < 1 && structureCount.storage.pending < 1) {
                    this.placeStorage(room);
                }
                break;
                
            case 5:
            case 6:
                // Phase 5-6: Place links if needed
                if (structureCount.links.built < 2 && structureCount.links.pending < 1) {
                    this.placeLinks(room);
                }
                
                // Place towers if available
                else if (this.checkTowersAvailable(room) > 0) {
                    this.placeTower(room);
                }
                break;
                
            default:
                // Higher phases: Focus on advanced structures
                if (this.checkTowersAvailable(room) > 0) {
                    this.placeTower(room);
                }
                break;
        }
    },
    
    removeAllConstructionSites: function(){
        for (let id in Game.constructionSites) {
            let site = Game.constructionSites[id];
            site.remove();
        }
        console.log("All construction sites have been removed.");
    },
    

    //Construction Memories - Structure Awareness

    // Count structures - Container, Storage, Extractor, Link, Terminal, Tower
    countStructures: function(room) {
        if (!room) return;
        
        // Initialize structure counts if necessary
        if (!Memory.rooms[room.name]) {
            Memory.rooms[room.name] = {};
        }
        
        if (!Memory.rooms[room.name].construct) {
            Memory.rooms[room.name].construct = {};
        }
        
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
        
        // Ensure all structure types are initialized
        const structureTypes = ['extensions', 'containers', 'storage', 'extractor', 'links', 'terminal', 'towers'];
        for (const type of structureTypes) {
            if (!structuresCount[type]) {
                structuresCount[type] = {built: 0, pending: 0};
            }
        }

        // Reset structure counts
        for (const key in structuresCount) {
            structuresCount[key].built = 0;
            structuresCount[key].pending = 0;
        }

        // Use a more efficient approach by grouping structures by type
        const structures = room.find(FIND_STRUCTURES);
        const structuresByType = _.groupBy(structures, 'structureType');
        
        // Count built structures
        if (structuresByType[STRUCTURE_EXTENSION]) structuresCount.extensions.built = structuresByType[STRUCTURE_EXTENSION].length;
        if (structuresByType[STRUCTURE_CONTAINER]) structuresCount.containers.built = structuresByType[STRUCTURE_CONTAINER].length;
        if (structuresByType[STRUCTURE_STORAGE]) structuresCount.storage.built = structuresByType[STRUCTURE_STORAGE].length;
        if (structuresByType[STRUCTURE_EXTRACTOR]) structuresCount.extractor.built = structuresByType[STRUCTURE_EXTRACTOR].length;
        if (structuresByType[STRUCTURE_LINK]) structuresCount.links.built = structuresByType[STRUCTURE_LINK].length;
        if (structuresByType[STRUCTURE_TERMINAL]) structuresCount.terminal.built = structuresByType[STRUCTURE_TERMINAL].length;
        if (structuresByType[STRUCTURE_TOWER]) structuresCount.towers.built = structuresByType[STRUCTURE_TOWER].length;

        // Use the same approach for construction sites
        const sites = room.find(FIND_CONSTRUCTION_SITES);
        const sitesByType = _.groupBy(sites, 'structureType');
        
        // Count construction sites
        if (sitesByType[STRUCTURE_EXTENSION]) structuresCount.extensions.pending = sitesByType[STRUCTURE_EXTENSION].length;
        if (sitesByType[STRUCTURE_CONTAINER]) structuresCount.containers.pending = sitesByType[STRUCTURE_CONTAINER].length;
        if (sitesByType[STRUCTURE_STORAGE]) structuresCount.storage.pending = sitesByType[STRUCTURE_STORAGE].length;
        if (sitesByType[STRUCTURE_EXTRACTOR]) structuresCount.extractor.pending = sitesByType[STRUCTURE_EXTRACTOR].length;
        if (sitesByType[STRUCTURE_LINK]) structuresCount.links.pending = sitesByType[STRUCTURE_LINK].length;
        if (sitesByType[STRUCTURE_TERMINAL]) structuresCount.terminal.pending = sitesByType[STRUCTURE_TERMINAL].length;
        if (sitesByType[STRUCTURE_TOWER]) structuresCount.towers.pending = sitesByType[STRUCTURE_TOWER].length;
    },

    cacheRoomStructures: function(room) {
        if (!Memory.rooms[room.name] || !Memory.rooms[room.name].lastUpdate || Game.time - Memory.rooms[room.name].lastUpdate > 50) {
            // Update every 50 ticks or if the room structure is not in memory
            Memory.rooms[room.name] = {
                structures: {},
                lastUpdate: Game.time
            };
            room.find(FIND_STRUCTURES).forEach(struct => {
                if (!Memory.rooms[room.name].structures[struct.structureType]) {
                    Memory.rooms[room.name].structures[struct.structureType] = [];
                }
                Memory.rooms[room.name].structures[struct.structureType].push(struct.id);
            });
        }
    },

    checkExtensionsAvailable: function(room) {
        // Maximum extensions allowed by controller level
        const extensionsLimits = [0, 0, 5, 10, 20, 30, 40, 50, 60]; // Indexed by controller level
        const controllerLevel = room.controller.level;

        // Ensure structure count exists
        if (!Memory.rooms[room.name].construct || !Memory.rooms[room.name].construct.structureCount) {
            this.countStructures(room);
        }

        // Get current number of extensions and extension construction sites
        const extensions = Memory.rooms[room.name].construct.structureCount.extensions.built || 0;
        const extensionSites = Memory.rooms[room.name].construct.structureCount.extensions.pending || 0;
        const totalExtensions = extensions + extensionSites;

        // Calculate the number of extensions that can still be built
        const extensionsAvailable = extensionsLimits[controllerLevel] - totalExtensions;

        // Log for debugging
        if (Game.time % 100 === 0) {
            console.log(`Room ${room.name} - Extensions: ${extensions} built, ${extensionSites} pending, ${extensionsAvailable} available`);
        }

        return extensionsAvailable;
    },

    checkTowersAvailable: function(room) {
        // Maximum towers allowed by controller level
        const towersLimits = [0, 0, 0, 1, 1, 2, 2, 3, 6]; // Indexed by controller level
        const controllerLevel = room.controller.level;

        // Get current number of towers and tower construction sites
        const towers = Memory.rooms[room.name].construct.structureCount.towers.built;
        const towerSites = Memory.rooms[room.name].construct.structureCount.towers.pending;
        const totalTowers = towers + towerSites;

        // Calculate the number of towers that can still be built
        const towersAvailable = towersLimits[controllerLevel] - totalTowers;

        return towersAvailable;
    },

    // Site Placement Methods
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
                }
            });

            for (let j = 0; j < path.path.length; j++) {
                const pos = path.path[j];
                room.createConstructionSite(pos, STRUCTURE_ROAD);
            }
        }
    },

    // Method to place a spawn in a room
    placeSpawn: function(room) {
        // Find a suitable position for the spawn
        const center = new RoomPosition(25, 25, room.name);
        const terrain = room.getTerrain();
        
        // Search in a spiral pattern from the center
        for (let radius = 1; radius <= 10; radius++) {
            for (let x = center.x - radius; x <= center.x + radius; x++) {
                for (let y = center.y - radius; y <= center.y + radius; y++) {
                    // Only check positions on the edge of the current radius
                    if (x === center.x - radius || x === center.x + radius || 
                        y === center.y - radius || y === center.y + radius) {
                        
                        // Check if the position is valid for a spawn
                        if (x >= 0 && x < 50 && y >= 0 && y < 50 && 
                            terrain.get(x, y) !== TERRAIN_MASK_WALL) {
                            
                            const pos = new RoomPosition(x, y, room.name);
                            const result = room.createConstructionSite(pos, STRUCTURE_SPAWN);
                            
                            if (result === OK) {
                                console.log(`Placed spawn construction site at ${pos}`);
                                return true;
                            }
                        }
                    }
                }
            }
        }
        
        console.log(`Failed to place spawn in room ${room.name}`);
        return false;
    },

    // Method to place containers near sources
    placeContainersNearSources: function(room) {
        if (!room) return;
        
        // Check if room memory exists and has source data
        if (!Memory.rooms[room.name] || 
            !Memory.rooms[room.name].mapping || 
            !Memory.rooms[room.name].mapping.sources || 
            !Memory.rooms[room.name].mapping.sources.id) {
            console.log(`No sources found in memory for room ${room.name}`);
            return;
        }
        
        const sourceIds = Memory.rooms[room.name].mapping.sources.id;
        if (!sourceIds || sourceIds.length === 0) {
            console.log(`No sources found in memory for room ${room.name}`);
            return;
        }

        // Check if we've already placed enough containers
        const structureCount = Memory.rooms[room.name].construct.structureCount;
        if (structureCount && 
            structureCount.containers && 
            (structureCount.containers.built + structureCount.containers.pending) >= sourceIds.length) {
            return; // We already have enough containers (one per source)
        }

        // Find sources that don't have containers nearby
        for (const sourceId of sourceIds) {
            const source = Game.getObjectById(sourceId);
            if (!source) continue;

            // Check if there's already a container near this source
            const nearbyContainers = source.pos.findInRange(FIND_STRUCTURES, 1, {
                filter: { structureType: STRUCTURE_CONTAINER }
            });
            
            const nearbyContainerSites = source.pos.findInRange(FIND_CONSTRUCTION_SITES, 1, {
                filter: { structureType: STRUCTURE_CONTAINER }
            });

            if (nearbyContainers.length > 0 || nearbyContainerSites.length > 0) {
                continue; // Skip if there's already a container or site
            }

            // Find a suitable position for the container
            const terrain = room.getTerrain();
            let bestPos = null;
            let bestScore = -Infinity;

            // Check positions around the source
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue; // Skip the source itself
                    
                    const x = source.pos.x + dx;
                    const y = source.pos.y + dy;
                    
                    if (x < 0 || x >= 50 || y < 0 || y >= 50) continue;
                    
                    const terrainType = terrain.get(x, y);
                    if (terrainType === TERRAIN_MASK_WALL) continue;
                    
                    // Score the position (prefer plains over swamps)
                    let score = terrainType === 0 ? 2 : 1;
                    
                    // Check if the position is already occupied
                    const lookResults = room.lookAt(x, y);
                    let isOccupied = false;
                    
                    for (const result of lookResults) {
                        if (result.type === 'structure' || result.type === 'constructionSite') {
                            isOccupied = true;
                            break;
                        }
                    }
                    
                    if (isOccupied) continue;
                    
                    // Update best position if this one is better
                    if (score > bestScore) {
                        bestScore = score;
                        bestPos = new RoomPosition(x, y, room.name);
                    }
                }
            }

            // Place container at the best position
            if (bestPos) {
                const result = room.createConstructionSite(bestPos, STRUCTURE_CONTAINER);
                if (result === OK) {
                    console.log(`Placed container construction site near source at ${bestPos}`);
                    return; // Place one container at a time to avoid overbuilding
                }
            }
        }
    },

    // Method to place storage
    placeStorage: function(room) {
        // Find a suitable position for storage, preferably near the controller
        const controller = room.controller;
        if (!controller) return;

        // Find the spawn
        const spawns = room.find(FIND_MY_SPAWNS);
        if (spawns.length === 0) return;
        
        const spawn = spawns[0];
        
        // Calculate a position between spawn and controller
        const midX = Math.floor((spawn.pos.x + controller.pos.x) / 2);
        const midY = Math.floor((spawn.pos.y + controller.pos.y) / 2);
        
        // Search in a spiral pattern from the midpoint
        const terrain = room.getTerrain();
        for (let radius = 0; radius <= 5; radius++) {
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dy = -radius; dy <= radius; dy++) {
                    // Only check positions on the edge of the current radius
                    if (Math.abs(dx) === radius || Math.abs(dy) === radius) {
                        const x = midX + dx;
                        const y = midY + dy;
                        
                        // Check if the position is valid
                        if (x >= 0 && x < 50 && y >= 0 && y < 50 && 
                            terrain.get(x, y) !== TERRAIN_MASK_WALL) {
                            
                            const pos = new RoomPosition(x, y, room.name);
                            
                            // Check if the position is already occupied
                            const structures = room.lookForAt(LOOK_STRUCTURES, x, y);
                            const constructionSites = room.lookForAt(LOOK_CONSTRUCTION_SITES, x, y);
                            
                            if (structures.length === 0 && constructionSites.length === 0) {
                                const result = room.createConstructionSite(pos, STRUCTURE_STORAGE);
                                if (result === OK) {
                                    console.log(`Placed storage construction site at ${pos}`);
                                    return true;
                                }
                            }
                        }
                    }
                }
            }
        }
        
        console.log(`Failed to place storage in room ${room.name}`);
        return false;
    },

    // Method to place towers
    placeTower: function(room) {
        // Find a suitable position for the tower
        const spawn = room.find(FIND_MY_SPAWNS)[0];
        if (!spawn) return false;
        
        // Try to place tower near spawn for better defense
        const terrain = room.getTerrain();
        
        // Search in a spiral pattern from the spawn
        for (let radius = 2; radius <= 5; radius++) {
            for (let x = spawn.pos.x - radius; x <= spawn.pos.x + radius; x++) {
                for (let y = spawn.pos.y - radius; y <= spawn.pos.y + radius; y++) {
                    // Only check positions on the edge of the current radius
                    if (Math.abs(x - spawn.pos.x) === radius || Math.abs(y - spawn.pos.y) === radius) {
                        // Check if the position is valid
                        if (x >= 0 && x < 50 && y >= 0 && y < 50 && 
                            terrain.get(x, y) !== TERRAIN_MASK_WALL) {
                            
                            const pos = new RoomPosition(x, y, room.name);
                            
                            // Check if the position is already occupied
                            const structures = room.lookForAt(LOOK_STRUCTURES, x, y);
                            const constructionSites = room.lookForAt(LOOK_CONSTRUCTION_SITES, x, y);
                            
                            if (structures.length === 0 && constructionSites.length === 0) {
                                const result = room.createConstructionSite(pos, STRUCTURE_TOWER);
                                if (result === OK) {
                                    console.log(`Placed tower construction site at ${pos}`);
                                    return true;
                                }
                            }
                        }
                    }
                }
            }
        }
        
        console.log(`Failed to place tower in room ${room.name}`);
        return false;
    },

    // Method to place links
    placeLinks: function(room) {
        // Check if we have sources and storage
        const sources = room.find(FIND_SOURCES);
        const storage = room.storage;
        
        if (!storage || sources.length === 0) return false;
        
        // First, try to place a link near storage if there isn't one already
        const storageLinks = storage.pos.findInRange(FIND_STRUCTURES, 2, {
            filter: { structureType: STRUCTURE_LINK }
        });
        
        const storageLinkSites = storage.pos.findInRange(FIND_CONSTRUCTION_SITES, 2, {
            filter: { structureType: STRUCTURE_LINK }
        });
        
        // If no storage link exists or is being built, place one
        if (storageLinks.length === 0 && storageLinkSites.length === 0) {
            const terrain = room.getTerrain();
            
            // Find a suitable position near storage
            for (let dx = -2; dx <= 2; dx++) {
                for (let dy = -2; dy <= 2; dy++) {
                    if (dx === 0 && dy === 0) continue; // Skip the storage itself
                    
                    const x = storage.pos.x + dx;
                    const y = storage.pos.y + dy;
                    
                    if (x < 0 || x >= 50 || y < 0 || y >= 50) continue;
                    if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
                    
                    const pos = new RoomPosition(x, y, room.name);
                    
                    // Check if position is free
                    const lookResults = room.lookAt(x, y);
                    let isOccupied = false;
                    
                    for (const result of lookResults) {
                        if (result.type === 'structure' || result.type === 'constructionSite') {
                            isOccupied = true;
                            break;
                        }
                    }
                    
                    if (!isOccupied) {
                        const result = room.createConstructionSite(pos, STRUCTURE_LINK);
                        if (result === OK) {
                            console.log(`Placed storage link construction site at ${pos}`);
                            return true;
                        }
                    }
                }
            }
        }
        
        // Then try to place links near sources that don't have one
        for (const source of sources) {
            const sourceLinks = source.pos.findInRange(FIND_STRUCTURES, 2, {
                filter: { structureType: STRUCTURE_LINK }
            });
            
            const sourceLinkSites = source.pos.findInRange(FIND_CONSTRUCTION_SITES, 2, {
                filter: { structureType: STRUCTURE_LINK }
            });
            
            // If this source already has a link or construction site, skip it
            if (sourceLinks.length > 0 || sourceLinkSites.length > 0) continue;
            
            // Find a suitable position for the link
            const terrain = room.getTerrain();
            
            for (let dx = -2; dx <= 2; dx++) {
                for (let dy = -2; dy <= 2; dy++) {
                    if (dx === 0 && dy === 0) continue; // Skip the source itself
                    
                    const x = source.pos.x + dx;
                    const y = source.pos.y + dy;
                    
                    if (x < 0 || x >= 50 || y < 0 || y >= 50) continue;
                    if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
                    
                    const pos = new RoomPosition(x, y, room.name);
                    
                    // Check if position is free
                    const lookResults = room.lookAt(x, y);
                    let isOccupied = false;
                    
                    for (const result of lookResults) {
                        if (result.type === 'structure' || result.type === 'constructionSite') {
                            isOccupied = true;
                            break;
                        }
                    }
                    
                    if (!isOccupied) {
                        const result = room.createConstructionSite(pos, STRUCTURE_LINK);
                        if (result === OK) {
                            console.log(`Placed source link construction site at ${pos}`);
                            return true;
                        }
                    }
                }
            }
        }
        
        return false;
    },

    // Method to place extensions in an efficient pattern
    placeExtensions: function(room) {
        // Check if we can build more extensions
        const extensionsAvailable = this.checkExtensionsAvailable(room);
        if (extensionsAvailable <= 0) return false;
        
        // Log for debugging
        console.log(`Room ${room.name} can build ${extensionsAvailable} more extensions`);
        
        // Get the weighted center of the room or use spawn as reference
        let centerX, centerY;
        
        // Initialize construct.weightedCenter if it doesn't exist
        if (!Memory.rooms[room.name].construct.weightedCenter) {
            Memory.rooms[room.name].construct = {
                ...Memory.rooms[room.name].construct,
                weightedCenter: {}
            };
        }
        
        if (Memory.rooms[room.name].construct.weightedCenter && 
            Memory.rooms[room.name].construct.weightedCenter.x !== undefined && 
            Memory.rooms[room.name].construct.weightedCenter.y !== undefined) {
            centerX = Memory.rooms[room.name].construct.weightedCenter.x;
            centerY = Memory.rooms[room.name].construct.weightedCenter.y;
        } else {
            const spawn = room.find(FIND_MY_SPAWNS)[0];
            if (!spawn) return false;
            centerX = spawn.pos.x;
            centerY = spawn.pos.y;
            
            // Store the center position for future use
            Memory.rooms[room.name].construct.weightedCenter = {
                x: centerX,
                y: centerY
            };
        }
        
        // Define extension patterns - these are offsets from the center
        const patterns = [
            // Flower pattern
            [
                {x: 0, y: -2}, {x: 1, y: -1}, {x: 2, y: 0}, {x: 1, y: 1}, {x: 0, y: 2},
                {x: -1, y: 1}, {x: -2, y: 0}, {x: -1, y: -1}
            ],
            // Outer ring
            [
                {x: 0, y: -3}, {x: 1, y: -3}, {x: 2, y: -2}, {x: 3, y: -1}, {x: 3, y: 0},
                {x: 3, y: 1}, {x: 2, y: 2}, {x: 1, y: 3}, {x: 0, y: 3}, {x: -1, y: 3},
                {x: -2, y: 2}, {x: -3, y: 1}, {x: -3, y: 0}, {x: -3, y: -1}, {x: -2, y: -2},
                {x: -1, y: -3}
            ]
        ];
        
        const terrain = room.getTerrain();
        
        // Try each pattern
        for (const pattern of patterns) {
            for (const offset of pattern) {
                const x = centerX + offset.x;
                const y = centerY + offset.y;
                
                // Check if position is valid
                if (x < 2 || x > 47 || y < 2 || y > 47) continue;
                if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
                
                const pos = new RoomPosition(x, y, room.name);
                
                // Check if position is free
                const structures = room.lookForAt(LOOK_STRUCTURES, x, y);
                const constructionSites = room.lookForAt(LOOK_CONSTRUCTION_SITES, x, y);
                
                if (structures.length === 0 && constructionSites.length === 0) {
                    const result = room.createConstructionSite(pos, STRUCTURE_EXTENSION);
                    if (result === OK) {
                        console.log(`Placed extension construction site at ${pos}`);
                        return true;
                    }
                }
            }
        }
        
        return false;
    }
};

module.exports = construction;