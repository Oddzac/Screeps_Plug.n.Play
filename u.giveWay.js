/**
 * Give Way Module - Based on V1king's implementation (12 March 2024)
 * 
 * Usage:
 * 1. Import this module in your creep role files: var giveWay = require("./u.giveWay");
 * 2. Call creep.giveWay() after your creep's movement logic
 * 
 * This module allows creeps to move out of the way when they're blocking other creeps.
 * It works by having moving creeps mark stationary creeps as "blocking", which
 * causes those creeps to move in a random direction to clear the path.
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
    
    // No request to move
    if (!this.memory.blocking) {
        return;
    }
    
    // It's an old request that has timed out
    if (Game.time > this.memory.blocking) {
        delete this.memory.blocking;
        return;
    }

    // Check if the creep is working - don't interrupt important tasks
    if (this.memory.working) {
        delete this.memory.blocking;
        return;
    }

    // Find a valid direction to move
    const validDirections = this.getValidMoveDirections();
    if (validDirections.length > 0) {
        // Move a random valid direction to get out of their way
        const randomDirection = validDirections[Math.floor(Math.random() * validDirections.length)];
        this.say("💢", true);
        this.move(randomDirection);
    }
    
    delete this.memory.blocking;
}

// Taken from Screeps engine source code
const offsetsByDirection = [, [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];

/**
 * Get valid directions for movement that don't lead into walls or other creeps
 */
Creep.prototype.getValidMoveDirections = function() {
    const validDirections = [];
    
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
                isValid = false;
                break;
            }
        }
        
        if (isValid) {
            validDirections.push(dir);
        }
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
                    // Request that they move away either this tick or the next
                    blockingCreep.memory.blocking = Game.time + 1;
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

module.exports = {
    resetCreepMovement
};