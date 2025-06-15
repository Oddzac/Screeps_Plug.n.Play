/*
calculateDesiredCounts: function(room) {
    const phase = Memory.rooms[room.name].phase.Phase;
    const structureCount = Memory.rooms[room.name].construct.structureCount;
    const totalHostiles = room.find(FIND_HOSTILE_CREEPS).length;
    const linksBuilt = structureCount.links.built;
    const extractorBuilt = structureCount.extractor.built;
    const terminalBuilt = structureCount.terminal.built;
    const scouted = Memory.rooms[room.name].scoutingComplete;
    const roomClaimsAvailable = Memory.conquest.roomClaimsAvailable;
    const claimers = _.filter(Game.creeps, (creep) => creep.name.startsWith(room.name + "_claimer")).length;
    const scouts = _.filter(Game.creeps, (creep) => creep.name.startsWith(room.name + "_scout")).length;
    let desiredCounts = {};


    // Check the number of energy sources in the room
    const energySources = room.find(FIND_SOURCES).length;

        // Adjust desired counts if there is only one energy source
        if (energySources === 1) {
            return {
                harvester: 2,
                hauler: 3,
                builder: 2,
                upgrader: 1
            };
        }

        /*if (Memory.rooms[room.name].underAttack) {
    
            const healersNeeded = Math.ceil(totalHostiles / 2); // 1 healer for every hostile
            const attackersNeeded = totalHostiles * 2; // 2 attackers for every hostile
    
            return {
                attacker: attackersNeeded,
                healer: healersNeeded,

                harvester: 2, // Minimal sustaining number during an attack
                hauler: 2, // Minimal sustaining number
            };

        } else if (scouted === false && scouts < 1) {
            //Begin Scouting
            return {
                scout: 1,
            };
        } else if (scouted === true && roomClaimsAvailable > 0 && claimers < 1 && phase > 3) {                         
            // Scouting Complete & Can Claim
            desiredCounts = {
                claimer: 1
            };

        } else {   //////////////COMMENT OUT
            //IMPLEMENT "IF CONSTRUCTION SITES: BUILDER +1"
            switch (phase) {
                case 1:
                    // Phase 1
                    desiredCounts = {
                        harvester: 2,
                        hauler: 3,
                        upgrader: 1,
                        builder: 4,
                        
                    };
                    break;
                case 2:
                    // Phase 2
                    desiredCounts = {
                        harvester: 2,
                        hauler: 3,
                        upgrader: 2,
                        builder: 3,
                        
                    };
                    break;
                case 3:
                    // Phase 3
                    desiredCounts = {
                        harvester: 2, 
                        hauler: 4,
                        upgrader: 2,
                        builder: 3,
                        
                    };
                    break;
                case 4:
                    
                    desiredCounts = {
                        harvester: 2,
                        hauler: 5,
                        upgrader: 2,
                        builder: 3,
                        
                    };
                    break;

                case 5:
                
                    desiredCounts = {
                        harvester: 2,
                        hauler: 5,
                        upgrader: 1,
                        builder: 3,
                        
                    };
                
                    break;

                case 6:
                
                    if (extractorBuilt > 0 && terminalBuilt < 1) {
                        desiredCounts = {
                            harvester: 3,
                            hauler: 3,
                            upgrader: 1,
                            builder: 3,
                            
                        };
                    } else if (extractorBuilt > 0 && terminalBuilt > 0) {
                        desiredCounts = {
                            harvester: 3,
                            hauler: 4,
                            upgrader: 1,
                            builder: 1,
                            
                        };

                    } else {
                        desiredCounts = {
                            harvester: 2,
                            hauler: 3,
                            upgrader: 1,
                            builder: 2,
                            
                        };

                    }
                    break;

                 case 7:
                    
                    if (extractorBuilt > 0 && terminalBuilt > 0) {
                        desiredCounts = {
                            harvester: 3,
                            hauler: 5,
                            upgrader: 1,
                            builder: 1,
                            
                        };

                    } else {
                        desiredCounts = {
                            harvester: 2,
                            hauler: 4,
                            upgrader: 1,
                            builder: 3,
                            
                        };

                    }
                    break;
                // More as needed
                default:
                    desiredCounts = {
                        harvester: 3,
                        hauler: 5,
                        upgrader: 1,
                        builder: 2,
                        
                    };
                    break;
            }
        
        //console.log(`${totalEnergyRequired}`);
        //console.log(`${JSON.stringify(desiredCounts)}`);
        Memory.rooms[room.name].spawning.desiredCounts = desiredCounts;
        return desiredCounts;
        
    },
*/    