var connections;
var postToWebhook;

var cells = [];
var structureCells = [];
var players = [];
var structures = [];
var gameStructureCells = [];
var autobreakTimers = [];
var sendHits = [];

var serverGameMaster = undefined;
var tbGayTeamID = undefined;
var tbGayAccept = undefined;

var spawnPoint = undefined;

var teams = undefined;
var projectiles = undefined;
var projectileCells = undefined;
var makeProjectile = undefined;

var teamLocationCounter = 0;
var shouldCalcBot = true;
var shouldCalcOccludes = true;

var lastAdvanceTime = Date.now();
var lastTickStart = Date.now();
var lastZombieHeal = Date.now();

var msgpack = require('../common/msgpack.js');
var config = require('../common/config.js');
var mapData = require('../common/mapData.js');
var utils = require('./utils.js');
var scores = require('./scores.js');
var tbgay = require('./TBK.js');
var inventoryManager = require('../common/inventoryManager.js');
var structureManager = require('./structureManager.js');

function processPlayerCell(cell, callback, ...args) {
    for (let j = 0; j < cell.length; j++) {
        if (cell[j] !== undefined) {
            let thePlayer = players[cell[j]];
            if (thePlayer !== undefined) {
                if (callback(thePlayer, ...args) == true) {
                    return true;
                }
            }
        }
    }
}
function processStructureCell(cell, callback, ...args) {
    for (let j = 0; j < cell.length; j++) {
        if (cell[j] !== undefined) {
            let theStructure = structures[cell[j]];
            if (theStructure !== undefined) {
                if (callback(theStructure, ...args) == true) {
                    return true;
                }
            }
        }
    }
}

function init(t, proj, projCells, makeProj, conn, i_postToWebhook) {
    teams = t;
    connections = conn;
    projectiles = proj;
    projectileCells = projCells;
    makeProjectile = makeProj;
    postToWebhook = i_postToWebhook;
    tbgay.init(players, structures, cells, structureCells, processPlayerCell, processStructureCell, connections, deletePlayer);
	structureManager.init(connections, cells, structureCells, players, structures, gameStructureCells, autobreakTimers, inventoryManager.isBox, makeProj);
    initializeCells();
}

function deferInit(makeTeam, acceptPlayer) {
    let gameMaster = new Player("Sky", 5, 15, [0, 0, 0, 0, 0, 0], "Default");
    connections[gameMaster.playerID] = new tbgay.dummyConnection();
    for (let j = 0; j < mapData.gameStructures.length; j++) {
        let strucDat = mapData.gameStructures[j];
        structureManager.createGameStructure(gameMaster.playerID, strucDat[0], strucDat[1], strucDat[2], strucDat[3]);
    }
    gameMaster.suspend();
	
    let tbGayClan = makeTeam(gameMaster, "TBK");
	
	serverGameMaster = gameMaster;
	tbGayTeamID = tbGayClan.teamID;
	tbGayAccept = acceptPlayer;
	
    for (let j = 0; j < 0; j++) {
        let testBotStats = [0, 0,
        0, config.STATS_INITIAL, 0, 0, 0, 3]; // Attack speed, the index=3 one (after the 2nd MAX_VAL) used to be maxed
        let testBot = new Player("Phalanx CIWS", 10, 7, testBotStats, "Red");
        testBot.stats = testBotStats;
        connections[testBot.playerID] = new tbgay.dummyConnection();
        testBot.loc = [config.CAVE_X + Math.floor(Math.random() * (config.MAP_X - config.CAVE_X)), Math.floor(Math.random() * config.MAP_Y)];
        testBot.finalizeGridLoc();
        testBot.joinTeam(tbGayClan.teamID);
        acceptPlayer(gameMaster, testBot.playerID);
        clearTimeout(testBot.totemTimer);
        testBot.totemTimer = undefined;
        tbgay.convertBot(testBot, "gun");

        /*
        let lmao = new structureManager.Structure(12, testBot.playerID, testBot.loc[0], testBot.loc[1], 0);
        lmao.finalize(testBot.holding);
        */
    }
    for (let j = 0; j < 0; j++) {
        let testBot2Stats = [config.STATS_INITIAL, 0, 0, 0, config.STATS_MAX_VAL, 0, config.STATS_MAX_VAL, 0];
        let testBot2 = new Player("Nuro", 28, 15, testBot2Stats, "Default");
        testBot2.stats = testBot2Stats;
        connections[testBot2.playerID] = new tbgay.dummyConnection();
        testBot2.loc = [config.CAVE_X + Math.floor(Math.random() * (config.MAP_X - config.CAVE_X)), Math.floor(Math.random() * config.MAP_Y)];
        testBot2.finalizeGridLoc();
        testBot2.joinTeam(tbGayClan.teamID);
        acceptPlayer(gameMaster, testBot2.playerID);
        tbgay.convertBot(testBot2, "boost");
    }
}

function iteratePlayers(callback) {
    for (let j = 0; j < players.length; j++) {
        let thePlayer = players[j];
        if (thePlayer !== undefined) {
            if (thePlayer.isSuspended != true) {
                callback(thePlayer);
            }
        }
    }
}

function initializeCells() {
    for (let j = 0; j < config.NUM_CELLS_LEN; j++) {
        let temp = [];
        for (let k = 0; k < config.NUM_CELLS_LEN; k++) {
            temp.push([]);
        }
        cells.push(temp);
    }
    for (let j = 0; j < config.NUM_CELLS_LEN; j++) {
        let temp = [];
        for (let k = 0; k < config.NUM_CELLS_LEN; k++) {
            temp.push([]);
        }
        structureCells.push(temp);
    }
    for (let j = 0; j < config.NUM_CELLS_LEN; j++) {
        let temp = [];
        for (let k = 0; k < config.NUM_CELLS_LEN; k++) {
            temp.push([]);
        }
        gameStructureCells.push(temp);
    }
}

function Player(name, primary, secondary, stats, color) {
    this.name = name;
    this.dir = 0;
    this.health = config.MAX_HEALTH;
    this.foodItem = 0;
    this.autohitting = false;
    this.autohittingCounter = 0;
    this.autohittingTimer = undefined;
	this.craftInsertQueue = [];

	this.inventoryManager = new inventoryManager.InventoryManager();
    this.setChoices(primary, secondary, stats, color, false);

    this.strucs = [];
    this.sawStrucs = [];
    this.velX = 0;
    this.velY = 0;
    this.radius = config.PLAYER_RADIUS;
    
    this.moveState = 0;
    this.oldLoc = undefined;

    this.kb_allowance = 0.85;
    this.kb_base = 0.08;
    this.kb_factor = 0.002;
    
    this.trapped = undefined;
    this.lofted = false;
    this.slowed = false;
    this.poosh = false;

    this.lastActionTime = (new Date()).getTime();
    this.lastBuildTime = (new Date()).getTime();
    this.lastLFActionTime = (new Date()).getTime();

    this.team = undefined;
    this.kills = 0;

    this.holdingSelector = 1;

    if (this.inventoryManager.buildIncludes(16)) {
        this.totemTimer = setTimeout((function() {
            this.suspend();
        }).bind(this), config.TOTEM_TIMER);
    }

    this.insert();
    this.generateSpawnPoint();
    this.finalizeGridLoc();
}
Player.prototype.holdingType = function() {
	return this.inventoryManager.getActionBarType(this.holding);
}
Player.prototype.setChoices = function(primary, secondary, stats, color, isResume=true) {
    this.inventoryManager.setChoices(primary, secondary);
	if (isResume == false) {
		this.inventoryManager.setUnifiedIndex(9, new inventoryManager.ItemSlot(config.getTypeByName("Crafter T.1"), 1));
	}

    if (typeof config.unifiedItems[this.inventoryManager.getPrimary()].strucPersistance != 'undefined') {
        this.strucPersistance = config.unifiedItems[this.inventoryManager.getPrimary()].strucPersistance;
    }
    else {
        this.strucPersistance = undefined;
    }
	
	this.holding = 0;

    if (stats[7] >= (config.STATS_MAX_VAL - config.STATS_INITIAL)) {
        for (let j = 0; j < config.colorNames.length; j++) {
            if (config.colorNames[j] == color) {
                this.color = j;
                break;
            }
        }
    }
    else {
        this.color = 0;
    }

    if (typeof this.color === 'undefined') {
        this.color = 0;
    }

    this.moveSpeed = config.MOVE_SPEED * (1 + (stats[0] - config.STATS_INITIAL) * config.SPEED_GROWTH);
    this.viewFactor = (1 + (stats[1] - config.STATS_INITIAL) * config.FOV_GROWTH);
    this.speedFactor = (1 - (stats[2] - config.STATS_INITIAL) * config.HIT_GROWTH);
    this.resistanceFactor = (1 - (stats[3] - config.STATS_INITIAL) * config.RESISTANCE_GROWTH);
    this.strucdmgFactor = (1 + (stats[4] - config.STATS_INITIAL) * config.STRUCDMG_GROWTH);
    this.playerdmgFactor = (1 + (stats[5] - config.STATS_INITIAL) * config.MELEEDMG_GROWTH);
    this.buildcountFactor = (1 + (stats[6] - config.STATS_INITIAL) * config.BUILDCOUNT_GROWTH);
}
Player.prototype.insert = function() {
    for (let j = 0; j < players.length; j++) {
        if (typeof players[j] == 'undefined') {
            players[j] = this;
            this.playerID = j;
            return;
        }
    }
    players.push(this);
    this.playerID = players.length - 1;
};
Player.prototype.enforceBorders = function() {
    if (this.loc[0] <= 0) {
        this.loc[0] = 0;
        if (this.velX <= 0) {
            this.velX = 0;
        }
    }
    else if (this.loc[0] >= config.MAP_X) {
        this.loc[0] = config.MAP_X;
        if (this.velX >= 0) {
            this.velX = 0;
        }
    }
    if (this.loc[1] <= 0) {
        this.loc[1] = 0;
        if (this.velY <= 0) {
            this.velY = 0;
        }
    }
    else if (this.loc[1] >= config.MAP_Y) {
        this.loc[1] = config.MAP_Y;
        if (this.velY >= 0) {
            this.velY = 0;
        }
    }
}
Player.prototype.finalizeGridLoc = function() {
    this.enforceBorders();
    let temp = utils.calculateGridCoords(this.loc);
    if (this.gridCoords !== undefined) {
        if ((temp[0] != this.gridCoords[0]) || (temp[1] != this.gridCoords[1])) {
            var index = cells[this.gridCoords[0]][this.gridCoords[1]].indexOf(this.playerID);
            if (index !== -1) {
                cells[this.gridCoords[0]][this.gridCoords[1]].splice(index, 1);
            }
            this.gridCoords = temp;
            cells[this.gridCoords[0]][this.gridCoords[1]].push(this.playerID);
        }
    }
    else {
        this.gridCoords = temp;
        cells[this.gridCoords[0]][this.gridCoords[1]].push(this.playerID);
    }
};
Player.prototype.processChange = function() {
    if (this.health >= 0) {
        if (this.trapped === undefined) {
            let move_speed = this.moveSpeed * config.unifiedItems[this.holdingType()].movemult;
            let move_released = false;

            if ((this.slowed == true) && (this.lofted == false)) {
                move_speed *= config.MARSH_SLOW_FACTOR;
            }
            if (this.moveState == msgpack.LEFT) {
                this.velX -= move_speed;
            }
            else if (this.moveState == msgpack.RIGHT) {
                this.velX += move_speed;
            }
            else if (this.moveState == msgpack.UP) {
                this.velY += move_speed;
            }
            else if (this.moveState == msgpack.DOWN) {
                this.velY -= move_speed;
            }
            else if (this.moveState == msgpack.UPPERRIGHT) {
                this.velX += 0.707 * move_speed;
                this.velY += 0.707 * move_speed;
            }
            else if (this.moveState == msgpack.LOWERRIGHT) {
                this.velX += 0.707 * move_speed;
                this.velY -= 0.707 * move_speed;
            }
            else if (this.moveState == msgpack.UPPERLEFT) {
                this.velX -= 0.707 * move_speed;
                this.velY += 0.707 * move_speed;
            }
            else if (this.moveState == msgpack.LOWERLEFT) {
                this.velX -= 0.707 * move_speed;
                this.velY -= 0.707 * move_speed;
            }
            else {
                move_released = true;
            }
            this.velX -= config.DECEL_FACTOR * this.velX;
            this.velY -= config.DECEL_FACTOR * this.velY;

            if (move_released) {
                if (Math.abs(this.velX) <= 1) {
                    this.velX = 0;
                }
                if (Math.abs(this.velY) <= 1) {
                    this.velY = 0;
                }
            }
        }
        else {
            if (this.poosh != true) {
                let totalSpeed = Math.sqrt(Math.pow(this.velX, 2) + Math.pow(this.velY, 2));
                if (totalSpeed > 15) {
                    this.velX *= 15 / totalSpeed;
                    this.velY *= 15 / totalSpeed;
                    totalSpeed = 15;
                }
                if (Math.abs(this.trapped - config.TRAP_TARGET_POINT) >= 0.2 * config.TRAP_TARGET_POINT) {
                    let proposedVelX = config.TRAP_DISTANCE_COEFF * (config.TRAP_TARGET_POINT - this.trapped) * Math.sin(this.trapAngle);
                    let proposedVelY = config.TRAP_DISTANCE_COEFF * (config.TRAP_TARGET_POINT - this.trapped) * Math.cos(this.trapAngle);
                    let proposedMultiplier = Math.min(10, totalSpeed) / Math.sqrt(Math.pow(proposedVelX, 2) + Math.pow(proposedVelY, 2));

                    this.velX = 0.7 * proposedMultiplier * proposedVelX;
                    this.velY = 0.7 * proposedMultiplier * proposedVelY;
                }
                else {
                    this.velX = 0.3 * this.velX; 
                    this.velY = 0.3 * this.velY;  
                    if (totalSpeed > 5) {
                        this.velX *= 5 / totalSpeed;
                        this.velY *= 5 / totalSpeed;
                        totalSpeed = 5;
                    }
                }
            }
        }
    }
    else {
        this.suspend();
    }
};
Player.prototype.generateSpawnPoint = function() {
    if (spawnPoint == undefined) {
        for (let j = 0; j < 4; j++) {
            this.loc = [Math.floor(config.MAP_X * Math.random()), Math.floor(config.MAP_Y * Math.random())];
            this.finalizeGridLoc();
            if (utils.runAroundResult(this, function(spot, tcgX, tcgY) {
                let structureVec = structureCells[tcgX][tcgY];
                return processStructureCell(structureVec, function(theStructure) {
                    if (theStructure.type == config.getTypeByName("Totem")) {
                        if ((Math.abs(theStructure.loc[0] - spot.loc[0]) < config.VIEWDISPLACEMENT_X) && (Math.abs(theStructure.loc[1] - spot.loc[1]) < config.VIEWDISPLACEMENT_Y)) {
                            return true;
                        }
                    }
                    return false;
                });
            }, config.VIEWDISPLACEMENT_X, config.VIEWDISPLACEMENT_Y) != true) {
                return;
            }
        }
    }
    else {
        this.loc = [Math.min(config.MAP_X, Math.max(0, spawnPoint[0] + config.PLAYER_RADIUS * 15 * Math.random())), Math.min(config.MAP_Y, Math.max(0, spawnPoint[1] + config.PLAYER_RADIUS * 15 * Math.random()))];
        this.finalizeGridLoc();
    }
}
Player.prototype.suspend = function() {
    this.isSuspended = true;
    // NOTE: Maybe add this back?
    //this.sawStrucs = [];
    this.kills = 0;
    this.moveState = 0;
    this.velX = 0;
    this.velY = 0;

    this.autohitting = false;
    this.autohittingCounter = 0;
    if (this.autohittingTimer !== undefined) {
        clearTimeout(this.autohittingTimer);
        this.autohittingTimer = undefined;
    }

    scores.removeScore(this.playerID);
    if (typeof this.gridCoords !== 'undefined') {
        var index = cells[this.gridCoords[0]][this.gridCoords[1]].indexOf(this.playerID);
        while (index !== -1) {
            cells[this.gridCoords[0]][this.gridCoords[1]].splice(index, 1);
            index = cells[this.gridCoords[0]][this.gridCoords[1]].indexOf(this.playerID);
        }
    }
    this.gridCoords = undefined;
    let a = new Uint8Array(msgpack.addNumb([msgpack.PLAYER_DESTROY_DELIM], this.playerID));
    for (let j = 0; j < connections.length; j++) {
        if (typeof connections[j] !== 'undefined') {
            connections[j].send(a);
        }
    }

    if (this.isBot == true) {
		if (this.botType != "zombie") {
			setTimeout(function() {
				this.resume(this.name, this.inventoryManager.getPrimary(), this.inventoryManager.getSecondary(), this.stats, this.color, connections[this.playerID]);
				this.loc = [config.CAVE_X + Math.floor(Math.random() * (config.MAP_X - config.CAVE_X)), Math.floor(Math.random() * config.MAP_Y)];
				this.finalizeGridLoc();
				if (this.botType == 0) {
					this.selectItem(2);
				}
				if (typeof this.totemTimer != 'undefined') {
					clearTimeout(this.totemTimer);
					this.totemTimer = undefined;
				}
			}.bind(this), 15 * 1000);
		}
    }
};
Player.prototype.resume = function(name, primary, secondary, stats, color, connection) {
    this.name = name;
    this.trapped = undefined;
    this.lofted = false;
    this.velX = 0;
    this.velY = 0;
    this.autohittingCounter = 0;
    this.autohitting = false;

    this.oldLoc = undefined;

    this.setChoices(primary, secondary, stats, color, true);

    if (this.inventoryManager.buildIncludes(16)) {
        let includeTimer = true;
        for (let j = 0; j < this.strucs.length; j++) {
            if (this.strucs[j] !== undefined) {
                if (structures[this.strucs[j]] !== undefined) {
                    if (structures[this.strucs[j]].type == config.getTypeByName("Totem")) {
                        includeTimer = false;
                        break;
                    }
                }
            }
        }
        if (includeTimer == true) {
            this.totemTimer = setTimeout((function() {
                this.suspend();
            }).bind(this), config.TOTEM_TIMER);
        }
        else if ((includeTimer == false) &&
                 (typeof this.totemTimer != 'undefined')
                ) {
            clearTimeout(this.totemTimer);
            this.totemTimer = undefined;
        }
    }

    this.isSuspended = false;
    this.generateSpawnPoint();
    this.health = config.MAX_HEALTH;
    connection.send(new Uint8Array(this.getJoinNotifData()));
	this.notifyTeams();
	this.notifyNames();
	this.broadcastName();
}
Player.prototype.getJoinNotifData = function() {
	let ack = [msgpack.JOIN];
    msgpack.addNumb(ack, this.playerID);
    msgpack.addFloat(ack, this.viewFactor);
    msgpack.addNumb(ack, Math.round(this.loc[0]));
    msgpack.addNumb(ack, Math.round(this.loc[1]));
    msgpack.addNumb(ack, this.color);
    if (this.totemTimer !== undefined) {
        msgpack.addNumb(ack, 1);
    }
    else {
        msgpack.addNumb(ack, 0);
    }
	this.inventoryManager.serializeItemData(ack);
    return ack;
}
Player.prototype.handleMeleeHit = function(t) {
    sendHits[this.playerID] = [];
    utils.runAround(this, checkMeleeIntersect, config.VIEWDISPLACEMENT_X, config.VIEWDISPLACEMENT_Y);
    this.lastActionTime = t;
}
Player.prototype.addCraftItem = function(typeID, structureID, num) {
	if (this.craftInputIDs == undefined) {
	    this.craftInputIDs = [];
	}
	this.craftInputIDs.push(structureID);
    if (this.craftItems != undefined) {
		for (let j = 0; j < this.craftItems.length; j++) {
		    if (this.craftItems[j][0] == typeID) {
			    this.craftItems[j][1] = this.craftItems[j][1] + num;
				return;
			}
		}
		this.craftItems.push([typeID, num]);
	}
	else {
	    this.craftItems = [];
		this.craftItems.push([typeID, num]);
	}
}
Player.prototype.removeCraftItem = function(inputStructure, structureID) {
	if (this.craftInputIDs != undefined) {
		for (let j = 0; j < this.craftInputIDs.length; j++) {
		    if (this.craftInputIDs[j] == structureID) {
			    this.craftInputIDs.splice(j, 1);
				break;
			}
		}
	}
	
	let typeID = inputStructure.type;
	let inputQuantity = 1;
	
	if (inventoryManager.isBox(typeID, inputStructure.boxInfo)) {
		typeID = inputStructure.boxInfo.item;
		inputQuantity = inputStructure.boxInfo.count;
	}
	
	if (this.craftItems != undefined) {
	    for (let j = 0; j < this.craftItems.length; j++) {
		    if (this.craftItems[j][0] == typeID) {
			    this.craftItems[j][1] = this.craftItems[j][1] - inputQuantity;
				if (this.craftItems[j][1] <= 0) {
				    this.craftItems.splice(j, 1);
				}
				return;
			}
		}
	}
	else {
	    // lmao bruh
	}
}
function viabilityCheckHelper(c, newStruc, isCraftAddition) {
	if (utils.isCollision(newStruc.loc[0], newStruc.loc[1], c.loc[0], c.loc[1], newStruc.radius, c.radius)) {
		if ((c.type == config.getTypeByName("Crafter T.1")) || (c.type == config.getTypeByName("Furnace"))) {
			isCraftAddition.craftValue = true;
			return false;
		}
		else if (c.ignoreBuildCollisions != true) {
			return true;
		}
	}
	return false;
}
function checkPlaceViability(newStruc, tcgX, tcgY, isCraftAddition) {
	let strucVec = structureCells[tcgX][tcgY];
	return processStructureCell(strucVec, viabilityCheckHelper, newStruc, isCraftAddition);
}
Player.prototype.handlePress = function(enforceSpeed = true) {
    if (this.holdingType() < config.unifiedItems.length) {
        let t = (new Date()).getTime();
        let holding = config.unifiedItems[this.holdingType()];
		let currentSecondary = this.inventoryManager.getSecondary();
		let currID = this.playerID;
        switch (holding.action) {
            case config.getActionByName("build"): // build
            case config.getActionByName("trap"):
            case config.getActionByName("boost"):
            case config.getActionByName("trench"):
            case config.getActionByName("landmine"):
                if ((t - this.lastBuildTime >= 82) || (!enforceSpeed)) {
					if (this.inventoryManager.canPlace(this.holding, this.buildcountFactor)) {
                        let holdingDelta = (this.trapped !== undefined) ? (0) : ((holding.placeDelta !== undefined) ? holding.placeDelta : 0);
						let timeInterpFactor = Math.max(0, Math.min(0.6, (Date.now() - lastAdvanceTime) / config.TICK_INTERVAL));
						
						let playerRewindLoc = this.getRewindedLoc();
						
                        let strucX = playerRewindLoc[0] + Math.sin(this.dir) * (this.radius + holding.radius - holdingDelta);
                        let strucY = playerRewindLoc[1] + Math.cos(this.dir) * (this.radius + holding.radius - holdingDelta);
                        let k = new structureManager.Structure(this.holdingType(), this.playerID, strucX, strucY, this.dir);
						
						let isCraftAddition = {};
						
                        if (utils.runAroundResult(k, checkPlaceViability, config.EDGE_TOLERANCE, config.EDGE_TOLERANCE, isCraftAddition) != true) {
                            if ((this.trapped !== undefined) && (holding.afterPlaceDelta !== undefined)) {
                                k.loc[0] += Math.sin(this.dir) * holding.afterPlaceDelta;
                                k.loc[1] += Math.cos(this.dir) * holding.afterPlaceDelta;
                            }
							let currHolding = this.inventoryManager.getUnifiedIndex(this.holding);
							if ((typeof currHolding != 'undefined') && inventoryManager.isBox(currHolding.item, currHolding.boxInfo)) {
								k.boxInfo = new inventoryManager.ItemSlot(currHolding.boxInfo.item, currHolding.boxInfo.count);
							}
                            
							k.finalize(this.holding);
                            
                            this.setHolding((this.holdingSelector == 2) ? 1 : 0);
                            
                            this.lastBuildTime = t;
							
							
                            if ((k.type == config.getTypeByName("Totem")) && (this.totemTimer !== undefined)) {
                                clearTimeout(this.totemTimer);
                                this.totemTimer = undefined;
                            }
							if (typeof isCraftAddition.craftValue != 'undefined') {
								if (typeof k.boxInfo != 'undefined') {
									if ((typeof k.boxInfo.item != 'undefined') && (k.boxInfo.item != config.getTypeByName("No Item")) && (typeof k.boxInfo.count != 'undefined') && (k.boxInfo.count > 0)) {
										this.addCraftItem(k.boxInfo.item, k.structureID, k.boxInfo.count);
									}
								}
								else {
									this.addCraftItem(k.type, k.structureID, 1);
								}
							}
							if (k.type == config.getTypeByName("Spawner")) {
								if (typeof this.spawners != 'undefined') {
									this.spawners.push([k.structureID, undefined]);
								}
								else {
									this.spawners = [[k.structureID, undefined]];
								}
							}
                        }
                    }
                }
            break;
            case config.getActionByName("melee"):
            case config.getActionByName("repairer"):
            case config.getActionByName("shield"): // Imagine getting wacked by a shield, lmao
                if ((t - this.lastActionTime >= holding.hitSpeed * this.speedFactor) || (!enforceSpeed)) {
                    this.handleMeleeHit(t);
                }
            break;
            case config.getActionByName("heal"):
                if (t - this.lastActionTime >= 110) {
                    this.health = Math.min(config.MAX_HEALTH, this.health + holding.heal);
                    this.setHolding((this.holdingSelector == 2) ? 1 : 0);
                    this.lastActionTime = t;
                }
            break;
            case config.getActionByName("gun"):
                if ((t - this.lastActionTime >= holding.hitSpeed * this.speedFactor) || (!enforceSpeed)) {
					let playerRewindLoc = this.getRewindedLoc();
                    let bullet = makeProjectile(this.playerID, holding.fires, playerRewindLoc[0] + holding.range * Math.sin(this.dir), playerRewindLoc[1] + holding.range * Math.cos(this.dir), this.dir, this.lofted);
                    this.lastActionTime = t;
                }
            break;
        }
        if ((this.autohitting == true) && (this.isSuspended != true) && (this.autohittingCounter <= 0)) {
            this.autohittingCounter += 1;
            this.autohittingTimer = setTimeout(this.autohitHandler, config.unifiedItems[this.holdingType()].hitSpeed * this.speedFactor, this);
        }
    }
};
Player.prototype.autohitHandler = function(p) {
	p.autohittingCounter -= 1;
	let currAction = config.unifiedItems[p.holdingType()].action;
	if ((p.autohitting == true) && (p.isSuspended != true) && ((currAction == config.getActionByName("melee")) || (currAction == config.getActionByName("shield")) || (currAction == config.getActionByName("gun")) || (currAction == config.getActionByName("repairer")))) {
		p.handlePress(false);
	}
};
Player.prototype.setAngle = function(angle) {
	this.dir = angle;
};
Player.prototype.setMoveState = function(state) {
    this.moveState = state;
};
Player.prototype.setHolding = function(index) {
	if (typeof index != 'undefined') {
		let actualType = this.inventoryManager.getActionBarType(index);
		if ((typeof actualType != 'undefined') && (actualType != config.getTypeByName("No Item"))) {
			if (typeof config.unifiedItems[this.inventoryManager.getActionBarType(index)] !== 'undefined') {
				this.holding = index;
			}
		}
	}
}
Player.prototype.selectItem = function(item) {
	this.setHolding(item-1);
    if (item == 1) {
        this.holdingSelector = 1;
    }
    else if (this.inventoryManager.getSecondary() !== undefined) {
        if (item == 2) {
            this.holdingSelector = 2;
        }
    }
};
Player.prototype.encodeName = function(toNotify) {
    msgpack.addNumb(toNotify, this.playerID);
    msgpack.addString(toNotify, this.name);
    msgpack.addNumb(toNotify, this.color);
    if (typeof this.team !== 'undefined') {
        msgpack.addNumb(toNotify, this.team);
    }
}
Player.prototype.broadcastName = function() {
    let toNotify = [msgpack.PLAYER_NAME_UPDATE];
    this.encodeName(toNotify);
    let toSend = new Uint8Array(toNotify);
    for (let j = 0; j < connections.length; j++) {
        if (typeof connections[j] !== 'undefined') {
            connections[j].send(toSend);
        }
    }
}
Player.prototype.notifyNames = function() {
    let myID = this.playerID;
	for (let j = 0; j < players.length; j++) {
        let thePlayer = players[j];
        if (thePlayer !== undefined) {
            let encodedName = msgpack.addNumb([msgpack.PLAYER_NAME_UPDATE], thePlayer.playerID);
			msgpack.addString(encodedName, thePlayer.name);
			msgpack.addNumb(encodedName, thePlayer.color);
			if (typeof thePlayer.team !== 'undefined') {
				msgpack.addNumb(encodedName, thePlayer.team);
			}
			connections[myID].send(new Uint8Array(encodedName));
        }
    }
    scores.notifyLeaderboard([connections[myID]]);
};
Player.prototype.subtractHealth = function(amount, killer) {
    if (this.health < amount * this.resistanceFactor) {
        if (players[killer] !== undefined) {
            postToWebhook("Player " + (this.name || "unknown") + " (ID " + this.playerID + ")  was killed by " + (players[killer].name || "unknown") + " (ID " + killer + ")");
            
			if (players[killer].isSuspended != true) {
				let newScore = scores.reportKill(killer, this.playerID);
				players[killer].kills = newScore;
				let newScoreUpdate = [msgpack.SCORE_UPDATE_DELIM];
				msgpack.addNumb(newScoreUpdate, players[killer].kills);
				connections[killer].send(new Uint8Array(newScoreUpdate));
			}
        }
        this.suspend();
        scores.notifyLeaderboard(connections);
    }
    else {
        this.health -= amount * this.resistanceFactor;
		/*
        if (this.isBot == true) {
            if ((new Date()).getTime() - this.lastActionTime >= 85) {
                this.selectItem(3);
                this.handlePress();
            }
        }
		*/
    }
};
Player.prototype.addHealth = function(amount) {
    if (this.health + amount > config.MAX_HEALTH) {
        this.health = config.MAX_HEALTH;
    }
    else {
        this.health += amount;
    }
};
Player.prototype.chatMessage = function(message) {
    let serializedMessage = msgpack.addNumb([msgpack.CHAT], this.playerID);
    msgpack.addString(serializedMessage, message);
    let toSend = new Uint8Array(serializedMessage);
    for (let j = 0; j < players.length; j++) {
		let thePlayer = players[j];
		if ((typeof thePlayer != 'undefined') && (thePlayer.isSuspended != true)) {
			if (
				((Math.abs(this.loc[0] - thePlayer.loc[0]) <= config.VIEWDISPLACEMENT_X * thePlayer.viewFactor) && (Math.abs(this.loc[1] - thePlayer.loc[1]) <= config.VIEWDISPLACEMENT_Y * thePlayer.viewFactor)) ||
				(this.isFriendly(thePlayer.playerID))
			) {
				if (typeof connections[thePlayer.playerID] !== 'undefined') {
					connections[thePlayer.playerID].send(toSend);
				}
			}
		}
	}
};
Player.prototype.notifyTeams = function() {
    let notifyMsg = [msgpack.NEW_CLAN_DELIM];
    for (let j = 0; j < teams.length; j++) {
        if (typeof teams[j] !== 'undefined') {
            teams[j].serializeCreate(notifyMsg);
        }
    }
    let toSend = new Uint8Array(notifyMsg);
    connections[this.playerID].send(toSend);
}
Player.prototype.joinTeam = function(ID) {
    if (typeof teams[ID] !== 'undefined') {
        teams[ID].requestJoin(this);
    }
}
Player.prototype.leaveTeam = function() {
    if (typeof this.team !== 'undefined') {
        let currTeam = teams[this.team];
        if (typeof currTeam !== 'undefined') {
            currTeam.leave(this);
        }
    }
}
Player.prototype.kickPlayer = function(kickID) {
    if (typeof this.team !== 'undefined') {
        let currTeam = teams[this.team];
        if (typeof currTeam !== 'undefined') {
            if (currTeam.owner == this.playerID) {
                let thePlayer = players[kickID];
                if (typeof thePlayer !== 'undefined') {
                    currTeam.leave(thePlayer);
                }
            }
        }
    }
}
Player.prototype.isFriendly = function(otherID) {
    if (this.playerID == otherID) {
        return true;
    }
    else if (this.team !== 'undefined') {
        let theTeam = teams[this.team];
        if (theTeam !== undefined) {
            if (theTeam.members.includes(otherID) || (theTeam.owner == otherID)) {
                return true;
            }
        }
    }
    return false;
}
Player.prototype.sendMapPing = function() {
    if (this.team !== undefined) {
        if (teams[this.team] !== undefined) {
            if ((this.mapPing == undefined) || (this.mapPing == 0)) {
                this.mapPing = config.PING_LENGTH;
                teams[this.team].mapPing = config.PING_LENGTH;
            }
        }
    }
}
Player.prototype.deletePlayerStructures = function() {
    let strucDeleteNotif = [msgpack.STRUCTURE_DESTROY_DELIM];
    for (let j = 0; j < this.strucs.length; j++) {
        msgpack.addNumb(strucDeleteNotif, this.strucs[j]);
        structureManager.deleteStructure(this.strucs[j]);
    }
    return strucDeleteNotif;
}
Player.prototype.getRewindedLoc = function(currentTime) {
	if (this.loc != undefined) {
		if (this.oldLoc != undefined) {
			let timeFactor = (Date.now() - lastAdvanceTime) / config.TICK_INTERVAL;
			return [
				this.oldLoc[0] * (1-timeFactor) + this.loc[0] * timeFactor,
				this.oldLoc[1] * (1-timeFactor) + this.loc[1] * timeFactor	
			];
		}
		else {
			return [this.loc[0], this.loc[1]];
		}
	}
	return undefined;
}


function checkPlayerCell(p, tcgX, tcgY) {
    let playerVec = cells[tcgX][tcgY];
    for (let j = 0; j < playerVec.length; j++) {
        let c = players[playerVec[j]];
        if ((playerVec[j] != p.playerID) && (c !== undefined)) {
            if (utils.isCollision(p.loc[0], p.loc[1], c.loc[0], c.loc[1], p.radius, c.radius)) {
                // SOFT COLLISION
                let theta = Math.atan2(c.loc[0] - p.loc[0], p.loc[1] - c.loc[1]);
                let KB_CONST = c.kb_base + c.kb_factor * (Math.pow(p.radius + c.radius, 2) - Math.pow(p.loc[0] - c.loc[0], 2) - Math.pow(p.loc[1] - c.loc[1], 2));
                if ((p.trapped !== undefined) || (c.trapped !== undefined)) {
                    KB_CONST = 1.75 * KB_CONST;
                }
                let KB_ALLOWANCE = ((p.trapped !== undefined) || (c.trapped !== undefined)) ? (c.kb_allowance * 0.8) : c.kb_allowance;
                p.velY = KB_ALLOWANCE * p.velY + KB_CONST * Math.cos(theta);
                p.velX = KB_ALLOWANCE * p.velX - KB_CONST * Math.sin(theta);
                p.poosh = true;
            }
        }
    }
}

function checkMeleeIntersect(p, tcgX, tcgY) {
	let playerRewindLoc = p.getRewindedLoc();
	
    let playerVec = cells[tcgX][tcgY];
    let structureVec = structureCells[tcgX][tcgY];
    processStructureCell(structureVec, function(the_structure) {
        if (utils.isMeleeHit(playerRewindLoc[0] + config.PLAYER_RADIUS * Math.sin(p.dir), playerRewindLoc[1] + config.PLAYER_RADIUS * Math.cos(p.dir), the_structure.loc[0], the_structure.loc[1], p.dir, config.unifiedItems[p.holdingType()].range)) {
            let holding = config.unifiedItems[p.holdingType()];
			
			let craftType = undefined;
			if (typeof p.craftItems !== 'undefined') {
				if (p.craftItems.length > 0) {
					if (the_structure.type == config.getTypeByName("Crafter T.1")) {
						craftType = "crafter";
					}
					else if (the_structure.type == config.getTypeByName("Furnace")) {
						craftType = "furnace";
					}
				}
			}
			
			if (typeof craftType != 'undefined') {
				if (
					(typeof the_structure.releaseTime == 'undefined') ||
					(Date.now() >= the_structure.releaseTime)
				) {
					let craftResultant = undefined;
					if (craftType == "furnace") {
						craftResultant = p.inventoryManager.getCraft(p.craftItems, inventoryManager.furnaceRatios);
					}
					else {
						craftResultant = p.inventoryManager.getCraft(p.craftItems, inventoryManager.craftRatios);
					}
					if (typeof craftResultant != 'undefined') {
						let crafterWaitNotif = undefined;
						
						if (typeof craftResultant[1][0] != 'undefined') {
							let craftTime = Math.min(inventoryManager.maxCraftTime, craftResultant[1][0] * craftResultant[0]);
							the_structure.releaseTime = Date.now() + craftTime;
							p.craftInsertQueue.push([Date.now() + craftTime, craftResultant]);
							
							crafterWaitNotif = [msgpack.MISC];
							msgpack.addString(crafterWaitNotif, "CRAFTWAIT");
							msgpack.addNumb(crafterWaitNotif, the_structure.structureID);
							msgpack.addNumb(crafterWaitNotif, Math.round(craftTime / 1000));
						}
						else {
							p.inventoryManager.insertCraft(craftResultant);
						}
						
						let strucDeleteNotif = [msgpack.STRUCTURE_DESTROY_DELIM];
						if (typeof p.craftInputIDs !== 'undefined') {
							while (p.craftInputIDs.length > 0) {
								msgpack.addNumb(strucDeleteNotif, p.craftInputIDs[0]);
								structureManager.deleteStructure(p.craftInputIDs[0]);
							}
						}
						else {
							p.craftInputIDs = [];
						}
						
						for (let j = 0; j < connections.length; j++) {
							if (typeof connections[j] !== 'undefined') {
								if (strucDeleteNotif.length > 1) {
									connections[j].send(new Uint8Array(strucDeleteNotif));
								}
								
								if (typeof crafterWaitNotif != 'undefined') {
									connections[j].send(new Uint8Array(crafterWaitNotif));
								}
							}
						}
					}
				}
			}
            else if (typeof holding.heal !== 'undefined') {
                the_structure.addHealth(holding.strucDmg);
            }
            else {
                let structureDamage = holding.strucDmg * p.strucdmgFactor;
                if (holding.selfStrucDmg !== undefined) {
                    structureDamage = holding.selfStrucDmg;
                }
				
				if ((!p.isFriendly(the_structure.owner)) && (the_structure.type == config.getTypeByName("Lapis spikes"))) {
					p.subtractHealth(Math.min(structureDamage, 0.45 * config.MAX_HEALTH));
				}
				
				if (p.isSuspended != true) {					
					if ((the_structure.type == config.getTypeByName("Spawner")) && (p.isBot == true)) {
					}
					else {
						if ((the_structure.isInternal !== true) && (structureDamage > 0)) {
							sendHits[p.playerID].push(the_structure.structureID);
						}
						the_structure.subtractHealth(structureDamage, p.playerID);
					}
				}
            }
        }
    });
    processPlayerCell(playerVec, function(the_player) {
		let targetRewindLoc = the_player.getRewindedLoc();
		
        let holding = config.unifiedItems[p.holdingType()];
        if (utils.isMeleeHit(playerRewindLoc[0], playerRewindLoc[1], targetRewindLoc[0], targetRewindLoc[1], p.dir, holding.range)) {
            if ((the_player.trapped == undefined) && (!p.isFriendly(the_player.playerID))) {
                let theta = Math.atan2(playerRewindLoc[0] - targetRewindLoc[0], targetRewindLoc[1] - playerRewindLoc[1]);
                the_player.velY += holding.knockback * Math.cos(theta);
                the_player.velX -= holding.knockback * Math.sin(theta);
            }
            if (typeof holding.heal !== 'undefined') {
                the_player.addHealth(holding.meleeDmg);
            }
            else {
                if (!p.isFriendly(the_player.playerID)) {
                    let damageMult = 1;
                    if (config.unifiedItems[the_player.holding].action == config.getActionByName("shield")) {
                        if (utils.angleWorks(Math.atan2(playerRewindLoc[0] - targetRewindLoc[0], playerRewindLoc[1] - targetRewindLoc[1]), the_player.dir + config.SHIELD_HALFANGLE, the_player.dir - config.SHIELD_HALFANGLE) == true) {
                            damageMult = config.SHIELD_DAMAGE_FACTOR;
                        }
                    }
                    the_player.subtractHealth(holding.meleeDmg * p.playerdmgFactor * damageMult, p.playerID);
                }
            }
        }
    });
}

function playerCollCheck() {
    iteratePlayers(function(currentPlayer) {
        currentPlayer.poosh = false;
        utils.runAround(currentPlayer, checkPlayerCell, config.EDGE_TOLERANCE, config.EDGE_TOLERANCE);
    });
}

function collCheck() {
    iteratePlayers(function(currentPlayer) {
        currentPlayer.trapped = undefined;
        currentPlayer.lofted = false;
        currentPlayer.slowed = false;
        utils.runAround(currentPlayer, structureManager.checkCell, config.EDGE_TOLERANCE, config.EDGE_TOLERANCE);
        currentPlayer.enforceBorders();
    });
}

function advancePositions() {
    iteratePlayers(function(thePlayer) {
        thePlayer.oldLoc = [thePlayer.loc[0], thePlayer.loc[1]];

        thePlayer.loc[0] = thePlayer.loc[0] + thePlayer.velX;
        thePlayer.loc[1] = thePlayer.loc[1] + thePlayer.velY;
        thePlayer.finalizeGridLoc();
    });
}

function serializePlayer(thePlayer, toModify) {
	msgpack.addNumb(toModify, thePlayer.playerID);
	msgpack.addNumb(toModify, Math.round(thePlayer.loc[0]));
	msgpack.addNumb(toModify, Math.round(thePlayer.loc[1]));
	//msgpack.addPosNegNumb(toModify, Math.round(thePlayer.velX));
	//msgpack.addPosNegNumb(toModify, Math.round(thePlayer.velY));
	msgpack.addFloat(toModify, thePlayer.dir);
	msgpack.addNumb(toModify, thePlayer.inventoryManager.getActionBarType(thePlayer.holding));
	msgpack.addNumb(toModify, Math.abs(Math.round(thePlayer.health)));
	let sendHit = sendHits[thePlayer.playerID];
	if (sendHit !== undefined) {
		msgpack.addHit(toModify);
		for (let j = 0; j < sendHit.length; j++) {
			   msgpack.addNumb(toModify, sendHit[j]);
		}
		msgpack.addHit(toModify);
	}
	if (typeof thePlayer.holding != 'undefined') {
		msgpack.addNumb(toModify, thePlayer.holding);
	}
	else {
		msgpack.addNumb(toModify, 0);
	}
}

function playerOccludeChecker(myPlayer, tgX, tgY, p) {
	if (!(myPlayer.playerID == p.playerID)) {
        let pOldLoc = p.getRewindedLoc();
        let myOldLoc = myPlayer.getRewindedLoc();

		let gameStructureVec = gameStructureCells[tgX][tgY];
		for (let j = 0; j < gameStructureVec.length; j++) {
			let theStructure = structures[gameStructureVec[j]];
			if (theStructure.viewBlocker == true) {
				if (utils.occludes(pOldLoc[0], pOldLoc[1], theStructure.loc[0], theStructure.loc[1], myOldLoc[0], myOldLoc[1], theStructure.radius, config.PLAYER_RADIUS)) {
					return true;
				}
			}
		}
	}
	return false;
}

function structureOccludeChecker(myStructure, tgX, tgY, p) {
    let pOldLoc = p.getRewindedLoc();

	let gameStructureVec = gameStructureCells[tgX][tgY];
	for (let j = 0; j < gameStructureVec.length; j++) {
		let gameStructure = structures[gameStructureVec[j]];
		if ((gameStructure.viewBlocker === true) && (gameStructure.structureID !== myStructure.structureID)) {
			if (utils.occludes(pOldLoc[0], pOldLoc[1], gameStructure.loc[0], gameStructure.loc[1], myStructure.loc[0], myStructure.loc[1], gameStructure.radius, myStructure.radius)) {
				return true;
			}
		}
	}
	return false;
}

function emitPlayerData(thePlayer, p, playerConcat) {
    let pRewindLoc = p.getRewindedLoc();
    let theRewindLoc = thePlayer.getRewindedLoc();
	if (Math.abs(pRewindLoc[0] - theRewindLoc[0]) > config.VIEWDISPLACEMENT_X * p.viewFactor) {
		//no-op
	}
	else if (Math.abs(pRewindLoc[1] - theRewindLoc[1]) > config.VIEWDISPLACEMENT_Y * p.viewFactor) {
		//no-op
	}
	else {
		let toRun = (thePlayer.playerID == p.playerID);
		if (!toRun) {
			utils.prepOccludes(pRewindLoc[0], pRewindLoc[1], theRewindLoc[0], theRewindLoc[1], config.PLAYER_RADIUS);
			toRun = (utils.runAroundResult(thePlayer, playerOccludeChecker, config.VIEWDISPLACEMENT_X * p.viewFactor, config.VIEWDISPLACEMENT_Y * p.viewFactor, p) != true);
		}
		if (toRun) {
			if (p.isBot == true) {
				p.targetPlayers.push(thePlayer.playerID);
			}
			else {
				serializePlayer(thePlayer, playerConcat);
			}
		}
	}
}
function emitStructureData(theStructure, p, structuresConcat) {
	if ((p.sawStrucs[theStructure.structureID] != true) && (theStructure.isInternal != true)) {
        let pRewindLoc = p.getRewindedLoc();

		if (Math.abs(pRewindLoc[0] - theStructure.loc[0]) > config.VIEWDISPLACEMENT_X * p.viewFactor) {
			//no-op
		}
		else if (Math.abs(pRewindLoc[1] - theStructure.loc[1]) > config.VIEWDISPLACEMENT_Y * p.viewFactor) {
			//no-op
		}
		else {
			if (!(theStructure.invisible == true) || p.isFriendly(theStructure.owner)) {
				utils.prepOccludes(pRewindLoc[0], pRewindLoc[1], theStructure.loc[0], theStructure.loc[1], theStructure.radius);
				if (utils.runAroundResult(theStructure, structureOccludeChecker, config.VIEWDISPLACEMENT_X * p.viewFactor, config.VIEWDISPLACEMENT_Y * p.viewFactor, p) != true) {
					p.sawStrucs[theStructure.structureID] = true;
					if (p.isBot != true) {
						theStructure.serializeStructure(structuresConcat);
					}
				}
			}
		}
	}
	else if ((p.isBot == true) && (theStructure.isInternal != true)) {
		p.targetStructures.push(theStructure.structureID);
	}
}
function emitMessage(p, tcgX, tcgY, playerConcat, structuresConcat) {
    let playerVec = cells[tcgX][tcgY];
    let strucVec = structureCells[tcgX][tcgY];
    let projectileVec = projectileCells[tcgX][tcgY];
    processPlayerCell(playerVec, emitPlayerData, p, playerConcat);
    processStructureCell(strucVec, emitStructureData, p, structuresConcat);
}

function decelHelper(thePlayer) {
	thePlayer.processChange();
}
function processDecels() {
    iteratePlayers(decelHelper);
}
function deletePlayer(playerID) {
    let k = players[playerID];
    if (typeof k !== 'undefined') {
        k.leaveTeam();
        scores.removeScore(playerID);
        scores.notifyLeaderboard(connections);
        k.autohitting = false;
        k.autohittingCounter = 0;
        if (k.autohittingTimer !== undefined) {
            clearTimeout(k.autohittingTimer);
            k.autohittingTimer = undefined;
        }
        if (typeof k.gridCoords !== 'undefined') { // This way server doesn't panic when deleting a not-yet-respawned player
            let thearray = cells[k.gridCoords[0]][k.gridCoords[1]];
            var index = thearray.indexOf(playerID);
            while (index > -1) {
                thearray.splice(index, 1);
                index = thearray.indexOf(playerID);
            }
        }
        let strucDeleteNotif = k.deletePlayerStructures();
        players[playerID] = undefined; // delete players[playerID]
        if (connections[playerID].connected == true) {
            connections[playerID].close();
        }
        connections[playerID] = undefined; // delete connections[playerID]
        let a = new Uint8Array(msgpack.addNumb([msgpack.PLAYER_DESTROY_DELIM], playerID));
        for (let j = 0; j < connections.length; j++) {
            if (typeof connections[j] !== 'undefined') {
                if (strucDeleteNotif.length > 1) {
                    connections[j].send(new Uint8Array(strucDeleteNotif));
                }
                connections[j].send(a);
            }
        }
    }
}

function sendStageHelper(thePlayer) {
	if (thePlayer.craftInsertQueue.length > 0) {
		let currTime = Date.now();
		for (let k = thePlayer.craftInsertQueue.length-1; k >= 0; k--) {
			if (currTime >= thePlayer.craftInsertQueue[k][0]) {
				thePlayer.inventoryManager.insertCraft(thePlayer.craftInsertQueue[k][1]);
				thePlayer.craftInsertQueue.splice(k, 1);
			}
		}
	}
	
	thePlayer.numAttackingBots = 0;
    let tickStart = Date.now();
	if ((typeof thePlayer.lastZombieWave == 'undefined') || (tickStart - thePlayer.lastZombieWave >= 45 * 1000)) {
		if (typeof thePlayer.spawners != 'undefined') {
			thePlayer.lastZombieWave = tickStart;
			for (let j = 0; j < thePlayer.spawners.length; j++) {
				if (typeof thePlayer.spawners[j] != 'undefined') {
					if (typeof thePlayer.spawners[j][1] == 'undefined') {
						let respawnStructure = structures[thePlayer.spawners[j][0]];
						
						let testBotStats = [config.STATS_INITIAL, 0, config.STATS_INITIAL, config.STATS_INITIAL, config.STATS_INITIAL, config.STATS_MAX_VAL, 0, 3];
						let testBot = new Player("Zombie", config.getTypeByName("Katana"), 15, testBotStats, "White");
						testBot.stats = testBotStats;
						connections[testBot.playerID] = new tbgay.dummyConnection();
						testBot.loc = [respawnStructure.loc[0], respawnStructure.loc[1]];
						testBot.finalizeGridLoc();
						testBot.joinTeam(tbGayTeamID);
						tbGayAccept(serverGameMaster, testBot.playerID);
						
						tbgay.convertBot(testBot, "zombie");
						testBot.resistanceFactor /= 4;
						
						thePlayer.spawners[j][1] = testBot;
						testBot.toAttack = thePlayer.playerID;
					}
					else if (thePlayer.spawners[j][1].isSuspended == true) {
						let toRespawn = thePlayer.spawners[j][1];
						let respawnStructure = structures[thePlayer.spawners[j][0]];
						toRespawn.resume(toRespawn.name, toRespawn.inventoryManager.getPrimary(), toRespawn.inventoryManager.getSecondary(), toRespawn.stats, toRespawn.color, connections[toRespawn.playerID]);
						toRespawn.loc = [respawnStructure.loc[0], respawnStructure.loc[1]];
						toRespawn.finalizeGridLoc();
						toRespawn.resistanceFactor /= 4;
					}
				}
			}
		}
	}
	
	let j = thePlayer.playerID;
	if (connections[j] !== undefined) {
		let playerSend = [msgpack.PLAYER_UPDATE_DELIM];
		let structureSend = [msgpack.STRUCTURE_DELIM];
		utils.runAround(thePlayer, emitMessage, config.VIEWDISPLACEMENT_X * thePlayer.viewFactor, config.VIEWDISPLACEMENT_Y * thePlayer.viewFactor, playerSend, structureSend);
		if (thePlayer.isBot != true) {
			connections[j].send(new Uint8Array(playerSend));
			if (structureSend.length > 1) {
				connections[j].send(new Uint8Array(structureSend));
			}
			
			if (thePlayer.inventoryManager.inventoryChange == true) {
				let response = [msgpack.MISC];
				msgpack.addString(response, 'INVUPDATE');
				thePlayer.inventoryManager.serializeItemData(response);
				connections[j].send(new Uint8Array(response));
			}
		}
	}
}
function tick() {
    let tickStart = Date.now();

    let prepStageStart = Date.now();
    for (let j = 0; j < projectiles.length; j++) {
        let theBullet = projectiles[j];
        if (theBullet !== undefined) {
            theBullet.advance();
        }
    }
    processDecels();
    playerCollCheck();
    collCheck(); // collCheck used to be before everything
    advancePositions(); // used to be before collcheck
    lastAdvanceTime = Date.now();
    let prepStageEnd = Date.now() - prepStageStart;

    teamLocationCounter += 1;
    if (teamLocationCounter >= 8) {
        teamLocationCounter = 0;
        for (let j = 0; j < teams.length; j++) {
            if (teams[j] !== undefined) {
                teams[j].broadcastLocations();
            }
        }
    }

	if (tickStart - lastZombieHeal >= 3000) {
		lastZombieHeal = Date.now();
		iteratePlayers(function(thePlayer) {
			if (typeof thePlayer.spawners != 'undefined') {
				for (let j = 0; j < thePlayer.spawners.length; j++) {
					if (typeof thePlayer.spawners[j] != 'undefined') {
						if ((typeof thePlayer.spawners[j][1] != 'undefined') && (thePlayer.spawners[j][1].isSuspended != true)) {
							thePlayer.spawners[j][1].health += 0.20 * config.MAX_HEALTH;
							if (thePlayer.spawners[j][1].health > config.MAX_HEALTH) {
								thePlayer.spawners[j][1].health = config.MAX_HEALTH;
							}
						}
					}
				}
			}
		});
	}

    let sendStageStart = Date.now();
    iteratePlayers(sendStageHelper);
    let sendStageEnd = Date.now() - sendStageStart;

    let botStageStart = Date.now();
    tbgay.processAllBots(shouldCalcBot);
    let botStageEnd = Date.now() - botStageStart;

    shouldCalcBot = !shouldCalcBot;
    sendHits = [];
	
    if (Date.now() - tickStart >= 35) {
        console.log("TICK TOOK TOO LONG, " + (Date.now() - tickStart) + "ms, at t=" + Date.now() + ". Prep stage=" + prepStageEnd + ", send stage=" + sendStageEnd + ", bot stage=" + botStageEnd);
        //postToWebhook("TICK TOOK TOO LONG, " + (Date.now() - tickStart) + "ms, at t=" + Date.now() + ". Prep stage=" + prepStageEnd + ", send stage=" + sendStageEnd + ", bot stage=" + botStageEnd);
    }
    if (Date.now() - lastAdvanceTime >= config.TICK_INTERVAL * 1.5) {
        console.log("TICK GAP TOO LONG, " + (Date.now() - lastAdvanceTime) + "ms, at t=" + Date.now() + ". Tick time = " + (Date.now() - tickStart));
        //postToWebhook("TICK GAP TOO LONG, " + (Date.now() - lastAdvanceTime) + "ms, at t=" + Date.now());
    }
}

let tickResolution = 11;
function startTicks() {
	if (Date.now() - lastTickStart >= config.TICK_INTERVAL) {
        lastTickStart = Date.now();
		tick();
	}
	
    let delayTime = config.TICK_INTERVAL - (Date.now() - lastTickStart) - tickResolution;
	if (delayTime >= 0) {
		setTimeout(startTicks, delayTime);
	}
	else {
		setImmediate(startTicks);
	}
}

exports.startTicks = startTicks;
exports.Structure = structureManager.Structure;
exports.Player = Player;
exports.initializeCells = initializeCells;
exports.deletePlayer = deletePlayer;
exports.handlePress = function(userID) {
    if (typeof players[userID] !== 'undefined') {
        players[userID].handlePress();
    }
};
exports.players = players;
exports.cells = cells;
exports.structures = structures;
exports.structureCells = structureCells;
exports.processPlayerCell = processPlayerCell;
exports.processStructureCell = processStructureCell;
exports.init = init;
exports.setSpawnPoint = function(loc) {
    spawnPoint = loc;
}
exports.deferInit = deferInit;