const msgpack = require('../common/msgpack.js');
const config = require('../common/config.js');
const utils = require('./utils.js');

var players = undefined;
var structures = undefined;
var cells = undefined;
var structureCells = undefined;
var processPlayerCell = undefined;
var processStructureCell = undefined;
var connections = undefined;

var bots = [];

function init(p, s, pcell, scell, ppC, ppS, conn) {
    players = p;
    structures = s;
    cells = pcell;
    structureCells = scell;
    processPlayerCell = ppC;
    processStructureCell = ppS;
    connections = conn;
}

function dummyConnection() {
}
dummyConnection.prototype.send = function(a) {
    // no-op
}
dummyConnection.prototype.ping = function(a) {
    // no-op
}

// Bot type 0 is a sniper
// Bot type 1 is nuro
// Bot type 2 is experimental push bot
function convertBot(p, botType) {
    p.isBot = true;
    p.botType = botType;
    p.basePointX = p.loc[0];
    p.basePointY = p.loc[1];
    bots.push(p.playerID);
    p.botID = bots.length - 1;
    
    p.targetPlayers = [];
    p.targetStructures = [];
    p.touchingTraps = [];

    p.selectItem(2);
}

function calculateInterceptAngle(bot, target, squaredBulletSpeed) {
    let xDiff = target.loc[0] - bot.loc[0];
    let yDiff = target.loc[1] - bot.loc[1];
    let velDiff = Math.pow(target.velX, 2) + Math.pow(target.velY, 2) - squaredBulletSpeed;
    let velDir = 2 * (xDiff * target.velX + yDiff * target.velY);
    let distanceRange = Math.pow(xDiff, 2) + Math.pow(yDiff, 2);

    let k = -velDir / (2 * velDiff);
    let discrim = Math.sqrt(velDir * velDir - 4 * velDiff * distanceRange) / (2 * velDiff);
    let t = undefined;
    if (((k - discrim) > (k + discrim)) && (k + discrim > 0)) {
        t = k + discrim;
    }
    else {
        t = k - discrim;
    }
    let actualX = target.loc[0] + t * target.velX;
    let actualY = target.loc[1] + t * target.velY;
    return Math.atan2(actualX - bot.loc[0], actualY - bot.loc[1]);
}

function processBoostSpiker(p) {
    let boostSpeed = (config.BOOST_SPEED / config.DECEL_FACTOR) - config.BOOST_SPEED;
    let angle = calculateInterceptAngle(p, p.toAttack, boostSpeed * boostSpeed);
    let sqDist = utils.getSquaredDistance(p.loc[0], p.loc[1], p.toAttack.loc[0], p.toAttack.loc[1]);
    if ((angle !== undefined) && (!isNaN(angle))) {
        if (sqDist <= Math.pow(config.PLAYER_RADIUS + config.SPIKE_RADIUS, 2)) {
            p.selectItem(5);
            p.dir = utils.normalizeAngle(angle + Math.PI/4);
            p.handlePress(false);
            p.selectItem(5);
            p.dir = utils.normalizeAngle(angle - Math.PI/4);
            p.handlePress(false);
            p.dir = utils.normalizeAngle(angle + 3 * Math.PI/4);
            p.handlePress(false);
            p.selectItem(5);
            p.dir = utils.normalizeAngle(angle - 3 * Math.PI/4);
            p.handlePress(false);
            p.selectItem(1);
            p.dir = angle;
        }
        else if (sqDist >= Math.pow(config.PLAYER_RADIUS * 2 + config.BOOST_RADIUS, 2)) {
            p.selectItem(7);
            p.dir = angle;
            p.handlePress(false);
        }
        
        let angleDeg = angle * (180 / Math.PI);
        if (angleDeg >= 0) {
            p.moveState = (angleDeg < 22.5) ? msgpack.UP : ((angleDeg > 180 - 22.5) ? msgpack.DOWN : ((angleDeg > 90) ? msgpack.LOWERRIGHT : msgpack.UPPERRIGHT));
        }
        else {
            p.moveState = (angleDeg > -22.5) ? msgpack.UP : ((angleDeg < 22.5 - 180) ? msgpack.DOWN : ((angleDeg > -90) ? msgpack.UPPERLEFT : msgpack.LOWERLEFT))
        }
    }
}

function processSniperBot(p) {
    let targetPlayer = undefined;
    let targetDistance = undefined;
    let seeingTarget = false;
    for (let j = 0; j < p.targetPlayers.length; j++) {
        if (p.targetPlayers[j] !== p.playerID) {
            if (players[p.targetPlayers[j]] !== undefined) {
                let distance = utils.getSquaredDistance(p.loc[0], p.loc[1], players[p.targetPlayers[j]].loc[0], players[p.targetPlayers[j]].loc[1]);
                if (((targetDistance == undefined) || (distance < targetDistance)) && (!p.isFriendly(p.targetPlayers[j]))) {
                    targetDistance = distance;
                    targetPlayer = players[p.targetPlayers[j]];
                    seeingTarget = true;
                }
            }
        }
    }
    if (seeingTarget == true) {
        let bulletSpeed = config.unifiedItems[config.unifiedItems[p.inventoryManager.getSecondary()].fires].speed;
        let tentativeDir = calculateInterceptAngle(p, targetPlayer, bulletSpeed * bulletSpeed);
        if (!isNaN(tentativeDir)) {
            p.dir = tentativeDir;
        }
        //p.dir = Math.PI - Math.atan2(targetPlayer.loc[0] - p.loc[0], p.loc[1] - targetPlayer.loc[1]);
        if (p.autohitting == false) {
            p.autohitting = true;
            p.handlePress();
        }
    }
    else {
        p.autohitting = false;
        p.dir += Math.PI / 20;
        if (p.dir > Math.PI) {
            p.dir = -Math.PI + p.dir - Math.PI;
        }
    }
}

function processBot(p, shouldCalcBot) {
    if (p.health < config.MAX_HEALTH * 0.8) {
        if ((new Date()).getTime() - p.lastActionTime >= 120) {
            p.selectItem(3);
            p.handlePress(false);
        }
    }
    if ((p.botType == 0) && (shouldCalcBot == true)) {
        processSniperBot(p);
    }
    else if (p.botType == 1) {
        if (p.autohitting == false) {
            p.autohitting = true;
            p.selectItem(1);
            p.handlePress(false);
        }
        if (p.touchingTraps.length > 0) {
            if (structures[p.touchingTraps[0]] !== undefined) {
                let angle = Math.atan2(structures[p.touchingTraps[0]].loc[0] - p.loc[0], structures[p.touchingTraps[0]].loc[1] - p.loc[1]);
                p.dir = utils.flipAngle(angle);
                p.selectItem(7);
                p.handlePress(false);
                p.dir = utils.normalizeAngle(utils.flipAngle(angle) + 0.175);
                p.selectItem(7);
                p.handlePress(false);
                p.dir = utils.normalizeAngle(utils.flipAngle(angle) - 0.175);
                p.selectItem(7);
                p.handlePress(false);
                p.selectItem(5);
                p.dir = utils.flipAngle(angle);
                p.handlePress(false);
                p.selectItem(1);
                p.dir = angle;
            }
        }
        else if (((p.toAttack === undefined) || (p.toAttack.isSuspended == true)) && (shouldCalcBot == true)) {
            p.toAttack = undefined;
            p.moveState = 0;
            for (let j = 0; j < p.targetPlayers.length; j++) {
                if (p.targetPlayers[j] !== p.playerID) {
                    let candidateX = players[p.targetPlayers[j]].loc[0];
                    let candidateY = players[p.targetPlayers[j]].loc[1];
                    if ((!p.isFriendly(p.targetPlayers[j])) && 
                        (players[p.targetPlayers[j]].isSuspended !== true)
                    ) {
                        let shouldAttack = true;
                        for (let k = 0; k < p.targetStructures.length; k++) {
                            if (structures[p.targetStructures[k]] !== undefined) {
                                if (!p.isFriendly(structures[p.targetStructures[k]].owner)) {
                                    if (utils.occludes(p.loc[0], p.loc[1], structures[p.targetStructures[k]].loc[0], structures[p.targetStructures[k]].loc[1], candidateX, candidateY, structures[p.targetStructures[k]].radius + config.PLAYER_RADIUS) == true) {
                                        shouldAttack = false;
                                        break;
                                    }
                                }
                            }
                        }
                        if (shouldAttack == true) {
                            p.toAttack = players[p.targetPlayers[j]];
                        }
                    }
                }
            }
			
			if (typeof p.toAttack != 'undefined') {
				let currTime = (new Date()).getTime();
				if ((typeof p.lastStrucsDeleted == 'undefined') || (currTime - p.lastStrucsDeleted > 3000)) {
					let info = new Uint8Array(p.deletePlayerStructures());
					for (let j = 0; j < connections.length; j++) {
						if (typeof connections[j] !== 'undefined') {
							connections[j].send(info);
						}
					}
					p.lastStrucsDeleted = (new Date()).getTime();
				}
			}
        }
        else if ((p.toAttack != undefined) && (p.toAttack.isSuspended != true)) {
            let shouldAttack = true;
            for (let k = 0; k < p.targetStructures.length; k++) {
                if (structures[p.targetStructures[k]] !== undefined) {
                    if (!p.isFriendly(structures[p.targetStructures[k]].owner)) {
                        if (utils.occludes(p.loc[0], p.loc[1], structures[p.targetStructures[k]].loc[0], structures[p.targetStructures[k]].loc[1], p.toAttack.loc[0], p.toAttack.loc[1], structures[p.targetStructures[k]].radius) == true) {
                            shouldAttack = false;
                            break;
                        }
                    }
                }
            }
            if ((utils.getSquaredDistance(p.toAttack.loc[0], p.toAttack.loc[1], p.loc[0], p.loc[1]) <= Math.pow(config.BOOSTBOT_RANGE, 2)) && 
                (p.toAttack.isSuspended !== true) &&
                (shouldAttack == true)
            ) {
				let currTime = (new Date()).getTime();
				if ((typeof p.lastStrucsDeleted == 'undefined') || (currTime - p.lastStrucsDeleted > 10000)) {
					let info = new Uint8Array(p.deletePlayerStructures());
					for (let j = 0; j < connections.length; j++) {
						if (typeof connections[j] !== 'undefined') {
							connections[j].send(info);
						}
					}
					p.lastStrucsDeleted = (new Date()).getTime();
				}
                processBoostSpiker(p);
            }
            else {
                p.toAttack = undefined;
                p.moveState = 0;
            }
        }
    }
    p.targetPlayers = [];
    p.targetStructures = [];
    p.touchingTraps = [];
}

function processAllBots(shouldCalcBot) {
    for (let j = 0; j < bots.length; j++) {
        if (bots[j] !== undefined) {
            if (players[bots[j]] !== undefined) {
                if (players[bots[j]].isSuspended != true) {
                    processBot(players[bots[j]], shouldCalcBot);
                }
            }
        }
    }
}

exports.init = init;
exports.convertBot = convertBot;
exports.processAllBots = processAllBots;
exports.dummyConnection = dummyConnection;