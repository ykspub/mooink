(function(exports) {
	let config = undefined;
	let msgpack = undefined;

	if (typeof module == 'undefined') {
		config = window.config;
		msgpack = window.msgpack;
	}
	else {
		config = require('../common/config.js');
		msgpack = require('../common/msgpack.js');
	}

	let itemData = config.unifiedItems;
	function compInt(a, b) {
		if (Math.abs(a - b) < 0.1) {
			return true;
		}
		return false;
	}

	function gcd(a, b) {
		if ((!b) || compInt(b, 0)) {
			return a;
		}
		return gcd(b, a % b);
	}
	
	function ItemSlot(item, count) {
		this.item = item;
		this.count = count;
	}
	ItemSlot.prototype.isBoxVariant = function(second) {
		if (typeof second != 'undefined') {
			if ((this.item == config.getTypeByName("Box")) && (typeof this.boxInfo != 'undefined')) {
				if (
					(this.boxInfo.item == second.item) && 
					(typeof this.boxInfo.count != 'undefined') && (this.boxInfo.count > 0) &&
					(typeof second.count != 'undefined') && (second.count > 0)
				) {
					return true;
				}
			}
		}
		return false;
	}
	ItemSlot.prototype.totalEq = function(second) {
		if (typeof second != 'undefined') {
			if (
				(this.item == config.getTypeByName("Box")) &&
				(second.item == config.getTypeByName("Box"))
			) {
				if (
					(typeof this.boxInfo != 'undefined') && (typeof second.boxInfo != 'undefined') &&
					(this.boxInfo.item == second.boxInfo.item) &&
					((this.boxInfo.count || 0) == (second.boxInfo.count || 0))
				) {
					return true;
				}
			}			
			else if (this.item == second.item) {
				return true;
			}
		}
		return false;
	}

	var craftRatios = [
		// Decomposition
		[
			[
				1000,
				[config.getTypeByName("Wood"), 1],
			], 
			[
				[config.getTypeByName("Wood walls"), 1],
			]
		],
		[
			[
				5000,
				[config.getTypeByName("Rock"), 5],
				[config.getTypeByName("Wood"), 10],
				[config.getTypeByName("Harming Powder"), 1],
			], 
			[
				[config.getTypeByName("Baby Spikes"), 1],
			]
		],
		[
			[
				10000,
				[config.getTypeByName("Rock"), 15],
				[config.getTypeByName("Wood"), 20],
			], 
			[
				[config.getTypeByName("Pit trap"), 1],
			]
		],
		[
			[
				12000,
				[config.getTypeByName("Rock"), 20],
				[config.getTypeByName("Wood"), 20],
			], 
			[
				[config.getTypeByName("Bigger Walls"), 1],
			]
		],
		[
			[
				7000,
				[config.getTypeByName("Rock"), 10],
				[config.getTypeByName("Wood"), 15],
			], 
			[
				[config.getTypeByName("Boost pads"), 1],
			]
		],
		
		// Synthesis
		[
			[
				1000,
				[config.getTypeByName("Wood walls"), 1],
			], 
			[
				[config.getTypeByName("Wood"), 1],
			]
		],
		[
			[
				7000,
				[config.getTypeByName("Boost pads"), 1],
			], 
			[
				[config.getTypeByName("Rock"), 10],
				[config.getTypeByName("Wood"), 15],
			]
		],
		[
			[
				10000,
				[config.getTypeByName("Pit trap"), 1],
			], 
			[
				[config.getTypeByName("Rock"), 15],
				[config.getTypeByName("Wood"), 20],
			]
		],
		[
			[
				12000,
				[config.getTypeByName("Bigger Walls"), 1],
			], 
			[
				[config.getTypeByName("Rock"), 20],
				[config.getTypeByName("Wood"), 20],
			]
		],
        [
			[
				20000,
				[config.getTypeByName("Crafter T.1"), 1],
			], 
			[
				[config.getTypeByName("Rock"), 100],
				[config.getTypeByName("Wood"), 200],
			]
		],
		/*
		[
			[
				20000,
				[config.getTypeByName("Furnace"), 1],
			], 
			[
				[config.getTypeByName("Rock"), 100],
				[config.getTypeByName("Wood"), 250],
			]
		],
		*/
		[
			[
				6000,
				[config.getTypeByName("Lapis Spikes"), 1],
			], 
			[
				[config.getTypeByName("Baby Spikes"), 1],
				[config.getTypeByName("Harming Powder"), 5],
				[config.getTypeByName("Rock"), 30],
			]
		],
		/*
		[
			[
				10000,
				[config.getTypeByName("TNT"), 1],
			], 
			[
				[config.getTypeByName("Harming Powder"), 15],
				[config.getTypeByName("Rock"), 30],
				[config.getTypeByName("Wood"), 50],
			]
		],
		*/
		[
			[
				20000,
				[config.getTypeByName("Spawner"), 1],
			], 
			[
				[config.getTypeByName("Rock"), 100],
				[config.getTypeByName("Wood"), 100],
				[config.getTypeByName("Harming powder"), 5],
			]
		],
	];
	exports.craftRatios = craftRatios;

	var furnaceRatios = [
		[
			[
				8000,
				[config.getTypeByName("Charcoal"), 1],
			], 
			[
				[config.getTypeByName("Wood"), 15],
			]
		],
		[
			[
				10000,
				[config.getTypeByName("Aluminum"), 1],
			], 
			[
				[config.getTypeByName("Charcoal"), 10],
				[config.getTypeByName("Rock"), 80],
			]
		]
	];
	exports.furnaceRatios = furnaceRatios;
	
	exports.maxCraftTime = 3 * 60 * 60 * 1000;

	function InventoryManager() {
		this.actionBarItems = [];
		this.inventoryItems = [];
		this.buildCounts = [];
		
		this.inventoryChange = false;
		
		for (let j = 0; j < config.actionBarSize; j++) {
			this.actionBarItems[j] = undefined;
		}
		for (let j = 0; j < config.inventorySize; j++) {
			this.inventoryItems[j] = undefined;
		}
	}
	InventoryManager.prototype.setChoices = function(primary, secondary) {
		this.actionBarItems = [];

		this.actionBarItems[0] = new ItemSlot(primary, undefined);
		this.actionBarItems[1] = new ItemSlot(secondary, undefined);
		
		this.applyGrant(config.defaultActionBar);
		
		for (let j = 0; j < config.itemGrants.length; j++) {
			let shouldApply = false;
			for (let k = 1; k < config.itemGrants[j].length; k++) {
				if ((primary == config.itemGrants[j][k]) || (secondary == config.itemGrants[j][k])) {
					shouldApply = true;
					break;
				}
			}
			if (shouldApply == true) {
				this.applyGrant(config.itemGrants[j][0]);
			}
		}
	}
	InventoryManager.prototype.applyGrant = function(grant) {
		for (let j = 0; j < grant.length; j++) {
			this.actionBarItems[grant[j][0]] = new ItemSlot(grant[j][1], undefined);
		}
	}
	InventoryManager.prototype.getUnifiedIndex = function(index) {
		let toReturn = undefined;
		if (index >= config.actionBarSize) {
			toReturn = this.inventoryItems[index-config.actionBarSize];
		}
		else {
			toReturn = this.actionBarItems[index];
		}
		if (typeof toReturn !== 'undefined') {
			return toReturn;
		}
		else {
			return new ItemSlot(config.getTypeByName("No Item"), undefined);
		}
	}
	InventoryManager.prototype.getUnifiedIndexType = function(index) {
		let toReturn = this.getUnifiedIndex(index);
		if (typeof toReturn !== 'undefined') {
			return toReturn.item;
		}
		else {
			return undefined;
		}
	}
	InventoryManager.prototype.setUnifiedIndex = function(index, value) {
		if (index >= config.actionBarSize) {
			this.inventoryItems[index-config.actionBarSize] = value;
		}
		else {
			this.actionBarItems[index] = value;
		}
		this.inventoryChange = true;
	}
	InventoryManager.prototype.getActionBarItem = function(index) {
		if (index < config.actionBarSize) {
			return this.getUnifiedIndex(index);
		}
		return undefined;
	}
	InventoryManager.prototype.getActionBarType = function(index) {
		let toReturn = this.getActionBarItem(index);
		if (typeof toReturn !== 'undefined') {
			return toReturn.item;
		}
		else {
			return undefined;
		}
	}
	InventoryManager.prototype.setActionBarItem = function(index, value) {
		if (index < config.actionBarSize) {
			this.actionBarItems[index] = value;
			this.inventoryChange = true;
		}
	}
	InventoryManager.prototype.getFoodItem = function() {
		for (let j = 0; j < config.actionBarSize; j++) {
			if (typeof this.actionBarItems[j] != 'undefined') {
				let itemType = this.getActionbarItem(j);
				if ((itemData[itemType] != 'undefined') &&
					(itemData[itemType].action == config.getActionByName("heal"))
				){
					return itemType;
				}
			}
		}
		return this.getActionBarType(2);
	}
	InventoryManager.prototype.getPrimary = function() {
		return this.getActionBarType(0);
	}
	InventoryManager.prototype.getSecondary = function() {
		return this.getActionBarType(1);
	}
	InventoryManager.prototype.structurePlaced = function(unifiedIndex) {
		if (typeof unifiedIndex != 'undefined') {
			let slotPlaced = this.getActionBarItem(unifiedIndex);
			if (typeof slotPlaced !== 'undefined') {
				let typeID = slotPlaced.item;
				if (typeof this.buildCounts[typeID] !== 'undefined') {
					this.buildCounts[typeID] += 1;
				}
				else {
					this.buildCounts[typeID] = 1;
				}
				
				if (typeof slotPlaced.count != 'undefined') {
					slotPlaced.count -= 1;
					if (slotPlaced.count <= 0) {
						this.setActionBarItem(unifiedIndex, undefined);
					}
					else {
						this.setActionBarItem(unifiedIndex, slotPlaced);
					}
					this.inventoryChange = true;
				}
			}
		}
	}
	InventoryManager.prototype.structureDestroyed = function(typeID) {
		this.buildCounts[typeID] -= 1;
		if (this.buildCounts[typeID] < 0) {
			this.buildCounts[typeID] = 0;
		}
	}
	InventoryManager.prototype.swapSlots = function(first, second) {
		let firstCopy = this.getUnifiedIndex(first);
		let secondCopy = this.getUnifiedIndex(second);
		
		if (
			(typeof firstCopy != 'undefined') && (typeof secondCopy != 'undefined') &&
			secondCopy.isBoxVariant(firstCopy)
		) {
			secondCopy.boxInfo.count += firstCopy.count;
			this.setUnifiedIndex(first, undefined);
		}
		else if (
			(typeof firstCopy != 'undefined') && (typeof secondCopy != 'undefined') &&
			(typeof firstCopy.count != 'undefined') && (firstCopy.count > 0) &&
			(typeof secondCopy.count != 'undefined') && (secondCopy.count > 0) &&
			firstCopy.totalEq(secondCopy)
		) {
			secondCopy.count += firstCopy.count;
			this.setUnifiedIndex(second, secondCopy);
			this.setUnifiedIndex(first, undefined);
		}
		else {
			this.setUnifiedIndex(first, secondCopy);
			this.setUnifiedIndex(second, firstCopy);
		}
		this.inventoryChange = true;
	}
	InventoryManager.prototype.boxItem = function(first) {
		let currSlot = this.getUnifiedIndex(first);
		if ((typeof currSlot != 'undefined') && (typeof currSlot.item != 'undefined') && (currSlot.item != config.getTypeByName("No Item"))) {
			if (currSlot.item == config.getTypeByName("Box")) {
				let boxInfo = currSlot.boxInfo;
				if (typeof boxInfo != 'undefined') {
					let newSlot = new ItemSlot(boxInfo.item, boxInfo.count);
					this.setUnifiedIndex(first, newSlot);
				}
			}
			else {
				let newSlot = new ItemSlot(config.getTypeByName("Box"), 1);
				newSlot.boxInfo = new ItemSlot(currSlot.item, currSlot.count);
				this.setUnifiedIndex(first, newSlot);
			}
		}
	}
	InventoryManager.prototype.buildIncludes = function(typeID) {
		for (let j = 0; j < config.actionBarSize; j++) {
			if (this.getActionBarType(j) == typeID) {
				return true;
			}
		}
		return false;
	}
	InventoryManager.prototype.canPlace = function(index, buildcountFactor) {
		let slotPlaced = this.getActionBarItem(index);
		if (typeof slotPlaced !== 'undefined') {
			let typeID = slotPlaced.item;
			let holding = config.unifiedItems[typeID];
			let buildLimit = (holding.buildUnscalable !== true) ? Math.floor(holding.build_limit * buildcountFactor) : holding.build_limit;
			if (typeof slotPlaced.count !== 'undefined') {
				if (slotPlaced.count >= 1) {
					return true;
				}
				else {
					return false;
				}
			}
			else if ((typeof this.buildCounts[typeID] == 'undefined') || (this.buildCounts[typeID] < buildLimit)) {
				return true;
			}
			else {
				return false;
			}
		}
		return false;
	}
	InventoryManager.prototype.serializeIndividualItem = function(ack, item) {
		if (typeof item == 'undefined') {
			msgpack.addNumb(ack, config.unifiedItems.length+1);
		}
		else {
			msgpack.addNumb(ack, item.item);
			if (typeof item.count !== 'undefined') {
				msgpack.addNumb(ack, item.count);
			}
			else {
				msgpack.addNumb(ack, 0);
			}
			
			if (item.item == config.getTypeByName("Box")) {
				this.serializeIndividualItem(ack, item.boxInfo);
			}
		}
	}
	InventoryManager.prototype.serializeItemData = function(ack) {
		this.inventoryChange = false;
		msgpack.addArray(ack, this.actionBarItems.length);
		for (let j = 0; j < this.actionBarItems.length; j++) {
			this.serializeIndividualItem(ack, this.actionBarItems[j]);
		}
		msgpack.addArray(ack, this.inventoryItems.length);
		for (let j = 0; j < this.inventoryItems.length; j++) {
			this.serializeIndividualItem(ack, this.inventoryItems[j]);
		}
		return ack;
	}
	InventoryManager.prototype.addItemNoMerge = function(item, quantity) {
		for (let j = 0; j < config.actionBarSize + config.inventorySize; j++) {
			let currIndex = this.getUnifiedIndex(j);
			if ((typeof currIndex == 'undefined') ||
				(currIndex.item == config.getTypeByName("No Item"))
			) {
				this.setUnifiedIndex(j, new ItemSlot(item, quantity));
				break;
			}
		}
	}
	InventoryManager.prototype.addItem = function(item, quantity) {
		let isAdded = false;
		for (let j = 0; j < config.actionBarSize + config.inventorySize; j++) {
			let currIndex = this.getUnifiedIndex(j);
			if (typeof currIndex != 'undefined') {
				if ((currIndex.item == item) && (typeof currIndex.count != 'undefined')) {
					currIndex.count += quantity;
					this.setUnifiedIndex(j, currIndex);
					isAdded = true;
					break;
				}
			}
		}
		if (isAdded == false) {
			this.addItemNoMerge(item, quantity);
		}
	}
	InventoryManager.prototype.insertCraft = function(inputResultant) {
		if (typeof inputResultant != 'undefined') {
			let craftResultant = inputResultant[1];
			let dupCount = Math.round(inputResultant[0]);
			if ((typeof inputResultant != 'undefined') && (typeof dupCount != 'undefined')) {
				for (let j = 1; j < craftResultant.length; j++) {
					this.addItem(craftResultant[j][0], craftResultant[j][1] * dupCount);
				}
			}
		}
	}
	InventoryManager.prototype.getCraft = function(inputArray, referenceArray) {
		if ((typeof inputArray != 'undefined') && (inputArray.length > 0)) {
			for (let i = 0; i < referenceArray.length; i++) {
				let resultantValue = referenceArray[i][0];
				let requiredItems = referenceArray[i][1];
				
				if (requiredItems.length == inputArray.length) {
					let tentativeRatio = undefined;
					let isFailed = false;
					
					for (let j = 0; j < inputArray.length; j++) {
						let isFound = false;
						for (let k = 0; k < requiredItems.length; k++) {
							if (inputArray[j][0] == requiredItems[k][0]) {
								let currRatio = inputArray[j][1] / requiredItems[k][1];
								if ((Number.isInteger(currRatio)) &&
									((typeof tentativeRatio == 'undefined') || compInt(tentativeRatio, currRatio))
								) {
									isFound = true;
									tentativeRatio = currRatio;
									break;
								}
							}
						}
						if (isFound == false) {
							isFailed = true;
							break;
						}
					}
					if (isFailed == false) {
						return [Math.round(tentativeRatio), resultantValue];
					}
				}
			}
		}
		return undefined;
	}
	InventoryManager.prototype.split1 = function(index) {
		let toSplit = this.getUnifiedIndex(index);
		if ((typeof toSplit != 'undefined') && (typeof toSplit.item != 'undefined') && (typeof toSplit.count != 'undefined') && (toSplit.count > 1)) {
			this.addItemNoMerge(toSplit.item, 1);
			toSplit.count -= 1;
			this.setUnifiedIndex(index, toSplit);
		}
	}
	InventoryManager.prototype.splitN = function(index, numSplit) {
		let toSplit = this.getUnifiedIndex(index);
		if ((typeof toSplit != 'undefined') && (typeof toSplit.item != 'undefined') && (typeof toSplit.count != 'undefined') && (typeof numSplit != 'undefined') &&
			(numSplit > 0) && (toSplit.count > numSplit)) {
			this.addItemNoMerge(toSplit.item, numSplit);
			toSplit.count -= numSplit;
			this.setUnifiedIndex(index, toSplit);
		}
	}
	InventoryManager.prototype.splitHalf = function(index) {
		let toSplit = this.getUnifiedIndex(index);
		if ((typeof toSplit != 'undefined') && (typeof toSplit.item != 'undefined') && (typeof toSplit.count != 'undefined') && (toSplit.count > 1)) {
			let retainCount = Math.floor(toSplit.count / 2);
			this.addItemNoMerge(toSplit.item, toSplit.count - retainCount);
			toSplit.count = retainCount;
			this.setUnifiedIndex(index, toSplit);
		}
	}
	InventoryManager.prototype.discardItem = function(index) {
		this.setUnifiedIndex(index, undefined);
	}
	function expectItem(recieved) {
		let itemType = msgpack.expectNumb(recieved);
		let itemQty = undefined;
		if (itemType < config.unifiedItems.length) {
			itemQty = msgpack.expectNumb(recieved);
		}
		else {
			itemType = undefined;
		}
		
		let toReturn = new ItemSlot(itemType, itemQty)
		
		if (itemType == config.getTypeByName("Box")) {
			toReturn.boxInfo = expectItem(recieved);
		}
		
		return toReturn;
	}
	exports.expectItem = expectItem;
	
	function isBox(type, boxInfo) {
		if ((type == config.getTypeByName("Box")) && (typeof boxInfo != 'undefined')) {
			if (
				(typeof boxInfo.item != 'undefined') && 
				(boxInfo.item != config.getTypeByName("No Item")) && (boxInfo.item < config.unifiedItems.length)
			) {
				return true;
			}
		}
		return false;
	}
	exports.isBox = isBox;

	exports.InventoryManager = InventoryManager;
	exports.ItemSlot = ItemSlot;
	exports.ItemSlot = ItemSlot;
})((typeof module == 'undefined') ? window.inventoryManager = {} : module.exports);