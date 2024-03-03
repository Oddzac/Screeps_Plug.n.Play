var terminals = {
    
    manageTerminal: function(room) {
        const terminal = room.terminal;
        const SURPLUS_THRESHOLD = { 'energy': 1000, 'O': 1000 }; // Default thresholds


        // Ensure there's at least 1000 energy before proceeding
        if (terminal.store[RESOURCE_ENERGY] < 1000) {
            //console.log('Insufficient energy for trading in', room.name);
            return; // Exit the function if there's not enough energy
        }
        
        // Iterate over all resources in the terminal
        for(const resourceType in terminal.store) {
            // Use specific threshold if defined, otherwise default to a general threshold
            const threshold = SURPLUS_THRESHOLD[resourceType] || 1000; // Default threshold for other resources
            
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
                    }
                    else {
                        console.log(`Trade failed for ${resourceType} in ${room.name}: ${result}`);
                    }
                }
            }
        }
    },

    adjustPrices: function(room) {
        const terminal = room.terminal;
        
        // Iterate over all resources in the terminal
        for(const resourceType in terminal.store) {
            let orders = Game.market.getAllOrders({type: ORDER_SELL, resourceType: resourceType});
            let buyOrders = Game.market.getAllOrders({type: ORDER_BUY, resourceType: resourceType});
    
            let sellOrderAverage = orders.reduce((acc, order) => acc + order.price, 0) / orders.length;
            let buyOrderAverage = buyOrders.reduce((acc, order) => acc + order.price, 0) / buyOrders.length;
    
            let myInventory = terminal.store[resourceType];
            let SURPLUS_THRESHOLD = 1000; // Default threshold for dynamic resource handling
    
            let priceAdjustmentFactor = 0.05; // Adjust this to make your price more competitive
    
            // Adjust price based on inventory and market conditions
            let myPrice;
            if(myInventory > SURPLUS_THRESHOLD) {
                myPrice = sellOrderAverage - priceAdjustmentFactor;
            } else {
                myPrice = buyOrderAverage + priceAdjustmentFactor;
            }
    
            myPrice = Math.max(myPrice, sellOrderAverage * 0.8);
            myPrice = Math.min(myPrice, buyOrderAverage * 1.2);

            let existingOrder = _.find(Game.market.orders, o => o.type == ORDER_SELL && o.resourceType == resourceType && o.roomName == room.name);
            if (existingOrder) {
                Game.market.changeOrderPrice(existingOrder.id, myPrice);
            } else {
                Game.market.createOrder({
                    type: ORDER_SELL,
                    resourceType: resourceType,
                    price: myPrice,
                    totalAmount: terminal.store[resourceType] - SURPLUS_THRESHOLD,
                    roomName: room.name
                });
            }
    
            console.log(`Setting sell price for ${resourceType} to ${myPrice.toFixed(2)} in ${room.name}`);
        }
    }
};

module.exports = terminals;
