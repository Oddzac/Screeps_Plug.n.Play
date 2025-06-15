/**
 * Movement Module - Enhanced pathfinding and traffic management
 * 
 * Features:
 * - Optimized path caching with context awareness
 * - Traffic management for high-traffic areas
 * - Path visualization for debugging
 * - Improved obstacle detection and avoidance
 */

var movement = {
    // Traffic density tracking
    trafficMap: {},
    
    // Path visualization settings
    visualizePaths: false,
    
    // Main Pathfinding Call
    moveToWithCache: function(creep, target, range = 1) {
        if (!creep || !target) return ERR_INVALID_ARGS;
        
        const targetPos = (target instanceof RoomPosition) ? target : target.pos;
        if (!targetPos) return ERR_INVALID_TARGET;
        
        // Initialize home room if not set
        if (!creep.memory.home) {
            const nameParts = creep.name.split('_');
            if (nameParts.length > 1 && Game.rooms[nameParts[0]]) {
                creep.memory.home = nameParts[0];
            } else {
                creep.memory.home = creep.room.name;
            }
        }
        
        // Update traffic map
        this.updateTrafficMap(creep.pos);
        
        // Call the path finding function
        return this.findCachedPath(creep, { pos: targetPos, range: range });
    },
    
    // Update traffic density map
    updateTrafficMap: function(pos) {
        const key = `${pos.roomName}_${pos.x}_${pos.y}`;
        
        if (!this.trafficMap[key]) {
            this.trafficMap[key] = { count: 0, lastUpdate: Game.time };
        } else {
            this.trafficMap[key].count++;
            this.trafficMap[key].lastUpdate = Game.time;
        }
        
        // Clean up old traffic data every 100 ticks
        if (Game.time % 100 === 0) {
            for (const key in this.trafficMap) {
                if (Game.time - this.trafficMap[key].lastUpdate > 100) {
                    delete this.trafficMap[key];
                }
            }
        }
    },
    
    // Get traffic density at position
    getTrafficDensity: function(pos) {
        const key = `${pos.roomName}_${pos.x}_${pos.y}`;
        return this.trafficMap[key] ? this.trafficMap[key].count : 0;
    },
    
    cleanupOldPaths: function() {
        const pathCache = Memory.pathCache;
        if (!pathCache) return;
        
        const currentTime = Game.time;
        const pathKeys = Object.keys(pathCache);
        for (const pathKey of pathKeys) {
            // Shorter cache time for paths in high traffic areas
            const maxAge = pathCache[pathKey].highTraffic ? 50 : 100;
            if (pathCache[pathKey].time + maxAge < currentTime) {
                delete pathCache[pathKey];
            }
        }
    },
    
    // Utility method to generate a unique key for caching paths
    generatePathKey: function(fromPos, toPos, range) {
        // Include room obstacles hash to invalidate paths when obstacles change
        const roomObstaclesHash = this.getRoomObstaclesHash(fromPos.roomName);
        return `${fromPos.roomName}_${fromPos.x},${fromPos.y}_${toPos.x},${toPos.y}_${range}_${roomObstaclesHash}`;
    },
    
    // Generate a hash of room obstacles to detect changes
    getRoomObstaclesHash: function(roomName) {
        const room = Game.rooms[roomName];
        if (!room) return '0';
        
        // Use construction sites as they change frequently
        const sites = room.find(FIND_CONSTRUCTION_SITES);
        const siteHash = sites.length > 0 ? sites.map(s => s.id).join('') : '0';
        
        // Include hostile creeps in the hash
        const hostiles = room.find(FIND_HOSTILE_CREEPS);
        const hostileHash = hostiles.length > 0 ? hostiles.length.toString() : '0';
        
        return `${siteHash.length}_${hostileHash}`;
    },
    
    // Method for creep movement using cached paths
    findCachedPath: function(creep, target, defaultRange = 1) {
        // Validate inputs
        if (!creep || !target) return;
        
        const targetPos = target.pos || target;
        if (!targetPos) return;
        
        // Check if target is in the same room
        if (targetPos.roomName !== creep.room.name) {
            // Handle inter-room movement
            const exitDir = creep.room.findExitTo(targetPos.roomName);
            if (exitDir === ERR_NO_PATH) return;
            
            const exit = creep.pos.findClosestByPath(exitDir);
            if (!exit) return;
            
            return creep.moveTo(exit);
        }
        
        const effectiveRange = target.range !== undefined ? target.range : defaultRange;
        const pathKey = this.generatePathKey(creep.pos, targetPos, effectiveRange); 
        const roomName = creep.room.name;
        
        if (!Memory.pathCache) Memory.pathCache = {};
        
        let path, moveResult;
        let useCache = false;
        
        // Check if path exists in cache and is still valid
        if (Memory.pathCache[pathKey] && 
            Memory.pathCache[pathKey].path && // Ensure path exists
            Memory.pathCache[pathKey].time + (Memory.pathCache[pathKey].highTraffic ? 50 : 100) > Game.time) {
            try {
                // Try to deserialize the path with error handling
                path = Room.deserializePath(Memory.pathCache[pathKey].path);
                useCache = true;
            } catch (e) {
                // If deserialization fails, delete the invalid path
                delete Memory.pathCache[pathKey];
                console.log(`Path deserialization error: ${e.message}`);
            }
        }
        
        // If no valid path from cache, generate a new one
        if (!path) {
            // Generate new path using PathFinder for better results
            const result = PathFinder.search(creep.pos, { pos: targetPos, range: effectiveRange }, {
                plainCost: 2,
                swampCost: 10,
                roomCallback: (roomName) => this.getTrafficAwareCostMatrix(roomName, creep)
            });
            
            if (!result.path || result.path.length === 0) return; // No path found
            
            path = result.path;
            
            try {
                const serializedPath = Room.serializePath(path);
                
                // Check if this path goes through high traffic areas
                const highTraffic = path.some(pos => this.getTrafficDensity(pos) > 3);
                
                Memory.pathCache[pathKey] = { 
                    path: serializedPath, 
                    time: Game.time,
                    highTraffic: highTraffic
                };
            } catch (e) {
                console.log(`Path serialization error: ${e.message}`);
                // Continue with the path but don't cache it
            }
        }
        
        // Visualize path if enabled
        if (this.visualizePaths && path && path.length > 0) {
            const visual = new RoomVisual(roomName);
            visual.poly(path, { stroke: useCache ? '#00ff00' : '#ffffff', opacity: 0.5 });
        }
        
        // Identify the next position on the path
        if (path && path.length > 0) {
            const nextPos = path[0];
            
            // Look for creeps at the next position
            const creepsAtNextPos = creep.room.lookForAt(LOOK_CREEPS, nextPos.x, nextPos.y);
            
            // Check if any of the creeps are working or have higher priority
            const isBlocking = creepsAtNextPos.some(c => 
                c && c.my && (c.memory.working || this.hasHigherPriority(c, creep))
            );
            
            if (isBlocking) {
                // Handle next position is blocked by working creep or higher priority creep
                creep.say("👀");
                
                // Try to find an alternative path around the blocking creep
                const altPath = this.findAlternativePath(creep, targetPos, effectiveRange, nextPos);
                if (altPath && altPath.length > 0) {
                    // Use the alternative path
                    moveResult = creep.moveByPath(altPath);
                } else {
                    // Use moveTo with ignoreCreeps:false as last resort
                    creep.moveTo(targetPos, {
                        range: effectiveRange,
                        ignoreCreeps: false,
                        reusePath: 0 // Don't cache this path
                    });
                }
            } else {
                // Execute movement
                moveResult = creep.moveByPath(path);
                if (moveResult !== OK && moveResult !== ERR_TIRED) {
                    // Clear the cache if the path is invalid
                    delete Memory.pathCache[pathKey];
                    
                    // Try direct movement as fallback
                    creep.moveTo(targetPos, {
                        range: effectiveRange,
                        reusePath: 5,
                        costCallback: (roomName, costMatrix) => {
                            return this.applyTrafficCosts(roomName, costMatrix);
                        }
                    });
                }
            }
        }
    },
    
    // Find alternative path around a blocking position
    findAlternativePath: function(creep, targetPos, range, blockingPos) {
        const costMatrix = this.getTrafficAwareCostMatrix(creep.room.name, creep);
        
        // Mark the blocking position as impassable
        costMatrix.set(blockingPos.x, blockingPos.y, 0xff);
        
        // Find a new path
        const result = PathFinder.search(creep.pos, { pos: targetPos, range: range }, {
            plainCost: 2,
            swampCost: 10,
            maxRooms: 1,
            costMatrix: costMatrix
        });
        
        return result.path;
    },
    
    // Check if one creep has higher priority than another
    hasHigherPriority: function(creep1, creep2) {
        // Priority order: harvester > hauler > upgrader > builder > others
        const priorities = {
            'harvester': 1,
            'hauler': 2,
            'upgrader': 3,
            'builder': 4
        };
        
        const priority1 = priorities[creep1.memory.role] || 5;
        const priority2 = priorities[creep2.memory.role] || 5;
        
        return priority1 < priority2;
    },
    
    // Get cost matrix that accounts for traffic
    getTrafficAwareCostMatrix: function(roomName, creep) {
        const baseCostMatrix = this.getCostMatrix(roomName);
        return this.applyTrafficCosts(roomName, baseCostMatrix, creep);
    },
    
    // Apply traffic costs to a cost matrix
    applyTrafficCosts: function(roomName, costMatrix, creep) {
        const room = Game.rooms[roomName];
        if (!room) return costMatrix;
        
        // Apply traffic density costs
        for (const key in this.trafficMap) {
            if (key.startsWith(roomName)) {
                const [_, x, y] = key.split('_').map(Number);
                const traffic = this.trafficMap[key].count;
                
                // Only increase cost if it's not already impassable
                if (costMatrix.get(x, y) < 0xff) {
                    // Increase cost based on traffic density
                    const additionalCost = Math.min(traffic * 5, 30);
                    costMatrix.set(x, y, costMatrix.get(x, y) + additionalCost);
                }
            }
        }
        
        return costMatrix;
    },
    
    // Generate and cache room cost matrices for more efficient pathfinding
    getCostMatrix: function(roomName) {
        if (!Memory.costMatrices) Memory.costMatrices = {};
        if (Memory.costMatrices[roomName] && Memory.costMatrices[roomName].time + 500 > Game.time) {
            return PathFinder.CostMatrix.deserialize(Memory.costMatrices[roomName].matrix);
        } else {
            const room = Game.rooms[roomName];
            let costs = new PathFinder.CostMatrix();
            
            if (room) { // Check if the room is visible
                // Add terrain costs
                const terrain = room.getTerrain();
                for (let y = 0; y < 50; y++) {
                    for (let x = 0; x < 50; x++) {
                        const tile = terrain.get(x, y);
                        if (tile === TERRAIN_MASK_WALL) {
                            costs.set(x, y, 0xff);
                        } else if (tile === TERRAIN_MASK_SWAMP) {
                            costs.set(x, y, 10);
                        } else {
                            costs.set(x, y, 2);
                        }
                    }
                }
                
                // Add structure costs
                room.find(FIND_STRUCTURES).forEach(function(struct) {
                    if (struct.structureType === STRUCTURE_ROAD) {
                        // Favor roads
                        costs.set(struct.pos.x, struct.pos.y, 1);
                    } else if (struct.structureType !== STRUCTURE_CONTAINER &&
                            (struct.structureType !== STRUCTURE_RAMPART || !struct.my)) {
                        // Avoid non-walkable structures
                        costs.set(struct.pos.x, struct.pos.y, 0xff);
                    }
                });
                
                // Add construction site costs
                room.find(FIND_CONSTRUCTION_SITES).forEach(function(site) {
                    if (site.structureType !== STRUCTURE_ROAD && 
                        site.structureType !== STRUCTURE_CONTAINER && 
                        site.structureType !== STRUCTURE_RAMPART) {
                        costs.set(site.pos.x, site.pos.y, 0xff);
                    }
                });
            }
            
            Memory.costMatrices[roomName] = {
                matrix: costs.serialize(),
                time: Game.time
            };
            return costs;
        }
    },
    
    // Toggle path visualization
    togglePathVisualization: function() {
        this.visualizePaths = !this.visualizePaths;
        return `Path visualization ${this.visualizePaths ? 'enabled' : 'disabled'}`;
    }
};

module.exports = movement;