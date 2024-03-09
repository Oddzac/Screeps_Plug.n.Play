//TODO
// DISREGARD 2 HIGHEST PRICES WHEN DETERMINING AVERAGE
// purchase limiter based on profit to expense

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
            const threshold = 500; // Default threshold for other resources
            
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
                        Memory.rooms[room.name].tradeSummary.pauseBuy -= .5;
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

        // Sort sell orders by price in ascending order
        sellOrders.sort((a, b) => a.price - b.price);

        // Remove the 2 highest prices if there are enough orders
        if (sellOrders.length > 2) {
            sellOrders.splice(-2);
        }

        // Calculate the average sell price excluding the 2 highest prices
        let currentSellAverage = sellOrders.length ? sellOrders.reduce((acc, o) => acc + o.price, 0) / sellOrders.length : 0;
        let marketData = Memory.marketData[resourceType];
        let recordedAverage = marketData.avgPrice;

        let myInventory = terminal.store[resourceType] || 0;
        let SURPLUS_THRESHOLD = 500;
        let myPrice;
        if (currentSellAverage < recordedAverage) {
            myPrice = recordedAverage;
        } else {
            myPrice = currentSellAverage;
        }

        // Adjustment based on order balance
        let orderBalance = buyOrders.length - sellOrders.length;
        let adjustmentFactor = 0.01 // .05% per balance point
        myPrice *= 1 + (orderBalance * adjustmentFactor);

        let existingOrder = _.find(Game.market.orders, o => o.type === ORDER_SELL && o.resourceType === resourceType && o.roomName === room.name);

        if (existingOrder) {
            Game.market.changeOrderPrice(existingOrder.id, myPrice);
            let amountToUpdate = myInventory - SURPLUS_THRESHOLD - existingOrder.remainingAmount;

            if (amountToUpdate > 0) {
                Game.market.extendOrder(existingOrder.id, amountToUpdate);
            } else if (amountToUpdate < 0) {
                Game.market.cancelOrder(existingOrder.id);
                if (myInventory > SURPLUS_THRESHOLD) {
                    Game.market.createOrder({
                        type: ORDER_SELL,
                        resourceType: resourceType,
                        price: myPrice,
                        totalAmount: myInventory - SURPLUS_THRESHOLD,
                        roomName: room.name
                    });
                }
            }
            console.log(`Updated sell order for ${resourceType} to ${myPrice.toFixed(2)} in ${room.name}`);
        } else if (myInventory > SURPLUS_THRESHOLD) {
            Game.market.createOrder({
                type: ORDER_SELL,
                resourceType: resourceType,
                price: myPrice,
                totalAmount: myInventory - SURPLUS_THRESHOLD,
                roomName: room.name
            });
            console.log(`Creating sell order ${resourceType} @ ${myPrice.toFixed(2)} in ${room.name}`);
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


        if (Memory.rooms[room.name].tradeSummary.creditsEarned < Memory.rooms[room.name].tradeSummary.expenditures) {
            return;
        }

        const MAX_CREDIT_SPEND_RATIO = 0.1; // Max spend ratio (10% of total credits)
        const DISCOUNT_THRESHOLD = 0.75; // Listings must be at least 75% below avg price
        
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
                        Memory.rooms[room.name].tradeSummary.pauseBuy += 1;
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
            console.log(`No market orders found for ${resource}`);
        }
    });
}
    

};

module.exports = terminals;
