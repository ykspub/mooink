var msgpack = window.msgpack;
var config = window.config;

window.actionBarSlots = [];
window.inventorySlots = [];
window.holdingSelectorIndex = 0;
window.damageTexts = [];

function Structure(infoID, infoType, infoX, infoY, infoDir, infoOwner) {
	this.infoID = infoID;
	this.infoType = infoType;
	this.infoX = infoX;
	this.infoY = infoY;
	this.infoDir = infoDir;
	this.infoOwner = infoOwner;
	this.infoCraftTime = undefined;
	this.infoCraftStart = undefined;
}

function DamageText(infoX, infoY, infoDmg, infoType) {
    this.infoX = infoX;
    this.infoY = infoY;
    this.infoDmg = infoDmg;
    this.infoType = infoType;
    this.infoStart = Date.now();
}

window.mainHandler = function(e) {
    let data = new Uint8Array(e.data);
    if (data.length != 0) {
        recieved.data = data;
        recieved.start = 1;
        if (data[0] == msgpack.PLAYER_UPDATE_DELIM) {
            let newVisiblePlayers = [];

            let currTime = window.performance.now();
            let infoID = msgpack.expectNumb(recieved);
            let infoX = msgpack.expectNumb(recieved);
            let infoY = msgpack.expectNumb(recieved);
            //let infovX = msgpack.expectPosNegNumb(recieved);
            //let infovY = msgpack.expectPosNegNumb(recieved);
            let infovX = 0;
			let infovY = 0;
			let infodir = msgpack.expectNumb(recieved);
            let infoholding = msgpack.expectNumb(recieved);
            let infohealth = msgpack.expectNumb(recieved);
            let infohitting = msgpack.expectHit(recieved);
            while (infoID !== undefined) {
                if (infoID == playerID) {
                    let willUpdateHUD = false;
					
					window.serverDeltaX = infoX - window.projectedX;
					window.serverDeltaY = infoY - window.projectedY;
					window.oldProjectedX = projectedX;
					window.oldProjectedY = projectedY;
					window.velX = config.JITTER_SMOOTH_FACTOR * window.velX + (1 - config.JITTER_SMOOTH_FACTOR) * infovX;
					window.velY = config.JITTER_SMOOTH_FACTOR * window.velY + (1 - config.JITTER_SMOOTH_FACTOR) * infovY;
					
                    if (infoholding != holding) {
                        window.holding = infoholding;
                        willUpdateHUD = true;
                    }

                    if (infohealth != health) {
                        let toInsert = new DamageText(infoX, infoY + window.config.PLAYER_RADIUS, Math.abs(health - infohealth), (infohealth < health) ? "bad" : "good");
                        let found = false;
                        for (let j = 0; j < window.damageTexts.length; j++) {
                            if (typeof window.damageTexts[j] == 'undefined') {
                                window.damageTexts[j] = toInsert;
                                found = true;
                            }
                        }
                        if (!found) {
                            window.damageTexts.push(toInsert);
                        }
                    }
                    health = infohealth;

                    lastUpdate = currTime;
                    if (infohitting == true) {
                        hitting = lastUpdate;
                        let hitID = msgpack.expectNumb(recieved);
                        while (hitID !== undefined) {
                            hitObjects[hitID] = currTime;
                            hitID = msgpack.expectNumb(recieved);
                        }
                        let hitClose = msgpack.expectHit(recieved);
                    }
					
                    let infoSelectorIndex = msgpack.expectNumb(recieved);
                    if (window.holdingSelectorIndex != infoSelectorIndex) {
                        window.holdingSelectorIndex = infoSelectorIndex;
                        willUpdateHUD = true;
                    }
					if (willUpdateHUD == true) {
                        window.updateStrucDiv();
                    }
                }
                else {
                    if (
						(window.players[infoID] === undefined) || 
						(!window.visiblePlayers.includes(infoID))
					) {
                        window.players[infoID] = [infoID, infoX, infoY, infovX, infovY, infodir, infoholding, infohealth, infoX, infoY, 0, 0];
                    }
                    else {
                        let p = window.players[infoID];
                        p[8] = p[1];
                        p[9] = p[2];
                        p[10] = infoX - p[1];
                        p[11] = infoY - p[2]; 
                        p[0] = infoID;
                        p[1] = infoX;
                        p[2] = infoY;
                        p[3] = infovX;
                        p[4] = infovY;
                        p[5] = infodir;
                        p[6] = infoholding;

                        if (infohealth < p[7]) {
                            let damageStatusType = ((typeof window.playerAllegiances[playerID] != 'undefined') && (window.playerAllegiances[playerID] == window.playerAllegiances[infoID])) ? "bad" : "neutral";
                            let toInsert = new DamageText(infoX, infoY + window.config.PLAYER_RADIUS, p[7] - infohealth, damageStatusType);
                            let found = false;
                            for (let j = 0; j < window.damageTexts.length; j++) {
                                if (typeof window.damageTexts[j] == 'undefined') {
                                    window.damageTexts[j] = toInsert;
                                    found = true;
                                }
                            }
                            if (!found) {
                                window.damageTexts.push(toInsert);
                            }
                        }

                        p[7] = infohealth;
                    }
                    newVisiblePlayers.push(infoID);
                    if (infohitting == true) {
                        window.hitTimes[infoID] = currTime;
                        let hitID = msgpack.expectNumb(recieved);
                        while (hitID !== undefined) {
                            hitObjects[hitID] = currTime;
                            hitID = msgpack.expectNumb(recieved);
                        }
                        let hitClose = msgpack.expectHit(recieved);
                    }
					
					let throwAway = msgpack.expectNumb(recieved);
                }
                infoID = msgpack.expectNumb(recieved);
                infoX = msgpack.expectNumb(recieved);
                infoY = msgpack.expectNumb(recieved);
                //infovX = msgpack.expectPosNegNumb(recieved);
                //infovY = msgpack.expectPosNegNumb(recieved);
                infovX = 0;
				infovY = 0;
				infodir = msgpack.expectNumb(recieved);
                infoholding = msgpack.expectNumb(recieved);
                infohealth = msgpack.expectNumb(recieved);
                infohitting = msgpack.expectHit(recieved);
            }

            window.visiblePlayers = newVisiblePlayers;

            if ((window.frameFullOcclude == true) && (window.oldFrameOcclude == false)) {
                window.oldFrameOcclude = true;
                window.occludeSwitchTime = currTime;
                window.occludeCutoffCounter = 0;
            }
            if (window.frameFullOcclude == false) {
                window.occludeCutoffCounter += 1;
                if (window.occludeCutoffCounter >= 3) {
                    window.occludeSwitchTime = undefined;
                    window.occludeCutoffCounter = 0;
                    window.oldFrameOcclude = false;
                }
            }
            window.frameFullOcclude = false;
        }
        else if (data[0] == msgpack.PLAYER_DESTROY_DELIM) {
            let infoID = msgpack.expectNumb(recieved);
            if (window.players[infoID] !== undefined) {
                window.playerNames[infoID] = undefined;
            }
            if (infoID == playerID) {
                window.rotationLocked = true;
                window.players = [];
                //window.structures = [];
                //structureCounts = [];
                window.bullets = [];
                //window.playerNames = [];
                window.playerColors = []
                window.playerAllegiances = [];
                kills = 0;
                window.hideGameUI();
                //window.ws.removeEventListener('message', mainHandler);
                window.ws.addEventListener('message', waitJoin);
                window.processTeamMenu();
            }
        }
        else if (data[0] == msgpack.STRUCTURE_DELIM) {
            let infoID = msgpack.expectNumb(recieved);
            let infoType = msgpack.expectNumb(recieved);
            let infoX = msgpack.expectNumb(recieved);
            let infoY = msgpack.expectNumb(recieved);
            let infoDir = msgpack.expectNumb(recieved);
            let infoOwner = msgpack.expectNumb(recieved);
            while (typeof infoID !== 'undefined') {
                if (infoOwner == playerID) {
                    window.incrementStruc(infoType);
                    if (infoType == 16) {
                        if (countdownTimer !== undefined) {
                            countdownTimer = undefined;
                        }
                    }
                }
                window.structures[infoID] = new Structure(infoID, infoType, infoX, infoY, infoDir, infoOwner);
				
				let specialCode = msgpack.expectString(recieved);
				if ((typeof specialCode  != 'undefined') && (specialCode  == "BOX")) {
					let item = msgpack.expectNumb(recieved);
					let qty = msgpack.expectNumb(recieved);
					if ((typeof item != 'undefined') && (typeof qty != 'undefined')) {
						window.structures[infoID].boxItem = item;
						window.structures[infoID].boxQty = qty;
					}
				}
				
				if ((typeof specialCode != 'undefined') && (specialCode == "CRAFTWAIT")) {
					let craftTime = msgpack.expectNumb(recieved);
					window.structures[infoID].infoCraftTime = craftTime * 1000;
					window.structures[infoID].infoCraftStart = window.performance.now();
				}
				
                infoID = msgpack.expectNumb(recieved);
                infoType = msgpack.expectNumb(recieved);
                infoX = msgpack.expectNumb(recieved);
                infoY = msgpack.expectNumb(recieved);
                infoDir = msgpack.expectNumb(recieved);
                infoOwner = msgpack.expectNumb(recieved);
            }
        }
        else if (data[0] == msgpack.BULLET_DELIM) {
            let infoID = msgpack.expectNumb(recieved);
            let infoX = msgpack.expectNumb(recieved);
            let infoY = msgpack.expectNumb(recieved);
            let infovX = msgpack.expectPosNegNumb(recieved);
            let infovY = msgpack.expectPosNegNumb(recieved);
            let infoType = msgpack.expectNumb(recieved);
            if (infoID !== undefined) {
                window.bullets[infoID] = [window.performance.now(), infoID, infoX, infoY, infovX, infovY, infoType];
            }
        }
        else if (data[0] == msgpack.BULLET_DESTROY_DELIM) {
            let infoID = msgpack.expectNumb(recieved);
            if (infoID !== undefined) {
                window.bullets[infoID] = undefined;
            }
        }
        else if (data[0] == msgpack.STRUCTURE_DESTROY_DELIM) {
            let infoID = msgpack.expectNumb(recieved);
            while (infoID !== undefined) {
                if (window.structures[infoID] !== undefined) {
                    if (window.structures[infoID].infoOwner == playerID) {
                        window.decrementStruc(window.structures[infoID].infoType);
                    }
                    window.structures[infoID] = undefined;
                }
                infoID = msgpack.expectNumb(recieved);
            }
        }
        else if (data[0] == msgpack.PLAYER_NAME_UPDATE) {
            let infoID = msgpack.expectNumb(recieved);
            let infoName = msgpack.expectString(recieved);
            let infoColor = msgpack.expectNumb(recieved);
            let infoTeam = msgpack.expectNumb(recieved);
            if (infoID !== undefined) {
                if (infoTeam !== undefined) {
                    window.playerAllegiances[infoID] = infoTeam;
                    window.playerNames[infoID] = "[" + window.clans[infoTeam][0] + "] " + infoName;
                }
                else {
                    window.playerNames[infoID] = infoName;
                    window.playerAllegiances[infoID] = undefined;
                }
                if (infoColor == undefined) {
                    window.playerColors[infoID] = 0;
                }
                else {
                    window.playerColors[infoID] = infoColor;
                }
                window.processTeamMenu();
            }
        }
        else if (data[0] == msgpack.CLAN_DESTROY_DELIM) {
            let infoTeam = msgpack.expectNumb(recieved);
            if (infoTeam !== undefined) {
                window.clans[infoTeam] = undefined;
                window.processTeamMenu();
            }
        }
        else if (data[0] == msgpack.PING) {
            if (data.length == 5) {
                document.getElementById('disconnected').innerText = "Disconnected: Server limit of 1 connection per IP address";
                window.ws.close();
            }
            else {
                let elapsed = window.performance.now() - lastPing;
                ping = elapsed;
                window.updateStrucDiv();
            }
        }
        else if (data[0] == msgpack.CHAT) {
            let infoID = msgpack.expectNumb(recieved);
            let infoMsg = msgpack.expectString(recieved);
            if ((infoID !== undefined) && 
                (infoMsg !== undefined)) {
                let name = window.playerNames[infoID]; 
                name += " [" + infoID + "]";
                let chatDiv = document.createElement('div');
                chatDiv.classList.add('chatEntryDiv');
                chatDiv.innerHTML = name + ": " + infoMsg + "<br>"; // haha xss go brr
                document.getElementById('chatDisplay').prepend(chatDiv);
            }
        }
        else if (data[0] == msgpack.NEW_CLAN_DELIM) {
            let infoID = msgpack.expectNumb(recieved);
            let infoName = msgpack.expectString(recieved);
            let infoOwner = msgpack.expectNumb(recieved);
            while (typeof infoID !== 'undefined') {
                window.clans[infoID] = [infoName, infoOwner];
                infoID = msgpack.expectNumb(recieved);
                infoName = msgpack.expectString(recieved);
                infoOwner = msgpack.expectNumb(recieved);
                window.processTeamMenu();
            }
        }
        else if (data[0] == msgpack.CLAN_REQUEST_DELIM) {
            let infoID = msgpack.expectNumb(recieved);
            if (typeof infoID !== 'undefined') {
                let name = window.playerNames[infoID];
                let requestDiv = document.createElement("div");
                requestDiv.innerText = "Click to accept player " + name + " (ID " + infoID + ")";
                requestDiv.style.color = "#FF0000";
                requestDiv.classList.add('chatEntryDiv');
                requestDiv.addEventListener('click', function() {
                    window.ws.send(new Uint8Array(msgpack.addString([msgpack.CHAT], '/clan-accept ' + infoID)));
                    requestDiv.innerText = "Player " + name + " (ID " + infoID + ") was accepted";
                });
                let lineBreak = document.createElement("br");
                chatDisplay.prepend(lineBreak);
                chatDisplay.prepend(requestDiv);
                //chatDisplay.innerText = "Sys> Player " + infoID + " (" + name + ") wants to join\n" + chatDisplay.innerText;
            }
        }
        else if (data[0] == msgpack.LEADERBOARD_UPDATE_DELIM) {
            let infoID = msgpack.expectNumb(recieved);
            let infoScore = msgpack.expectNumb(recieved);
            let leaderboardText = "";
            while (infoID !== undefined) {
                leaderboardText = window.playerNames[infoID] + " [" + infoID + "]: " + infoScore + " kp\n" + leaderboardText;
                infoID = msgpack.expectNumb(recieved);
                infoScore = msgpack.expectNumb(recieved);
            }
            leaderboardText = "Leaderboard:\n" + leaderboardText;
            document.getElementById('leaderboard').innerText = leaderboardText;
        }
        else if (data[0] == msgpack.SCORE_UPDATE_DELIM) {
            let infoKills = msgpack.expectNumb(recieved);
            kills = infoKills;
            window.updateStrucDiv();
        }
        else if (data[0] == msgpack.TEAM_LOCATION_DELIM) {
            minimaprenderCounter = 0;
            let shouldPing = msgpack.expectPing(recieved);
            if (shouldPing == true) {
                beginMinimapUpdate(true);
            }
            else {
                beginMinimapUpdate(false);
            }
            let infoID = msgpack.expectNumb(recieved);
            shouldPing = msgpack.expectPing(recieved);
            let infoX = msgpack.expectNumb(recieved);
            let infoY = msgpack.expectNumb(recieved);
            let processedIndex = 0;
            let wasPinging = false;
            minictx.fillStyle = '#0000FF';
            while (infoID !== undefined) {
                let fillRadius = 4;
                if (processedIndex == 1) {
                    minictx.fillStyle = '#FFFFFF';
                }
                if (shouldPing == true) {
                    minictx.fillStyle = '#FF0000';
                    fillRadius = 7;
                    wasPinging = true;
                }
                else if (wasPinging == true) {
                    wasPinging = false;
                    minictx.fillStyle = '#FFFFFF';
                }
                if (infoID !== playerID) {
                    minictx.beginPath();
                    minictx.arc(infoX * (minimapCanvas.width / config.MAP_X), minimapCanvas.height - infoY * (minimapCanvas.height / config.MAP_Y), fillRadius, 0, 2 * Math.PI);
                    minictx.fill();
                }
                infoID = msgpack.expectNumb(recieved);
                shouldPing = msgpack.expectPing(recieved);
                infoX = msgpack.expectNumb(recieved);
                infoY = msgpack.expectNumb(recieved);
                processedIndex += 1;
            }
        }
		else if (data[0] == msgpack.MISC) {
			let identifier = msgpack.expectString(recieved);
			if (identifier == 'INVUPDATE') {
				expectItemDetails(recieved);
                window.updateStrucDiv();
			}
			else if (identifier == 'CRAFTWAIT') {
				let crafterID = msgpack.expectNumb(recieved);
				let craftTime = msgpack.expectNumb(recieved);
				if (typeof window.structures[crafterID] != 'undefined') {
					window.structures[crafterID].infoCraftTime = craftTime * 1000;
					window.structures[crafterID].infoCraftStart = window.performance.now();
				}
			}
		}
    }
}

function expectItemDetails(recieved) {
	let actionBarLength = msgpack.expectArray(recieved);
	window.actionBarSlots = [];
	for (let j = 0; j < actionBarLength; j++) {
		let itemInfo = window.inventoryManager.expectItem(recieved);
		window.actionBarSlots.push(itemInfo);
	}
	window.populateSelectBarImages();
	
	let inventoryLength = msgpack.expectArray(recieved);
	window.inventorySlots = [];
	for (let j = 0; j < inventoryLength; j++) {
		let itemInfo = window.inventoryManager.expectItem(recieved);
		window.inventorySlots.push(itemInfo);
	}
	window.processInventory();
}

window.waitJoin = function(e) {
    let data = new Uint8Array(e.data);
    if (data.length != 0) {
        recieved.data = data;
        recieved.start = 1;
        if (data[0] == msgpack.JOIN) {
            let theID = msgpack.expectNumb(recieved);
            let vScale = msgpack.expectNumb(recieved);
            let infoX = msgpack.expectNumb(recieved);
            let infoY = msgpack.expectNumb(recieved);
            let infoColor = msgpack.expectNumb(recieved);
            let infoCountdown = msgpack.expectNumb(recieved);
			
			expectItemDetails(recieved);
			
            let infoRecon = msgpack.expectString(recieved);

            if (infoColor == undefined) {
                myColor = 0;
            }
            else {
                myColor = infoColor;
            }
            if (infoCountdown == 1) {
                countdownTimer = window.performance.now();
            }
            else {
                countdownTimer = undefined;
            }
            playerID = theID;
            
            if (reconnectID == undefined) {
                reconnectID = infoRecon;
            }

            VIEW_X = config.VIEW_X * vScale;
            VIEW_Y = config.VIEW_Y * vScale;
            HVIEW_X = VIEW_X/2;
            HVIEW_Y = VIEW_Y/2;
            projectedX = infoX;
            projectedY = infoY;
            window.oldProjectedX = infoX;
            window.oldProjectedY = infoY;
            lastUpdate = window.performance.now();
            window.serverDeltaX = 0;
            window.serverDeltaY = 0;
            window.ws.removeEventListener('message', waitJoin);
            window.ws.addEventListener('message', window.mainHandler);
            window.configCanvas();
            window.checkPing();
            window.drawLeaderboardBacker(theID);
        }
    }
}