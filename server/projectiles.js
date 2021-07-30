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

var projectiles = [];
var projectileCells = [];

var projectilePool = [];

function init(p, s, pcell, scell, ppC, ppS, conn) {
    players = p;
    structures = s;
    cells = pcell;
    structureCells = scell;
    processPlayerCell = ppC;
    processStructureCell = ppS;
    connections = conn;

    for (let j = 0; j < config.NUM_CELLS_LEN; j++) {
        let temp = [];
        for (let k = 0; k < config.NUM_CELLS_LEN; k++) {
            temp.push([]);
        }
        projectileCells.push(temp);
    }
}

function Projectile(owner, type, locX, locY, dir, lofted) {
    this.config(owner, type, locX, locY, dir, lofted);
};
Projectile.prototype.config = function(owner, type, locX, locY, dir, lofted) {
    let speed = config.unifiedItems[type].speed;
    this.owner = owner;
    this.velX = speed * Math.sin(dir);
    this.velY = speed * Math.cos(dir);
    this.radius = config.unifiedItems[type].radius;
    this.loc = [locX, locY];
    this.startLoc = [locX, locY];
    this.range = config.unifiedItems[type].range;
    this.dir = dir;
    this.lofted = lofted;
    this.type = type;
    this.viewers = [];
    if (this.projectileID == undefined) {
        this.insert();
    }
    this.finalizeGridLoc();
    this.notifyCreate();
}
Projectile.prototype.insert = function() {
    for (let j = 0; j < projectiles.length; j++) {
        if (projectiles[j] == undefined) {
            projectiles[j] = this;
            this.projectileID = j;
            return;
        }
    }
    projectiles.push(this);
    this.projectileID = projectiles.length - 1;
};
Projectile.prototype.finalizeGridLoc = function() {
    let temp = utils.calculateGridCoords(this.loc);
    if (typeof this.gridCoords !== 'undefined') {
        if ((temp[0] != this.gridCoords[0]) || (temp[1] != this.gridCoords[1])) {
            var index = projectileCells[this.gridCoords[0]][this.gridCoords[1]].indexOf(this.projectileID);
            if (index !== -1) {
                projectileCells[this.gridCoords[0]][this.gridCoords[1]].splice(index, 1);
            }
            this.gridCoords = temp;
            projectileCells[this.gridCoords[0]][this.gridCoords[1]].push(this.projectileID);
        }
    }
    else {
        this.gridCoords = temp;
        projectileCells[this.gridCoords[0]][this.gridCoords[1]].push(this.projectileID);
    }
};
Projectile.prototype.checkCollision = function(item, newCoord) {
    if (((item.loc[0] - item.radius) > (this.loc[0] + this.radius)) && ((item.loc[0] - item.radius) > (newCoord[0] + this.radius))) {
        return false;
    }
    if (((item.loc[1] - item.radius) > (this.loc[1] + this.radius)) && ((item.loc[1] - item.radius) > (newCoord[1] + this.radius))) {
        return false;
    }
    if (((this.loc[0] - this.radius) > (item.loc[0] + item.radius)) && ((newCoord[0] - this.radius) > (item.loc[0] + item.radius))) {
        return false;
    }
    if (((this.loc[1] - this.radius) > (item.loc[1] + item.radius)) && ((newCoord[1] - this.radius) > (item.loc[1] + item.radius))) {
        return false;
    }
    if (utils.pointSegmentSquaredDistance(this.loc[0], this.loc[1], newCoord[0], newCoord[1], item.loc[0], item.loc[1]) <= Math.pow(this.radius + item.radius, 2)) {
        return true;
    }
    return false;
};
Projectile.prototype.checkView = function(item, newCoord) {
    let viewX = config.VIEWDISPLACEMENT_X * item.viewFactor;
    let viewY = config.VIEWDISPLACEMENT_Y * item.viewFactor;
    if (((item.loc[0] - viewX) > (this.loc[0] + this.radius)) && ((item.loc[0] - viewX) > (newCoord[0] + this.radius))) {
        return false;
    }
    if (((item.loc[1] - viewY) > (this.loc[1] + this.radius)) && ((item.loc[1] - viewY) > (newCoord[1] + this.radius))) {
        return false;
    }
    if (((this.loc[0] - this.radius) > (item.loc[0] + viewX)) && ((newCoord[0] - this.radius) > (item.loc[0] + viewX))) {
        return false;
    }
    if (((this.loc[1] - this.radius) > (item.loc[1] + viewY)) && ((newCoord[1] - this.radius) > (item.loc[1] + viewY))) {
        return false;
    }
    if (utils.pointSegmentSquaredDistance(this.loc[0], this.loc[1], newCoord[0], newCoord[1], item.loc[0], item.loc[1]) <= Math.pow(Math.max(viewX, viewY), 2)) {
        return true;
    }
    return false;
};
Projectile.prototype.destroy = function() {
    let thearray = projectileCells[this.gridCoords[0]][this.gridCoords[1]];
    let index = thearray.indexOf(this.projectileID);
    if (index > -1) {
        thearray.splice(index, 1);
    }
    this.notifyDelete();
    this.isSuspended = true;
    this.gridCoords = undefined;
    this.loc = undefined;
    this.lofted = undefined;
    projectilePool.push(this.projectileID);
};
Projectile.prototype.advance = function() {
    if (this.isSuspended != true) {
        let newCoord = [this.loc[0] + this.velX, this.loc[1] + this.velY];
        let currSquaredDistance = utils.getSquaredDistance(newCoord[0], newCoord[1], this.startLoc[0], this.startLoc[1]);
        if (currSquaredDistance >= Math.pow(this.range, 2)) {
            this.destroy();
            return;
        }
        let structureCollider = undefined;
        let structureColliderDistance = undefined;
        let playerCollider = undefined;
        let playerColliderDistance = undefined;
        utils.runAround(this, function(bullet, gridX, gridY) {
            let playersVec = cells[gridX][gridY];
            let structuresVec = structureCells[gridX][gridY];
            processPlayerCell(playersVec, function(thePlayer) {
                if ((bullet.checkCollision(thePlayer, newCoord) == true) && (!thePlayer.isFriendly(bullet.owner))) {
                    let squaredDistance = utils.getSquaredDistance(thePlayer.loc[0], thePlayer.loc[1], bullet.loc[0], bullet.loc[1]);
                    if ((playerCollider == undefined) || (squaredDistance < playerColliderDistance)) {
                        playerCollider = thePlayer;
                        playerColliderDistance = squaredDistance;
                    }
                }
            });
            processStructureCell(structuresVec, function(theStructure) {
                if ((bullet.checkCollision(theStructure, newCoord) == true) && ((theStructure.ignoreCollisions !== true) || (theStructure.lofted == true))) {
                    if ((bullet.lofted == false) || (theStructure.lofted == true)) {
                        let squaredDistance = utils.getSquaredDistance(theStructure.loc[0], theStructure.loc[1], bullet.loc[0], bullet.loc[1]);
                        if ((structureCollider == undefined) || (squaredDistance < structureColliderDistance)) {
                            structureCollider = theStructure;
                            structureColliderDistance = squaredDistance;
                        }
                    }
                }
            });
        }, this.velX + config.EDGE_TOLERANCE, this.velY + config.EDGE_TOLERANCE);
        if (playerCollider !== undefined) {
            let bulletData = config.unifiedItems[this.type];
            let bulletDamage = bulletData.playerDamage;
            if (bulletData.snipeRange !== undefined) {
                if (currSquaredDistance >= Math.pow(bulletData.snipeRange, 2)) {
                    if (Math.pow(playerCollider.velX, 2) + Math.pow(playerCollider.velY, 2) >= Math.pow(bulletData.snipeSpeed, 2)) {
                        if (playerCollider.trapped != true) {
                            bulletDamage = bulletData.snipeDamage;
                        }
                    }
                }
            }
            if (playerCollider.trapped == undefined) {
                playerCollider.velX += bulletData.knockback * Math.sin(this.dir);
                playerCollider.velY += bulletData.knockback * Math.cos(this.dir);
            }
            let toRun = true;
            if (config.unifiedItems[playerCollider.holdingType()].action == 4) {
                if (utils.angleWorks(Math.atan2(this.startLoc[0] - playerCollider.loc[0], this.startLoc[1] - playerCollider.loc[1]), playerCollider.dir + config.SHIELD_HALFANGLE, playerCollider.dir - config.SHIELD_HALFANGLE) == true) {
                    toRun = false;
                }
            }
            if (toRun == true) {
                if (bulletDamage > 150) {
                    playerCollider.subtractHealth(250, this.owner);
                }
                else {
                    playerCollider.subtractHealth(bulletDamage, this.owner);
                }
            }
            this.destroy();
        }
        else if (typeof structureCollider !== 'undefined') {
            if (structureCollider.type != 16) { // Is not totem
                structureCollider.subtractHealth(config.unifiedItems[this.type].structureDamage);
            }
            this.destroy();
        }
        else if ((newCoord[0] <= 0) || (newCoord[0] >= config.MAP_X)) {
            this.destroy();
        }
        else if ((newCoord[1] <= 0) || (newCoord[1] >= config.MAP_Y)) {
            this.destroy();
        }
        else {
            this.loc = newCoord;
            this.finalizeGridLoc();
        }
    }
};
Projectile.prototype.notifyCreate = function() {
    let maxRangeX = config.VIEWDISPLACEMENT_X * (1 + config.FOV_GROWTH * (config.STATS_MAX_VAL - config.STATS_INITIAL));
    let maxRangeY = config.VIEWDISPLACEMENT_Y * (1 + config.FOV_GROWTH * (config.STATS_MAX_VAL - config.STATS_INITIAL));
    let toModify = [msgpack.BULLET_DELIM];
    serializeBullet(this, toModify);
    let xRange = this.range * Math.sin(this.dir);
    let yRange = this.range * Math.cos(this.dir);
    let toSend = new Uint8Array(toModify);
    utils.runAround(this, function(bullet, tcgX, tcgY) {
        let playersVec = cells[tcgX][tcgY];
        processPlayerCell(playersVec, function(thePlayer) {
            if (bullet.checkView(thePlayer, [bullet.loc[0] + xRange, bullet.loc[1] + yRange]) == true) {
                connections[thePlayer.playerID].send(toSend);
                bullet.viewers.push(thePlayer.playerID);
            }
        });
    }, maxRangeX + Math.abs(xRange), maxRangeY + Math.abs(yRange));
}
Projectile.prototype.notifyDelete = function() {
    let toModify = [msgpack.BULLET_DESTROY_DELIM];
    msgpack.addNumb(toModify, this.projectileID);
    let toSend = new Uint8Array(toModify);
    for (let j = 0; j < this.viewers.length; j++) {
        let thePlayer = players[this.viewers[j]];
        if (typeof thePlayer !== 'undefined') {
            connections[thePlayer.playerID].send(toSend);
        }
    }
}

function serializeBullet(theBullet, toModify) {
    msgpack.addNumb(toModify, theBullet.projectileID);
    msgpack.addNumb(toModify, Math.round(theBullet.loc[0]));
    msgpack.addNumb(toModify, Math.round(theBullet.loc[1]));
    msgpack.addPosNegNumb(toModify, Math.round(theBullet.velX));
    msgpack.addPosNegNumb(toModify, Math.round(theBullet.velY));
    msgpack.addNumb(toModify, theBullet.type);
}

function makeProjectile(owner, type, locX, locY, dir, lofted) {
    if (projectilePool.length > 0) {
        let recycledBullet = projectilePool.pop();
        projectiles[recycledBullet].isSuspended = undefined;
        projectiles[recycledBullet].config(owner, type, locX, locY, dir, lofted);
        return projectiles[recycledBullet];
    }
    else {
        return new Projectile(owner, type, locX, locY, dir, lofted);
    }
}

exports.projectiles = projectiles;
exports.projectileCells = projectileCells;
exports.makeProjectile = makeProjectile;
exports.init = init;