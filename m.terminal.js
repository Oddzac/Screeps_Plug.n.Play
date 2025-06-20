//TODO
// Game.market.calcTransactionCost to determine if transaction possible
// Set cap via transaction cost for amountToBuy limiter

var marketManager = {

    globalMarketManagement: function() {
        
        if (Game.time % 50 === 0) {
            this.updatePL();
            this.purchaseUnderpricedResources();
        }

        //10 Minutes
        if (Game.time % 201 === 0) {
            this.updateMarketPrices();
            this.adjustPrices();

        }

        //Hourly
        if (Game.time % 1200 === 0) {
            this.generateMarketSummary();
            this.consolidateEnergy();
        }


        //Daily
        if (Game.time % 28800 === 0) {
            this.updateResourceNeeds();
        }
        
    },

    handleRoomTerminal: function(room) {
        this.manageStorageThresholds(room);

    },



    purchaseUnderpricedResources: function() {

        const bucket = Game.cpu.bucket;
        const currentPL = Memory.marketData.PL.PL;
        let lastCredits = Memory.marketData.PL.lastCredits; //Get last recorded credits
        let limitSwitch = lastCredits * 0.001;
        let purchased = false;
        
    
        if (currentPL < limitSwitch && currentPL !== 0) {
            let percentToLimit = (currentPL / limitSwitch) * 100;
            console.log(`PL: ${percentToLimit}% (Below Profit Threshold)`);
            return;
        }
        
        if (bucket < 550) {
            console.log(`CPU: ${bucket} / 500 (Below Execution Threshold)`);
            return;
        }

        const terminals = _.filter(Game.structures, s => s.structureType === STRUCTURE_TERMINAL);
        
        // Safeguard: Check if we have any terminals
        if (!terminals || terminals.length === 0) {
            console.log('No terminals available in any room. Cannot proceed with market operations.');
            return;
        }
        
        const masterTerminal = terminals[0];
        
        // Safeguard: Check if masterTerminal has a room
        if (!masterTerminal.room) {
            console.log('Master terminal has no room. Cannot proceed with market operations.');
            return;
        }
        
        const MAX_CREDIT_SPEND_RATIO = 0.01; // Max spend ratio (1% of total credits)
        const DISCOUNT_THRESHOLD = 0.50; // Listings must be at least 50% below average price
        
        const maxSpend = Game.market.credits * MAX_CREDIT_SPEND_RATIO;
        if (maxSpend < 0.01) {
            console.log('Insufficient credits to consider purchases.');
            return;
        }
        
        // Get prioritized resources
        const priorityList = this.prioritizeResources();
        
        // Create a set of priority resources for quick lookup
        const priorityResources = new Set(priorityList.map(p => p.resource));
        
        // Combine priority resources with other resources
        const resourcesInOrder = [
            ...priorityList.map(p => p.resource),
            ...Object.keys(Memory.marketData.resources).filter(r => !priorityResources.has(r))
        ];
        
        resourcesInOrder.forEach(resource => {
            const resourceData = Memory.marketData.resources[resource];
            const avgPrice = resourceData.avgPrice;
            const maxPriceToPay = avgPrice * (1 - DISCOUNT_THRESHOLD);
    

            let sellOrders = Game.market.getAllOrders({ type: ORDER_SELL, resourceType: resource });
            let underpricedOrders = sellOrders.filter(order => order.price <= avgPrice * (1 - DISCOUNT_THRESHOLD));
    
            if (underpricedOrders.length > 0) {
                console.log(`[PurchaseResource] Resource: ${resource} - Orders under ${maxPriceToPay}: ${underpricedOrders.length}`);
                underpricedOrders.sort((a, b) => a.price - b.price);
                let orderToBuy = underpricedOrders[0];
                
                // Calculate maximum amount we can buy based on credits
                let maxAmountCanBuy = Math.floor(maxSpend / orderToBuy.price);
                let amountToBuy = maxAmountCanBuy;
                let transactionCost, totalCost;
                
                // Safeguard: Check if orderToBuy has a roomName
                if (!orderToBuy.roomName) {
                    console.log(`[Error] Order ${orderToBuy.id} has no roomName. Skipping.`);
                    return;
                }
                
                // Adjust amountToBuy based on available energy for transport
                try {
                    do {
                        transactionCost = Game.market.calcTransactionCost(amountToBuy, masterTerminal.room.name, orderToBuy.roomName);
                        totalCost = orderToBuy.price * amountToBuy + transactionCost;
                        if (totalCost > maxSpend || transactionCost > masterTerminal.store[RESOURCE_ENERGY]) {
                            amountToBuy--;  // Decrease the amount to buy if over limits
                        } else {
                            break; // If within budget, proceed
                        }
                    } while (amountToBuy > 0);
                } catch (e) {
                    console.log(`[Error] Failed to calculate transaction cost: ${e}. Skipping purchase.`);
                    return;
                }
                
                if (amountToBuy > 0) {
                   if (!orderToBuy || !Game.market.getOrderById(orderToBuy.id)) {
                       console.log(`[Error] The order ID ${orderToBuy.id} is not valid or the order has been removed.`);
                       return;
                   } 
                   console.log(`[PurchaseResource] ${masterTerminal.room.name} Attempting to purchase ${amountToBuy} of ${resource}`);
                   let result = Game.market.deal(orderToBuy.id, amountToBuy, masterTerminal.room.name);
                   if(result === OK) {
                        let totalCost = orderToBuy.price * amountToBuy;
                        let terminals = _.filter(Game.structures, s => s.structureType === STRUCTURE_TERMINAL);
                        let terminal = terminals.length > 0 ? terminals[0] : null;
                        let currentQuantity = terminal ? terminal.store[resource] || 0 : 0; // Existing quantity before purchase

                        if (Memory.marketData.resources[resource].costBasis === 0 && currentQuantity === 0) {
                            Memory.marketData.resources[resource].costBasis = orderToBuy.price;
                        } else {
                            let newCostBasis = ((Memory.marketData.resources[resource].costBasis * currentQuantity) + totalCost) / (currentQuantity + amountToBuy);
                            Memory.marketData.resources[resource].costBasis = newCostBasis;

                            console.log(`[PurchaseResource] New Cost Basis for ${resource}: ${newCostBasis}`);
                        }
                        console.log(`[PurchaseResource] Purchased ${amountToBuy} ${resource} for ${orderToBuy.price} credits each. Total cost: ${orderToBuy.price * amountToBuy}`);
                        Game.notify(`[PurchaseResource] Purchased ${amountToBuy} ${resource} for ${orderToBuy.price} credits each. Total cost: ${orderToBuy.price * amountToBuy}`);


                        let newQuantity = masterTerminal.store[resource] || 0;
                        console.log(`[PurchaseResource] Current quantity of ${resource} in ${masterTerminal.room.name}: ${newQuantity}`);
                        Game.notify(`[PurchaseResource] Current quantity of ${resource} in ${masterTerminal.room.name}: ${newQuantity}`);
                        purchased = true;
                    } else {
                        console.log(`[PurchaseResource] Purchase failed... ${result}`);
                        return;
                    }
                } else {
                    console.log(`[PurchaseResource] Not enough energy or credits to purchase any of ${resource}`);
                }
            }
        });
    
        if (purchased) {
            Memory.marketData.PL.lastCredits = Game.market.credits; // Update the lastCredits with the current credits for the next comparison
        }
    
    },
    
    
    manageStorageThresholds: function(room) {
        const terminal = room.terminal;
        if (!terminal || terminal.store[RESOURCE_ENERGY] < 1000) {
            return;
        }

        // Initialize resource needs if not already done
        if (!Memory.resourceNeeds) {
            this.initResourceNeeds();
        }

        let threshold;
        for (const resourceType in terminal.store) {
            // Check if this is a resource we want to keep
            let keepAmount = 0;
            
            // Check basic resources
            if (Memory.resourceNeeds.basic[resourceType]) {
                keepAmount = Memory.resourceNeeds.basic[resourceType];
            }
            
            // Check lab resources
            if (Memory.resourceNeeds.labs[resourceType]) {
                keepAmount = Math.max(keepAmount, Memory.resourceNeeds.labs[resourceType]);
            }
            
            // Check boost resources
            if (Memory.resourceNeeds.boosts[resourceType]) {
                keepAmount = Math.max(keepAmount, Memory.resourceNeeds.boosts[resourceType]);
            }
            
            // Default threshold for energy
            if (resourceType === RESOURCE_ENERGY) {
                keepAmount = Math.max(keepAmount, 10000);
            }
            
            threshold = keepAmount;

            if (terminal.store[resourceType] > threshold) {
                this.prepareToSell(room, resourceType, terminal.store[resourceType] - threshold);
            }
        }
    },
    


    prepareToSell: function(room, resourceType, amount) {
        let orders = Game.market.getAllOrders(order => order.resourceType === resourceType && order.type === ORDER_BUY).sort((a, b) => b.price - a.price);
        if (orders.length > 0) {
            let marketPrice = orders[0].price;
            if (marketPrice > Memory.marketData.resources[resourceType].costBasis) {
                let result = Game.market.deal(orders[0].id, amount, room.name);
                if (result === OK) {
                    this.registerSale(resourceType, amount, marketPrice);
                }
            }
        }
    },

    registerSale: function(resourceType, amount, price) {
        let creditsEarned = price * amount;
        if (!Memory.marketData.marketSummary.soldQuantities[resourceType]) {
            Memory.marketData.marketSummary.soldQuantities[resourceType] = { quantity: 0, creditsEarned: 0 };
        }
        Memory.marketData.marketSummary.soldQuantities[resourceType].quantity += amount;
        Memory.marketData.marketSummary.soldQuantities[resourceType].creditsEarned += creditsEarned;

        
        console.log(`Trade executed for ${resourceType}. Credits earned: ${creditsEarned}`);
        this.updatePL();
    },
    
    // Define essential resources for different RCL levels
    initResourceNeeds: function() {
        if (!Memory.resourceNeeds) {
            Memory.resourceNeeds = {
                // Basic resources needed at all levels
                basic: {
                    [RESOURCE_ENERGY]: 10000,
                    [RESOURCE_OXYGEN]: 1000,
                    [RESOURCE_HYDROGEN]: 1000,
                    [RESOURCE_UTRIUM]: 1000,
                    [RESOURCE_LEMERGIUM]: 1000,
                    [RESOURCE_KEANIUM]: 1000,
                    [RESOURCE_ZYNTHIUM]: 1000,
                    [RESOURCE_CATALYST]: 1000
                },
                // Resources for specific purposes
                labs: {},
                boosts: {},
                // Track what's reserved for specific purposes
                reserved: {}
            };
        }
    },
    
    // Update resource needs based on current RCL
    updateResourceNeeds: function() {
        this.initResourceNeeds();
        
        // Update needs based on current RCL
        const myRooms = Object.values(Game.rooms).filter(r => r.controller && r.controller.my);
        const maxRCL = Math.max(...myRooms.map(r => r.controller.level), 0);
        
        // Adjust resource needs based on RCL
        if (maxRCL >= 6) {
            // Labs are available at RCL 6
            Memory.resourceNeeds.labs = {
                // Common lab reactions
                [RESOURCE_HYDROXIDE]: 1000,  // OH: O + H
                [RESOURCE_ZYNTHIUM_KEANITE]: 500,  // ZK: Z + K
                [RESOURCE_UTRIUM_LEMERGITE]: 500,  // UL: U + L
            };
            
            // Basic boosts
            Memory.resourceNeeds.boosts = {
                [RESOURCE_CATALYZED_GHODIUM_ACID]: 500,  // GH2O: Upgrade controller
                [RESOURCE_CATALYZED_ZYNTHIUM_ACID]: 500,  // ZH2O: Dismantle
                [RESOURCE_CATALYZED_LEMERGIUM_ACID]: 500,  // LH2O: Heal
                [RESOURCE_CATALYZED_KEANIUM_ALKALIDE]: 500,  // KO: Ranged attack
                [RESOURCE_CATALYZED_UTRIUM_ACID]: 500,  // UH2O: Attack
            };
        }
        
        console.log(`Updated resource needs for RCL ${maxRCL}`);
    },
    
    // Prioritize resources based on current needs
    prioritizeResources: function() {
        if (!Memory.resourceNeeds) {
            this.initResourceNeeds();
        }
        
        // Create a priority list of resources to buy
        let priorityList = [];
        
        // First, check what we're missing from our basic needs
        const terminals = _.filter(Game.structures, s => s.structureType === STRUCTURE_TERMINAL);
        if (terminals.length === 0) return [];
        
        const masterTerminal = terminals[0];
        if (!masterTerminal || !masterTerminal.room) return [];
        
        // Check basic resources
        for (const resource in Memory.resourceNeeds.basic) {
            const needed = Memory.resourceNeeds.basic[resource];
            const current = masterTerminal.store[resource] || 0;
            if (current < needed) {
                priorityList.push({
                    resource: resource,
                    priority: 1,
                    amount: needed - current
                });
            }
        }
        
        // Check lab resources if we have labs
        const myRooms = Object.values(Game.rooms).filter(r => r.controller && r.controller.my);
        const hasLabs = myRooms.some(r => r.find(FIND_MY_STRUCTURES, {filter: s => s.structureType === STRUCTURE_LAB}).length > 0);
        
        if (hasLabs) {
            for (const resource in Memory.resourceNeeds.labs) {
                const needed = Memory.resourceNeeds.labs[resource];
                const current = masterTerminal.store[resource] || 0;
                if (current < needed) {
                    priorityList.push({
                        resource: resource,
                        priority: 2,
                        amount: needed - current
                    });
                }
            }
            
            // Check boost resources
            for (const resource in Memory.resourceNeeds.boosts) {
                const needed = Memory.resourceNeeds.boosts[resource];
                const current = masterTerminal.store[resource] || 0;
                if (current < needed) {
                    priorityList.push({
                        resource: resource,
                        priority: 3,
                        amount: needed - current
                    });
                }
            }
        }
        
        // Sort by priority (lower number = higher priority)
        priorityList.sort((a, b) => a.priority - b.priority);
        
        return priorityList;
    },

    adjustPrices: function() {
        // Access all terminals across owned rooms
        const terminals = _.filter(Game.structures, s => s.structureType === STRUCTURE_TERMINAL);
    
        terminals.forEach(terminal => {
            if (!terminal) {
                console.log('No terminal available in some rooms');
                return; // Skip if no terminal is present
            }
    
            Object.keys(Memory.marketData.resources).forEach(resourceType => {

                let myInventory = terminal.store[resourceType] || 0;
                if (resourceType === RESOURCE_ENERGY && myInventory < 10000) return; // Skip energy
    
                let sellOrders = Game.market.getAllOrders({ resourceType: resourceType, type: ORDER_SELL });
                sellOrders.sort((a, b) => a.price - b.price);
                let lowestSellPrice = sellOrders.length > 0 ? sellOrders[0].price : null;
    
                let marketData = Memory.marketData.resources[resourceType];
                let costBasis = marketData.costBasis || 0;
                let profitMargin = 0.01; // Desired profit margin
                let significantlyLowerThreshold = 0.10; // Price must be at least 10% lower than the lowest sell price
    

                let SURPLUS_THRESHOLD = 50; // Inventory threshold above which to sell
    
                let myPrice;
    
                // Determine the price based on cost basis and market conditions
                if (costBasis > 0 && lowestSellPrice != null && costBasis <= (lowestSellPrice * (1 - significantlyLowerThreshold))) {
                    myPrice = lowestSellPrice - 0.0001; // Undercut the lowest price if significantly lower
                } else if (costBasis > 0) {
                    myPrice = costBasis * (1 + profitMargin); // Add a profit margin
                } else if (costBasis === 0 && lowestSellPrice !== null) {
                    myPrice = lowestSellPrice - 0.00001; // Undercut the lowest price slightly if no cost basis
                } else {
                    myPrice = 999; // Default high price to avoid accidental listing
                }
    
                // Adjust the market orders based on current inventory
                if (myInventory > SURPLUS_THRESHOLD) {
                    let existingOrder = _.find(Game.market.orders, {type: ORDER_SELL, resourceType: resourceType, roomName: terminal.room.name});
                    if (existingOrder) {
                        Game.market.changeOrderPrice(existingOrder.id, myPrice);
                        let amountToUpdate = myInventory - SURPLUS_THRESHOLD - existingOrder.remainingAmount;
                        if (amountToUpdate > 0) {
                            Game.market.extendOrder(existingOrder.id, amountToUpdate);
                        }
                    } else {
                        let orderResult = Game.market.createOrder({
                            type: ORDER_SELL,
                            resourceType: resourceType,
                            price: myPrice,
                            totalAmount: myInventory - SURPLUS_THRESHOLD,
                            roomName: terminal.room.name
                        });
                        if (typeof orderResult === "string") {
                            Memory.marketData.resources[resourceType].orders[orderResult] = {
                                remainingAmount: myInventory - SURPLUS_THRESHOLD,
                                price: myPrice
                            };
                        }
                    }
                    console.log(`Adjusted pricing for ${resourceType} to ${myPrice.toFixed(3)} in room ${terminal.room.name}`);
                }
            });
        });
    },
    


    updateMarketPrices: function() {
        const resources = Object.keys(Memory.marketData.resources);
        resources.forEach(resource => {
            let orders = Game.market.getAllOrders({ resourceType: resource, type: ORDER_SELL })
                .filter(o => !Game.rooms[o.roomName] || o.roomName !== Game.rooms[Object.keys(Game.rooms)[0]].name);
    
            let data = Memory.marketData.resources[resource];
            
            if (orders.length > 0) {
                if (orders.length > 2) {
                    orders.sort((a, b) => a.price - b.price);
    
                    // Determine weights based on price gaps
                    const weights = new Array(orders.length).fill(1); // Start with a base weight of 1 for all orders
                    for (let i = 1; i < orders.length; i++) {
                        if ((orders[i].price - orders[i - 1].price) > (orders[i - 1].price * 0.1)) {
                            // Reduce weight by 70% if the price jump from the previous order is more than 10%
                            weights[i] = weights[i - 1] * 0.30;
                        } else {
                            weights[i] = weights[i - 1]; // Maintain the same weight as the previous order if there's no significant gap
                        }
                    }
    
                    // Calculate weighted average
                    let totalWeight = weights.reduce((acc, weight) => acc + weight, 0);
                    let weightedSum = orders.reduce((acc, order, index) => acc + order.price * weights[index], 0);
                    var weightedAverage = weightedSum / totalWeight;
                } else {
                    // Simple average for <= 2 orders
                    var weightedAverage = orders.reduce((acc, order) => acc + order.price, 0) / orders.length;
                }
    
                data.averagePrices.push(weightedAverage);
    
                if (data.averagePrices.length > 10) {
                    data.averagePrices.shift();
                }
    
                data.avgPrice = data.averagePrices.reduce((acc, price) => acc + price, 0) / data.averagePrices.length;
            } else {
                // Handle case with no orders, set avgPrice to 0 or maintain previous value
                data.avgPrice = 0;
            }
    
            data.lastUpdate = Game.time;
        });
    },
    






    updatePL: function() {
        const lastCredits = Memory.marketData.PL.lastCredits;
        const currentCredits = Game.market.credits;
        let PL = currentCredits - lastCredits;
        Memory.marketData.PL.PL = PL;
        console.log(`Updating PL: ${PL}`);
    },

    cleanupOldOrders: function() {
        Object.keys(Memory.marketData.resources).forEach(resourceType => {
            if (Memory.marketData.resources[resourceType].orders && typeof Memory.marketData.resources[resourceType].orders === 'object') {
                Object.keys(Memory.marketData.resources[resourceType].orders).forEach(orderId => {
                    if (!Game.market.orders[orderId]) {
                        delete Memory.marketData.resources[resourceType].orders[orderId];
                    }
                });
            }
        });
    },

    consolidateEnergy: function() {
        const terminals = _.filter(Game.structures, s => s.structureType === STRUCTURE_TERMINAL);
        if (terminals.length === 0) {
            console.log('No terminals available.');
            return;
        }
        const masterTerminal = terminals[0];        

        terminals.forEach(terminal => {
            if (terminal.id === masterTerminal.id) {
                return; // Skip the master terminal itself
            }
            const energyToSend = terminal.store[RESOURCE_ENERGY]; // Amount of energy to send if conditions are met
            if (energyToSend > 0) {
                const amount = terminal.store[RESOURCE_ENERGY]; // Calculate excess energy
                const cost = Game.market.calcTransactionCost(amount, terminal.room.name, masterTerminal.room.name);
                const availableToSend = amount - cost;
                if (availableToSend > 0) { // Check if there is enough energy for sending and the cost
                    const result = terminal.send(RESOURCE_ENERGY, availableToSend, masterTerminal.room.name);
                    if (result === OK) {
                        console.log(`Sent ${amount} energy from ${terminal.room.name} to ${masterTerminal.room.name}`);
                    } else {
                        console.log(`Failed to send energy from ${terminal.room.name}: ${result}`);
                    }
                }
            }
        });
    },

    generateMarketSummary: function() {
        let summary = "Market Summary:\n";
        let overallPL = Memory.marketData.PL.PL || 0;
        let bucket = Game.cpu.bucket;
        summary += `Overall P&L: ${overallPL}\n`;
        summary += `CPU Bucket: ${bucket}\n`;
    
        // Summarize sold quantities and reset them after outputting
        if (Memory.marketData.marketSummary && Memory.marketData.marketSummary.soldQuantities) {
            for (const resourceType in Memory.marketData.marketSummary.soldQuantities) {
                const data = Memory.marketData.marketSummary.soldQuantities[resourceType];
                if (data.quantity > 0) {
                    summary += `Sold ${data.quantity} of ${resourceType}, earning ${data.creditsEarned} credits.\n`;
                    // Reset sold quantities for each resource type
                    Memory.marketData.marketSummary.soldQuantities[resourceType] = { quantity: 0, creditsEarned: 0 };
                }
            }
        }
    
        // Summarize active orders with cost basis information
        for (const orderId in Game.market.orders) {
            const order = Game.market.orders[orderId];
            if (order.active) {
                const costBasis = Memory.marketData.resources[order.resourceType] ? Memory.marketData.resources[order.resourceType].costBasis : 'N/A';
                summary += `Order ${orderId}: ${order.amount} x ${order.resourceType} @ ${order.price} (Cost Basis: ${costBasis})\n`;
            }
        }

        console.log(summary);
        Game.notify(summary);
    
        // Optionally update the market summary in memory if other data needs to be reset or managed
        Memory.marketData.marketSummary.lastRun = Game.time; // Update last run timestamp
    },
    

};

module.exports = marketManager;