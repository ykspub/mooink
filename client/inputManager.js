var chatting = false;
var lastTouchStart = undefined;

function handleChat() {
	let chatBox = document.getElementById('chatBox');
	if (chatBox.style.display == 'none') {
		chatBox.style.display = 'initial';
		chatBox.focus();
		chatting = true;
	}
	else {
		if (chatBox.value != "") {
			if (chatBox.value == "/chat-clear") {
				document.getElementById('chatDisplay').innerHTML = "";
			}
			else if (chatBox.value == "/clan-list") {
				let chatDisplay = document.getElementById('chatDisplay');
				let toPrepend = "Sys> Clans: \n";
				for (let j = 0; j < window.clans.length; j++) {
					if (typeof window.clans[j] !== 'undefined') {
						toPrepend += "Sys> [" + j + "]: " + window.clans[j][0] + "\n";
					}
				}
				let newP = document.createElement("div");
				newP.innerText = toPrepend;
				chatDisplay.prepend(newP);
				//chatDisplay.innerText = toPrepend + chatDisplay.innerText;
			}
			else {
				let text = chatBox.value;
				if (text.length > config.MAX_CHAT_LEN) {
					window.ws.send(new Uint8Array(msgpack.addString([msgpack.CHAT], text.substring(0, config.MAX_CHAT_LEN))));
				}
				else {
					window.ws.send(new Uint8Array(msgpack.addString([msgpack.CHAT], text)));
				}
			}
		}
		chatBox.style.display = 'none';
		chatBox.value = "";
		chatting = false;
	}
}

if (!window.initElement) {
	window.initElement = (function(type, classes) {
		let toReturn = document.createElement(type);
		if (classes) {
			for (let j = 0; j < classes.length; j++) {
				toReturn.classList.add(classes[j]);
			}
		}
		return toReturn;
	});
}

function ignoreEvent(e) {
	e.stopPropagation();
}

window.addEventListener('load', function() {
    var config = window.config;
    var msgpack = window.msgpack;

    const gCanvas = document.getElementById('GameCanvas');
    var keysPressed = [];
    var tempDirection = 0;

	var autohitSendState = 0;

    var up = false;
    var down = false;
    var left = false;
    var right = false;
    window.rotationLocked = true;

    window.touchRotateCoords = undefined;
    window.touchMoveCoords = undefined;

    //var leaderboardTapped = window.performance.now();
    var minimapTapped = window.performance.now();

    var sendDir = false;

    const toggleAutoHitArr = new Uint8Array([msgpack.TOGGLEAUTOHIT]);
    const clickArr = new Uint8Array([msgpack.CLICK]);
    const ulArr = new Uint8Array([msgpack.UPPERLEFT]);
    const llArr = new Uint8Array([msgpack.LOWERLEFT]);
    const urArr = new Uint8Array([msgpack.UPPERRIGHT]);
    const lrArr = new Uint8Array([msgpack.LOWERRIGHT]);
    const lArr = new Uint8Array([msgpack.LEFT]);
    const rArr = new Uint8Array([msgpack.RIGHT]);
    const uArr = new Uint8Array([msgpack.UP]);
    const dArr = new Uint8Array([msgpack.DOWN]);
    const releaseArr = new Uint8Array([msgpack.MOVERELEASE]);

    function touchMoveHandler(e) {
        e.preventDefault();
        e.stopPropagation();
        var changedTouches = e.changedTouches;
        if (changedTouches.length <= 2) {
            for (let j = 0; j < changedTouches.length; j++) {
                if (changedTouches[j].pageX < window.REFX) {
                    let theta = Math.atan2(changedTouches[j].pageX - window.touchMoveCoords[0], window.touchMoveCoords[1] - changedTouches[j].pageY) * 180 / Math.PI;
                    let MOVE_SNAP = 22.5;
                    up = false;
                    down = false;
                    right = false;
                    left = false;
                    if ((theta <= (90 - MOVE_SNAP)) && (theta >= (MOVE_SNAP - 90))) {
                        up = true;
                    }
                    if ((theta >= (90 + MOVE_SNAP)) || (theta <= (-90 - MOVE_SNAP))) {
                        down = true;
                    }
                    if ((theta >= MOVE_SNAP) && (theta <= (180 - MOVE_SNAP))) {
                        right = true;
                    }
                    if ((theta <= -MOVE_SNAP) && (theta >= (-180 + MOVE_SNAP))) {
                        left = true;
                    }
                    updateKeys();
                }
                else {
                    let theta = Math.atan2(changedTouches[j].pageX - window.touchRotateCoords[0], window.touchRotateCoords[1] - changedTouches[j].pageY);
                    window.direction = theta;
                    sendDir = true;
                }
            }
        }
    }

    function touchStartHandler(e) {
        e.preventDefault();
        e.stopPropagation();
        var changedTouches = e.changedTouches;
        for (let j = 0; j < changedTouches.length; j++) {
            if (changedTouches[j].pageX < window.REFX) {
                if (typeof window.touchMoveCoords === 'undefined') {
                    window.touchMoveCoords = [changedTouches[j].pageX, changedTouches[j].pageY];
                }
            }
            else {
                if (typeof window.touchRotateCoords === 'undefined') {
                    window.touchRotateCoords = [changedTouches[j].pageX, changedTouches[j].pageY];
                    window.ws.send(toggleAutoHitArr);
                }
            }
        }
    }
    function touchEndHandler(e) {
        e.preventDefault();
        e.stopPropagation();
        let changedTouches = e.changedTouches;
        for (let j = 0; j < changedTouches.length; j++) {
            if (changedTouches[j].pageX < window.REFX) {
                window.touchMoveCoords = undefined;
                up = false;
                down = false;
                right = false;
                left = false;
                updateKeys();
            }
            else {
                window.touchRotateCoords = undefined;
                if (sendDir == true) {
                    let a = msgpack.addFloat([msgpack.ROTATE], window.direction);
                    window.ws.send(new Uint8Array(a));
                    sendDir = false;
                }
                window.ws.send(toggleAutoHitArr);
                window.ws.send(clickArr);
            }
        }
    }

    window.addEventListener('mousemove', function(e) {
        if (window.rotationLocked == false) {
            window.direction = Math.atan2(e.clientX - window.REFX, window.REFY - e.clientY);
            sendDir = true;
        }
        else {
            tempDirection = Math.atan2(e.clientX - window.REFX, window.REFY - e.clientY);
        }
    });

    window.addEventListener('mousedown', function(e) {
		autohitSendState = 1;
        if (sendDir == true) {
            let a = msgpack.addFloat([msgpack.ROTATE], window.direction);
            window.ws.send(new Uint8Array(a));
            sendDir = false;
        }
        window.ws.send(clickArr);
		setTimeout(function() {
			if (autohitSendState == 1) {
                window.ws.send(toggleAutoHitArr);
				autohitSendState = 2;
			}
		}, 250);
    });

    window.addEventListener('mouseup', function(e) {
		if (autohitSendState == 2) {
            window.ws.send(toggleAutoHitArr);
		}
		autohitSendState = 0;
    });

    function updateKeys() {
        if ((typeof ws !== 'undefined') && (ws.readyState === WebSocket.OPEN)) {
            if (up && left) {
                window.ws.send(ulArr);
            }
            else if (down && left) {
                window.ws.send(llArr);
            }
            else if (up && right) {
                window.ws.send(urArr);
            }
            else if (down && right) {
                window.ws.send(lrArr);
            }
            else if (left) {
                window.ws.send(lArr);
            }
            else if (right) {
                window.ws.send(rArr);
            }
            else if (up) {
                window.ws.send(uArr);
            }
            else if (down) {
                window.ws.send(dArr);
            }
            else {
                window.ws.send(releaseArr);
            }
        }
    }
    function keyupHandler(e) {
        if (keysPressed[e.keyCode] == true) {
            keysPressed[e.keyCode] = false;
            if (e.keyCode == 37 || e.keyCode == 65) {
                left = false;
            }
            else if (e.keyCode == 39 || e.keyCode == 68) {
                right = false;
            }
            else if (e.keyCode == 38 || e.keyCode == 87) {
                up = false;
            }
            else if (e.keyCode == 40 || e.keyCode == 83) {
                down = false;
            }
            updateKeys();
        }
    }
    document.addEventListener('keyup', keyupHandler);
    
    function keydownHandler(e) {
        if (keysPressed[e.keyCode] != true) {
            keysPressed[e.keyCode] = true;
            if (e.key == 'Enter') {
                handleChat();
            }
            else if (chatting == false) {
                if ((e.key == '1') || (e.key == '2') || (e.key == '3') || (e.key == '4') || (e.key == '5') || (e.key == '6') || (e.key == '7') || (e.key == '8') || (e.key == '9')) {
                    window.ws.send(new Uint8Array(msgpack.addNumb([msgpack.SELITEM], parseInt(e.key))));
                }
                else if ((e.key == 'e') || (e.key == 'E')) {
                    window.ws.send(toggleAutoHitArr);
                }
                else if (e.keyCode == 32) {
                    if (sendDir == true) {
                        let a = msgpack.addFloat([msgpack.ROTATE], window.direction);
                        window.ws.send(new Uint8Array(a));
                        sendDir = false;
                    }
                    window.ws.send(clickArr);
                }
                else if ((e.key == 'q') || (e.key == 'Q')) {
                    window.ws.send(new Uint8Array(msgpack.addNumb([msgpack.SELITEM], 3)));
                }
                else if ((e.key == 'x') || (e.key == 'X')) {
                    if (window.rotationLocked == true) {
                        window.direction = tempDirection;
                        let a = msgpack.addFloat([msgpack.ROTATE], tempDirection);
                        window.ws.send(new Uint8Array(a));
                    }
                    window.rotationLocked = !window.rotationLocked;
                }
                else if ((e.key == 'r') || (e.key == 'R')) {
                    window.ws.send(new Uint8Array([msgpack.MAP_PING]));
                }
                else {
                    if (e.keyCode == 37 || e.keyCode == 65) {
                        left = true;
                    }
                    else if (e.keyCode == 39 || e.keyCode == 68) {
                        right = true;
                    }
                    else if (e.keyCode == 38 || e.keyCode == 87) {
                        up = true;
                    }
                    else if (e.keyCode == 40 || e.keyCode == 83) {
                        down = true;
                    }
                    updateKeys();
                }
            }
        }
    }
    document.addEventListener('keydown', keydownHandler);
    document.addEventListener('keydown', function(e) {
        if (e.key == 'Escape') {
            document.getElementById('teamList').style.display = "none";
			document.getElementById('storageManagementHolder').style.display = "none";
			document.getElementById('recipeList').style.display = "none";
            document.addEventListener('keydown', keydownHandler);
            document.addEventListener('keyup', keyupHandler);
        }
    });
    gCanvas.addEventListener('touchmove', touchMoveHandler, false);
    gCanvas.addEventListener('touchstart', touchStartHandler, false);
    gCanvas.addEventListener('touchend', touchEndHandler, false);
    let HUD = document.getElementById('HUDData');
    HUD.addEventListener('touchmove', touchMoveHandler, false);
    HUD.addEventListener('touchstart', touchStartHandler, false);
    HUD.addEventListener('touchend', touchEndHandler, false);
    let minimap = document.getElementById('minimap');
    minimap.addEventListener('touchmove', touchMoveHandler, false);
    minimap.addEventListener('touchstart', function(e) {
        touchStartHandler(e);
        minimapTapped = window.performance.now();
    }, false);
    minimap.addEventListener('click', function() {
        window.ws.send(new Uint8Array([msgpack.MAP_PING]));
    });
    minimap.addEventListener('touchend', function(e) {
        touchEndHandler(e);
        if (window.performance.now() - minimapTapped <= 200) {
            var evt = new MouseEvent("click", {
                view: window,
                bubbles: true,
                cancelable: true,
            });
            minimap.dispatchEvent(evt);
        }
    }, false);
    let topContainer = document.getElementById('actionFloat');
    topContainer.addEventListener('touchmove', touchMoveHandler, false);
    topContainer.addEventListener('touchstart', function(e) {
        touchStartHandler(e);
        //leaderboardTapped = window.performance.now();
    }, false);
    topContainer.addEventListener('touchend', function(e) {
        touchEndHandler(e);
        /*
		if (window.performance.now() - leaderboardTapped <= 200) {
            var evt = new MouseEvent("click", {
                view: window,
                bubbles: true,
                cancelable: true,
            });
            leaderboard.dispatchEvent(evt);
        }
		*/
    }, false);
	
	// ====================
	// BEGIN TEAM MENU CODE
	// ====================
	window.processTeamMenu = function() {
		document.getElementById('storageManagementHolder').style.display = 'none';
		document.getElementById('recipeList').style.display = 'none';
		
        let teamList = document.getElementById('teamList');
        while (teamList.firstChild) {
            teamList.removeChild(teamList.firstChild);
        }
        if (typeof window.playerAllegiances[playerID] !== 'undefined') {
            for (let j = 0; j < window.playerAllegiances.length; j++) {
                if (typeof window.playerAllegiances[j] !== 'undefined') {
                    if (window.playerAllegiances[j] == window.playerAllegiances[playerID]) {
						let clanObject = window.initElement('div', ['teamEntry', 'preventSelect']);
                        let memberLabel = window.initElement('div', ['teamLabel', 'preventSelect']);
                        memberLabel.innerText = window.playerNames[j];
                        clanObject.appendChild(memberLabel);
                        if (window.clans[window.playerAllegiances[playerID]][1] == playerID) {
                            let clanKickButton = window.initElement('div', ['joinButton']);
                            clanKickButton.innerText = 'Kick';
                            clanKickButton.addEventListener('click', function() {
                                window.ws.send(new Uint8Array(msgpack.addString([msgpack.CHAT], '/clan-kick ' + j)));
                            });
                            clanObject.appendChild(clanKickButton);
                        }
                        
                        teamList.appendChild(clanObject);
                    }
                }
            }
			
			let leaveEntry = window.initElement('div', ['teamEntry']);
			let clanLeaveButton = window.initElement('div', ['joinButton']);
			clanLeaveButton.innerText = 'Leave';
			clanLeaveButton.addEventListener('click', function() {
				window.ws.send(new Uint8Array(msgpack.addString([msgpack.CHAT], '/clan-leave')));
			});
			leaveEntry.appendChild(clanLeaveButton);
			teamList.appendChild(leaveEntry);
        }
        else {
            for (let j = 0; j < window.clans.length; j++) {
                if (typeof window.clans[j] !== 'undefined') {
                    let clanObject = window.initElement('div', ['teamEntry', 'preventSelect']);
                    let clanLabel = window.initElement('div', ['teamLabel', 'preventSelect']);
                    clanLabel.innerText = window.clans[j][0];
                    clanObject.appendChild(clanLabel);
                    let clanJoinButton = window.initElement('div', ['joinButton']);
                    clanJoinButton.innerText = 'Join';
                    clanJoinButton.addEventListener('click', function() {
                        window.ws.send(new Uint8Array(msgpack.addString([msgpack.CHAT], '/clan-join ' + j)));
                    });
                    clanObject.appendChild(clanJoinButton);
                    teamList.appendChild(clanObject);
                }
            }
            let clanObject = window.initElement('div', ['teamEntry']);
            let clanName = document.createElement('input');
            clanName.type = "text";
            clanName.classList.add('clanTextBox');
            clanObject.appendChild(clanName);
            let clanCreateButton = window.initElement('div', ['joinButton']);
            clanCreateButton.innerText = 'Create';
            clanCreateButton.addEventListener('click', function() {
                window.ws.send(new Uint8Array(msgpack.addString([msgpack.CHAT], '/clan-create ' + clanName.value)));
            });
            clanObject.appendChild(clanCreateButton);
            teamList.appendChild(clanObject);
        }
    }
	
	let teamToggle = document.getElementById('teamMenuButton');
    let toggleTeamMenu = (function(e) {
		ignoreEvent(e);
        e.preventDefault();
		let teamList = document.getElementById('teamList');
        window.processTeamMenu();
        if (teamList.style.display == 'none') {
            teamList.style.display = 'flex';
            document.removeEventListener('keydown', keydownHandler);
            document.removeEventListener('keyup', keyupHandler);
        }
        else {
            teamList.style.display = 'none';
            document.addEventListener('keydown', keydownHandler);
            document.addEventListener('keyup', keyupHandler);
        }
	});
	teamToggle.addEventListener('click', toggleTeamMenu);
    teamToggle.addEventListener('touchend', toggleTeamMenu);
    teamToggle.addEventListener('touchstart', ignoreEvent);
	document.getElementById('teamMenuButton').addEventListener('mousedown', ignoreEvent);
	// ==================
	// END TEAM MENU CODE
	// ==================
	
	// ====================
	// BEGIN INVENTORY CODE
	// ====================
	let toggleInventory = (function(e) {
		document.getElementById('teamList').style.display = 'none';
		document.getElementById('recipeList').style.display = 'none';
		
		window.processInventory();
		let inventoryPane = document.getElementById('storageManagementHolder');
		if (inventoryPane.style.display == 'none') {
            inventoryPane.style.display = 'grid';
			document.removeEventListener('keydown', keydownHandler);
            document.removeEventListener('keyup', keyupHandler);
        }
        else {
            inventoryPane.style.display = 'none';
			document.addEventListener('keydown', keydownHandler);
            document.addEventListener('keyup', keyupHandler);
        }
        ignoreEvent(e);
        e.preventDefault();
	});
	document.getElementById('inventoryButton').addEventListener('click', toggleInventory);
    document.getElementById('inventoryButton').addEventListener('touchstart', toggleInventory);
    document.getElementById('inventoryButton').addEventListener('touchend', ignoreEvent);
	document.getElementById('inventoryButton').addEventListener('mousedown', ignoreEvent);
	// ==================
	// END INVENTORY CODE
	// ==================
	
	// =================
	// BEGIN RECIPE CODE
	// =================
	let recipeToggle = document.getElementById('recipeButton');
    let toggleRecipeMenu = (function(e) {
		ignoreEvent(e);
        e.preventDefault();
		
		document.getElementById('teamList').style.display = 'none';
		document.getElementById('storageManagementHolder').style.display = 'none';
		
		let recipeList = document.getElementById('recipeList');
        if (recipeList.style.display == 'none') {
            recipeList.style.display = 'flex';
			document.removeEventListener('keydown', keydownHandler);
            document.removeEventListener('keyup', keyupHandler);
        }
        else {
            recipeList.style.display = 'none';
			document.addEventListener('keydown', keydownHandler);
            document.addEventListener('keyup', keyupHandler);
        }
	});
	recipeToggle.addEventListener('click', toggleRecipeMenu);
    recipeToggle.addEventListener('touchend', toggleRecipeMenu);
    recipeToggle.addEventListener('touchstart', ignoreEvent);
	recipeToggle.addEventListener('mousedown', ignoreEvent);
	// ===============
	// END RECIPE CODE
	// ===============

    setInterval(function() {
        if (sendDir == true) {
            let a = msgpack.addFloat([msgpack.ROTATE], window.direction);
            window.ws.send(new Uint8Array(a));
            sendDir = false;
        }
    }, 330);
});


barItemList = [];
window.addEventListener('load', function() {
	let selectBar = document.getElementById('selectBar');
	
	let chatSelector = document.createElement('canvas');
    chatSelector.classList.add('selectBarItem');
	chatSelector.style.opacity = '90%';
	chatSelector.style.zIndex = '999';
	
	chatSelector.width = 50;
	chatSelector.height = 50;
	
	let chatSelectorCtx = chatSelector.getContext('2d');
	chatSelectorCtx.fillStyle = "rgba(140, 140, 140, 0.7)";
	chatSelectorCtx.fillRect(0, 0, chatSelector.width, chatSelector.height);
	chatSelectorCtx.textBaseline = 'middle';
	chatSelectorCtx.textAlign = 'center';
	chatSelectorCtx.font = "25px Arial";
	chatSelectorCtx.fillStyle = "#FFFFFF";
	chatSelectorCtx.fillText('c', chatSelector.width/2, chatSelector.height/2);
    chatSelector.addEventListener('click', function(e) {
        e.stopPropagation();
        e.preventDefault();
        handleChat();
        chatSelector.blur();
    });
    chatSelector.addEventListener('touchend', function(e) {
        e.preventDefault();
    });
    chatSelector.addEventListener('touchstart', function(e) {
        e.preventDefault();
        handleChat();
    });
    selectBar.appendChild(chatSelector);
	
    for (let j = 1; j <= 9; j++) {
        let barItem = document.createElement('canvas');
		barItemList.push(barItem);
		barItem.classList.add('selectBarItem');
        barItem.style.opacity = '90%';
        barItem.style.zIndex = '999';
		
		barItem.width = 48;
		barItem.height = 48;
		
		let barCtx = barItem.getContext('2d');
		barCtx.fillStyle = "rgba(140, 140, 140, 0.7)";
		barCtx.fillRect(0, 0, barItem.width, barItem.height);
		barCtx.textBaseline = 'middle';
		barCtx.textAlign = 'center';
		barCtx.font = "20px Arial";
		barCtx.fillStyle = "#FFFFFF";
		barCtx.fillText('' + j, barItem.width/2, barItem.height/2);
		
        barItem.addEventListener('click', function(e) {
            e.stopPropagation();
            e.preventDefault();
            window.ws.send(new Uint8Array(msgpack.addNumb([msgpack.SELITEM], j)));
            barItem.blur();
        });
        barItem.addEventListener('touchend', function(e) {
            e.preventDefault();
            e.stopPropagation();
        });
        barItem.addEventListener('touchstart', function(e) {
            e.preventDefault();
            window.ws.send(new Uint8Array(msgpack.addNumb([msgpack.SELITEM], j)));
        });
        document.getElementById('selectBar').appendChild(barItem);
    }
});

var firstDragObject = undefined;
function sendInventorySwitch(secondDragObject) {
	if (firstDragObject != undefined) {
		console.log("SWAPPING " + firstDragObject + " and " + secondDragObject);
		let swapMessage = [window.msgpack.MISC];
		window.msgpack.addString(swapMessage, "INVSWAP");
		window.msgpack.addNumb(swapMessage, firstDragObject);
		window.msgpack.addNumb(swapMessage, secondDragObject);
		window.ws.send(new Uint8Array(swapMessage));
		firstDragObject = undefined;
	}
}
window.getHoldSlotName = function(slot) {
	let toReturn = window.config.unifiedItems[slot.item].name;
	
	if ((slot.item == config.getTypeByName("Box")) && (typeof slot.boxInfo != 'undefined')) {
		toReturn += " [" + getSlotName(slot.boxInfo) + "]"
	}
	return toReturn;
}
window.getSlotName = function(slot) {
	let toReturn = window.getHoldSlotName(slot);
	
	if ((typeof slot.count != 'undefined') && (slot.count > 0)) {
		toReturn += " (x" + slot.count + ")";
	}
	return toReturn;
}

let insertInventoryImage = (function(inventorySlot, actionBarSlot) {
	if (
		(typeof actionBarSlot != 'undefined') && 
		(typeof actionBarSlot.item != 'undefined') && 
		(actionBarSlot.item != config.getTypeByName("No Item"))
	) {
		let charImageDim = window.innerWidth / 36;
		
		if (actionBarSlot.item == config.getTypeByName("Box")) {
			let boxStart = window.initElement('div', ['actionBarInlineLabel']);
			boxStart.innerText = "[";
			inventorySlot.appendChild(boxStart);
			insertInventoryImage(inventorySlot, actionBarSlot.boxInfo);
			let boxEnd = window.initElement('div', ['actionBarInlineLabel']);
			boxEnd.innerText = "]";
			inventorySlot.appendChild(boxEnd);
		}
		else {
			inventorySlot.appendChild(window.initElement('span', ['actionBarHelper']));
			inventorySlot.appendChild(window.generateImageHint(charImageDim, actionBarSlot.item));
		}
		
		if ((typeof actionBarSlot.count != 'undefined') && (actionBarSlot.count > 0)) {
			let countEntry = window.initElement('div', ['actionBarInlineLabel']);
			countEntry.innerText = 'x' + actionBarSlot.count;
			inventorySlot.appendChild(countEntry);
		}
	}
	else {
		let noItem = window.initElement('div', ['actionBarInlineLabel']);
		noItem.innerText = "<Empty>";
		inventorySlot.appendChild(noItem);
	}
});

window.processInventory = function() {
	firstDragObject = undefined;
	
	let inventoryPane = document.getElementById('storageManagement');
	inventoryPane.addEventListener('mousedown', ignoreEvent);
	while (inventoryPane.firstChild) {
		inventoryPane.removeChild(inventoryPane.firstChild);
	}
		
	for (let j = 0; j < 9; j++) {
	    let inventorySlot = window.initElement('div', ['actionBarLabel']);
		insertInventoryImage(inventorySlot, window.actionBarSlots[j]);
        let dragStart = (function(e) {
			e.preventDefault();
			firstDragObject = j;
		});
        let dragStop = (function(e) {
			e.preventDefault();
			sendInventorySwitch(j);
		});

		inventorySlot.addEventListener('mousedown', dragStart);
		inventorySlot.addEventListener('mouseup', dragStop);
        inventorySlot.addEventListener('touchstart', function() {
            lastTouchStart = window.performance.now();
        });
        inventorySlot.addEventListener('touchend', function(e) {
            if ((typeof lastTouchStart != 'undefined') && (window.performance.now() - lastTouchStart < 350)) {
                if (typeof firstDragObject != 'undefined') {
                    dragStop(e);
                }
                else {
                    dragStart(e);
                }
                lastTouchStart = undefined;
            }
        });
		inventoryPane.appendChild(inventorySlot);
	}
	
	for (let j = 0; j < window.config.inventorySize; j++) {
	    let inventorySlot = window.initElement('div', ['inventoryLabel']);
		insertInventoryImage(inventorySlot, window.inventorySlots[j]);

        let dragStart = (function(e) {
			e.stopPropagation();
			e.preventDefault();
			firstDragObject = j + 9;
		});
        let dragStop = (function(e) {
			e.stopPropagation();
			e.preventDefault();
			sendInventorySwitch(j + 9);
		});

		inventorySlot.addEventListener('mousedown', dragStart);
		inventorySlot.addEventListener('mouseup', dragStop);
        inventorySlot.addEventListener('touchstart', function() {
            lastTouchStart = window.performance.now();
        });
        inventorySlot.addEventListener('touchend', function(e) {
            if ((typeof lastTouchStart != 'undefined') && (window.performance.now() - lastTouchStart < 350)) {
                if (typeof firstDragObject != 'undefined') {
                    dragStop(e);
                }
                else {
                    dragStart(e);
                }
                lastTouchStart = undefined;
            }
        });
		inventoryPane.appendChild(inventorySlot);
	}
	
	let boxSlot = window.initElement('div', ['specialLabel']);
	boxSlot.innerText = "Box item";
	boxSlot.addEventListener('mousedown', ignoreEvent);
	boxSlot.addEventListener('mouseup', function(e) {
		e.stopPropagation();
		e.preventDefault();
		if (typeof firstDragObject != 'undefined') {
			let boxMessage = [window.msgpack.MISC];
			window.msgpack.addString(boxMessage, "BOXITEM");
			window.msgpack.addNumb(boxMessage, firstDragObject);
			window.ws.send(new Uint8Array(boxMessage));
			firstDragObject = undefined;
		}
	});
	inventoryPane.appendChild(boxSlot);
	
	let split1Slot = window.initElement('div', ['specialLabel']);
	split1Slot.innerText = "Split 1";
	split1Slot.addEventListener('mousedown', ignoreEvent);
	split1Slot.addEventListener('mouseup', function(e) {
		e.stopPropagation();
		e.preventDefault();
		if (typeof firstDragObject != 'undefined') {
			let splitMessage = [window.msgpack.MISC];
			window.msgpack.addString(splitMessage, "SPLIT1");
			window.msgpack.addNumb(splitMessage, firstDragObject);
			window.ws.send(new Uint8Array(splitMessage));
			firstDragObject = undefined;
		}
	});
	inventoryPane.appendChild(split1Slot);
	
	let splitHalfSlot = window.initElement('div', ['specialLabel']);
	splitHalfSlot.innerText = "Split half";
	splitHalfSlot.addEventListener('mousedown', ignoreEvent);
	splitHalfSlot.addEventListener('mouseup', function(e) {
		e.stopPropagation();
		e.preventDefault();
		if (typeof firstDragObject != 'undefined') {
			let splitMessage = [window.msgpack.MISC];
			window.msgpack.addString(splitMessage, "SPLITHALF");
			window.msgpack.addNumb(splitMessage, firstDragObject);
			window.ws.send(new Uint8Array(splitMessage));
			firstDragObject = undefined;
		}
	});
	inventoryPane.appendChild(splitHalfSlot);
	
	let splitNSlot = window.initElement('select', ['specialLabel', 'gameTextColor']);
	for (let j = 0; j < 250; j++) {
        if ((j+1) % 5 == 0) {
            let opt = window.initElement('option', ['specialLabel', 'gameTextColor']);
            opt.value = j+1;
            opt.innerText = "Split " + (j+1);
            splitNSlot.appendChild(opt);
        }
	}
	splitNSlot.addEventListener('mousedown', ignoreEvent);
	splitNSlot.addEventListener('mouseup', function(e) {
		e.stopPropagation();
		e.preventDefault();
		if (typeof firstDragObject != 'undefined') {
			let splitMessage = [window.msgpack.MISC];
			window.msgpack.addString(splitMessage, "SPLITN");
			window.msgpack.addNumb(splitMessage, firstDragObject);
			window.msgpack.addNumb(splitMessage, parseInt(splitNSlot.value));
			window.ws.send(new Uint8Array(splitMessage));
			firstDragObject = undefined;
		}
	});
	inventoryPane.appendChild(splitNSlot);
	
	let discardSlot = window.initElement('div', ['specialLabel']);
	discardSlot.innerText = "Discard";
	discardSlot.addEventListener('mousedown', ignoreEvent);
	discardSlot.addEventListener('mouseup', function(e) {
		e.stopPropagation();
		e.preventDefault();
		if (typeof firstDragObject != 'undefined') {
			let splitMessage = [window.msgpack.MISC];
			window.msgpack.addString(splitMessage, "DISCARD");
			window.msgpack.addNumb(splitMessage, firstDragObject);
			window.ws.send(new Uint8Array(splitMessage));
			firstDragObject = undefined;
		}
	});
	inventoryPane.appendChild(discardSlot);
}

window.populateSelectBarImages = function() {
	let itemList = window.actionBarSlots;
	let items = window.config.unifiedItems;
	for (let j = 0; j < barItemList.length; j++) {
		let barItem = barItemList[j];
		let barCtx = barItem.getContext('2d');
		barCtx.clearRect(0, 0, barItemList[j].width, barItemList[j].height);
		barCtx.fillStyle = 'rgba(180, 180, 180, 0.6)';
		barCtx.fillRect(0, 0, barItemList[j].width, barItemList[j].height);
		
		if ((typeof itemList[j] != 'undefined') && (typeof itemList[j].item != 'undefined') && (itemList[j].item != window.config.getTypeByName("No Item"))) {
            if (items[itemList[j].item].vertical == true) {
                let widthRatio = window.images[itemList[j].item].width / window.images[itemList[j].item].height;
				let heightPadding = barItem.height * 0.1;
				barCtx.drawImage(window.images[itemList[j].item], 0.5 * (barItem.width - (barItem.height - heightPadding) * widthRatio), heightPadding / 2, (barItem.height - heightPadding) * widthRatio, barItem.height - heightPadding); 
            }
			else if (
                (items[itemList[j].item].wtype == 1) || 
                (items[itemList[j].item].wtype == 2)
            ) {
				let heightRatio = window.images[itemList[j].item].height / window.images[itemList[j].item].width;
				let widthPadding = barItem.width * 0.1;
				barCtx.drawImage(window.images[itemList[j].item], widthPadding/2, 0.5 * (barItem.height - (barItem.width - widthPadding) * heightRatio), barItem.width - widthPadding, (barItem.width - widthPadding) * heightRatio); 
			}
			else {
				let paddingX = barItem.width * 0.1;
				let paddingY = barItem.height * 0.1;
				barCtx.drawImage(window.images[itemList[j].item], paddingX/2, paddingY/2, barItem.width - paddingX, barItem.height - paddingY);
				
				if (typeof itemList[j].boxInfo != 'undefined') {
					let width = window.images[itemList[j].boxInfo.item].width;
					let height = window.images[itemList[j].boxInfo.item].height;
					let heightRatio = (width > height) ? (height / width) : 1;
					let widthRatio = (height > width) ? (width / height) : 1;
					
					barCtx.drawImage(
									 window.images[itemList[j].boxInfo.item], 0.5 * (barItem.width - widthRatio * (barItem.width - paddingX)), 
									 0.5 * (barItem.height - heightRatio * (barItem.height - paddingY)), widthRatio * (barItem.width - paddingX), heightRatio * (barItem.height - paddingY)
									);
				}
			}
			
			if ((typeof itemList[j].count != 'undefined') && (itemList[j].count > 0)) {
				barCtx.textBaseline = 'middle';
				barCtx.textAlign = 'center';
				barCtx.font = "20px Arial";
				barCtx.fillStyle = "#FFFFFF";
				barCtx.fillText('x' + itemList[j].count, barItem.width/2, barItem.height/2);
			}
		}
		else {
			barCtx.fillStyle = "rgba(140, 140, 140, 0.7)";
			barCtx.fillRect(0, 0, barItem.width, barItem.height);
			barCtx.textBaseline = 'middle';
			barCtx.textAlign = 'center';
			barCtx.font = "20px Arial";
			barCtx.fillStyle = "#FFFFFF";
			barCtx.fillText('' + (j+1), barItem.width/2, barItem.height/2);
		}
	}
}