var memories = require('./m.memories');

// RCL structure limits
const STRUCTURE_LIMITS = {
    [STRUCTURE_SPAWN]: [0, 1, 1, 1, 1, 1, 1, 2, 3],
    [STRUCTURE_EXTENSION]: [0, 0, 5, 10, 20, 30, 40, 50, 60],
    [STRUCTURE_TOWER]: [0, 0, 0, 1, 1, 2, 2, 3, 6],
    [STRUCTURE_STORAGE]: [0, 0, 0, 0, 1, 1, 1, 1, 1],
    [STRUCTURE_LINK]: [0, 0, 0, 0, 0, 2, 3, 4, 6],
    [STRUCTURE_EXTRACTOR]: [0, 0, 0, 0, 0, 0, 1, 1, 1],
    [STRUCTURE_LAB]: [0, 0, 0, 0, 0, 0, 3, 6, 10],
    [STRUCTURE_TERMINAL]: [0, 0, 0, 0, 0, 0, 1, 1, 1],
    [STRUCTURE_CONTAINER]: [5, 5, 5, 5, 5, 5, 5, 5, 5],
    [STRUCTURE_FACTORY]: [0, 0, 0, 0, 0, 0, 0, 1, 1],
    [STRUCTURE_OBSERVER]: [0, 0, 0, 0, 0, 0, 0, 0, 1],
    [STRUCTURE_POWER_SPAWN]: [0, 0, 0, 0, 0, 0, 0, 0, 1],
    [STRUCTURE_NUKER]: [0, 0, 0, 0, 0, 0, 0, 0, 1]
};

var construction = {
    
    manageConstruction: function(room) {
        if (!room) return;
        
        // Check if room memory exists
        if (!Memory.rooms[room.name] || !Memory.rooms[room.name].phase) {
            console.log(`Room ${room.name} missing memory or phase information`);
            return;
        }
        
        // Initialize construct if it doesn't exist
        if (!Memory.rooms[room.name].construct) {
            Memory.rooms[room.name].construct = {};
        }
        
        // Update structure counts once per 20 ticks to save CPU
        if (Game.time % 20 === 0 || !Memory.rooms[room.name].construct.structureCount) {
            this.countStructures(room);
        }
        
        // Get structure counts and RCL
        const structureCount = Memory.rooms[room.name].construct.structureCount;
        const rcl = room.controller.level;
        
        // Log current RCL and structure counts for debugging (less frequently)
        if (Game.time % 500 === 0) {
            console.log(`Room ${room.name} RCL: ${rcl}, Extensions: ${structureCount.extensions.built}/${STRUCTURE_LIMITS[STRUCTURE_EXTENSION][rcl]}`);
        }
        
        // Check for construction sites - limit total number to avoid CPU waste
        const constructionSites = room.find(FIND_CONSTRUCTION_SITES);
        if (constructionSites.length >= 5) {
            return; // Too many construction sites already
        }
        
        // Check if we have builders available - only check if we're going to build something
        const buildersCount = _.filter(Game.creeps, c => c.memory.role === 'builder' && (c.memory.home === room.name || !c.memory.home)).length;
        if (buildersCount < 1) {
            return;
        }
        
        // Determine what to build next based on RCL and priorities
        let buildTarget = this.determineBuildTarget(room, rcl, structureCount);
        
        // Execute the appropriate build function if we have a target
        if (buildTarget) {
            this[buildTarget.function](room);
        }
    },
    
    // Helper function to determine what to build next based on RCL and priorities
    determineBuildTarget: function(room, rcl, structureCount) {
        // Create an array of possible build targets with priorities
        let buildTargets = [];
        
        // Check for spawn first at RCL 1 if none exists
        if (rcl >= 1 && (!structureCount.spawns || structureCount.spawns.built === 0) && 
            (!structureCount.spawns || structureCount.spawns.pending === 0)) {
            return { function: 'placeSpawn', priority: 200 };
        }
        
        // Check for extensions - they're always useful for energy capacity
        const extensionsAvailable = this.checkExtensionsAvailable(room);
        if (extensionsAvailable > 0) {
            buildTargets.push({ function: 'placeExtensions', priority: 100 });
        }
        
        // Add potential build targets based on RCL
        if (rcl >= 1) {
            // RCL 1+: Focus on containers near sources
            if ((structureCount.containers.built + structureCount.containers.pending) < 2) {
                buildTargets.push({ function: 'placeContainersNearSources', priority: 95 });
            }
        }
        
        if (rcl >= 2) {
            // RCL 2+: Add roads between key structures
            buildTargets.push({ function: 'placeRoads', priority: 70 });
        }
        
        if (rcl >= 3) {
            // RCL 3+: Place towers
            const towersAvailable = this.checkTowersAvailable(room);
            if (towersAvailable > 0) {
                buildTargets.push({ function: 'placeTower', priority: 90 });
            }
        }
        
        if (rcl >= 4) {
            // RCL 4+: Place storage
            if (structureCount.storage.built === 0 && structureCount.storage.pending === 0) {
                buildTargets.push({ function: 'placeStorage', priority: 85 });
            }
        }
        
        if (rcl >= 5) {
            // RCL 5+: Place links
            if (structureCount.links.built < 2 && structureCount.links.pending === 0) {
                buildTargets.push({ function: 'placeLinks', priority: 80 });
            }
        }
        
        // Sort by priority (highest first) and return the top target
        buildTargets.sort((a, b) => b.priority - a.priority);
        return buildTargets.length > 0 ? buildTargets[0] : null;
    },
    
    // New method to place roads between key structures
    placeRoads: function(room) {
        // Check if we've recently placed roads to avoid excessive CPU usage
        if (Memory.rooms[room.name].lastRoadPlacement && 
            Game.time - Memory.rooms[room.name].lastRoadPlacement < 1000) {
            return false;
        }
        
        // Find key structures to connect
        const spawn = room.find(FIND_MY_SPAWNS)[0];
        if (!spawn) return false;
        
        const sources = room.find(FIND_SOURCES);
        const controller = room.controller;
        const storage = room.storage;
        
        // Place roads between spawn and sources
        for (const source of sources) {
            if (this.placeRoadBetween(room, spawn.pos, source.pos)) {
                Memory.rooms[room.name].lastRoadPlacement = Game.time;
                return true;
            }
        }
        
        // Place road between spawn and controller
        if (controller && this.placeRoadBetween(room, spawn.pos, controller.pos)) {
            Memory.rooms[room.name].lastRoadPlacement = Game.time;
            return true;
        }
        
        // Place road between spawn and storage if it exists
        if (storage && this.placeRoadBetween(room, spawn.pos, storage.pos)) {
            Memory.rooms[room.name].lastRoadPlacement = Game.time;
            return true;
        }
        
        return false;
    },
    
    // Helper method to place a road between two positions
    placeRoadBetween: function(room, pos1, pos2) {
        // Find path between positions
        const path = PathFinder.search(pos1, { pos: pos2, range: 1 }, {
            plainCost: 2,
            swampCost: 10,
            roomCallback: function(roomName) {
                let room = Game.rooms[roomName];
                if (!room) return;
                let costs = new PathFinder.CostMatrix;
                
                // Favor existing roads
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
        
        // Check if path is valid
        if (path.incomplete) return false;
        
        // Place road construction sites along the path
        // Only place one road per call to avoid excessive CPU usage
        for (let i = 0; i < path.path.length; i++) {
            const pos = path.path[i];
            
            // Check if there's already a road or construction site here
            const structures = room.lookForAt(LOOK_STRUCTURES, pos);
            const hasRoad = structures.some(s => s.structureType === STRUCTURE_ROAD);
            if (hasRoad) continue;
            
            const sites = room.lookForAt(LOOK_CONSTRUCTION_SITES, pos);
            const hasRoadSite = sites.some(s => s.structureType === STRUCTURE_ROAD);
            if (hasRoadSite) continue;
            
            // Place road construction site
            const result = room.createConstructionSite(pos, STRUCTURE_ROAD);
            if (result === OK) {
                return true; // Successfully placed one road
            }
        }
        
        return false;
    },
    
    removeAllConstructionSites: function(){
        for (let id in Game.constructionSites) {
            let site = Game.constructionSites[id];
            site.remove();
        }
        console.log("All construction sites have been removed.");
    },
    

    //Construction Memories - Structure Awareness

    // Count all structure types
    countStructures: function(room) {
        if (!room) return;
        
        // Initialize structure counts if necessary
        if (!Memory.rooms[room.name]) {
            Memory.rooms[room.name] = {};
        }
        
        if (!Memory.rooms[room.name].construct) {
            Memory.rooms[room.name].construct = {};
        }
        
        // Define the structure keys we need to track
        const structureKeys = {
            spawns: true,
            extensions: true,
            containers: true,
            storage: true,
            extractor: true,
            links: true,
            terminal: true,
            towers: true,
            labs: true,
            factory: true,
            observer: true,
            powerSpawn: true,
            nuker: true
        };
        
        // Create or update the structure count object
        if (!Memory.rooms[room.name].construct.structureCount) {
            Memory.rooms[room.name].construct.structureCount = {};
        }
        
        // Ensure all structure types are initialized
        for (const key in structureKeys) {
            if (!Memory.rooms[room.name].construct.structureCount[key]) {
                Memory.rooms[room.name].construct.structureCount[key] = {built: 0, pending: 0};
            }
        }

        const structuresCount = Memory.rooms[room.name].construct.structureCount;
        
        // Define mapping between structure types and memory keys
        const structureTypeMap = {
            [STRUCTURE_SPAWN]: 'spawns',
            [STRUCTURE_EXTENSION]: 'extensions',
            [STRUCTURE_CONTAINER]: 'containers',
            [STRUCTURE_STORAGE]: 'storage',
            [STRUCTURE_EXTRACTOR]: 'extractor',
            [STRUCTURE_LINK]: 'links',
            [STRUCTURE_TERMINAL]: 'terminal',
            [STRUCTURE_TOWER]: 'towers',
            [STRUCTURE_LAB]: 'labs',
            [STRUCTURE_FACTORY]: 'factory',
            [STRUCTURE_OBSERVER]: 'observer',
            [STRUCTURE_POWER_SPAWN]: 'powerSpawn',
            [STRUCTURE_NUKER]: 'nuker'
        };
        
        // Reset structure counts
        for (const key in structuresCount) {
            structuresCount[key].built = 0;
            structuresCount[key].pending = 0;
        }

        // Use a more efficient approach by grouping structures by type
        const structures = room.find(FIND_STRUCTURES);
        const structuresByType = _.groupBy(structures, 'structureType');
        
        // Count built structures using the mapping
        for (const type in structureTypeMap) {
            if (structuresByType[type]) {
                structuresCount[structureTypeMap[type]].built = structuresByType[type].length;
            }
        }

        // Use the same approach for construction sites
        const sites = room.find(FIND_CONSTRUCTION_SITES);
        const sitesByType = _.groupBy(sites, 'structureType');
        
        // Count construction sites using the mapping
        for (const type in structureTypeMap) {
            if (sitesByType[type]) {
                structuresCount[structureTypeMap[type]].pending = sitesByType[type].length;
            }
        }
        
        // Store the last update time
        Memory.rooms[room.name].construct.lastStructureCount = Game.time;
    },

    cacheRoomStructures: function(room) {
        if (!Memory.rooms[room.name]) {
            Memory.rooms[room.name] = {};
        }
        
        // Initialize or update the structures cache
        if (!Memory.rooms[room.name].structuresCache || 
            !Memory.rooms[room.name].structuresCache.lastUpdate || 
            Game.time - Memory.rooms[room.name].structuresCache.lastUpdate > 50) {
            
            // Create or reset the structures cache
            Memory.rooms[room.name].structuresCache = {
                byType: {},
                lastUpdate: Game.time
            };
            
            // Group structures by type
            const structures = room.find(FIND_STRUCTURES);
            const structuresByType = _.groupBy(structures, 'structureType');
            
            // Store structure IDs by type
            for (const type in structuresByType) {
                Memory.rooms[room.name].structuresCache.byType[type] = 
                    structuresByType[type].map(s => s.id);
            }
        }
    },

    checkExtensionsAvailable: function(room) {
        const controllerLevel = room.controller.level;
        const maxAllowed = STRUCTURE_LIMITS[STRUCTURE_EXTENSION][controllerLevel];

        // Ensure structure count exists
        if (!Memory.rooms[room.name].construct || !Memory.rooms[room.name].construct.structureCount) {
            this.countStructures(room);
        }

        // Get current number of extensions and extension construction sites
        const extensions = Memory.rooms[room.name].construct.structureCount.extensions.built || 0;
        const extensionSites = Memory.rooms[room.name].construct.structureCount.extensions.pending || 0;
        const totalExtensions = extensions + extensionSites;

        // Calculate the number of extensions that can still be built
        const extensionsAvailable = maxAllowed - totalExtensions;

        // Log for debugging
        if (Game.time % 100 === 0) {
            console.log(`Room ${room.name} - Extensions: ${extensions} built, ${extensionSites} pending, ${extensionsAvailable} available`);
        }

        return Math.max(0, extensionsAvailable);
    },

    checkTowersAvailable: function(room) {
        const controllerLevel = room.controller.level;
        const maxAllowed = STRUCTURE_LIMITS[STRUCTURE_TOWER][controllerLevel];

        // Get current number of towers and tower construction sites
        const towers = Memory.rooms[room.name].construct.structureCount.towers.built || 0;
        const towerSites = Memory.rooms[room.name].construct.structureCount.towers.pending || 0;
        const totalTowers = towers + towerSites;

        // Calculate the number of towers that can still be built
        const towersAvailable = maxAllowed - totalTowers;

        return Math.max(0, towersAvailable);
    },
    
    // Generic function to check how many structures of a given type can be built
    getStructuresAvailable: function(room, structureType) {
        const rcl = room.controller.level;
        const maxAllowed = STRUCTURE_LIMITS[structureType][rcl];
        
        // Get current count of structures and construction sites
        let currentCount = 0;
        
        // Use the structure count from memory if available
        if (Memory.rooms[room.name].construct && Memory.rooms[room.name].construct.structureCount) {
            const structureKey = this.getStructureKeyForType(structureType);
            if (structureKey && Memory.rooms[room.name].construct.structureCount[structureKey]) {
                const counts = Memory.rooms[room.name].construct.structureCount[structureKey];
                currentCount = (counts.built || 0) + (counts.pending || 0);
            }
        }
        
        return Math.max(0, maxAllowed - currentCount);
    },
    
    // Helper function to get the memory key for a structure type
    getStructureKeyForType: function(structureType) {
        const structureKeys = {
            [STRUCTURE_SPAWN]: 'spawns',
            [STRUCTURE_EXTENSION]: 'extensions',
            [STRUCTURE_CONTAINER]: 'containers',
            [STRUCTURE_STORAGE]: 'storage',
            [STRUCTURE_TOWER]: 'towers',
            [STRUCTURE_LINK]: 'links',
            [STRUCTURE_EXTRACTOR]: 'extractor',
            [STRUCTURE_LAB]: 'labs',
            [STRUCTURE_TERMINAL]: 'terminal',
            [STRUCTURE_FACTORY]: 'factory',
            [STRUCTURE_OBSERVER]: 'observer',
            [STRUCTURE_POWER_SPAWN]: 'powerSpawn',
            [STRUCTURE_NUKER]: 'nuker'
        };
        
        return structureKeys[structureType];
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
    
    // Method to place terminal
    placeTerminal: function(room) {
        // Find a suitable position for terminal, preferably near storage
        const storage = room.storage;
        if (!storage) return false;
        
        // Try to place terminal near storage
        const terrain = room.getTerrain();
        
        // Search in a spiral pattern from the storage
        for (let radius = 2; radius <= 4; radius++) {
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dy = -radius; dy <= radius; dy++) {
                    // Only check positions on the edge of the current radius
                    if (Math.abs(dx) === radius || Math.abs(dy) === radius) {
                        const x = storage.pos.x + dx;
                        const y = storage.pos.y + dy;
                        
                        // Check if the position is valid
                        if (x >= 0 && x < 50 && y >= 0 && y < 50 && 
                            terrain.get(x, y) !== TERRAIN_MASK_WALL) {
                            
                            const pos = new RoomPosition(x, y, room.name);
                            
                            // Check if the position is already occupied
                            const structures = room.lookForAt(LOOK_STRUCTURES, x, y);
                            const constructionSites = room.lookForAt(LOOK_CONSTRUCTION_SITES, x, y);
                            
                            if (structures.length === 0 && constructionSites.length === 0) {
                                const result = room.createConstructionSite(pos, STRUCTURE_TERMINAL);
                                if (result === OK) {
                                    console.log(`Placed terminal construction site at ${pos}`);
                                    return true;
                                }
                            }
                        }
                    }
                }
            }
        }
        
        console.log(`Failed to place terminal in room ${room.name}`);
        return false;
    },
    
    // Method to place extractor
    placeExtractor: function(room) {
        // Find mineral in the room
        const minerals = room.find(FIND_MINERALS);
        if (minerals.length === 0) return false;
        
        const mineral = minerals[0];
        
        // Check if there's already an extractor on this mineral
        const extractors = mineral.pos.lookFor(LOOK_STRUCTURES);
        if (extractors.some(s => s.structureType === STRUCTURE_EXTRACTOR)) {
            return false; // Extractor already exists
        }
        
        // Check for construction sites
        const extractorSites = mineral.pos.lookFor(LOOK_CONSTRUCTION_SITES);
        if (extractorSites.some(s => s.structureType === STRUCTURE_EXTRACTOR)) {
            return false; // Extractor is already being built
        }
        
        // Place extractor on the mineral
        const result = room.createConstructionSite(mineral.pos, STRUCTURE_EXTRACTOR);
        if (result === OK) {
            console.log(`Placed extractor construction site at ${mineral.pos}`);
            return true;
        }
        
        console.log(`Failed to place extractor in room ${room.name}`);
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