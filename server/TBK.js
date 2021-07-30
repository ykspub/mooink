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
var deletePlayer = undefined;

var bots = [];

function init(p, s, pcell, scell, ppC, ppS, conn, dPlayer) {
    players = p;
    structures = s;
    cells = pcell;
    structureCells = scell;
    processPlayerCell = ppC;
    processStructureCell = ppS;
    connections = conn;
	deletePlayer = dPlayer;
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

function followTarget(angle) {
	let angleDeg = (180 / Math.PI) * angle;
	if (angleDeg >= 0) {
		return (angleDeg < 22.5) ? msgpack.UP : ((angleDeg > 180 - 22.5) ? msgpack.DOWN : ((angleDeg > 90) ? msgpack.LOWERRIGHT : msgpack.UPPERRIGHT));
	}
	else {
		return (angleDeg > -22.5) ? msgpack.UP : ((angleDeg < 22.5 - 180) ? msgpack.DOWN : ((angleDeg > -90) ? msgpack.UPPERLEFT : msgpack.LOWERLEFT))
	}
}

function isReserved(target) {
	let cutoff = 1;
	if (typeof target.kills != 'undefined') {
		if (target.kills >= 9) {
			cutoff = 99;
		}
		else if (target.kills >= 6) {
			cutoff = 3;
		}
		else if (target.kills >= 4) {
			cutoff = 2;
		}
	}
	
	if ((typeof target.numAttackingBots == 'undefined') || (target.numAttackingBots+1 <= cutoff)) {
		return false;
	}
	else {
		return true;
	}
}

function setAttacker(target) {
	if (typeof target.numAttackingBots == 'undefined') {
		target.numAttackingBots = 1;
	}
	else {
		target.numAttackingBots += 1;
	}
}

function boostSpikeHelper(p, boostSpeed, isFirst) {
	let offset = (isFirst == true) ? (Math.PI/4) : (3 * Math.PI/4);
	
	if (!isFirst) {
		if (typeof p != 'undefined') {
			p.awaitingKillTime = undefined;
		}
	}
	
	if ((typeof p != 'undefined') && (p.isSuspended != true) && (typeof p.toAttack != 'undefined') && (p.toAttack.isSuspended != true)) {
		let sqDist = utils.getSquaredDistance(p.loc[0], p.loc[1], p.toAttack.loc[0], p.toAttack.loc[1]);
		if (sqDist <= Math.pow(config.PLAYER_RADIUS * 3 + config.SPIKE_RADIUS, 2)) {
			let newAngle = calculateInterceptAngle(p, p.toAttack, boostSpeed * boostSpeed);
			if ((newAngle !== undefined) && (!isNaN(newAngle))) {
				p.selectItem(5);
				p.dir = utils.normalizeAngle(newAngle + offset);
				p.handlePress(false);
				p.selectItem(5);
				p.dir = utils.normalizeAngle(newAngle - offset);
				p.handlePress(false);
				p.dir = newAngle;
			}
		}
	}
}
function executeBoostSpike(p) {
    let boostSpeed = (config.BOOST_SPEED / config.DECEL_FACTOR) - config.BOOST_SPEED;
    let sqDist = utils.getSquaredDistance(p.loc[0], p.loc[1], p.toAttack.loc[0], p.toAttack.loc[1]);
	
	let angle = calculateInterceptAngle(p, p.toAttack, boostSpeed * boostSpeed);
	
	if ((typeof angle != 'undefined') && (!isNaN(angle))) {
		if (
			(sqDist <= Math.pow(config.PLAYER_RADIUS + config.SPIKE_RADIUS, 2)) && 
			((typeof p.awaitingKillTime == 'undefined') || (Date.now() - p.awaitingKillTime >= 30000))
		) {
			p.awaitingKillTime = Date.now();
			let minScalePoint = 2; // don't scale until we have more than 2 kills
			let maxScalePoint = 8; // max difficulty at 8 kills
			let quadSpeed = 625;
			if ((typeof p.toAttack.kills != 'undefined') && (p.toAttack.kills > minScalePoint)) {
				quadSpeed -= (p.toAttack.kills - minScalePoint) * (quadSpeed / (maxScalePoint - minScalePoint));
				quadSpeed = Math.max(0, quadSpeed);
			}
			
			setTimeout(boostSpikeHelper, quadSpeed+1, p, boostSpeed, true);
			setTimeout(boostSpikeHelper, Math.max(20, quadSpeed * 1.5), p, boostSpeed, false);
		}
		else if (sqDist >= Math.pow(config.PLAYER_RADIUS * 2 + config.BOOST_RADIUS, 2)) {
			p.selectItem(7);
			p.dir = angle;
			p.handlePress(false);
		}
		
		p.moveState = followTarget(angle);
	}
}

function getClosestObstacle(p, target) {
	let toReturn = undefined;
	
	for (let k = 0; k < p.targetStructures.length; k++) {
		if (structures[p.targetStructures[k]] !== undefined) {
			if ((!p.isFriendly(structures[p.targetStructures[k]].owner)) && (structures[p.targetStructures[k]].ignoreCollisions != true)) {
				if (utils.occludes(
					p.loc[0], p.loc[1], structures[p.targetStructures[k]].loc[0], structures[p.targetStructures[k]].loc[1], 
					target.loc[0], target.loc[1], structures[p.targetStructures[k]].radius + config.PLAYER_RADIUS
				)) {
					let distance = utils.getSquaredDistance(p.loc[0], p.loc[1], structures[p.targetStructures[k]].loc[0], structures[p.targetStructures[k]].loc[1]);
					if ((typeof toReturn == 'undefined') || (distance < toReturn)) {
						toReturn = distance;
					}
				}
			}
		}
	}
	return toReturn;
}

function isBoostTarget(p, target) {
	let targetBotDistance = utils.getSquaredDistance(target.loc[0], target.loc[1], p.loc[0], p.loc[1]);
	
	let shouldAttack = true;
	let numSusSpikes = 0;
	for (let k = 0; k < p.targetStructures.length; k++) {
		if (structures[p.targetStructures[k]] !== undefined) {
			if (!p.isFriendly(structures[p.targetStructures[k]].owner)) {
				if (utils.occludes(
					p.loc[0], p.loc[1], structures[p.targetStructures[k]].loc[0], structures[p.targetStructures[k]].loc[1], 
					target.loc[0], target.loc[1], structures[p.targetStructures[k]].radius + config.PLAYER_RADIUS
				)) {
					shouldAttack = false;
					break;
				}
				
				let targetStrucDistance = utils.getSquaredDistance(structures[p.targetStructures[k]].loc[0], structures[p.targetStructures[k]].loc[1], target.loc[0], target.loc[1]);
				if (
					(targetStrucDistance < Math.pow(2 * structures[p.targetStructures[k]].radius + 2 * config.PLAYER_RADIUS, 2)) &&
					(targetBotDistance >= targetStrucDistance * 4)
				) {
					numSusSpikes += 1;
				}
			}
		}
	}
	return (shouldAttack == true) && (numSusSpikes <= 1) && (!isReserved(target));
}

function processBoostSpiker(p, shouldCalcBot) {
	if (p.autohitting == false) {
		p.autohitting = true;
		p.selectItem(1);
		p.handlePress(false);
	}
	else if (((p.toAttack === undefined) || (p.toAttack.isSuspended == true)) && shouldCalcBot) {
		p.toAttack = undefined;
		p.moveState = 0;
		for (let j = 0; j < p.targetPlayers.length; j++) {
			if (p.targetPlayers[j] !== p.playerID) {
				if ((!p.isFriendly(p.targetPlayers[j])) && 
					(players[p.targetPlayers[j]].isSuspended !== true)
				) {
					if (isBoostTarget(p, players[p.targetPlayers[j]])) {
						p.toAttack = players[p.targetPlayers[j]];
					}
				}
			}
		}
	}
	else if ((p.toAttack != undefined) && (p.toAttack.isSuspended != true)) {
		let toAttack = true;
		if (shouldCalcBot) {
			toAttack = isBoostTarget(p, p.toAttack);
		}
		if ((utils.getSquaredDistance(p.toAttack.loc[0], p.toAttack.loc[1], p.loc[0], p.loc[1]) <= Math.pow(config.BOOSTBOT_RANGE, 2)) && 
			(p.toAttack.isSuspended !== true) &&
			toAttack
		) {
			let currTime = (new Date()).getTime();
			if ((typeof p.lastStrucsDeleted == 'undefined') || (currTime - p.lastStrucsDeleted > 6000)) {
				let info = new Uint8Array(p.deletePlayerStructures());
				for (let j = 0; j < connections.length; j++) {
					if (typeof connections[j] !== 'undefined') {
						connections[j].send(info);
					}
				}
				p.lastStrucsDeleted = (new Date()).getTime();
			}
			executeBoostSpike(p);
		}
		else {
			p.toAttack = undefined;
			p.moveState = 0;
		}
	}
	
	if (typeof p.toAttack != 'undefined') {
		setAttacker(p.toAttack);
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
                if (
					((targetDistance == undefined) || (distance < targetDistance)) && 
					(!p.isFriendly(p.targetPlayers[j])) && 
					(!isReserved(players[p.targetPlayers[j]]))
				) {
                    targetDistance = distance;
                    targetPlayer = players[p.targetPlayers[j]];
                    seeingTarget = true;
                }
            }
        }
    }
    if (seeingTarget == true) {
		p.selectItem(2);
		
        let bulletSpeed = config.unifiedItems[config.unifiedItems[p.inventoryManager.getSecondary()].fires].speed;
        let tentativeDir = calculateInterceptAngle(p, targetPlayer, bulletSpeed * bulletSpeed);
        if (!isNaN(tentativeDir)) {
            p.dir = tentativeDir;
        }

        if (p.autohitting == false) {
            p.autohitting = true;
            p.handlePress();
        }

		if (!isNaN(tentativeDir)) {
			p.moveState = followTarget(tentativeDir);
		}
		
		setAttacker(targetPlayer);
    }
    else {
        p.autohitting = false;
        p.dir += Math.PI / 20;
        if (p.dir > Math.PI) {
            p.dir = -Math.PI + p.dir - Math.PI;
        }
		p.moveState = 0;
    }
}

function processZombie(p, shouldCalcBot) {
	if (typeof p.toAttack != 'undefined') {
		let toAttack = players[p.toAttack];
		if (typeof toAttack != 'undefined') {
			if (toAttack.isSuspended != true) {
				p.selectItem(1);
				if (shouldCalcBot) {
					let angle = Math.atan2(toAttack.loc[0] - p.loc[0], toAttack.loc[1] - p.loc[1]);
					p.dir = angle;
					p.moveState = followTarget(angle);
					if (p.autohitting == false) {
						p.autohitting = true;
						p.handlePress();
					}
					
					let distance = getClosestObstacle(p, toAttack);
					if (typeof distance != 'undefined') {
						let playerReach = config.unifiedItems[p.inventoryManager.getUnifiedIndex(0).item].range;
						
						if (distance <= Math.pow(config.PLAYER_RADIUS * 3, 2)) {
							p.moveState = followTarget(utils.flipAngle(angle));
						}
						else if (distance <= Math.pow(playerReach + 1.5 * config.PLAYER_RADIUS, 2)) {
							p.moveState = 0;
						}
					}
				}
			}
		}
		else {
			deletePlayer(p.playerID);
		}
	}
}

function healHelper(p, maxHealSpeed) {
	if (typeof p != 'undefined') {
		if ((p.isSuspended != true) && (Date.now() - p.lastActionTime >= maxHealSpeed) && (p.health < config.MAX_HEALTH)) {
			p.selectItem(3);
			p.handlePress(false);
			p.botHealTimer = undefined;
		}
		else if ((p.isSuspended != true) && (p.health < config.MAX_HEALTH)) {
			registerHealTimer(p, maxHealSpeed + 10 - (Date.now() - p.lastActionTime), maxHealSpeed);
		}
		else {
			p.botHealTimer = undefined;
		}
	}
}
function registerHealTimer(p, delayTime, maxHealSpeed) {
	p.botHealTimer = setTimeout(healHelper, delayTime, p, maxHealSpeed);
}

function processBot(p, shouldCalcBot) {
    if ((p.health < config.MAX_HEALTH * 0.8) && (typeof p.botHealTimer == 'undefined') && (p.botType != "zombie")) {
		registerHealTimer(
							p, 
							(p.health < config.MAX_HEALTH * 0.5) ? Math.max(10, 130 - (Date.now() - p.lastActionTime)) : 200, 
							120
						 );
    }

	let currTime = (new Date()).getTime();
	if (p.touchingTraps.length > 0) {
		if (
			(structures[p.touchingTraps[0]] !== undefined) &&
			((typeof p.antiTrapTime == 'undefined') || (currTime - p.antiTrapTime >= 1000))
		) {
			let angle = Math.atan2(structures[p.touchingTraps[0]].loc[0] - p.loc[0], structures[p.touchingTraps[0]].loc[1] - p.loc[1]);
			p.dir = utils.flipAngle(angle);
			if (p.inventoryManager.getActionBarItem(6).item != config.getTypeByName("Pit trap")) {
				p.selectItem(7);
				p.handlePress(false);
				p.dir = utils.normalizeAngle(utils.flipAngle(angle) + 0.175);
				p.selectItem(7);
				p.handlePress(false);
				p.dir = utils.normalizeAngle(utils.flipAngle(angle) - 0.175);
				p.selectItem(7);
				p.handlePress(false);
			}
			else {
				p.selectItem(5);
				p.dir = utils.normalizeAngle(utils.flipAngle(angle) - 0.175);
				p.handlePress(false);
				
				p.selectItem(5);
				p.dir = utils.normalizeAngle(utils.flipAngle(angle) + 0.175);
				p.handlePress(false);
			}
			p.selectItem(5);
			p.dir = utils.flipAngle(angle);
			p.handlePress(false);
			p.selectItem(1);
			p.dir = angle;
			
			p.antiTrapTime = (new Date()).getTime();
		}
	}
	else if (p.botType == "gun") {
		processSniperBot(p);
	}
	else if (p.botType == "boost") {
		processBoostSpiker(p, shouldCalcBot);
	}
	else if (p.botType == "zombie") {
		processZombie(p, shouldCalcBot);
	}
	
	if (
		((typeof p.lastStrucsDeleted == 'undefined') || (currTime - p.lastStrucsDeleted > 8000)) &&
		((typeof p.antiTrapTime != 'undefined') && (currTime - p.antiTrapTime > 4000))
	) {
		let info = new Uint8Array(p.deletePlayerStructures());
		if (info.length > 1) {
			for (let j = 0; j < connections.length; j++) {
				if (typeof connections[j] !== 'undefined') {
					connections[j].send(info);
				}
			}
		}
		p.lastStrucsDeleted = (new Date()).getTime();
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