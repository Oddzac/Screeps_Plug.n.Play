var memories = require('./m.memories');

var construction = {
    
    //TODO
    //placeLinks method - needs to check if there is already a link near given source and ignore if so (continue placing as able)
    
    manageConstruction: function(room) {
        
        const spawns = room.find(FIND_MY_SPAWNS);
        const buildersCount = _.filter(Game.creeps, { memory: { role: 'builder' } }).length;
        const structureCount = Memory.rooms[room.name].construct.structureCount;
        const containersBuilt = structureCount.containers.built;
        const containerSites = structureCount.containers.pending;
        const storageBuilt = structureCount.storage.built;
        const storageSites = structureCount.storage.pending;
        const linksBuilt = structureCount.links.built;
        const linkSites = structureCount.links.pending;
        const towersBuilt = structureCount.towers.built; 
        const towerSites = structureCount.towers.pending;

        
        if (buildersCount < 1) {
            return;
        }

        if (this.checkTowersAvailable(room) > 0) {
            //this.placeTower(room);
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
    

    //Construction Memories - Structure Awareness

    // Count structures - Container, Storage, Extractor, Link, Terminal, Tower
    countStructures: function(room) {
        // Initialize structure counts if necessary
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
                    break;
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
                    break;
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
        const totalTowers = towers + towerSites;

        // Calculate the number of extensions that can still be built
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
        // Get sources from memory
        const sourceIds = Memory.rooms[room.name].mapping.sources.id;
        if (!sourceIds || sourceIds.length === 0) {
            console.log(`No sources found in memory for room ${room.name}`);
            return;
        }

        for (let i = 0; i < sourceIds.length; i++) {
            const source = Game.getObjectById(sourceIds[i]);
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
                    const structures = room.lookForAt(LOOK_STRUCTURES, x, y);
                    const constructionSites = room.lookForAt(LOOK_CONSTRUCTION_SITES, x, y);
                    
                    if (structures.length > 0 || constructionSites.length > 0) continue;
                    
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
    }
};

module.exports = construction;