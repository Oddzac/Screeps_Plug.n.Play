var roleScout = {
    run: function(creep) {
        const targetRoom = 'E24S19'; 
        if (creep.room.name !== targetRoom) {
            const exitDir = creep.room.findExitTo(targetRoom);
            const exit = creep.pos.findClosestByRange(exitDir);
            creep.moveTo(exit);
        } else {
            // Perform scouting actions, like recording room details
            console.log(`Scouting in ${creep.room.name}`);
        }
    }
};
