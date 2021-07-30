var https = require('https');
var http = require('http');
var fs = require('fs');
var serverPort = 8080;

var wsServer = require('ws').Server;

var serverData = require('./server/servergamedata.js');
var msgpack = require('./common/msgpack.js');
var config = require('./common/config.js');
var teams = require('./server/teams.js');
var projectiles = require('./server/projectiles.js');

var connections = [];
var pausedPlayers = [];
var pausedPlayerHashes = [];

function postToWebhook(text) {
    const data = new TextEncoder().encode(
        JSON.stringify({
            embeds: [{"color": 16711680, "title": "update", "description":text}]
        })
    );
    const options = {
        hostname: 'discord.com',
        port: 443,
        path: process.env.WEBHOOK_URL,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length
        }
    };
    const req = https.request(options, res => {});
    req.write(data);
    req.end();
}
postToWebhook("Server started");

serverData.init(teams.teams, projectiles.projectiles, projectiles.projectileCells, projectiles.makeProjectile, connections, postToWebhook);
teams.init(serverData.players, connections);
projectiles.init(serverData.players, serverData.structures, serverData.cells, serverData.structureCells, serverData.processPlayerCell, serverData.processStructureCell, connections);
serverData.deferInit(teams.makeTeam, teams.acceptPlayer);

var commons = ['/config.js', '/msgpack.js', '/mapData.js', '/inventoryManager.js', '/utilCalc.js'];

var server = http.createServer(function(req, res) {
    if ((req.method === 'GET') && req.url.includes('.js')) {
        let baseUrl = (commons.includes(req.url)) ? './common' : './client';
        fs.readFile(baseUrl + req.url, function(err, data) {
            if (typeof data !== 'undefined') {
                res.writeHead(200, {'Content-Type': 'text/javascript'});
                res.write(data);
                return res.end();
            }
        });
    }
    else if ((req.method === 'GET') && req.url.includes('.css')) {
        fs.readFile('./client' + req.url, function(err, data) {
            if (typeof data !== 'undefined') {
                res.writeHead(200, {'Content-Type': 'text/css'});
                res.write(data);
                return res.end();
            }
        });
    }
    else if ((req.method === 'GET') && req.url.includes('.png')) {
        fs.readFile('./img' + req.url, function(err, data) {
            if (typeof data !== 'undefined') {
                res.writeHead(200, {'Content-Type': 'image/png'});
                res.write(data);
                return res.end();
            }
        });
    }
    else if ((req.method == 'GET') && req.url.includes('.txt')) {
        fs.readFile('./client' + req.url, function(err, data) {
            if (typeof data !== 'undefined') {
                res.writeHead(200, {'Content-Type': 'text/plain'});
                res.write(data);
                return res.end();
            }
        });
    }
    else if ((req.method == 'GET') && req.url.includes('.html')) {
        fs.readFile('./client' + req.url, function(err, data) {
            if (typeof data !== 'undefined') {
                res.writeHead(200, {'Content-Type': 'text/html'});
                res.write(data);
                return res.end();
            }
        });
    }
    else {
        fs.readFile('./client/index.html', function(err, data) {
            if (typeof data !== 'undefined') {
                res.writeHead(200, {'Content-Type': 'text/html'});
                res.write(data);
                return res.end();
            }
        });
    }
});

var mainServer = new wsServer({
    server
});
mainServer.on('connection', function(connection) {
    if (true) { 
        var userID = undefined;
        var user = undefined;
        var uniqueHash = makeRandomString(5, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789");
        connection.on('close', function(connection) {
            if (typeof userID !== 'undefined') {
                postToWebhook("Connection terminated for " + user.name + " with ID " + user.playerID);
                console.log("Connection terminated for " + user.name + " with ID " + user.playerID + " at time " + (new Date().toLocaleString()));
                pausedPlayers.push(user);
                pausedPlayerHashes.push(uniqueHash);
                setTimeout(function() {
                    for (let j = 0; j < pausedPlayerHashes.length; j++) {
                        if (pausedPlayerHashes[j] == uniqueHash) {
                            let toDelete = pausedPlayers[j].playerID;
                            serverData.deletePlayer(toDelete);
                            connections[toDelete] = undefined;

                            pausedPlayers.splice(j, 1);
                            pausedPlayerHashes.splice(j, 1);
                        }
                    }
                }, 5 * 1000);
            }
        });
        connection.on('error', function(error) {
            console.log("WS error " + error);
        });
        connection.on('message', function(message) {
            let binData = message;
            if ((binData !== undefined) && (binData.length != 0)) {
                if (binData[0] == msgpack.JOIN) {
                    if (typeof user === 'undefined') {
                        let k = waitJoin(binData, connection, uniqueHash);
                        if (typeof k !== 'undefined') {
                            user = k;
                            userID = k.playerID;
                        }
                    }
                    else if ((typeof user !== 'undefined') && (user.isSuspended == true)) {
                        let respawnData = extractJoinData(binData);
                        if (typeof respawnData !== 'undefined') {
                            let playerName = respawnData[0];
                            let primaryWeapon = respawnData[1];
                            let secondaryWeapon = respawnData[2];
                            let upgradePoints = respawnData[3];
                            let colorName = respawnData[4];
                            user.resume(playerName, primaryWeapon, secondaryWeapon, upgradePoints, colorName, connection);
                        }
                    }
                }
                else if ((binData[0] == msgpack.RECONNECT) && (user == undefined)) {
                    if (binData.length > 1) {
                        let toDecode = msgpack.preDecode(binData, 1);
                        let recievedHash = msgpack.expectString(toDecode);
                        if (recievedHash !== undefined) {
                            for (let j = 0; j < pausedPlayerHashes.length; j++) {
                                if (pausedPlayerHashes[j] == recievedHash) {
                                    user = pausedPlayers[j];
                                    userID = user.playerID;
                                    uniqueHash = recievedHash;
                                    connections[userID] = connection;
                                    pausedPlayers.splice(j, 1);
                                    pausedPlayerHashes.splice(j, 1);
                                }
                            }
                        }
                    }
                }
                else if ((user !== undefined) && (user.isSuspended !== true)) {
                    if (binData.length > 200) {
                        connection.close();
                    }
                    processMessage(binData, connection, user);
                }
            }
        });
    }
    else {
        request.reject();
    }
});

function extractJoinData(binData) {
    let data = msgpack.preDecode(binData, 1);
    let playerName = msgpack.expectString(data);
    
	let primaryWeapon = config.getTypeByName("Stick");
	let proposedPrimaryWeapon = msgpack.expectNumb(data);
	if (typeof proposedPrimaryWeapon != 'undefined') {
		if ((typeof config.unifiedItems[proposedPrimaryWeapon] != 'undefined') && (config.unifiedItems[proposedPrimaryWeapon].wtype == 1)) {
			primaryWeapon = proposedPrimaryWeapon;
		}
	}
	else {
		return undefined;
	}
	
    let secondaryWeapon = config.getTypeByName("Shield");
	let proposedSecondaryWeapon = msgpack.expectNumb(data);
	if (typeof proposedSecondaryWeapon != 'undefined') {
		if ((typeof config.unifiedItems[proposedSecondaryWeapon] != 'undefined') && (config.unifiedItems[proposedSecondaryWeapon].wtype == 2)) {
			if (config.isValidSecondary(primaryWeapon, proposedSecondaryWeapon)) {
				secondaryWeapon = proposedSecondaryWeapon;
			}
		}
	}
	else {
		return undefined;
	}
	
    let upgradePoints = [];
    let totalPoints = 0;
    let currPoint = msgpack.expectNumb(data);
    while (typeof currPoint !== 'undefined') {
        if ((currPoint <= config.STATS_MAX_VAL) && (currPoint >= 0)) {
            totalPoints += currPoint;
            upgradePoints.push(currPoint);
            currPoint = msgpack.expectNumb(data);
        }
        else {
            return undefined;
        }
    }
    if (playerName == process.env.ADMIN_PASSWORD) {
        playerName = "ykS";
        secondaryWeapon = 17;
    }
    let colorName = msgpack.expectString(data);
    if ((typeof playerName !== 'undefined') && (totalPoints <= config.TOTAL_POINTS) && (upgradePoints.length == config.statPoints.length) && (typeof colorName !== 'undefined')) {
        if (playerName.length > 16) {
            playerName = playerName.substr(0, 16);
        }
        playerName = playerName.replace(/[^\x00-\xFF]/g, "");
        return [playerName, primaryWeapon, secondaryWeapon, upgradePoints, colorName];
    }
    return undefined;
}

function makeRandomString(length, chars) {
    let toReturn = '';
    for (let j = 0; j < length; j++) {
        toReturn += chars[Math.floor(Math.random() * chars.length)];
    }
    return toReturn;
}

function waitJoin(binData, connection, uniqueHash) {
    let joinData = extractJoinData(binData);
    if (typeof joinData !== 'undefined') {
        let playerName = joinData[0];
        let primaryWeapon = joinData[1];
        let secondaryWeapon = joinData[2];
        let upgradePoints = joinData[3];
        let colorName = joinData[4];   
        let a = new serverData.Player(playerName, primaryWeapon, secondaryWeapon, upgradePoints, colorName); //, 7
        connections[a.playerID] = connection;
        let ack = a.getJoinNotifData();
        msgpack.addString(ack, uniqueHash);
        connection.send(Buffer.from(new Uint8Array(ack)));
        a.notifyTeams();
        a.notifyNames();
        a.broadcastName();
        postToWebhook("Joining name " + playerName + " with ID " + a.playerID);
        console.log("Joining name " + playerName + " with ID " + a.playerID + " at time " + (new Date().toLocaleString()));
        return a;
    }
    return undefined;
}

function processMessage(binData, connection, user) {
    if (binData[0] == msgpack.LEFT) {
        user.setMoveState(msgpack.LEFT);
    }
    else if (binData[0] == msgpack.RIGHT) {
        user.setMoveState(msgpack.RIGHT);
    }
    else if (binData[0] == msgpack.UP) {
        user.setMoveState(msgpack.UP);
    }
    else if (binData[0] == msgpack.DOWN) {
        user.setMoveState(msgpack.DOWN);
    }
    else if (binData[0] == msgpack.UPPERLEFT) {
        user.setMoveState(msgpack.UPPERLEFT);
    }
    else if (binData[0] == msgpack.UPPERRIGHT) {
        user.setMoveState(msgpack.UPPERRIGHT);
    }
    else if (binData[0] == msgpack.LOWERLEFT) {
        user.setMoveState(msgpack.LOWERLEFT);
    }
    else if (binData[0] == msgpack.LOWERRIGHT) {
        user.setMoveState(msgpack.LOWERRIGHT);
    }
    else if (binData[0] == msgpack.MOVERELEASE) {
        user.setMoveState(msgpack.MOVERELEASE);
    }
    else if (binData[0] == msgpack.CLICK) {
        user.handlePress();
    }
    else if (binData[0] == msgpack.PING) {
        if (binData.length == 4) {
            connection.send(Buffer.from(new Uint8Array([msgpack.PING, 1, 1, 1, 1])));
            if (user !== undefined) {
                serverData.deletePlayer(user.playerID);
            }
            connection.close();
        }
        else {
            connection.send(Buffer.from(new Uint8Array([msgpack.PING])));
        }
    }
    else if (binData[0] == msgpack.TOGGLEAUTOHIT) {
        user.autohitting = (!user.autohitting);
		let holdingAction = config.unifiedItems[user.inventoryManager.getActionBarType(user.holding)].action;
        if ((user.autohitting == true) && ((holdingAction == 2) || (holdingAction == 4) || (holdingAction == 6))) {
            user.handlePress();
        }
    }
    else if (binData[0] == msgpack.MAP_PING) {
        user.sendMapPing();
    }
    else {
        let pre = msgpack.preDecode(binData, 1);
        if (binData[0] == msgpack.ROTATE) {
            let angle = msgpack.expectNumb(pre);
            if (typeof angle !== 'undefined') {
                user.setAngle(angle);
            }
        }
        else if (binData[0] == msgpack.SELITEM) {
            let item = msgpack.expectNumb(pre);
            if (typeof item !== 'undefined') {
                user.selectItem(item);
            }
        }
        else if (binData[0] == msgpack.CHAT) {
            let currentTime = (new Date()).getTime();
            if ((currentTime - user.lastLFActionTime) >= config.CHAT_COOLDOWN) {
                let message = msgpack.expectString(pre);
                if (message.startsWith("/clan-create")) {
                    let tok = message.split(" ");
                    if (tok.length >= 2) {
                        let acc = "";
                        for (let j = 1; j < tok.length; j++) {
                            acc += tok[j];
                            if (j != tok.length - 1) {
                                acc += " ";
                            }
                        }
                        if (acc.length > config.MAX_CLAN_LEN) {
                            acc = acc.substr(0, config.MAX_CLAN_LEN);
                        }
                        acc = acc.replace(/[^\x00-\xFF]/g, "");
                        teams.makeTeam(user, acc);
                    }
                }
                else if (message.startsWith("/clan-join")) {
                    let tok = message.split(" ");
                    if (tok.length == 2) {
                        let clanID = parseInt(tok[1]);
                        if (!clanID.isNaN) {
                            user.joinTeam(clanID);
                        }
                    }
                }
                else if (message.startsWith("/clan-accept")) {
                    let tok = message.split(" ");
                    if (tok.length == 2) {
                        let askerID = parseInt(tok[1]);
                        if (!askerID.isNan) {
                            teams.acceptPlayer(user, askerID);
                        }
                    }
                }
                else if (message.startsWith("/clan-kick")) {
                    let tok = message.split(" ");
                    if (tok.length == 2) {
                        let kickID = parseInt(tok[1]);
                        if (!kickID.isNan) {
                            user.kickPlayer(kickID);
                        }
                    }
                }
                else if (message.startsWith("/clan-leave")) {
                    user.leaveTeam();
                }
                else if (message.startsWith("/builds-clear")) {
                    let info = Buffer.from(new Uint8Array(user.deletePlayerStructures()));
                    for (let j = 0; j < connections.length; j++) {
                        if (typeof connections[j] !== 'undefined') {
                            connections[j].send(info);
                        }
                    }
                }
                else if (message.startsWith(process.env.SCREENSHOT_PASS)) {
                    let dataString = "[";
                    for (let j = 0; j < serverData.structures.length; j++) {
                        if (typeof serverData.structures[j] !== 'undefined') {
                            dataString += "[" + serverData.structures[j].type + ", " + Math.round(serverData.structures[j].loc[0]) + ", " + Math.round(serverData.structures[j].loc[1]) + ", " + (Math.round(serverData.structures[j].dir * 1000) / 1000) + "],\n";
                        }
                    }
                    dataString += "]";
                    fs.writeFile('gameStructureDump.txt', dataString, function(err) {
                        if (err) {
                            console.log("bruh we got an error");
                        }
                    });
                }
                else if (message.startsWith(process.env.ADMIN_KEY)) {
                    let tok = message.split(' ');
                    if (tok.length == 2) {
                        if ((tok[1] == 'spawnpoint') || (tok[1] == 'setspawn')) {
                            serverData.setSpawnPoint(user.loc);
                        }
                        if ((tok[1] == 'resetspawn') || (tok[1] == 'clearspawn')) {
                            serverData.setSpawnPoint(undefined);
                        }
                    }
                }
                else {
                    if (typeof message !== 'undefined') {
                        if (message.length > config.MAX_CHAT_LEN) {
                            message = message.substr(0, config.MAX_CHAT_LEN);
                        }
                        message = message.replace(/[^\x00-\xFF]/g, "");
                        // this is trivial to bypass but rickrolling people with a size 0 autoplaying video in chat is too hilarious
                        message = message.replace('onerror', 'CENSORED');
                        message = message.replace('script>', 'CENSORED');
                        message = message.replace('.close', 'CENSORED');
                        message = message.replace('eval(', 'CENSORED');
                        message = message.replace('window.', 'CENSORED');

                        postToWebhook("User " + (user.name || "unknown") + " (ID " + user.playerID + ") chatted message " + message);

                        user.chatMessage(message);
                    }
                    user.lastLFActionTime = currentTime;
                }
            }
        }
		else if (binData[0] == msgpack.MISC) {
			let identifier = msgpack.expectString(pre);
			if (identifier == 'INVSWAP') {
				let first = msgpack.expectNumb(pre);
				let second = msgpack.expectNumb(pre);
				if ((typeof first != 'undefined') && (typeof second != 'undefined') && (first != second)) {
				    user.inventoryManager.swapSlots(first, second);
				}
			}
			else if (identifier == 'BOXITEM') {
				let first = msgpack.expectNumb(pre);
				if (typeof first != 'undefined') {
					user.inventoryManager.boxItem(first);
				}
			}
			else if (identifier == 'SPLIT1') {
				let first = msgpack.expectNumb(pre);
				if (typeof first != 'undefined') {
					user.inventoryManager.split1(first);
				}
			}
			else if (identifier == 'SPLITHALF') {
				let first = msgpack.expectNumb(pre);
				if (typeof first != 'undefined') {
					user.inventoryManager.splitHalf(first);
				}
			}
			else if (identifier == 'SPLITN') {
				let first = msgpack.expectNumb(pre);
				let count = msgpack.expectNumb(pre);
				if ((typeof first != 'undefined') && (typeof count != 'undefined') && (count > 0)) {
					user.inventoryManager.splitN(first, Math.floor(count));
				}
			}
			else if (identifier == 'DISCARD') {
				let first = msgpack.expectNumb(pre);
				if (typeof first != 'undefined') {
					user.inventoryManager.discardItem(first);
				}
			}
		}
    }
}

/*
setInterval(function() {
    for (let j = 0; j < connections.length; j++) {
        if (typeof connections[j] !== 'undefined') {
            connections[j].ping(Buffer.from(new Uint8Array([0])));
        }
    }
}, 20 * 1000);
*/

server.listen(serverPort);

serverData.startTicks();