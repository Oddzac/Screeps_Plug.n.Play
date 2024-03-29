//TODO
// purchase limiter based on profit to expense
// if energy hi threshold

var terminals = {
    
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
