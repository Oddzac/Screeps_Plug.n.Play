const linker = {

    identifyLinks: function(room) {
        if (!room.storage) {
            console.log(`[LinkManager] ${room.name} does not have storage; cannot assign master link.`);
            return;
        }

        const links = room.find(FIND_MY_STRUCTURES, {
            filter: { structureType: STRUCTURE_LINK }
        });

        let masterLink = null;
        let distanceToStorage = Infinity;

        links.forEach(link => {
            const range = link.pos.getRangeTo(room.storage);
            if (range < distanceToStorage) {
                distanceToStorage = range;
                masterLink = link;
            }
        });

        const childLinks = links.filter(link => link.id !== masterLink.id);

        room.memory.links = {
            masterLink: masterLink.id,
            childLinks: childLinks.map(link => link.id)
        };
    },

    manageLinks: function(room) {

        const myLinksCount = room.find(FIND_MY_STRUCTURES, {
            filter: { structureType: STRUCTURE_LINK }
        });

        if (!room.memory.links || !room.memory.links.masterLink || !room.memory.links.childLinks || room.memory.links.childLinks.length === 0 || myLinksCount.length - 1 > room.memory.links.childLinks.length) {
            this.identifyLinks(room); // Initialize link identification if not already done
        }

        const masterLink = Game.getObjectById(room.memory.links.masterLink);
        if (!masterLink) {
            console.log(`[LinkManager] Master link in ${room.name} not found or destroyed. Reidentifying links.`);
            this.identifyLinks(room);
            return;
        }

        room.memory.links.childLinks.forEach(childLinkId => {
            const childLink = Game.getObjectById(childLinkId);
            if (childLink && childLink.store.getUsedCapacity(RESOURCE_ENERGY) > 199) {
                childLink.transferEnergy(masterLink);
            }
        });
    },

    run: function(room) {
            if (Game.time % 10 === 0) { // Example: Run every 10 ticks
                this.manageLinks(room);
            }
    }
};

module.exports = linker;