var msgpack = require('../common/msgpack.js');
var config = require('../common/config.js');
var utils = require('./utils.js');

var connections;

var cells;
var structureCells;
var players;
var structures;
var gameStructureCells;
var autobreakTimers;
var makeProjectile;

var isBox;

function init(i_connections, i_cells, i_structureCells, i_players, i_structures, i_gameStructureCells, i_autobreakTimers, i_isBox, i_makeProjectile) {
	connections = i_connections;
	cells = i_cells;
	structureCells = i_structureCells;
	players = i_players;
	structures = i_structures;
	gameStructureCells = i_gameStructureCells;
	autobreakTimers = i_autobreakTimers;
	isBox = i_isBox;
	makeProjectile = i_makeProjectile;
}
module.exports.init = init;

// Remember to call finalizeStructure()
function Structure(type, owner, locX, locY, dir) {
    if (type < config.unifiedItems.length) {
        if ((config.unifiedItems[type].action == config.getActionByName("build")) || (config.unifiedItems[type].action == config.getActionByName("trap")) || (config.unifiedItems[type].action == config.getActionByName("boost")) || (config.unifiedItems[type].action == config.getActionByName("trench")) || (config.unifiedItems[type].action == config.getActionByName("landmine"))) {
            let structureData = config.unifiedItems[type];
            this.type = type;
            this.owner = owner;
            this.health = structureData.health;
            this.dir = dir;
            this.radius = structureData.radius;
            this.softCollision = structureData.softCollision;
            this.collisionKB = structureData.collisionKB;
            this.preventSqueeze = structureData.preventSqueeze;
            this.action = structureData.action;
            this.setLoc(locX, locY);
            this.damage = structureData.damage;
            this.placeDelta = structureData.placeDelta;
            this.trapPlaceDelta = structureData.trapPlaceDelta;
            this.ignoreCollisions = structureData.ignoreCollisions;
            this.ignoreBuildCollisions = structureData.ignoreBuildCollisions;
            this.unbreakable = structureData.unbreakable;
            this.viewBlocker = structureData.viewBlocker;
            this.invisible = structureData.invisible;
            if (typeof structureData.lofted !== 'undefined') {
                this.lofted = true;
            }

            if (type == config.getTypeByName("Totem")) {
                this.lastFired = (new Date()).getTime();
            }
        }
    }
}
Structure.prototype.setLoc = function(x, y) {
    this.loc = [Math.min(config.MAP_X, Math.max(0, x)), Math.min(config.MAP_Y, Math.max(0, y))];
    this.gridCoords = utils.calculateGridCoords(this.loc);
}
Structure.prototype.insert = function() {
    for (let j = 0; j < structures.length; j++) {
        if (structures[j] == undefined) {
            structures[j] = this;
            this.structureID = j;
            return;
        }
    }
    structures.push(this);
    this.structureID = structures.length - 1;
}
Structure.prototype.finalize = function(holding) {
    this.insert();
    structureCells[this.gridCoords[0]][this.gridCoords[1]].push(this.structureID);
    let owner = players[this.owner];
    let foundSpot = false;
    for (let j = 0; j < owner.strucs.length; j++) {
        if (typeof owner.strucs[j] == 'undefined') {
            owner.strucs[j] = this.structureID;
            foundSpot = true;
            break;
        }
    }
    if (foundSpot == false) {
        owner.strucs.push(this.structureID);
    }
    if (config.variableHostiles.includes(this.type)) {
        if (typeof owner.strucPersistance !== 'undefined') {
            let theID = this.structureID;
            let t = setTimeout(function() {
                deleteStructure(theID);
                notifyStructureDelete(theID);
            }, owner.strucPersistance * 1000);
            autobreakTimers[theID] = t;
        }
    }
	
	owner.inventoryManager.structurePlaced(holding);
};
Structure.prototype.subtractHealth = function(amount, breakerID) {
    if (this.unbreakable !== true) {
        if (this.health < amount) {
			if (isBox(this.type, this.boxInfo) && (typeof breakerID != 'undefined')) {
				if (
					(this.owner == breakerID) ||
					((typeof this.boxInfo.count != 'undefined') && (this.boxInfo.count > 0))
				) {
					let breakerPlayer = players[breakerID];
					if (typeof breakerPlayer != 'undefined') {
						breakerPlayer.inventoryManager.addItem(this.boxInfo.item, this.boxInfo.count);
					}
				}
			}
			
            notifyStructureDelete(this.structureID);
            deleteStructure(this.structureID);
        }
        else {
            this.health -= amount;
        }
    }
};
Structure.prototype.addHealth = function(amount) {
    if (this.health + amount > config.unifiedItems[this.type].health) {
        this.health = config.unifiedItems[this.type].health;
    }
    else {
        this.health += amount;
    }
}
Structure.prototype.serializeStructure = function(toModify) {
    msgpack.addNumb(toModify, this.structureID);
    msgpack.addNumb(toModify, this.type);
    msgpack.addNumb(toModify, Math.round(this.loc[0]));
    msgpack.addNumb(toModify, Math.round(this.loc[1]));
    msgpack.addFloat(toModify, this.dir);
    msgpack.addNumb(toModify, this.owner);
	
	if (isBox(this.type, this.boxInfo)) {
		msgpack.addString(toModify, "BOX");
		msgpack.addNumb(toModify, this.boxInfo.item);
		if (
			(typeof this.boxInfo.count != 'undefined') &&
			(this.boxInfo.count > 0)
		) {
			msgpack.addNumb(toModify, this.boxInfo.count);
		}
		else {
			msgpack.addNumb(toModify, 0);
		}
	}
	
	if ((typeof this.releaseTime != 'undefined') && (this.releaseTime > Date.now())) {
		msgpack.addString(toModify, "CRAFTWAIT");
		msgpack.addNumb(toModify, Math.round((this.releaseTime - Date.now()) / 1000));
	}
}

function checkCell(p, tcgX, tcgY) {
    let strucVec = structureCells[tcgX][tcgY];
    for (let j = 0; j < strucVec.length; j++) {
        let c = structures[strucVec[j]];
        if (c !== undefined) {
            let actualPlayerRadius = (c.action == config.getActionByName("trap")) ? (p.radius / 3) : p.radius;

            // Rewind time for more accurate trap collisions
            if ((p.oldLoc != undefined) &&
				((c.ignoreCollisions != true) || ((c.action == config.getActionByName("trap")) && (!p.isFriendly(c.owner)))) &&
				(p.poosh != true)
			) {
                if (utils.isCollision(0.5 * (p.loc[0] + p.oldLoc[0]), 0.5 * (p.loc[1] + p.oldLoc[1]), c.loc[0], c.loc[1], actualPlayerRadius, c.radius) &&
					(!utils.isCollision(p.oldLoc[0], p.oldLoc[1], c.loc[0], c.loc[1], actualPlayerRadius, c.radius))
				) {
                    p.loc[0] = 0.5 * (p.loc[0] + p.oldLoc[0]);
                    p.loc[1] = 0.5 * (p.loc[1] + p.oldLoc[1]);
					p.oldLoc[0] = p.loc[0];
					p.oldLoc[1] = p.loc[1];
					
                    p.finalizeGridLoc();
                }
            }

            if (utils.isCollision(p.loc[0], p.loc[1], c.loc[0], c.loc[1], actualPlayerRadius, c.radius)) {
                if ((p.isBot == true) && (c.action == config.getActionByName("trap")) && (!p.isFriendly(c.owner))) {
                    p.touchingTraps.push(strucVec[j]);
                }
                if ((c.action == config.getActionByName("trap")) || (c.action == config.getActionByName("trench"))) {
                    if (!p.isFriendly(c.owner)) {
                        c.invisible = false;
                        if (c.action == 5) {
                            p.trapped = utils.getSquaredDistance(p.loc[0], p.loc[1], c.loc[0], c.loc[1]);
                            p.trapAngle = Math.atan2(p.loc[0] - c.loc[0], p.loc[1] - c.loc[1]);
                        }
                        else if (c.action == 10) {
                            p.slowed = true;
                        }
                    }
                }
                else if (c.action == config.getActionByName("landmine")) {
                    if (!p.isFriendly(c.owner)) {
                        utils.runAround(c, function(theMine, tgX, tgY) {
                            let playerCell = cells[tgX][tgY];
                            processPlayerCell(playerCell, function(thePlayer) {
                                if (utils.getSquaredDistance(thePlayer.loc[0], thePlayer.loc[1], theMine.loc[0], theMine.loc[1]) <= Math.pow(config.LANDMINE_RANGE_FACTOR * theMine.radius, 2)) {
                                    if (!thePlayer.isFriendly(theMine.owner)) {
                                        thePlayer.subtractHealth(theMine.damage, theMine.owner);
                                        let theta = Math.atan2(theMine.loc[0] - thePlayer.loc[0], thePlayer.loc[1] - theMine.loc[1]);
                                        thePlayer.velX = -theMine.collisionKB * Math.sin(theta);
                                        thePlayer.velY = theMine.collisionKB * Math.cos(theta);
                                    }
                                }
                            });
                        });
                        deleteStructure(c.structureID);
                        notifyStructureDelete(c.structureID);
                    }
                }
                else if (c.type == config.getTypeByName("Platforms")) {
                    p.lofted = true;
                }
                else if (c.type == config.getTypeByName("Marsh")) {
                    p.slowed = true;
                }
                else if (c.action == config.getActionByName("Boost")) {
                    p.velX -= Math.sin(c.dir) * c.collisionKB;
                    p.velY -= Math.cos(c.dir) * c.collisionKB;
                    p.trapped = undefined;
                }
                else if (c.ignoreCollisions != true) {
                    let theta = Math.atan2(c.loc[0] - p.loc[0], c.loc[1] - p.loc[1]);

                    if (typeof c.softCollision == 'undefined') {
                        let totalVelocity = Math.sqrt(Math.pow(p.velX, 2) + Math.pow(p.velY, 2));
                        let tangentX = Math.sin(theta - (Math.PI/2));
                        let tangentY = Math.cos(theta - (Math.PI/2));
                        let velProjection = tangentX * p.velX + tangentY * p.velY;
						
                        let normalX = Math.sin(theta);
                        let normalY = Math.cos(theta);
                        let velRejection = normalX * p.velX + normalY * p.velY;
                        let rectifiedRejection = (velRejection < 0) ? velRejection : 0;
						
						let playerDistance = Math.sqrt(utils.getSquaredDistance(p.loc[0], p.loc[1], c.loc[0], c.loc[1]));
						let distanceRatio = playerDistance / (c.radius + p.radius);
						let ratioCutoff = 0.9;
						let velocityWeight = (distanceRatio < ratioCutoff) ? 1.0 : (-(distanceRatio - 1.0) / (1.0 - ratioCutoff));
						
                        p.velX = velocityWeight * (rectifiedRejection * normalX + velProjection * tangentX) + (1 - velocityWeight) * p.velX;
                        p.velY = velocityWeight * (rectifiedRejection * normalY + velProjection * tangentY) + (1 - velocityWeight) * p.velY;

                        let playerRadiusTolerance = (c.preventSqueeze == true) ? 0.7 : 0.45;
						
						if (playerDistance <= c.radius + playerRadiusTolerance * p.radius) {
                            p.loc[0] = c.loc[0] - (c.radius + playerRadiusTolerance * p.radius) * Math.sin(theta);
                            p.loc[1] = c.loc[1] - (c.radius + playerRadiusTolerance * p.radius) * Math.cos(theta);
                        }
                    }
                    else {
                        let final_kb_const = (c.softCollision.kb_base + c.softCollision.kb_factor * (Math.pow(p.radius + c.radius, 2) - Math.pow(p.loc[0] - c.loc[0], 2) - Math.pow(p.loc[1] - c.loc[1], 2)));
                        if (p.trapped !== undefined) {
                            final_kb_const = 0.07 * final_kb_const;
                        }
                        p.velY = c.softCollision.kb_allowance * p.velY - final_kb_const * Math.cos(theta);
                        p.velX = c.softCollision.kb_allowance * p.velX - final_kb_const * Math.sin(theta);
                    }

                    if ((typeof c.collisionKB !== 'undefined') &&
                       (!(config.variableHostiles.includes(c.type) && p.isFriendly(c.owner)))) {
                        let collisionKB = -c.collisionKB;
                        if (p.trapped !== undefined) {
                            collisionKB *= 0.0175;
                        }
                        p.velX = collisionKB * Math.sin(theta);
                        p.velY = collisionKB * Math.cos(theta);
                    }

                    if (!p.isFriendly(c.owner)) {
                        p.subtractHealth(c.damage, c.owner);
                    }
                    if ((c.type == config.getTypeByName("Totem")) && (c.owner == p.playerID)) { 
                        let currentTime = (new Date()).getTime();
                        if (currentTime - c.lastFired >= config.TOTEM_RELOAD_TIME) {
                            let bullet = makeProjectile(p.playerID, config.TOTEM_FIRE_ID, p.loc[0] + config.PLAYER_RADIUS * Math.sin(p.dir), p.loc[1] + config.PLAYER_RADIUS * Math.cos(p.dir), p.dir, true);
                            c.lastFired = currentTime;
                        }
                    }
                }
            }
        }
    }
}

function deleteStructure(structureID) {
    let k = structures[structureID];
    if (typeof k !== 'undefined') {
        if (typeof autobreakTimers[structureID] !== 'undefined') {
            clearTimeout(autobreakTimers[structureID]);
        }
		
        let thearray = structureCells[k.gridCoords[0]][k.gridCoords[1]];
        let index = thearray.indexOf(structureID);
        if (index > -1) {
            thearray.splice(index, 1);
        }
        for (let j = 0; j < players.length; j++) {
            if (typeof players[j] !== 'undefined') {
                players[j].sawStrucs[structureID] = undefined;
            }
        }
        let thearray2 = players[k.owner].strucs;
        for (let i = 0; i < thearray2.length; i++) {
            if (thearray2[i] == structureID) {
                thearray2[i] = undefined;
            }
        }
        let owner = players[k.owner];
        if (typeof owner !== 'undefined') {
			if (typeof owner.craftInputIDs != 'undefined') {
				if (owner.craftInputIDs.includes(structureID)) {
					owner.removeCraftItem(k, structureID);
				}
			}
			if ((typeof owner.spawners != 'undefined') && (owner.spawners.length > 0)) {
				for (let j = owner.spawners.length-1; j >= 0; j--) {
					if (owner.spawners[j][0] == structureID) {
						owner.spawners.splice(j, 1);
					}
				}
			}
			
			owner.inventoryManager.structureDestroyed(k.type);
			
            if (k.type == config.getTypeByName("Totem")) {
                console.log("Despawning due to totem delete in /builds-clear");
                owner.suspend();
            }
        }
        structures[structureID] = undefined; // delete structures[structureID]
    }
}

function notifyStructureDelete(structureID) {
    let a = new Uint8Array(msgpack.addNumb([msgpack.STRUCTURE_DESTROY_DELIM], structureID));
    for (let j = 0; j < connections.length; j++) {
        if (connections[j] !== undefined) {
            connections[j].send(a);
        }
    }
}

function createGameStructure(owner, type, x, y, dir) {
    let s = new Structure(type, owner, x, y, dir);
    s.finalize(owner.holding);
    gameStructureCells[s.gridCoords[0]][s.gridCoords[1]].push(s.structureID);
    s.isInternal = true;
}

module.exports.Structure = Structure;
module.exports.createGameStructure = createGameStructure;
module.exports.notifyStructureDelete = notifyStructureDelete;
module.exports.deleteStructure = deleteStructure;
module.exports.checkCell = checkCell;