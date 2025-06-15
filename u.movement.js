/**
 * Movement Module - Simplified pathfinding with traffic management
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
        
        // Use direct moveTo with traffic-aware cost matrix
        return creep.moveTo(targetPos, {
            range: range,
            reusePath: 20,
            costCallback: (roomName, costMatrix) => {
                return this.applyTrafficCosts(roomName, costMatrix);
            },
            visualizePathStyle: this.visualizePaths ? {
                fill: 'transparent',
                stroke: '#ffffff',
                lineStyle: 'dashed',
                strokeWidth: .15,
                opacity: .1
            } : undefined
        });
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
    
    // Clean up old paths - no longer needed with direct moveTo
    cleanupOldPaths: function() {
        // This is now a no-op since we're not using path cache
        return;
    },
    
    // Apply traffic costs to a cost matrix
    applyTrafficCosts: function(roomName, costMatrix) {
        if (!costMatrix) return;
        
        const room = Game.rooms[roomName];
        if (!room) return costMatrix;
        
        // Apply traffic density costs
        for (const key in this.trafficMap) {
            if (key.startsWith(roomName)) {
                const parts = key.split('_');
                if (parts.length >= 3) {
                    const x = parseInt(parts[1]);
                    const y = parseInt(parts[2]);
                    if (!isNaN(x) && !isNaN(y)) {
                        const traffic = this.trafficMap[key].count;
                        
                        // Only increase cost if it's not already impassable
                        if (costMatrix.get(x, y) < 0xff) {
                            // Increase cost based on traffic density
                            const additionalCost = Math.min(traffic * 5, 30);
                            costMatrix.set(x, y, costMatrix.get(x, y) + additionalCost);
                        }
                    }
                }
            }
        }
        
        // Add structure costs
        room.find(FIND_STRUCTURES).forEach(function(struct) {
            if (struct.structureType === STRUCTURE_ROAD) {
                // Favor roads
                costMatrix.set(struct.pos.x, struct.pos.y, 1);
            } else if (struct.structureType !== STRUCTURE_CONTAINER &&
                    (struct.structureType !== STRUCTURE_RAMPART || !struct.my)) {
                // Avoid non-walkable structures
                costMatrix.set(struct.pos.x, struct.pos.y, 0xff);
            }
        });
        
        // Add construction site costs
        room.find(FIND_CONSTRUCTION_SITES).forEach(function(site) {
            if (site.structureType !== STRUCTURE_ROAD && 
                site.structureType !== STRUCTURE_CONTAINER && 
                site.structureType !== STRUCTURE_RAMPART) {
                costMatrix.set(site.pos.x, site.pos.y, 0xff);
            }
        });
        
        return costMatrix;
    },
    
    // Toggle path visualization
    togglePathVisualization: function() {
        this.visualizePaths = !this.visualizePaths;
        return `Path visualization ${this.visualizePaths ? 'enabled' : 'disabled'}`;
    }
};

module.exports = movement;