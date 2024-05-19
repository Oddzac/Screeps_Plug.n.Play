// TODO
// Expand scouting logic to track owned rooms as 


var roleScout = {
    run: function(creep) {
    // Directly set initialRoom if it's not already set
    if (!creep.memory.initialRoom) {
        console.log('Directly setting initial room for:', creep.memory.initialRoom);
        creep.memory.initialRoom = creep.room.name;
    }

    // If scouting of the initial room is complete, suicide the scout
    if (Memory.rooms[creep.memory.initialRoom] && Memory.rooms[creep.memory.initialRoom].scoutingComplete === true) {
        creep.suicide();
    }

    // Determine the next target room if necessary
    if (!creep.memory.targetRoom || creep.room.name === creep.memory.targetRoom) {
        console.log('Scout MemInit for:', creep.memory.initialRoom);
        if (creep.room.name !== creep.memory.initialRoom) {
            console.log('Setting Initial Room for:', creep.memory.initialRoom);
            this.recordRoomInfo(creep);
            creep.memory.targetRoom = creep.memory.initialRoom;
        } else {
            console.log('Scout Calling chooseNextRoom for:', creep.memory.initialRoom);
            creep.memory.targetRoom = this.chooseNextRoom(creep);
        }
    }

    // Move to the target room if it's not the current room
    if (creep.room.name !== creep.memory.targetRoom) {
        const exitDir = creep.room.findExitTo(creep.memory.targetRoom);
        const exit = creep.pos.findClosestByRange(exitDir);
        creep.moveTo(exit);
    } else if (creep.room.name === creep.memory.targetRoom) {
        console.log('Scout in target room:', creep.memory.initialRoom);

        // Attempt to move towards the controller if it's an unowned room
        if (controller && !controller.owner) {
          // Initialize move attempt counter if not already set
          if (creep.memory.moveAttempts === undefined) {
              creep.memory.moveAttempts = 0;
          }

          let rangeToController = creep.pos.getRangeTo(controller);

          // Only try to move towards the controller if not within 5 tiles
          if (rangeToController > 5) {
              let moveResult = creep.moveTo(controller, {visualizePathStyle: {stroke: '#ffaa00'}});
              // Increment move attempts counter if move command was issued
              if (moveResult === OK) {
                  creep.memory.moveAttempts++;
              }
          } else {
              // If within 5 tiles, set accessibleController flag to true
              if (!Memory.conquest.scoutedRooms[creep.room.name]) {
                  Memory.conquest.scoutedRooms[creep.room.name] = {};
              }
              Memory.conquest.scoutedRooms[creep.room.name].accessibleController = true;
              // Reset move attempts counter
              creep.memory.moveAttempts = 0;
          }

          // Consider the controller inaccessible if move attempts exceed a threshold (e.g., 50 attempts)
          if (creep.memory.moveAttempts > 50) {
              Memory.conquest.scoutedRooms[creep.room.name].accessibleController = false;
              console.log('Controller in', creep.room.name, 'is deemed inaccessible.');
              // Reset move attempts counter to prevent repeated logging
              creep.memory.moveAttempts = 0;
          }
      }
    }
  },

    /*isHighwayRoom: function(room) {
      // Extract the horizontal and vertical components from the room name
      const matches = room.match(/^[WE]([0-9]+)[NS]([0-9]+)$/);
      if (!matches) return false; // In case the room name doesn't match the expected pattern
  
      // Parse the numerical parts
      const [, horizontal, vertical] = matches.map(Number);
  
      // Check if either the horizontal or vertical component is divisible by 10
      if (horizontal % 10 === 0 || vertical % 10 === 0) {
        return true;
      } else {
        return false;
      }
  }, */
      
    chooseNextRoom: function(creep) {
        if (!creep.memory.initialRoom) {
            creep.memory.initialRoom = creep.room.name;
        }
        if (!creep.memory.availableExits) {
            // Store available exits from the initial room
            creep.memory.availableExits = Game.map.describeExits(creep.memory.initialRoom);
        }

        if (!creep.memory.exploredRooms) {
            // Initialize an array to keep track of rooms that have been attempted for scouting
            creep.memory.exploredRooms = [];
        }

        if (!creep.memory.exitOrder) {
            // Define the order in which exits will be checked based on the clockwise direction
            creep.memory.exitOrder = [FIND_EXIT_RIGHT, FIND_EXIT_BOTTOM, FIND_EXIT_LEFT, FIND_EXIT_TOP];
        }

        if (!creep.memory.currentExitIndex) {
            creep.memory.currentExitIndex = 0; // Start with the first direction in the order
        }
    
        // Increment and loop the index to cycle through directions
        let attemptedAllDirections = false;
        let nextRoom = null;
        while (!nextRoom && !attemptedAllDirections) {
            const direction = creep.memory.exitOrder[creep.memory.currentExitIndex];
            nextRoom = creep.memory.availableExits[direction];
            if (!nextRoom || creep.memory.exploredRooms.includes(nextRoom)) {
                // If the room is not available or already explored, move to the next direction
                creep.memory.currentExitIndex = (creep.memory.currentExitIndex + 1) % creep.memory.exitOrder.length;
                nextRoom = null; // Reset nextRoom to null to continue the search
                // Check if we have attempted all directions
                attemptedAllDirections = creep.memory.currentExitIndex === 0;
            }
        }
    
        if (nextRoom) {
            // Add the room to the list of explored rooms to avoid revisiting
            creep.memory.exploredRooms.push(nextRoom);
            
            return nextRoom;
        } else {
            // Mark scouting as complete if all directions have been attempted
            Memory.rooms[creep.memory.initialRoom].scoutingComplete = true;

            return null;
        }
    },
            
    recordRoomInfo: function(creep) {
        // Basic room info
        const roomInfo = {
          name: creep.room.name,
          owner: creep.room.controller ? creep.room.controller.owner : null,
          //isHighway: this.isHighwayRoom(creep.room),
          sources: creep.room.find(FIND_SOURCES).map(source => ({
            id: source.id,
            type: source.energy ? 'energy' : 'unknown' // Add other types as necessary
          })),
          terrain: this.analyzeTerrain(creep.room),
          hasController: !!creep.room.controller,
          accessibleController: false,
        };

      
        // Determine if the room is claimable
        if (roomInfo.hasController && !roomInfo.owner) {
          Memory.conquest.claimRooms[roomInfo.name] = true;
        }

        // Determine if the room is attack target (check that room owner formatted correctly) 
        if (roomInfo.hasController && roomInfo.owner !== 'Odd-z') {
          Memory.conquest.targetRooms[roomInfo.name] = true;
        }
      
        // Avoid duplicating info
        if (!Memory.conquest.scoutedRooms[roomInfo.name]) {
          Memory.conquest.scoutedRooms[roomInfo.name] = roomInfo;
        }
      
        console.log(`Scouting report for room ${roomInfo.name}: `, JSON.stringify(roomInfo));
        Game.notify(`Scouting report for room ${roomInfo.name}: ` + JSON.stringify(roomInfo));
      },
      
      analyzeTerrain: function(room) {
        const terrain = room.getTerrain();
        let counts = { plain: 0, swamp: 0, wall: 0 };
        
        for (let x = 0; x < 50; x++) {
          for (let y = 0; y < 50; y++) {
            switch (terrain.get(x, y)) {
              case TERRAIN_MASK_WALL:
                counts.wall++;
                break;
              case TERRAIN_MASK_SWAMP:
                counts.swamp++;
                break;
              default:
                counts.plain++;
                break;
            }
          }
        }
      
        // Convert counts to percentages
        let total = counts.plain + counts.swamp + counts.wall;
        return {
          plain: (counts.plain / total) * 100,
          swamp: (counts.swamp / total) * 100,
          wall: (counts.wall / total) * 100,
        };
    },

    
};

  module.exports = roleScout