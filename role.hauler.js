

var utility = require('./u.utilities');
var movement = require('./u.movement');
var giveWay = require("./u.giveWay");

var roleHauler = {
    // Clean up energy requests by removing non-existent haulers and stale requests
    cleanupEnergyRequests: function(roomName) {
        if (!Memory.rooms[roomName].energyRequests) return;
        
        const currentTime = Game.time;
        const requestsToDelete = [];
        
        for (const requestId in Memory.rooms[roomName].energyRequests) {
            const request = Memory.rooms[roomName].energyRequests[requestId];
            
            // Check if the request is stale (older than 100 ticks)
            if (request.timestamp && currentTime - request.timestamp > 100) {
                requestsToDelete.push(requestId);
                continue;
            }
            
            // Check if the target creep still exists
            const targetCreep = Game.getObjectById(requestId);
            if (!targetCreep) {
                requestsToDelete.push(requestId);
                continue;
            }
            
            // Check if the target creep still needs energy
            if (targetCreep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                requestsToDelete.push(requestId);
                continue;
            }
            
            // Clean up locks that are too old (prevent deadlocks)
            if (request.lockTime && currentTime - request.lockTime > 5) {
                delete request.lockId;
                delete request.lockTime;
            }
            
            // Skip if no assignedHaulers array
            if (!request.assignedHaulers) continue;
            
            // Filter out non-existent haulers
            const previousLength = request.assignedHaulers.length;
            request.assignedHaulers = request.assignedHaulers.filter(id => {
                const hauler = Game.getObjectById(id);
                // Keep only existing haulers that still have this request assigned
                return hauler && hauler.memory.assignedRequest === requestId;
            });
            
            // If we removed haulers, update the count
            if (request.assignedHaulers.length !== previousLength) {
                request.haulerCount = request.assignedHaulers.length;
            }
            
            // If assignedTo refers to a non-existent creep or a creep that's no longer assigned to this request, clear it
            if (request.assignedTo) {
                const assignedHauler = Game.getObjectById(request.assignedTo);
                if (!assignedHauler || assignedHauler.memory.assignedRequest !== requestId) {
                    delete request.assignedTo;
                }
            }
        }
        
        // Delete all identified stale requests
        for (const requestId of requestsToDelete) {
            delete Memory.rooms[roomName].energyRequests[requestId];
        }
    },
    
    run: function(creep) {
        // Periodically clean up energy requests (once every 20 ticks)
        if (Game.time % 20 === 0) {
            this.cleanupEnergyRequests(creep.room.name);
        }
        
        // Check for high-priority resources to collect (dropped resources, tombstones, ruins)
        if (creep.store.getFreeCapacity() > 0 && this.checkForHighPriorityResources(creep)) {
            return; // If we found and are collecting high-priority resources, skip the rest of the function
        }
        
        if (creep.store.getUsedCapacity() === 0) {
            creep.memory.isCollecting = true;
            delete creep.memory.assignedRequest;

        } else if (creep.memory.task === 'linkHauler' || creep.memory.task === 'spawnHauler' && creep.store.getUsedCapacity() > 0) {
            creep.memory.isCollecting = false;

        } else if (creep.store.getFreeCapacity() === 0) {
            creep.memory.isCollecting = false;
        }

        this.signRoom(creep);

        if (Game.time % 50 === 0 && creep.memory.task !== 'spawnHauler' && creep.memory.task !== 'linkHauler') {
            this.assignCollectionTask(creep);
        }
        
        if (creep.memory.isCollecting) {
            if (!creep.memory.task) {
                this.assignCollectionTask(creep);
            }
            this.assignCollectionTarget(creep);
            
        } else {
            // First check if we need to deliver to spawn structures
            if (this.deliverToSpawnStructures(creep)) {
                return;
            }
            
            // Then check if we're assigned to a builder request
            if (creep.memory.assignedRequest && this.deliverAssignedRequest(creep)) {
                return;
            }
            
            // Then check for new builder energy requests
            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0 && this.checkForEnergyRequests(creep)) {
                return;
            }
            
            // Finally, proceed with normal resource delivery
            this.deliverResources(creep);
        }
        creep.giveWay();
    },
    
    // New function to check for and collect high-priority resources
    checkForHighPriorityResources: function(creep) {
        // Skip if we're full
        if (creep.store.getFreeCapacity() === 0) return false;
        
        // Skip for specialized haulers that should stick to their assigned tasks
        if (creep.memory.task === 'linkHauler') return false;
        
        let highPriorityTarget = null;
        let highestValue = 0;
        
        // Check for dropped resources
        const droppedResources = creep.room.find(FIND_DROPPED_RESOURCES, {
            filter: r => r.amount > 50 // Only consider resources with significant amounts
        });
        
        for (const resource of droppedResources) {
            // Calculate value based on amount and distance
            const distance = creep.pos.getRangeTo(resource);
            const value = resource.amount / (distance + 1); // Higher amount and shorter distance = higher value
            
            if (value > highestValue) {
                highestValue = value;
                highPriorityTarget = resource;
            }
        }
        
        // Check for tombstones with resources
        const tombstones = creep.room.find(FIND_TOMBSTONES, {
            filter: t => _.sum(t.store) > 0
        });
        
        for (const tombstone of tombstones) {
            const distance = creep.pos.getRangeTo(tombstone);
            const value = _.sum(tombstone.store) / (distance + 1);
            
            if (value > highestValue) {
                highestValue = value;
                highPriorityTarget = tombstone;
            }
        }
        
        // Check for ruins with resources
        const ruins = creep.room.find(FIND_RUINS, {
            filter: r => _.sum(r.store) > 0
        });
        
        for (const ruin of ruins) {
            const distance = creep.pos.getRangeTo(ruin);
            const value = _.sum(ruin.store) / (distance + 1);
            
            if (value > highestValue) {
                highestValue = value;
                highPriorityTarget = ruin;
            }
        }
        
        // If we found a high-priority target, collect from it
        if (highPriorityTarget) {
            // Save current task to resume after collecting
            if (!creep.memory.previousTask) {
                creep.memory.previousTask = creep.memory.task;
            }
            
            // Temporarily switch to collection mode
            creep.memory.isCollecting = true;
            
            // Collect from the target
            this.moveToAndCollect(creep, highPriorityTarget);
            
            // Signal that we found and are handling a high-priority resource
            return true;
        }
        
        // If we had a previous task and no high-priority targets now, restore it
        if (creep.memory.previousTask && !highPriorityTarget) {
            creep.memory.task = creep.memory.previousTask;
            delete creep.memory.previousTask;
        }
        
        return false;
    },
    
    deliverToSpawnStructures: function(creep) {
        // First try to fill spawns
        const spawns = creep.room.find(FIND_MY_SPAWNS, {
            filter: s => s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        
        if (spawns.length > 0) {
            const spawn = creep.pos.findClosestByPath(spawns);
            if (creep.transfer(spawn, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.say('🏠');
                movement.moveToWithCache(creep, spawn);
            }
            return true;
        }
        
        // Then try to fill extensions
        const extensions = creep.room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_EXTENSION && 
                         s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        
        if (extensions.length > 0) {
            const extension = creep.pos.findClosestByPath(extensions);
            if (creep.transfer(extension, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.say('🏠');
                movement.moveToWithCache(creep, extension);
            }
            return true;
        }
        
        // No spawn structures need energy
        return false;
    },
    
    checkForEnergyRequests: function(creep) {
        // Check for energy requests
        if (!Memory.rooms[creep.room.name].energyRequests) {
            return false;
        }
        
        // Prioritize requests based on task and working status
        let bestRequest = null;
        let bestScore = -Infinity;
        
        // Use a critical section approach to prevent race conditions
        // Generate a unique lock ID for this creep
        const lockId = `hauler_${creep.id}_${Game.time}`;
        
        // First pass: find the best request without modifying anything
        for (const requestId in Memory.rooms[creep.room.name].energyRequests) {
            const request = Memory.rooms[creep.room.name].energyRequests[requestId];
            
            // Skip if this request is currently being processed by another hauler
            if (request.lockId && request.lockTime && Game.time - request.lockTime < 2) {
                continue;
            }
            
            // Count how many haulers are already assigned to this request
            let assignedHaulers = 0;
            if (request.assignedHaulers) {
                // Count valid haulers (filter out non-existent creeps)
                assignedHaulers = request.assignedHaulers.filter(id => Game.getObjectById(id)).length;
            }
            
            // Skip if already at the limit of 2 haulers
            if (assignedHaulers >= 2) continue;
            
            // Calculate priority score (higher is better)
            let score = 0;
            
            // Prioritize by task type
            if (request.task === 'building') score += 10;
            else if (request.task === 'repairing') score += 20;
            else if (request.task === 'upgrading') score += 30;
            
            // Prioritize builders who are actively working
            if (request.working === true) score -= 50;
            
            // Factor in distance (closer is better)
            const targetCreep = Game.getObjectById(requestId);
            if (targetCreep) {
                const distance = creep.pos.getRangeTo(targetCreep);
                score += distance * 2; // Distance penalty
            }
            
            // Factor in request age (older is better)
            const age = Game.time - request.timestamp;
            score -= age * 0.5;
            
            // Update best request if this one has a better score
            if (score > bestScore) {
                bestScore = score;
                bestRequest = request;
            }
        }
        
        // If we found a suitable request, try to lock and claim it
        if (bestRequest) {
            // Attempt to acquire a lock on this request
            const requestRef = Memory.rooms[creep.room.name].energyRequests[bestRequest.id];
            
            // Check if someone else has locked it since our first pass
            if (requestRef.lockId && requestRef.lockTime && Game.time - requestRef.lockTime < 2) {
                return false; // Someone else got it first
            }
            
            // Set our lock
            requestRef.lockId = lockId;
            requestRef.lockTime = Game.time;
            
            // Double-check the hauler count now that we have the lock
            // This prevents race conditions where multiple haulers try to claim the same request
            let assignedHaulers = 0;
            if (requestRef.assignedHaulers) {
                assignedHaulers = requestRef.assignedHaulers.filter(id => Game.getObjectById(id)).length;
            }
            
            // If still under the limit, assign ourselves
            if (assignedHaulers < 2) {
                // Initialize the assignedHaulers array if it doesn't exist
                if (!requestRef.assignedHaulers) {
                    requestRef.assignedHaulers = [];
                }
                
                // Add this hauler to the assignedHaulers array
                requestRef.assignedHaulers.push(creep.id);
                
                // Also maintain the legacy assignedTo field for backward compatibility
                requestRef.assignedTo = creep.id;
                
                creep.memory.assignedRequest = bestRequest.id;
                
                // Release the lock
                delete requestRef.lockId;
                delete requestRef.lockTime;
                
                return true;
            } else {
                // Release the lock if we can't claim it
                delete requestRef.lockId;
                delete requestRef.lockTime;
            }
        }
        
        return false;
    },
    
    deliverAssignedRequest: function(creep) {
        const requestId = creep.memory.assignedRequest;
        const roomName = creep.room.name;
        
        // Check if request still exists
        if (!Memory.rooms[roomName].energyRequests || 
            !Memory.rooms[roomName].energyRequests[requestId]) {
            delete creep.memory.assignedRequest;
            return false;
        }
        
        const request = Memory.rooms[roomName].energyRequests[requestId];
        const targetCreep = Game.getObjectById(requestId);
        
        // If target creep no longer exists, clear request
        if (!targetCreep) {
            delete Memory.rooms[roomName].energyRequests[requestId];
            delete creep.memory.assignedRequest;
            return false;
        }
        
        // Check if the builder is still working on the same task
        if (request.task && targetCreep.memory.task !== request.task) {
            // Builder changed tasks, update the request
            Memory.rooms[roomName].energyRequests[requestId].task = targetCreep.memory.task;
        }
        
        // Get the builder's target construction site if they have one
        let builderTargetSite = null;
        if (targetCreep.memory.task === "building" && targetCreep.memory.targetSiteId) {
            builderTargetSite = Game.getObjectById(targetCreep.memory.targetSiteId);
        }
        
        // If the builder has a target site and is not full of energy, go to the site instead of directly to the builder
        if (builderTargetSite && !targetCreep.memory.harvesting && 
            targetCreep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
            
            // Check if the builder is near their target site
            const builderAtSite = targetCreep.pos.inRangeTo(builderTargetSite, 3);
            
            if (builderAtSite) {
                // Builder is at the site, approach carefully to avoid blocking
                if (creep.pos.inRangeTo(targetCreep, 1)) {
                    // We're already adjacent, transfer energy
                    const result = creep.transfer(targetCreep, RESOURCE_ENERGY);
                    
                    if (result === OK) {
                        creep.say('🔋');
                        
                        // Remove this hauler from the assignedHaulers array
                        if (request.assignedHaulers) {
                            const index = request.assignedHaulers.indexOf(creep.id);
                            if (index > -1) {
                                request.assignedHaulers.splice(index, 1);
                            }
                        }
                        
                        // Clear the assignment but keep the request active if they still need more
                        if (targetCreep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                            // Only clear assignedTo if it matches this creep's ID
                            if (request.assignedTo === creep.id) {
                                delete Memory.rooms[roomName].energyRequests[requestId].assignedTo;
                            }
                        } else {
                            // If the builder is full, delete the entire request
                            delete Memory.rooms[roomName].energyRequests[requestId];
                        }
                        
                        delete creep.memory.assignedRequest;
                        return true;
                    }
                } else {
                    // Find a position near the builder that doesn't block their path to the construction site
                    const siteToBuilderVector = {
                        x: targetCreep.pos.x - builderTargetSite.pos.x,
                        y: targetCreep.pos.y - builderTargetSite.pos.y
                    };
                    
                    // Calculate a position that's not in the direct path between builder and site
                    // Try to approach from the side or behind relative to the construction site
                    let approachPositions = [];
                    
                    // Check positions around the builder
                    for (let dx = -1; dx <= 1; dx++) {
                        for (let dy = -1; dy <= 1; dy++) {
                            if (dx === 0 && dy === 0) continue; // Skip the builder's position
                            
                            const posX = targetCreep.pos.x + dx;
                            const posY = targetCreep.pos.y + dy;
                            
                            // Skip if out of bounds
                            if (posX < 0 || posX > 49 || posY < 0 || posY > 49) continue;
                            
                            const pos = new RoomPosition(posX, posY, targetCreep.room.name);
                            
                            // Check if position is walkable
                            const terrain = Game.map.getRoomTerrain(targetCreep.room.name);
                            if (terrain.get(posX, posY) === TERRAIN_MASK_WALL) continue;
                            
                            // Check if position is occupied
                            const lookResults = targetCreep.room.lookAt(posX, posY);
                            let isBlocked = false;
                            for (const result of lookResults) {
                                if (result.type === 'creep' || 
                                    (result.type === 'structure' && 
                                     result.structure.structureType !== STRUCTURE_ROAD && 
                                     result.structure.structureType !== STRUCTURE_CONTAINER)) {
                                    isBlocked = true;
                                    break;
                                }
                            }
                            if (isBlocked) continue;
                            
                            // Calculate if this position is in the path between builder and site
                            // We want to avoid positions that would block the builder's path
                            const dotProduct = dx * siteToBuilderVector.x + dy * siteToBuilderVector.y;
                            
                            // Positions with negative dot product are more likely to be out of the way
                            // (approaching from behind the builder relative to the site)
                            approachPositions.push({
                                pos: pos,
                                score: dotProduct
                            });
                        }
                    }
                    
                    // Sort positions by score (lower is better - less likely to block)
                    approachPositions.sort((a, b) => a.score - b.score);
                    
                    if (approachPositions.length > 0) {
                        // Move to the best position
                        creep.say('🔄');
                        movement.moveToWithCache(creep, approachPositions[0].pos);
                    } else {
                        // If no good position found, wait at a distance
                        creep.say('⏳');
                        movement.moveToWithCache(creep, targetCreep, 2);
                    }
                }
            } else {
                // Builder is not at the site yet, go to the site and wait nearby
                if (creep.pos.inRangeTo(builderTargetSite, 3)) {
                    // We're already at the site, just wait
                    creep.say('⌛');
                } else {
                    // Move to the construction site
                    creep.say('🏗️');
                    movement.moveToWithCache(creep, builderTargetSite, 3);
                }
                
                // If the builder gets close enough, approach them
                if (creep.pos.inRangeTo(targetCreep, 2)) {
                    const result = creep.transfer(targetCreep, RESOURCE_ENERGY);
                    
                    if (result === OK) {
                        creep.say('🔋');
                        
                        // Remove this hauler from the assignedHaulers array
                        if (request.assignedHaulers) {
                            const index = request.assignedHaulers.indexOf(creep.id);
                            if (index > -1) {
                                request.assignedHaulers.splice(index, 1);
                            }
                        }
                        
                        // Clear the assignment but keep the request active if they still need more
                        if (targetCreep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                            // Only clear assignedTo if it matches this creep's ID
                            if (request.assignedTo === creep.id) {
                                delete Memory.rooms[roomName].energyRequests[requestId].assignedTo;
                            }
                        } else {
                            // If the builder is full, delete the entire request
                            delete Memory.rooms[roomName].energyRequests[requestId];
                        }
                        
                        delete creep.memory.assignedRequest;
                        return true;
                    }
                }
            }
            
            return true;
        } else {
            // Standard behavior - move directly to the builder
            if (creep.pos.isNearTo(targetCreep)) {
                const result = creep.transfer(targetCreep, RESOURCE_ENERGY);
                
                if (result === OK) {
                    creep.say('🔋');
                    
                    // Remove this hauler from the assignedHaulers array
                    if (request.assignedHaulers) {
                        const index = request.assignedHaulers.indexOf(creep.id);
                        if (index > -1) {
                            request.assignedHaulers.splice(index, 1);
                        }
                    }
                    
                    // Clear the assignment but keep the request active if they still need more
                    if (targetCreep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                        // Only clear assignedTo if it matches this creep's ID
                        if (request.assignedTo === creep.id) {
                            delete Memory.rooms[roomName].energyRequests[requestId].assignedTo;
                        }
                    } else {
                        // If the builder is full, delete the entire request
                        delete Memory.rooms[roomName].energyRequests[requestId];
                    }
                    
                    delete creep.memory.assignedRequest;
                    return true;
                }
            } else {
                // Check if the builder has moved significantly since last update
                const lastUpdated = request.lastUpdated || 0;
                const timeSinceUpdate = Game.time - lastUpdated;
                
                // If it's been a while since the position was updated, move to the actual builder position
                if (timeSinceUpdate > 10) {
                    creep.say('🔍');
                    movement.moveToWithCache(creep, targetCreep);
                } else {
                    creep.say('🚚');
                    movement.moveToWithCache(creep, targetCreep);
                }
                return true;
            }
        }
        
        return true;
    },

    signRoom: function(creep) {
        if(creep.room.controller && !Memory.rooms[creep.room.name].signed) {
            const signResult = creep.signController(creep.room.controller, "The oddz favor none 🎲");
            if(signResult == ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.controller);
            } else if(signResult == OK) {
                Memory.rooms[creep.room.name].signed = true;
            }
        }
    },

    assignCollectionTask: function(creep) {
        // Determine task based on room phase and structure availability
        const roomName = creep.room.name;
        const phase = Memory.rooms[creep.room.name].phase.Phase;
        const structureCount = Memory.rooms[creep.room.name].construct.structureCount;
        
        const haulers = _.sum(Game.creeps, (c) => c.memory.role === 'hauler' && c.room.name === roomName);
        const spawnHaulers = _.sum(Game.creeps, (c) => c.memory.role === 'hauler' && c.room.name === roomName && c.memory.task === 'spawnHauler');
        const linkHaulers = _.sum(Game.creeps, (c) => c.memory.role === 'hauler' && c.room.name === roomName && c.memory.task === 'linkHauler');
        const terminalHauler = _.sum(Game.creeps, (c) => c.memory.role === 'hauler' && c.room.name === roomName && c.memory.task === 'terminalHauler');
        const collectors = _.sum(Game.creeps, (c) => c.memory.role === 'hauler' && c.room.name === roomName && c.memory.task === 'collector');
        const energySources = Memory.rooms[creep.room.name].mapping.sources.count;
        const containersBuilt = structureCount.containers.built;
        const storageBuilt = structureCount.storage.built;
        const linksBuilt = structureCount.links.built;
        const terminalBuilt = structureCount.terminal.built;
        const extensions = structureCount.extensions.built



        let target;

        //ifLink: assign 1 linkHauler > ifStorage: assign 1 spawnHauler > ifContainers:
        
       //
                  
         if (linkHaulers < 1 && linksBuilt > 1) {
            creep.memory.task = 'linkHauler';
            
        } else if (phase >= 6 && linksBuilt > 2 && energySources > 1 && spawnHaulers < 2) {
            creep.memory.task = 'spawnHauler';
            
        } else if (energySources < 2 && extensions > 30 && spawnHaulers < 2) {
            creep.memory.task = 'spawnHauler';
            
        } else if (spawnHaulers < 1 && storageBuilt > 0) {
            creep.memory.task = 'spawnHauler';
            

        } else if (collectors < 1) {
            creep.memory.task = 'collector';

        } else if (terminalHauler < 1 && terminalBuilt > 0) {
            creep.memory.task = 'terminalHauler';
            

        } else {
            creep.memory.task = 'collector';
            delete creep.memory.linkId;
            this.assignContainer(creep);
            return; //Early Return For !target
        }

        this.assignCollectionTarget(creep);
    },

    assignContainer: function(creep) {
        const sourcesAndMinerals = creep.room.find(FIND_SOURCES).concat(creep.room.find(FIND_MINERALS));
        const containers = creep.room.find(FIND_STRUCTURES, {
            filter: (s) => {
                if (s.structureType !== STRUCTURE_CONTAINER || _.sum(s.store) <= 0) {
                    return false;
                }
                // Check if the container is within 3 tiles of any source or mineral
                return sourcesAndMinerals.some(sourceOrMineral => 
                    s.pos.inRangeTo(sourceOrMineral, 3)
                );
            }
        });
    
        if (containers.length > 0) {
            const containerAssignments = containers.map(container => ({
                id: container.id,
                count: _.sum(Game.creeps, c => c.memory.containerId === container.id && c.memory.role === 'hauler')
            }));
    
            const leastAssigned = _.min(containerAssignments, 'count');
            if (leastAssigned && leastAssigned.id) {
                creep.memory.containerId = leastAssigned.id;
            }
        }
    },
    
    //IMPLEMENT SWITCH CASE VIA ROLE
    assignCollectionTarget: function(creep) {

        const phase = Memory.rooms[creep.room.name].phase.Phase;
        const storageBuilt = Memory.rooms[creep.room.name].storageBuilt > 0;
        const containersBuilt = Memory.rooms[creep.room.name].containersBuilt > 0;
        //const task = Game.getObjectById(creep.memory.task);
        let targets = [];
        let target;
    


        if (creep.memory.task === 'linkHauler') {
            delete creep.memory.containerId;
            // Check if we already have a link assigned in memory
            if (!creep.memory.linkId) {
                // Find the storage structure
                const storage = creep.room.storage;
                if (!storage) {
                    console.log('Storage not found for', creep.name);
                    return; // Exit if there's no storage
                }
        
                // Find links within a range of 3 tiles from storage
                const links = storage.pos.findInRange(FIND_STRUCTURES, 3, {
                    filter: {structureType: STRUCTURE_LINK}
                });
        
                // Assign the closest link (if any) to the creep's memory
                if (links.length > 0) {
                    creep.memory.linkId = links[0].id;
                } else {
                    console.log('No link found within range for', creep.name);
                    return; // Exit if no link is found within range
                }
            }

            target = Game.getObjectById(creep.memory.linkId);

        } else if (creep.memory.task === 'spawnHauler' || creep.memory.task === 'terminalHauler' ) {
            //Collect from room storage exclusively
            delete creep.memory.linkId;
            target = creep.room.storage;
            

} else {
    // Clear any irrelevant memory assignments.
    delete creep.memory.linkId;

    // Initialize targets array.
    targets = [];

    // Add dropped resources with higher priority
    const droppedResources = creep.room.find(FIND_DROPPED_RESOURCES, {
        filter: (r) => (storageBuilt && r.amount > 20) || (!storageBuilt && r.resourceType === RESOURCE_ENERGY && r.amount > 20)
    });
    
    // Add tombstones with resources
    const tombstonesWithResources = creep.room.find(FIND_TOMBSTONES, {
        filter: (t) => _.sum(t.store) > 0
    });
    
    // Add ruins with resources
    const ruinsWithResources = creep.room.find(FIND_RUINS, {
        filter: (t) => _.sum(t.store) > 0
    });
    
    // Calculate value for each resource source based on amount and distance
    const valuedTargets = [];
    
    // Process dropped resources
    for (const resource of droppedResources) {
        const distance = creep.pos.getRangeTo(resource);
        // Higher priority for dropped resources (multiply by 2)
        const value = (resource.amount / (distance + 1)) * 2;
        valuedTargets.push({ target: resource, value: value });
    }
    
    // Process tombstones
    for (const tombstone of tombstonesWithResources) {
        const distance = creep.pos.getRangeTo(tombstone);
        // Higher priority for tombstones (multiply by 1.5)
        const value = (_.sum(tombstone.store) / (distance + 1)) * 1.5;
        valuedTargets.push({ target: tombstone, value: value });
    }
    
    // Process ruins
    for (const ruin of ruinsWithResources) {
        const distance = creep.pos.getRangeTo(ruin);
        // Higher priority for ruins (multiply by 1.5)
        const value = (_.sum(ruin.store) / (distance + 1)) * 1.5;
        valuedTargets.push({ target: ruin, value: value });
    }
    
    // Add assigned container if it exists and has resources
    if (creep.memory.containerId) {
        const assignedContainer = Game.getObjectById(creep.memory.containerId);
        if (assignedContainer && _.sum(assignedContainer.store) > 0) {
            const distance = creep.pos.getRangeTo(assignedContainer);
            const value = _.sum(assignedContainer.store) / (distance + 1);
            valuedTargets.push({ target: assignedContainer, value: value });
        }
    }
    
    // Sort targets by value (highest first)
    valuedTargets.sort((a, b) => b.value - a.value);
    
    // Select the highest value target
    if (valuedTargets.length > 0) {
        target = valuedTargets[0].target;
    } else if (!creep.memory.containerId || creep.memory.task !== 'spawnHauler' && creep.memory.task !== 'linkHauler') {
        // If no targets and no specific task, consider finding a new container to assign.
        const containers = creep.room.find(FIND_STRUCTURES, {
            filter: (s) => s.structureType === STRUCTURE_CONTAINER && _.sum(s.store) > 0
        });

        if (containers.length > 0) {
            // Assign the creep to the least assigned container if not already assigned.
            if (!creep.memory.containerId) {
                let containerAssignments = containers.map(container => ({
                    id: container.id,
                    count: _.sum(Game.creeps, c => c.memory.containerId === container.id && c.memory.role === 'hauler')
                }));

                let leastAssigned = _.min(containerAssignments, 'count');
                creep.memory.containerId = leastAssigned.id;
            }
        }
    }
}

    
        if (target) {
            //Got our target, go get it.
            this.moveToAndCollect(creep, target);
        } else {
            //No targets available
            this.waitNear(creep);
        }
    },

    moveToAndCollect: function(creep, target) {
        let actionResult;
    
        // If room storage does not exist, prevent collecting non-energy resources
        // Exception: Always collect from tombstones and ruins regardless of resource type
        if (!creep.room.storage && 
            target instanceof Resource && 
            target.resourceType !== RESOURCE_ENERGY && 
            !(target instanceof Tombstone) && 
            !(target instanceof Ruin)) {
            console.log('Storage not available. Skipping non-energy resource collection for', creep.name);
            return; // Exit the function to avoid collecting non-energy resources
        }
    
        if (creep.memory.task === 'spawnHauler') {
            // target = room storage
            actionResult = creep.withdraw(target, RESOURCE_ENERGY);
        } else if (creep.memory.task === 'terminalHauler') {
            let resourceType = RESOURCE_ENERGY; // Default to energy
            let totalMinerals = _.sum(creep.room.storage.store) - creep.room.storage.store[RESOURCE_ENERGY]; // Calculate total minerals in storage
            
            if (totalMinerals > 0) {
                // If there are minerals, find one to withdraw
                for(const resource in creep.room.storage.store) {
                    if(resource !== RESOURCE_ENERGY && creep.room.storage.store[resource] > 0) {
                        resourceType = resource;
                        break; // Withdraw the first found surplus mineral
                    }
                }
                // Check if a surplus mineral was found, if not and energy is surplus, proceed with energy
                if (resourceType === RESOURCE_ENERGY && creep.room.storage.store[RESOURCE_ENERGY] <= 5000) {
                    // If there's not enough surplus energy, do not proceed to withdraw
                    this.waitNear(creep); // Wait if conditions are not met
                    return; // Exit the function
                }
            } else if (creep.room.storage.store[RESOURCE_ENERGY] <= 1000) {
                // If there's not enough energy, do not proceed to withdraw
                this.waitNear(creep); // Wait if conditions are not met
                return; // Exit the function
            }
            // Proceed to withdraw the selected surplus resource
            actionResult = creep.withdraw(target, resourceType);
        } else if (target instanceof Resource) {
            // Always prioritize picking up dropped resources
            actionResult = creep.pickup(target);
            if (actionResult === OK) {
                creep.say('💰'); // Show a special emoji for picking up dropped resources
            }
        } else if (target instanceof Tombstone || target instanceof Ruin) {
            // For tombstones and ruins, prioritize energy first, then other resources
            let resourceType = RESOURCE_ENERGY;
            
            // Check if there's energy in the store
            if (target.store[RESOURCE_ENERGY] && target.store[RESOURCE_ENERGY] > 0) {
                resourceType = RESOURCE_ENERGY;
            } else {
                // If no energy, get the most abundant resource
                resourceType = Object.keys(target.store).reduce((a, b) => target.store[a] > target.store[b] ? a : b, null);
            }
            
            if (resourceType) {
                actionResult = creep.withdraw(target, resourceType);
                if (actionResult === OK) {
                    creep.say('⚱️'); // Special emoji for tombstones/ruins
                }
            } else {
                // No resources available
                actionResult = ERR_NOT_ENOUGH_RESOURCES;
            }
        } else if (target.store) {
            // For containers and other structures with store
            // Prioritize energy for regular haulers
            if (creep.memory.task === 'collector' && target.store[RESOURCE_ENERGY] > 0) {
                actionResult = creep.withdraw(target, RESOURCE_ENERGY);
            } else {
                // Otherwise get the most abundant resource
                let resourceType = Object.keys(target.store).reduce((a, b) => target.store[a] > target.store[b] ? a : b, RESOURCE_ENERGY);
                actionResult = creep.withdraw(target, resourceType);
            }
        }
    
        if (actionResult === ERR_NOT_IN_RANGE) {
            movement.moveToWithCache(creep, target);
            creep.say('🔄');
        } else if (actionResult === OK) {
            // Successfully collected resources
            // If we were temporarily collecting high-priority resources, restore previous task
            if (creep.memory.previousTask) {
                creep.memory.task = creep.memory.previousTask;
                delete creep.memory.previousTask;
                
                // If we're now full, switch to delivery mode
                if (creep.store.getFreeCapacity() === 0) {
                    creep.memory.isCollecting = false;
                }
            }
        } else if (actionResult !== OK) {
            // Typically when assigned source becomes empty
            // Clear any temporary task assignment
            if (creep.memory.previousTask) {
                creep.memory.task = creep.memory.previousTask;
                delete creep.memory.previousTask;
            }
            
            // Try to find another high-priority resource
            if (!this.checkForHighPriorityResources(creep)) {
                this.waitNear(creep); // Hold tight if no other resources found
            }
        }
    },
    

    deliverResources: function(creep) {

        const storageBuilt = Memory.rooms[creep.room.name].storageBuilt > 0;
        let target;
        let targets = [];

        switch (creep.memory.task) {
            case 'spawnHauler':
                // Prioritize spawns and extensions first, then towers, by their need for energy.
                targets = creep.room.find(FIND_MY_STRUCTURES, {
                    filter: (structure) => {
                        return (structure.structureType === STRUCTURE_EXTENSION ||
                                structure.structureType === STRUCTURE_SPAWN) &&
                                structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                    }
                });
    
                if (targets.length === 0) {
                    // If all spawns and extensions are full, then look at towers.
                    targets = creep.room.find(FIND_MY_STRUCTURES, {
                        filter: (structure) => {
                            return structure.structureType === STRUCTURE_TOWER &&
                                   structure.store.getFreeCapacity(RESOURCE_ENERGY) > 190;
                        }
                    });
                }
    
                target = creep.pos.findClosestByPath(targets);
                break;

            case 'terminalHauler':
              /*  if (creep.store[RESOURCE_ENERGY] > 49 && creep.room.storage.store[RESOURCE_ENERGY] <= 5000) {
                    target = creep.room.storage
                } else { */
                    target = creep.room.terminal
               // }
                break;

            case 'linkHauler':
                //linkHaulers only deposit energy into storage
                target = creep.room.storage
                break;


            default:
    // Check if storage is built and has free capacity
    if (storageBuilt && creep.room.storage && creep.room.storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        target = creep.room.storage;
    } else {
        // Check for spawns, extensions, and towers with free capacity
        targets = creep.room.find(FIND_MY_STRUCTURES, {
            filter: structure => (
                (structure.structureType === STRUCTURE_SPAWN || 
                structure.structureType === STRUCTURE_EXTENSION ||
                structure.structureType === STRUCTURE_TOWER) &&
                structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            )
        }).map(structure => ({
            structure: structure,
            priority: this.getDeliveryPriority(structure)
        }));

        // Sort targets by priority (lower number means higher priority) and then by distance
        if (targets.length > 0) {
            targets.sort((a, b) => a.priority - b.priority || 
                creep.pos.getRangeTo(a.structure) - creep.pos.getRangeTo(b.structure));
            target = targets[0].structure;
        } else {
            // If spawns, extensions, and towers are full or not present, find containers
            // When looking for containers, exclude the assigned container
            const assignedContainerId = creep.memory.containerId;
            let containers = creep.room.find(FIND_STRUCTURES, {
                filter: (structure) => {
                    return structure.structureType === STRUCTURE_CONTAINER &&
                        structure.id !== assignedContainerId &&
                        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }
            });

            // Find the container closest to the room's controller
            if (containers.length > 0) {
                let controller = creep.room.controller;
                target = controller ? controller.pos.findClosestByPath(containers) : null;
            }
        }
    }
    break;
        }
    
        if (target) {
            this.transferResources(creep, target);
        } else {
            if (!creep.memory.home) {
                // Try to parse the room name from the creep's name
                const nameParts = creep.name.split('_');
                if (nameParts.length > 1 && Game.rooms[nameParts[0]]) {
                    // Validate if the room exists in the game
                    creep.memory.home = nameParts[0];
                } else {
                    // Fallback to the current room if parsing fails or room is not accessible
                    creep.memory.home = creep.room.name;
                }
            }
            
            const homeRoom = Game.rooms[creep.memory.home];
            if (!homeRoom) {
                console.log('Home room not accessible:', creep.memory.home);
                return;
            }
            
            // Retrieve spawns in the home room
            const spawns = homeRoom.find(FIND_MY_SPAWNS);
            if (spawns.length === 0) {
                console.log('No spawns found in home room:', creep.memory.home);
                return;
            }
            
            const spawn = spawns[0]; // Get the first spawn
            movement.moveToWithCache(creep, spawn);

        }
    },

    getDeliveryPriority: function(structure) {
        const priorities = {
            [STRUCTURE_SPAWN]: 1,
            [STRUCTURE_EXTENSION]: 2,
            [STRUCTURE_TOWER]: 3,
            [STRUCTURE_STORAGE]: 4
        };
        return priorities[structure.structureType] || 5;
    },

    transferResources: function(creep, target) {
        // Iterate over all resources in the creep's cargo
        for (const resourceType in creep.store) {
            let result = creep.transfer(target, resourceType);
            
            if (result === ERR_NOT_IN_RANGE) {
                // Move to the target if it's not in range
                movement.moveToWithCache(creep, target);
                creep.say('🚚');
                return; // Exit the loop since we need to move closer
            } else if (result === OK) {
                // If the transfer was successful
                if (creep.store.getUsedCapacity() === 0) {
                    // Set the creep to start collecting again
                    creep.memory.isCollecting = true;
                    
                    break; // Exit the loop as the cargo is empty
                }
            } else if (result === ERR_FULL) {
                // If the target is full, find a new target or re-evaluate the task
                
                this.waitNear(creep);
                break; // Try to distribute any remaining energy
            }
        }
    },               

    waitNear: function(creep) {
        let waitLocation;
    
        // Check for containerId and linkId in memory to set waitLocation near them
        if (creep.memory.containerId) {
            const container = Game.getObjectById(creep.memory.containerId);
            if (container) {
                waitLocation = container.pos;
            }
        } else if (creep.memory.linkId) {
            const link = Game.getObjectById(creep.memory.linkId);
            if (link) {
                waitLocation = link.pos;
            }
        } else if (creep.memory.task === 'spawnHauler' || creep.memory.task === 'terminalHauler') {
            const storage = creep.room.storage;
            if (storage) {
                waitLocation = storage.pos;
            }
        }
    
    // Use room storage as a fallback wait location
    if (!waitLocation) {

        let home = creep.memory.home;  // Retrieve the home room name stored in memory
        let depotFlagName = `${home} - DEPOT`; // Construct the flag's name by appending 'Depot'
        let depotFlag = Game.flags[depotFlagName];  // Get the flag object

        if (depotFlag) {
            waitLocation = depotFlag.pos;
        } else {
            const storage = creep.room.storage;
            if (storage) {
                waitLocation = storage.pos;
            } else {
                // Fallback to the room controller if no storage is available
                if (creep.room.controller) {
                    waitLocation = creep.room.controller.pos;
                }
            }
        }
    }

    if (waitLocation) {
        movement.moveToWithCache(creep, waitLocation, 2);
        creep.say('⌛');
    } else {
        console.log(`No valid waitLocation found for creep ${creep.name} in room ${creep.room.name}`);
    }
},
    
};

module.exports = roleHauler;
