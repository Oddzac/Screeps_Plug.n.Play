/**
 * Give Way Module - Enhanced version with smarter avoidance
 * 
 * Usage:
 * 1. Import this module in your creep role files: var giveWay = require("./u.giveWay");
 * 2. Call creep.giveWay() after your creep's movement logic
 * 
 * This module allows creeps to move out of the way when they're blocking other creeps.
 * It works by having moving creeps mark stationary creeps as "blocking", which
 * causes those creeps to move in a smart direction to clear the path.
 */

Creep.prototype.giveWay = function() {
    // Don't move if fatigued
    if (this.fatigue > 0) {
        return;
    }
    
    // We can't block others when we're actively moving
    if (this.hasMoved) {
        delete this.memory.blocking;
        return;
    }
    
    // Check if we're in a traffic jam (multiple creeps around us)
    const surroundingCreeps = this.pos.findInRange(FIND_MY_CREEPS, 2).length - 1; // -1 to exclude self
    const isInTrafficJam = surroundingCreeps >= 4;
    
    // If we're in a traffic jam and not working, consider moving even without a blocking request
    if (isInTrafficJam && !this.memory.working && !this.memory.blocking && Game.time % 5 === 0) {
        // Find a random direction to move to alleviate traffic
        const validDirections = this.getSmartMoveDirections();
        if (validDirections.length > 0) {
            this.say("🚶", true);
            this.move(validDirections[Math.floor(Math.random() * validDirections.length)]);
            return;
        }
    }
    
    // No request to move
    if (!this.memory.blocking) {
        return;
    }
    
    // It's an old request that has timed out
    if (typeof this.memory.blocking === 'number' && Game.time > this.memory.blocking) {
        delete this.memory.blocking;
        return;
    }

    // Check if the creep is working - don't interrupt important tasks
    // But if we're in a traffic jam, move anyway after a few ticks of being blocked
    const blockingTime = typeof this.memory.blocking === 'object' ? 
        this.memory.blocking.time - Game.time : 0;
    
    if (this.memory.working && blockingTime < 3) {
        // Only stay put if we haven't been blocking for too long
        return;
    }

    // Find the direction of the creep that wants to pass through
    const blockingData = this.memory.blocking;
    let preferredDirection;
    
    if (typeof blockingData === 'object' && blockingData.fromPos) {
        // Calculate preferred direction based on the position of the blocking creep
        const fromPos = new RoomPosition(
            blockingData.fromPos.x, 
            blockingData.fromPos.y, 
            blockingData.fromPos.roomName
        );
        
        // Get direction from the blocking creep to this creep
        const dx = this.pos.x - fromPos.x;
        const dy = this.pos.y - fromPos.y;
        
        // Determine the best direction to move (continue in same direction)
        if (Math.abs(dx) > Math.abs(dy)) {
            // Moving horizontally
            preferredDirection = dx > 0 ? RIGHT : LEFT;
        } else {
            // Moving vertically
            preferredDirection = dy > 0 ? BOTTOM : TOP;
        }
    }

    // Get valid directions, prioritizing the preferred direction if available
    // If we're in a traffic jam, be more willing to use swamps
    const validDirections = this.getSmartMoveDirections(preferredDirection, isInTrafficJam);
    
    if (validDirections.length > 0) {
        // Move in the best direction to get out of the way
        this.say("💢", true);
        this.move(validDirections[0]);
    } else if (isInTrafficJam) {
        // If we're in a traffic jam and can't find a good direction, try any valid direction
        const directions = [TOP, TOP_RIGHT, RIGHT, BOTTOM_RIGHT, BOTTOM, BOTTOM_LEFT, LEFT, TOP_LEFT];
        for (const dir of directions) {
            const result = this.move(dir);
            if (result === OK) {
                this.say("🏃", true);
                break;
            }
        }
    }
    
    delete this.memory.blocking;
};

// Taken from Screeps engine source code
const offsetsByDirection = [, [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];

/**
 * Get valid directions for movement, prioritizing the preferred direction
 * @param {number} preferredDirection - The preferred direction to move in
 * @param {boolean} isTrafficJam - Whether we're in a traffic jam situation
 */
Creep.prototype.getSmartMoveDirections = function(preferredDirection, isTrafficJam = false) {
    // First check if the preferred direction is valid
    const validDirections = [];
    const scoredDirections = [];
    
    // Check all 8 directions
    for (let dir = 1; dir <= 8; dir++) {
        const offset = offsetsByDirection[dir];
        const x = this.pos.x + offset[0];
        const y = this.pos.y + offset[1];
        
        // Skip if out of bounds
        if (x < 0 || x > 49 || y < 0 || y > 49) {
            continue;
        }
        
        // Look for obstacles
        const lookResults = this.room.lookAt(x, y);
        let isValid = true;
        let score = 0;
        
        // Check for roads (prefer moving onto roads)
        const hasRoad = lookResults.some(result => 
            result.type === 'structure' && result.structure.structureType === STRUCTURE_ROAD
        );
        
        if (hasRoad) {
            score += 5; // Prefer roads
        }
        
        // Check for swamp (avoid if possible, but less penalty in traffic jams)
        const isSwamp = lookResults.some(result => 
            result.type === 'terrain' && result.terrain === 'swamp'
        );
        
        if (isSwamp) {
            // Reduce swamp penalty in traffic jams to encourage using alternative paths
            score -= isTrafficJam ? 1 : 3;
        }
        
        // Check for creeps nearby (avoid crowded areas)
        const nearbyPos = new RoomPosition(x, y, this.room.name);
        const nearbyCreeps = nearbyPos.findInRange(FIND_MY_CREEPS, 1).length;
        
        // Penalize positions with many nearby creeps
        score -= nearbyCreeps * 2;
        
        for (const result of lookResults) {
            // Check for impassable terrain
            if (result.type === 'terrain' && result.terrain === 'wall') {
                isValid = false;
                break;
            }
            
            // Check for structures that block movement
            if (result.type === 'structure') {
                const structure = result.structure;
                if (structure.structureType !== STRUCTURE_ROAD && 
                    structure.structureType !== STRUCTURE_CONTAINER && 
                    structure.structureType !== STRUCTURE_RAMPART) {
                    isValid = false;
                    break;
                }
                
                // Only allow moving onto friendly ramparts
                if (structure.structureType === STRUCTURE_RAMPART && !structure.my) {
                    isValid = false;
                    break;
                }
            }
            
            // Check for other creeps
            if (result.type === 'creep') {
                // In traffic jams, we might want to swap positions with other creeps
                if (isTrafficJam) {
                    const otherCreep = result.creep;
                    // If the other creep is also stuck and not working, consider it valid
                    // but with a penalty
                    if (otherCreep.my && !otherCreep.memory.working) {
                        score -= 5;
                    } else {
                        isValid = false;
                    }
                } else {
                    isValid = false;
                }
                break;
            }
        }
        
        if (isValid) {
            // If this is the preferred direction, give it a big score boost
            if (preferredDirection && dir === preferredDirection) {
                score += 10;
            }
            
            // Add randomness to break ties and prevent predictable patterns
            score += Math.random() * 0.5;
            
            // Add to valid directions
            validDirections.push(dir);
            
            // Add to scored directions for smarter selection
            scoredDirections.push({ direction: dir, score: score });
        }
    }
    
    // If we have scored directions, sort by score and return the best ones
    if (scoredDirections.length > 0) {
        scoredDirections.sort((a, b) => b.score - a.score);
        return scoredDirections.map(d => d.direction);
    }
    
    return validDirections;
};

/**
 * Override the built-in move method to track movement and mark blocking creeps
 */
const originalMove = Creep.prototype.move;
Creep.prototype.move = function(target) {
    // We passed a direction
    if (typeof target === "number" && target >= 1 && target <= 8) {
        // Use the direction to find the next position
        const offset = offsetsByDirection[target];
        const nextX = this.pos.x + offset[0];
        const nextY = this.pos.y + offset[1];

        // Check if the next position is within room bounds
        if (nextX >= 0 && nextX <= 49 && nextY >= 0 && nextY <= 49) {
            // Check any creeps at the next position
            const blockingCreeps = this.room.lookForAt(LOOK_CREEPS, nextX, nextY);
            if (blockingCreeps.length > 0) {
                const blockingCreep = blockingCreeps[0];
                // Only mark our own creeps as blocking
                if (blockingCreep && blockingCreep.my) {
                    // Request that they move away with information about our position
                    blockingCreep.memory.blocking = {
                        time: Game.time + 1,
                        fromPos: {
                            x: this.pos.x,
                            y: this.pos.y,
                            roomName: this.pos.roomName
                        }
                    };
                }
            }
        }
    }

    // Mark that this creep has moved this tick
    this.hasMoved = true;

    // Call the original move method
    return originalMove.call(this, target);
};

/**
 * Override the built-in moveTo method to track movement
 */
const originalMoveTo = Creep.prototype.moveTo;
Creep.prototype.moveTo = function() {
    // Mark that this creep has moved this tick
    this.hasMoved = true;
    
    // Call the original moveTo method with all arguments
    return originalMoveTo.apply(this, arguments);
};

/**
 * Reset the hasMoved flag at the beginning of each tick
 * This should be called in main.js before creep logic runs
 */
function resetCreepMovement() {
    for (const name in Game.creeps) {
        delete Game.creeps[name].hasMoved;
    }
}

/**
 * Visualize creep traffic and movement patterns
 */
function visualizeTraffic() {
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        const visual = room.visual;
        
        // Get all creeps in the room
        const creeps = room.find(FIND_MY_CREEPS);
        
        // Create a heatmap of creep positions
        const heatmap = {};
        
        for (const creep of creeps) {
            const key = `${creep.pos.x},${creep.pos.y}`;
            heatmap[key] = (heatmap[key] || 0) + 1;
        }
        
        // Visualize the heatmap
        for (const key in heatmap) {
            const [x, y] = key.split(',').map(Number);
            const intensity = Math.min(heatmap[key] * 0.2, 1);
            visual.circle(x, y, {
                radius: 0.5,
                fill: `rgba(255, 0, 0, ${intensity})`,
                opacity: 0.5
            });
        }
        
        // Visualize creep movement intentions
        for (const creep of creeps) {
            if (creep.memory.blocking) {
                visual.circle(creep.pos.x, creep.pos.y, {
                    radius: 0.5,
                    fill: 'blue',
                    opacity: 0.5
                });
            }
        }
    }
}

module.exports = {
    resetCreepMovement,
    visualizeTraffic
};