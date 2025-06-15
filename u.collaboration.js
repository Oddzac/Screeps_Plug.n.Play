/**
 * Collaboration utility module for coordinating creep activities
 */

var collaboration = {
    // Registry for creeps requesting resources
    requestRegistry: {},
    
    /**
     * Register a creep as needing resources
     * @param {Creep} creep - The creep requesting resources
     * @param {string} resourceType - The resource type needed (default: RESOURCE_ENERGY)
     * @param {number} priority - Priority level (1-5, lower is higher priority)
     */
    requestResource: function(creep, resourceType = RESOURCE_ENERGY, priority = 3) {
        if (!creep || !creep.id) return;
        
        // Create room registry if it doesn't exist
        if (!this.requestRegistry[creep.room.name]) {
            this.requestRegistry[creep.room.name] = {};
        }
        
        this.requestRegistry[creep.room.name][creep.id] = {
            id: creep.id,
            pos: creep.pos,
            resourceType: resourceType,
            priority: priority,
            timestamp: Game.time,
            role: creep.memory.role
        };
    },
    
    /**
     * Remove a creep from the request registry
     * @param {Creep} creep - The creep to remove
     */
    fulfillRequest: function(creep) {
        if (!creep || !creep.id || !this.requestRegistry[creep.room.name]) return;
        delete this.requestRegistry[creep.room.name][creep.id];
    },
    
    /**
     * Find the nearest creep requesting resources
     * @param {Creep} hauler - The hauler looking for delivery targets
     * @param {string} resourceType - The resource type to deliver (default: RESOURCE_ENERGY)
     * @returns {Creep|null} - The nearest requesting creep or null if none found
     */
    findNearestRequest: function(hauler, resourceType = RESOURCE_ENERGY) {
        if (!hauler || !hauler.room || !this.requestRegistry[hauler.room.name]) return null;
        
        const roomRequests = this.requestRegistry[hauler.room.name];
        const validRequests = [];
        
        // Filter valid requests and clean up expired ones
        for (const id in roomRequests) {
            const request = roomRequests[id];
            const requestCreep = Game.getObjectById(id);
            
            // Clean up invalid requests
            if (!requestCreep || requestCreep.store.getFreeCapacity(request.resourceType) === 0 || Game.time - request.timestamp > 50) {
                delete roomRequests[id];
                continue;
            }
            
            // Only consider requests for the resource type we have
            if (request.resourceType === resourceType) {
                validRequests.push({
                    creep: requestCreep,
                    priority: request.priority,
                    distance: hauler.pos.getRangeTo(requestCreep)
                });
            }
        }
        
        // Sort by priority first, then by distance
        validRequests.sort((a, b) => {
            if (a.priority !== b.priority) {
                return a.priority - b.priority;
            }
            return a.distance - b.distance;
        });
        
        return validRequests.length > 0 ? validRequests[0].creep : null;
    },
    
    /**
     * Clean up the request registry periodically
     */
    cleanup: function() {
        for (const roomName in this.requestRegistry) {
            const roomRequests = this.requestRegistry[roomName];
            
            for (const id in roomRequests) {
                const request = roomRequests[id];
                const creep = Game.getObjectById(id);
                
                // Remove requests for non-existent creeps or those that are too old
                if (!creep || Game.time - request.timestamp > 100) {
                    delete roomRequests[id];
                }
            }
            
            // Clean up empty room registries
            if (Object.keys(roomRequests).length === 0) {
                delete this.requestRegistry[roomName];
            }
        }
    },
    
    /**
     * Determine if a creep should switch roles based on colony needs
     * @param {Creep} creep - The creep to evaluate
     * @returns {string|null} - The new role or null if no change needed
     */
    evaluateRoleSwitch: function(creep) {
        if (!creep || !creep.room) return null;
        
        const room = creep.room;
        const currentRole = creep.memory.role;
        
        // Don't switch specialized roles
        if (['hauler', 'claimer', 'attacker', 'healer', 'scout'].includes(currentRole)) {
            return null;
        }
        
        // Count creeps by role in this room
        const creepCounts = {};
        for (const name in Game.creeps) {
            const c = Game.creeps[name];
            if (c.room.name === room.name) {
                creepCounts[c.memory.role] = (creepCounts[c.memory.role] || 0) + 1;
            }
        }
        
        // Check for construction sites
        const constructionSites = room.find(FIND_CONSTRUCTION_SITES).length;
        
        // Check for damaged structures
        const damagedStructures = room.find(FIND_STRUCTURES, {
            filter: s => s.hits < s.hitsMax && s.structureType !== STRUCTURE_WALL && s.structureType !== STRUCTURE_RAMPART
        }).length;
        
        // Make decisions based on colony needs
        if (currentRole === 'harvester') {
            // Only switch if we have enough harvesters
            const minHarvesters = room.find(FIND_SOURCES).length;
            if ((creepCounts.harvester || 0) > minHarvesters) {
                if (constructionSites > 0 && (creepCounts.builder || 0) < 2) {
                    return 'builder';
                } else if ((creepCounts.upgrader || 0) < 2) {
                    return 'upgrader';
                }
            }
        } else if (currentRole === 'builder') {
            if (constructionSites === 0 && damagedStructures === 0) {
                return 'upgrader';
            }
        } else if (currentRole === 'upgrader') {
            if (constructionSites > 0 && (creepCounts.builder || 0) < 2) {
                return 'builder';
            }
        }
        
        return null;
    }
};

module.exports = collaboration;