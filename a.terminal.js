//TODO
// MEMORY SWITCH FLIP ON SELL / BUY

var terminals = {
    
    manageTerminal: function(room) {
        const terminal = room.terminal;

        // Check and reset profit summary hourly
        this.manageProfitSummary(room);

        // Ensure there's at least 1000 energy before proceeding
        if (terminal.store[RESOURCE_ENERGY] < 1000) {
            //console.log('Insufficient energy for trading in', room.name);
            return; // Exit the function if there's not enough energy
        }
        
        // Iterate over all resources in the terminal
        for(const resourceType in terminal.store) {
            // Skip selling energy
            if (resourceType === RESOURCE_ENERGY) {
                continue; // Skip to the next resource
            }
            // Use specific threshold if defined, otherwise default to a general threshold
            const threshold = 1000; // Default threshold for other resources
            
            if(terminal.store[resourceType] > threshold) {
                let orders = Game.market.getAllOrders(order => order.resourceType === resourceType && order.type === ORDER_BUY);
                
                // Sort orders by price, descending
                orders.sort((a, b) => b.price - a.price);
    
                if(orders.length > 0) {
                    let amountToSell = Math.min(terminal.store[resourceType] - threshold, orders[0].amount);
                    let result = Game.market.deal(orders[0].id, amountToSell, room.name);
                    if(result === OK) {
                        let creditsEarned = orders[0].price * amountToSell;
                        console.log(`Trade executed for ${resourceType} in ${room.name}. Credits earned: ${creditsEarned}`);
                        Game.notify(`Trade executed for ${resourceType} in ${room.name}. Credits earned: ${creditsEarned}`);
                        // Update the memory with credits earned
                        Memory.rooms[room.name].tradeSummary.creditsEarned += creditsEarned;
                        Memory.rooms[room.name].tradeSummary.pauseBuy -= 5
                    }
                    else {
                        //console.log(`Trade failed for ${resourceType} in ${room.name}: ${result}`);
                    }
                }
            }
        }
        
    },


    adjustPrices: function(room) {
        const terminal = room.terminal;
    
        if (!terminal) {
            console.log('No terminal in room');
            return;
        }
    
        Object.keys(Memory.marketData).forEach(resourceType => {

            // Skip selling energy
            if (resourceType === RESOURCE_ENERGY) {
                return; // Skip to the next resource
            }
            let currentOrders = Game.market.getAllOrders({resourceType: resourceType});
            let sellOrders = currentOrders.filter(o => o.type === ORDER_SELL && o.roomName !== room.name);
            let buyOrders = currentOrders.filter(o => o.type === ORDER_BUY);
    

            let currentSellAverage = sellOrders.length ? sellOrders.reduce((acc, o) => acc + o.price, 0) / sellOrders.length : 0;
            let marketData = Memory.marketData[resourceType];
            let recordedAverage = marketData.avgPrice;
    
            let myInventory = terminal.store[resourceType];
            let SURPLUS_THRESHOLD = 1000;
            let myPrice;
            if (currentSellAverage < recordedAverage) {
                // If current average is below recorded average, set myPrice to recorded average
                myPrice = recordedAverage;
            } else {
                // If current average is above recorded average, set myPrice at current average
                myPrice = currentSellAverage;
            }
    
            // Consider the number of listings to adjust myPrice
            let orderBalance = buyOrders.length - sellOrders.length;
            let adjustmentFactor = 0.0005; // 0.05% as a decimal
            myPrice *= 1 + (orderBalance * adjustmentFactor); // Adjust myPrice based on order balance
    
            // Find any existing order for this resource in the room
            let existingOrder = _.find(Game.market.orders, o => o.type === ORDER_SELL && o.resourceType === resourceType && o.roomName === room.name);
    
            if (existingOrder) {
                // Update price
                Game.market.changeOrderPrice(existingOrder.id, myPrice);
    
                // Calculate the amount to adjust to match current inventory
                let amountToUpdate = myInventory - SURPLUS_THRESHOLD - existingOrder.remainingAmount;
                
                if(amountToUpdate > 0) {
                    // Increase the amount if we have more resources to sell
                    Game.market.extendOrder(existingOrder.id, amountToUpdate);
                } else if(amountToUpdate < 0) {
                    // Cancel the order and repost it if we have less to sell
                    Game.market.cancelOrder(existingOrder.id);
                    Game.market.createOrder({
                        type: ORDER_SELL,
                        resourceType: resourceType,
                        price: myPrice,
                        totalAmount: terminal.store[resourceType] - SURPLUS_THRESHOLD,
                        roomName: room.name
                    });

                    
                }
                console.log(`Updated sell order for ${resourceType} to ${myPrice.toFixed(2)} and adjusted amount in ${room.name}`);
            } else {
                // Only create a new order if there's enough of the resource
                let surplus = terminal.store[resourceType] ? terminal.store[resourceType] - 1000 : 0;
                if (surplus > 0) {
                    Game.market.createOrder({
                        type: ORDER_SELL,
                        resourceType: resourceType,
                        price: myPrice,
                        totalAmount: surplus,
                        roomName: room.name
                    });
                    console.log(`Creating sell order ${resourceType} @ ${myPrice.toFixed(2)} in ${room.name}`);
                }
            }
        });
    },

    

    manageProfitSummary: function(room) {
        const HOUR_TICKS = 1200; // ~3 seconds per tick
        if (!Memory.rooms[room.name].tradeSummary) {
            Memory.rooms[room.name].tradeSummary = {
                creditsEarned: 0,
                expenditures: 0,
                lastUpdate: Game.time,
                pauseBuy: 0
            };
        }
        const tradeSummary = Memory.rooms[room.name].tradeSummary;
    
        if (Game.time - tradeSummary.lastUpdate >= HOUR_TICKS) {
            const profitLoss = tradeSummary.creditsEarned - tradeSummary.expenditures;
            console.log(`Hourly Trade Summary for ${room.name}: Credits earned: ${tradeSummary.creditsEarned.toFixed(2)}, Expenditures: ${tradeSummary.expenditures.toFixed(2)}, Profit/Loss: ${profitLoss.toFixed(2)}`);
            Game.notify(`Hourly Trade Summary for ${room.name}: Credits earned: ${tradeSummary.creditsEarned.toFixed(2)}, Expenditures: ${tradeSummary.expenditures.toFixed(2)}, Profit/Loss: ${profitLoss.toFixed(2)}`);
    
            // Reset for the next period
            tradeSummary.creditsEarned = 0;
            tradeSummary.expenditures = 0;
            tradeSummary.lastUpdate = Game.time;
        }
    },
    

    purchaseUnderpricedResources: function(room) {


        if (Memory.rooms[room.name].tradeSummary.pauseBuy > 9) {
            return;
        }

        const MAX_CREDIT_SPEND_RATIO = 0.01; // Max spend ratio (1% of total credits)
        const DISCOUNT_THRESHOLD = 0.5; // Listings must be at least 25% below avg price
        
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
                        console.log(`Purchased ${amountToBuy} ${resource} for ${orderToBuy.price} credits each from ${room.name}.`);
                        // Update expenditures
                        const totalSpent = orderToBuy.price * amountToBuy;
                        Memory.rooms[room.name].tradeSummary.expenditures += totalSpent;
                        Memory.rooms[room.name].tradeSummary.pauseBuy += 1
                    } else {
                        //console.log(`Failed to purchase ${resource} from ${room.name}: ${result}`);
                    }
                }
            }
        });
    },

    updateMarketPrices: function() {

        if (!Memory.marketData) {
            Memory.marketData = {
                // Init structure for each resource
                'energy': {
                    avgPrice: 0,
                    averagePrices: [], // Array to hold the average prices
                    lastUpdate: Game.time, // Last update time to manage update frequency
                },
                'power': {
                    avgPrice: 0,
                    averagePrices: [], // Array to hold the average prices
                    lastUpdate: Game.time // Last update time to manage update frequency
                },
                'H': {
                    avgPrice: 0,                    
                    averagePrices: [], // Array to hold the average prices
                    lastUpdate: Game.time // Last update time to manage update frequency
                },
                'O': {
                    avgPrice: 0,
                    averagePrices: [], // Array to hold the average prices
                    lastUpdate: Game.time // Last update time to manage update frequency
                },
                'U': {
                    avgPrice: 0,
                    averagePrices: [], // Array to hold the average prices
                    lastUpdate: Game.time // Last update time to manage update frequency
                },
                'L': {
                    avgPrice: 0,
                    averagePrices: [], // Array to hold the average prices
                    lastUpdate: Game.time // Last update time to manage update frequency
                },
                'K': {
                    avgPrice: 0,
                    averagePrices: [], // Array to hold the average prices
                    lastUpdate: Game.time // Last update time to manage update frequency
                },
                'Z': {
                    avgPrice: 0,
                    averagePrices: [], // Array to hold the average prices
                    lastUpdate: Game.time // Last update time to manage update frequency
                },
                'X': {
                    avgPrice: 0,
                    averagePrices: [], // Array to hold the average prices
                    lastUpdate: Game.time // Last update time to manage update frequency
                },
                'G': {
                    avgPrice: 0,
                    averagePrices: [], // Array to hold the average prices
                    lastUpdate: Game.time // Last update time to manage update frequency
                },// Similar structure for other resources...
            };
        }
        const resources = Object.keys(Memory.marketData);
    const PRICE_HISTORY_LIMIT = 10; // Keep the history manageable

    resources.forEach(resource => {
        let orders = Game.market.getAllOrders({ resourceType: resource });
        if (orders.length > 0) {
            // Calculate the average price of the current orders
            let averagePrice = orders.reduce((acc, order) => acc + order.price, 0) / orders.length;

            // Get the market data for the resource
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
            console.log(`No market orders found for ${resource}`);
        }
    });
}
    

};

module.exports = terminals;
