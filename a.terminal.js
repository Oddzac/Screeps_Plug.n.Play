//TODO
// purchase limiter based on profit to expense
// if energy hi threshold

/*var terminals = {
    
    manageTerminal: function(room) {
        const terminal = room.terminal;
        if (terminal.store[RESOURCE_ENERGY] < 1000) {
            return; // Exit if not enough energy
        }
    
        let threshold;
        for (const resourceType in terminal.store) {
            threshold = resourceType === RESOURCE_ENERGY ? 10000 : 0; // Adjust thresholds as needed
    
            if (terminal.store[resourceType] > threshold) {
                let orders = Game.market.getAllOrders(order => order.resourceType === resourceType && order.type === ORDER_BUY).sort((a, b) => b.price - a.price);
    
                if (orders.length > 0 && Memory.marketData[resourceType].costBasis > 0) {
                    let marketPrice = orders[0].price;
                    if (marketPrice > Memory.marketData[resourceType].costBasis) { // Sell if market price is higher than cost basis
                        let amountToSell = Math.min(terminal.store[resourceType] - threshold, orders[0].amount);
                        let result = Game.market.deal(orders[0].id, amountToSell, room.name);
                        if (result === OK) {
                            let creditsEarned = marketPrice * amountToSell;
                            if (!Memory.marketData.marketSummary.soldQuantities[resourceType]) {
                                Memory.marketData.marketSummary.soldQuantities[resourceType] = { quantity: 0, creditsEarned: 0 };
                            }
                            Memory.marketData.marketSummary.soldQuantities[resourceType].quantity += amountToSell;
                            Memory.marketData.marketSummary.soldQuantities[resourceType].creditsEarned += creditsEarned;
    
                            this.updatePL();
                            console.log(`Trade executed for ${resourceType} in ${room.name}. Credits earned: ${creditsEarned}`);
                        }
                    }
                }
            }
        }
    },

    ensureMarketDataForResource: function(resourceType) {
        if (!Memory.marketData[resourceType]) {
            Memory.marketData[resourceType] = {
                avgPrice: 0,
                costBasis: 0,
                averagePrices: [],
                orders: {},
                lastUpdate: Game.time
            };
        } else if (!Memory.marketData[resourceType].orders) { // Ensure the orders object exists
            Memory.marketData[resourceType].orders = {};
        }
    },



adjustPrices: function(room) {
    const terminal = room.terminal;
    if (!terminal) {
        console.log('No terminal in room');
        return;
    }

    Object.keys(Memory.marketData).forEach(resourceType => {

        if (resourceType === RESOURCE_ENERGY) return; // Skip selling energy

        // Get lowest price or null orders
        let sellOrders = Game.market.getAllOrders({resourceType: resourceType, type: ORDER_SELL});
        sellOrders.sort((a, b) => a.price - b.price);
        let lowestSellPrice = sellOrders.length > 0 ? sellOrders[0].price : null;

        // Get current cost basis
        let marketData = Memory.marketData[resourceType];
        let costBasis = marketData.costBasis || 0;

        let profitMargin = 0.01; // Adjust to set desired profit margin
        let significantlyLowerThreshold = 0.10; // 10% lower than the lowest sell price

        // Maintain minimum inventory
        let myInventory = terminal.store[resourceType] || 0;
        let SURPLUS_THRESHOLD = 50; // Adjust as needed

        let myPrice;
        if (costBasis > 0 && lowestSellPrice != null && costBasis <= (lowestSellPrice * (1 - significantlyLowerThreshold))) {
            // If cost basis is significantly lower than the lowest market price, undercut the lowest price
            myPrice = lowestSellPrice - 0.0001;
        } else if (costBasis > 0) {
            // If cost basis is greater than 0 but not significantly lower, set price based on cost basis and desired profit margin
            myPrice = costBasis * (1 + profitMargin);
        } else if (costBasis === 0 && lowestSellPrice !== null) {
            // If cost basis is 0, slightly undercut the lowest market price
            myPrice = lowestSellPrice - 0.0001;
        } else {
            // Fallback if no cost basis and no market orders
            myPrice = 999; // Arbitrary high price to avoid accidental listing
        }

        if (myInventory > SURPLUS_THRESHOLD) {
            let existingOrder = _.find(Game.market.orders, {type: ORDER_SELL, resourceType: resourceType, roomName: room.name});
            if (existingOrder) {
                Game.market.changeOrderPrice(existingOrder.id, myPrice);

                // Calculate the amount by which to extend or reduce the existing order
                let amountToUpdate = myInventory - SURPLUS_THRESHOLD - existingOrder.remainingAmount;

                if (amountToUpdate > 0) {
                    // Extend the order if we have more inventory than the order covers
                    Game.market.extendOrder(existingOrder.id, amountToUpdate);
                } else if (amountToUpdate < 0) {
                    // Note: Canceling and recreating an order might not be efficient due to CPU and credit costs.
                    // Consider whether adjusting downwards is necessary or if it can be managed differently.
                }

            } else {
                let orderResult = Game.market.createOrder({
                    type: ORDER_SELL,
                    resourceType: resourceType,
                    price: myPrice,
                    totalAmount: myInventory - SURPLUS_THRESHOLD,
                    roomName: room.name
                });
                this.ensureMarketDataForResource(resourceType);
                if (typeof orderResult === "string") {
                    Memory.marketData[resourceType].orders[orderResult] = {
                        remainingAmount: myInventory - SURPLUS_THRESHOLD,
                        price: myPrice
                    };
                }
            }
            console.log(`Adjusted pricing for ${resourceType} to ${myPrice.toFixed(3)} in ${room.name}`);
        }
    });
},
    

    purchaseUnderpricedResources: function(room) {
        const terminal = room.terminal;

        let lastCredits = Memory.marketData.PL.lastCredits;
        let limitSwitch = lastCredits * .01;

        
        if (Memory.marketData.PL.PL < limitSwitch) {
            console.log(`PL: ${Memory.marketData.PL.PL} / ${limitSwitch} (no profit, skipping purchase.)`);
            return;
        }

        const MAX_CREDIT_SPEND_RATIO = 0.01; // Max spend ratio (10% of total credits)
        const DISCOUNT_THRESHOLD = 0.40; // Listings must be at least 50% below avg price
        
        // Check if there's enough credits
        const maxSpend = Game.market.credits * MAX_CREDIT_SPEND_RATIO;
        if (maxSpend < 0.01) { // Ensure there's a sensible minimum to spend based on total credits
            console.log('Insufficient credits to consider purchases.');
            return;
        }

        Object.keys(Memory.marketData).forEach(resource => {
            const resourceData = Memory.marketData[resource];
            const avgPrice = resourceData.avgPrice;

            let sellOrders = Game.market.getAllOrders({ type: ORDER_SELL, resourceType: resource });
            let underpricedOrders = sellOrders.filter(order => order.price <= avgPrice * DISCOUNT_THRESHOLD);

            if (underpricedOrders.length > 0) {
                // Sort orders to find the lowest price
                underpricedOrders.sort((a, b) => a.price - b.price);
                let orderToBuy = underpricedOrders[0];
                
                // Calculate amount to buy without exceeding maxSpend
                let maxAmountCanBuy = Math.floor(maxSpend / orderToBuy.price);
                let amountToBuy = Math.min(maxAmountCanBuy, orderToBuy.remainingAmount);

                if (amountToBuy > 0) {
                    let result = Game.market.deal(orderToBuy.id, amountToBuy, room.name);
                    if(result === OK) {
                        let totalCost = orderToBuy.price * amountToBuy;
                        // Check if this is the initial purchase for the resource
                        let currentQuantity = terminal.store[resource] || 0; // Existing quantity before purchase
                        if (Memory.marketData[resource].costBasis === 0 && currentQuantity === 0) {
                            // If this is the first purchase, set costBasis to the purchase price
                            Memory.marketData[resource].costBasis = orderToBuy.price;
                        } else {
                            // Otherwise, calculate the new average cost basis
                            let newCostBasis = ((Memory.marketData[resource].costBasis * currentQuantity) + totalCost) / (currentQuantity + amountToBuy);
                            Memory.marketData[resource].costBasis = newCostBasis;
                        }
                        console.log(`Purchased ${amountToBuy} ${resource} for ${orderToBuy.price} credits each from ${room.name}. Current cost basis: ${Memory.marketData[resource].costBasis}`);
                    } else {
                        // Handle purchase failure
                    }
                }
            }
        });

        // Get the current credits amount from the game
        const currentCredits = Game.market.credits;
        // Update the lastCredits with the currentCredits for the next comparison
        Memory.marketData.PL.lastCredits = currentCredits;
    },

    updatePL: function() {
        // Retrieve the last recorded credits amount
        const lastCredits = Memory.marketData.PL.lastCredits;
        const currentCredits = Game.market.credits;

        if (lastCredits === currentCredits) {
            //P&L has not changed since last update
            return;
        }
        
        // Calculate the profit and loss by subtracting the last recorded credits from the current credits
        let PL = currentCredits - lastCredits;
        
        // Store the calculated P&L in memory
        Memory.marketData.PL.PL = PL;
        

        console.log(`Updating PL: Last Credits = ${lastCredits}, Current Credits = ${currentCredits}, New PL = ${PL}`);
                
    },

    updateMarketPrices: function() {

        const resources = Object.keys(Memory.marketData);
        const PRICE_HISTORY_LIMIT = 10;

        resources.forEach(resource => {
            let orders = Game.market.getAllOrders({ resourceType: resource, type: ORDER_SELL }).filter(o => o.roomName !== Game.rooms[Object.keys(Game.rooms)[0]].name); // Filtering out own room's orders if necessary

            if (orders.length > 2) {
                // Sort orders by price in ascending order to easily remove the highest prices
                orders.sort((a, b) => a.price - b.price);

                // Remove the 2 highest prices
                orders.splice(-2);

                // Calculate the average price of the remaining orders
                let averagePrice = orders.reduce((acc, order) => acc + order.price, 0) / orders.length;

                let data = Memory.marketData[resource];

                // Add the new average price
                data.averagePrices.push(averagePrice);

                // Ensure the averagePrices array does not exceed the PRICE_HISTORY_LIMIT
                if (data.averagePrices.length > PRICE_HISTORY_LIMIT) {
                    data.averagePrices.shift(); // Remove the oldest price to maintain the limit
                }

                // Update the avgPrice
                data.avgPrice = data.averagePrices.reduce((acc, price) => acc + price, 0) / data.averagePrices.length;

                // Update the last update time
                data.lastUpdate = Game.time;
            } else {
                // Optionally handle the case where there are no orders for the resource
                //console.log(`No market orders found for ${resource}`);
            }
        });
    },

    cleanupOldOrders: function() {
        Object.keys(Memory.marketData).forEach(resourceType => {
            if (Memory.marketData[resourceType].orders && typeof Memory.marketData[resourceType].orders === 'object') {
                Object.keys(Memory.marketData[resourceType].orders).forEach(orderId => {
                    if (!Game.market.orders[orderId]) {
                        // If the order no longer exists in the game, remove it from memory
                        delete Memory.marketData[resourceType].orders[orderId];
                    }
                });
            }
        });
    },  



    generateMarketSummary: function() {

        const previousSummary = Memory.marketData.marketSummary || {};
        const currentSummary = {
            activeListings: [],
            overallPL: 0,
            soldQuantities: previousSummary.soldQuantities || {},
            lastRun: Game.time,
        };
        let changes = false;
        let message = "Market Summary:\n";
        let message2 = "Profit Summary:\n";


        // Active listings and their cost basis and listed price
        for (const orderId in Game.market.orders) {
            const order = Game.market.orders[orderId];
            if (order.active) {
                const resourceData = Memory.marketData[order.resourceType];
                const listing = {
                    resourceType: order.resourceType,
                    amount: order.remainingAmount,
                    costBasis: resourceData ? resourceData.costBasis : 'N/A',
                    listedPrice: order.price,
                };
                currentSummary.activeListings.push(listing);
                message += `Resource: ${listing.resourceType}, Amount: ${listing.amount}, Cost Basis: ${listing.costBasis}, Listed Price: ${listing.listedPrice}\n`;
                changes = true;
            }
        }


        // Overall P&L comparison
        const currentPL = Memory.marketData.PL ? Memory.marketData.PL.PL : 0;
        const previousPL = previousSummary.overallPL || 0;
        currentSummary.overallPL = currentPL;
        if (currentPL !== previousPL) {
            message2 += `Overall P&L: ${currentPL} (Previous: ${previousPL})\n`;
            changes = true;
        }

        // Sold quantities since last run
        if (Object.keys(currentSummary.soldQuantities).length > 0) {
            for (const [resourceType, quantity] of Object.entries(currentSummary.soldQuantities)) {
                message2 += `Sold ${resourceType}: ${quantity}\n`;
                changes = true;
            }
        }
        currentSummary.soldQuantities = {};
        



        // Update the market summary in memory
        Memory.marketData.marketSummary = currentSummary;

        // Send an email notification if there are changes
        if (changes) {
            Game.notify(message);
            Game.notify(message2);
            console.log("Market summary email sent.");
        } else {
            console.log("No significant changes in market activities.");
        }
    },  

};

module.exports = terminals;
*/


var marketManager = {

    globalMarketManagement: function() {

        if (Game.time % 50 === 0) {
            this.updateMarketPrices();
            this.updatePL();
            this.purchaseUnderpricedResources();
        }

        //10 Minutes
        if (Game.time % 201 === 0) {
            this.adjustPrices();

        }

        //Hourly
        if (Game.time % 1200 === 0) {
            this.generateMarketSummary();
        }
        
        
    },

    handleRoomTerminal: function(room) {
        this.manageStorageThresholds(room);

    },



    purchaseUnderpricedResources: function() {
        let lastCredits = Memory.marketData.PL.lastCredits;
        let limitSwitch = lastCredits * 0.01;
    
        if (Memory.marketData.PL.PL < limitSwitch) {
            console.log(`PL: ${Memory.marketData.PL.PL} / ${limitSwitch} (no profit, skipping purchase.)`);
            return;
        }
    
        const MAX_CREDIT_SPEND_RATIO = 0.01; // Max spend ratio (1% of total credits)
        const DISCOUNT_THRESHOLD = 0.40; // Listings must be at least 40% below average price
        
        const maxSpend = Game.market.credits * MAX_CREDIT_SPEND_RATIO;
        if (maxSpend < 0.01) {
            console.log('Insufficient credits to consider purchases.');
            return;
        }
    
        Object.keys(Memory.marketData).forEach(resource => {
            const resourceData = Memory.marketData[resource];
            const avgPrice = resourceData.avgPrice;
    
            let sellOrders = Game.market.getAllOrders({ type: ORDER_SELL, resourceType: resource });
            let underpricedOrders = sellOrders.filter(order => order.price <= avgPrice * DISCOUNT_THRESHOLD);
    
            if (underpricedOrders.length > 0) {
                underpricedOrders.sort((a, b) => a.price - b.price);
                let orderToBuy = underpricedOrders[0];
                
                let maxAmountCanBuy = Math.floor(maxSpend / orderToBuy.price);
                let amountToBuy = Math.min(maxAmountCanBuy, orderToBuy.remainingAmount);
    
                if (amountToBuy > 0) {
                    let result = Game.market.deal(orderToBuy.id, amountToBuy);
                    if(result === OK) {
                        let totalCost = orderToBuy.price * amountToBuy;
                        let terminals = _.filter(Game.structures, s => s.structureType === STRUCTURE_TERMINAL);
                        let terminal = terminals.length > 0 ? terminals[0] : null; // Assume the first terminal for the example
                        let currentQuantity = terminal ? terminal.store[resource] || 0 : 0; // Existing quantity before purchase
    
                        if (Memory.marketData[resource].costBasis === 0 && currentQuantity === 0) {
                            Memory.marketData[resource].costBasis = orderToBuy.price;
                        } else {
                            let newCostBasis = ((Memory.marketData[resource].costBasis * currentQuantity) + totalCost) / (currentQuantity + amountToBuy);
                            Memory.marketData[resource].costBasis = newCostBasis;
                        }
                        console.log(`Purchased ${amountToBuy} ${resource} for ${orderToBuy.price} credits each. Current cost basis: ${Memory.marketData[resource].costBasis}`);
                    } else {
                        // Handle purchase failure
                    }
                }
            }
        });
    
        Memory.marketData.PL.lastCredits = Game.market.credits; // Update the lastCredits with the current credits for the next comparison
    },
    
    
    manageStorageThresholds: function(room) {
        const terminal = room.terminal;
        if (!terminal || terminal.store[RESOURCE_ENERGY] < 1000) {
            return;
        }

        let threshold;
        for (const resourceType in terminal.store) {
            threshold = resourceType === RESOURCE_ENERGY ? 10000 : 0;

            if (terminal.store[resourceType] > threshold) {
                this.prepareToSell(room, resourceType, terminal.store[resourceType] - threshold);
            }
        }
    },
    


    prepareToSell: function(room, resourceType, amount) {
        let orders = Game.market.getAllOrders(order => order.resourceType === resourceType && order.type === ORDER_BUY).sort((a, b) => b.price - a.price);
        if (orders.length > 0) {
            let marketPrice = orders[0].price;
            if (marketPrice > Memory.marketData[resourceType].costBasis) {
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

        this.updatePL();
        console.log(`Trade executed for ${resourceType}. Credits earned: ${creditsEarned}`);
    },

    adjustPrices: function() {
        // Access all terminals across owned rooms
        const terminals = _.filter(Game.structures, s => s.structureType === STRUCTURE_TERMINAL);
    
        terminals.forEach(terminal => {
            if (!terminal) {
                console.log('No terminal available in some rooms');
                return; // Skip if no terminal is present
            }
    
            Object.keys(Memory.marketData).forEach(resourceType => {
                if (resourceType === RESOURCE_ENERGY) return; // Continue to skip energy
    
                let sellOrders = Game.market.getAllOrders({ resourceType: resourceType, type: ORDER_SELL });
                sellOrders.sort((a, b) => a.price - b.price);
                let lowestSellPrice = sellOrders.length > 0 ? sellOrders[0].price : null;
    
                let marketData = Memory.marketData[resourceType];
                let costBasis = marketData.costBasis || 0;
                let profitMargin = 0.01; // Desired profit margin
                let significantlyLowerThreshold = 0.10; // Price must be at least 10% lower than the lowest sell price
    
                let myInventory = terminal.store[resourceType] || 0;
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
                            Memory.marketData[resourceType].orders[orderResult] = {
                                remainingAmount: myInventory - SURPLUS_THRESHOLD,
                                price: myPrice
                            };
                        }
                    }
                    console.log(`Adjusted pricing for ${resourceType} to ${myPrice.toFixed(3)} globally in room ${terminal.room.name}`);
                }
            });
        });
    },
    

    updateMarketPrices: function() {
        const resources = Object.keys(Memory.marketData);
        resources.forEach(resource => {
            let orders = Game.market.getAllOrders({ resourceType: resource, type: ORDER_SELL })
                .filter(o => o.roomName !== Game.rooms[Object.keys(Game.rooms)[0]].name);
    
            if (orders.length > 2) {
                orders.sort((a, b) => a.price - b.price);
    
                // Determine weights based on price gaps
                const weights = new Array(orders.length).fill(1); // Start with a base weight of 1 for all orders
                for (let i = 1; i < orders.length; i++) {
                    if ((orders[i].price - orders[i - 1].price) > (orders[i - 1].price * 0.1)) {
                        // Reduce weight by 75% if the price jump from the previous order is more than 10%
                        weights[i] = weights[i - 1] * 0.25;
                    } else {
                        weights[i] = weights[i - 1]; // Maintain the same weight as the previous order if there's no significant gap
                    }
                }
    
                // Calculate weighted average
                let totalWeight = weights.reduce((acc, weight) => acc + weight, 0);
                let weightedSum = orders.reduce((acc, order, index) => acc + order.price * weights[index], 0);
                let weightedAverage = weightedSum / totalWeight;
    
                let data = Memory.marketData[resource];
                data.averagePrices.push(weightedAverage);
    
                if (data.averagePrices.length > 10) {
                    data.averagePrices.shift();
                }
    
                data.avgPrice = data.averagePrices.reduce((acc, price) => acc + price, 0) / data.averagePrices.length;
                data.lastUpdate = Game.time;
            }
        });
    },


    /*
    handleGlobalTransactions: function() {
        const maxSpend = Game.market.credits * 0.01;
        Object.keys(Memory.marketData).forEach(resourceType => {
            const avgPrice = Memory.marketData[resourceType].avgPrice || 0;
            let sellOrders = Game.market.getAllOrders({ type: ORDER_SELL, resourceType: resourceType });
            let underpricedOrders = sellOrders.filter(order => order.price <= avgPrice * 0.6);
            if (underpricedOrders.length > 0) {
                underpricedOrders.sort((a, b) => a.price - b.price);
                let orderToBuy = underpricedOrders[0];
                let amountToBuy = Math.min(Math.floor(maxSpend / orderToBuy.price), orderToBuy.remainingAmount);
                if (amountToBuy > 0) {
                    let result = Game.market.deal(orderToBuy.id, amountToBuy);
                    if (result === OK) {
                        console.log(`Purchased ${amountToBuy} of ${resourceType} at ${orderToBuy.price} each.`);
                    }
                }
            }
        });
    },
    */


    updatePL: function() {
        const lastCredits = Memory.marketData.PL.lastCredits;
        const currentCredits = Game.market.credits;
        let PL = currentCredits - lastCredits;
        Memory.marketData.PL.PL = PL;
        console.log(`Updating PL: New PL = ${PL}`);
    },

    cleanupOldOrders: function() {
        Object.keys(Memory.marketData).forEach(resourceType => {
            if (Memory.marketData[resourceType].orders && typeof Memory.marketData[resourceType].orders === 'object') {
                Object.keys(Memory.marketData[resourceType].orders).forEach(orderId => {
                    if (!Game.market.orders[orderId]) {
                        delete Memory.marketData[resourceType].orders[orderId];
                    }
                });
            }
        });
    },

    generateMarketSummary: function() {
        let summary = "Market Summary:\n";
        let overallPL = Memory.marketData.PL.PL || 0;
        let bucket = Game.cpu.bucket;
        summary += `Overall P&L: ${overallPL}\n`;
        summary += `CPU Bucket: ${bucket}\n`;
    
        // Summarize active orders with cost basis information
        for (const orderId in Game.market.orders) {
            const order = Game.market.orders[orderId];
            if (order.active) {
                const costBasis = Memory.marketData[order.resourceType] ? Memory.marketData[order.resourceType].costBasis : 'N/A';
                summary += `Order ${orderId}: ${order.amount} x ${order.resourceType} @ ${order.price} (Cost Basis: ${costBasis})\n`;
            }
        }
    
        // Summarize sold quantities and reset them after outputting
        if (Memory.marketData.marketSummary && Memory.marketData.marketSummary.soldQuantities) {
            for (const resourceType in Memory.marketData.marketSummary.soldQuantities) {
                const data = Memory.marketData.marketSummary.soldQuantities[resourceType];
                summary += `Sold ${data.quantity} of ${resourceType}, earning ${data.creditsEarned} credits.\n`;
                // Reset sold quantities for each resource type
                Memory.marketData.marketSummary.soldQuantities[resourceType] = { quantity: 0, creditsEarned: 0 };
            }
        }
    
        console.log(summary);
        Game.notify(summary);
    
        // Optionally update the market summary in memory if other data needs to be reset or managed
        Memory.marketData.marketSummary.lastRun = Game.time; // Update last run timestamp
    },
    

};

module.exports = marketManager;
