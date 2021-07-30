window.statPoints = [];
window.primarySelection = undefined;
window.secondarySelection = undefined;
window.colorSelection = undefined;

let remainingPoints = undefined;

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

function makePointChange(idVal, progressBar, label, amount) {
    if ((window.statPoints[idVal] + amount <= config.STATS_MAX_VAL) && 
        (window.statPoints[idVal] + amount >= 0) &&
        (remainingPoints - amount >= 0)) {
        window.statPoints[idVal] += amount;
        progressBar.value = window.statPoints[idVal];
        label.innerText = config.statPoints[idVal] + ' (' + window.statPoints[idVal] + ')';
        remainingPoints -= amount;
        document.getElementById('totalPoints').innerText = 'Stats - ' + remainingPoints + ' points left';

        if (config.statPoints[idVal] == 'Vanity')  {
            if (window.statPoints[idVal] >= (config.STATS_MAX_VAL - config.STATS_INITIAL)) {
                document.getElementById('colorSelectorHolder').style.display = "flex";
            }
            else {
                document.getElementById('colorSelectorHolder').style.display = "none";
            }
        }
    }
}

function loadPoints() {
    let savedPoints = window.localStorage.getItem('statPoints');
    if ((typeof savedPoints !== 'undefined') && (savedPoints !== null)) {
        let parsed = JSON.parse(savedPoints);
        if (typeof parsed !== 'undefined') {
            for (let j = 0; j < parsed.length; j++) {
                makePointChange(j, document.getElementById('stat' + j + 'Display'), document.getElementById('stat' + j + 'Meter'), parsed[j] - window.statPoints[j]);
            }
        }
    }
}

function savePoints() {
    window.localStorage.setItem('statPoints', JSON.stringify(window.statPoints));
}

function populateColorSelector() {
    let colorSelectorDiv = document.getElementById('colorSelectorHolder');

    while (colorSelectorDiv.firstChild) {
		colorSelectorDiv.removeChild(colorSelectorDiv.firstChild);
	}

    for (let k = 0; k < window.config.colorNames.length; k++) {
        let opt = window.initElement('div', ['colorSelectorEntry']);
        if (window.config.colorNames[k] == window.colorSelection) {
            opt.classList.add('optionSelected');
        }
        opt.style.background = window.config.colors[k];
        opt.addEventListener('click', function() {
            window.colorSelection = window.config.colorNames[k];
            populateColorSelector();
        })
        colorSelectorDiv.appendChild(opt);
    }
}
window.addEventListener('load', function() {
    var config = window.config;
    var msgpack = window.msgpack;

    remainingPoints = (config.TOTAL_POINTS - config.statPoints.length * config.STATS_INITIAL);
    document.getElementById('totalPoints').innerText = 'Stats - ' + remainingPoints + ' points left';
    let statNames = config.statPoints;

    let container = document.getElementById('statBody');
    for (let j = 0; j < statNames.length; j++) {
        window.statPoints[j] = config.STATS_INITIAL;
        let theName = statNames[j];
        let meter = window.initElement('div', ['pointCount']);
        meter.id = 'stat' + j + 'Meter';
        meter.innerText = theName + ' (' + config.STATS_INITIAL + ')';
        if (typeof window.config.statPointDescriptions[j] != 'undefined') {
            meter.setAttribute("tooltip-text", window.config.statPointDescriptions[j]);
        }
        container.appendChild(meter);

        let barHolder = window.initElement('div', ['statPointGUI']);
        let minusButton = window.initElement('button', ['upgradeButton']);
        minusButton.id = 'subtract' + 'stat' + j;
        minusButton.innerText = '-';
        barHolder.appendChild(minusButton);
        let progress = window.initElement('progress', ['pointDisplay']);
        progress.id = 'stat' + j + 'Display';
        progress.value = config.STATS_INITIAL;
        progress.max = 5;
        barHolder.appendChild(progress);
        let plusButton = window.initElement('button', ['upgradeButton']);
        plusButton.id = 'add' + 'stat' + j;
        plusButton.innerText = '+';
        barHolder.appendChild(plusButton);
        if (typeof window.config.statPointDescriptions[j] != 'undefined') {
            barHolder.setAttribute("tooltip-text", window.config.statPointDescriptions[j]);
        }
        container.appendChild(barHolder);

        if (statNames[j] == 'Vanity') {
            window.colorSelection = window.config.colorNames[0];
            populateColorSelector();
            document.getElementById('colorSelectorHolder').style.display = "none";
            makePointChange(j, progress, meter, -window.config.STATS_INITIAL);
        }
        minusButton.addEventListener('click', function() {
            makePointChange(j, progress, meter, -1);
            savePoints();
        });
        plusButton.addEventListener('click', function() {
            makePointChange(j, progress, meter, 1);
            savePoints();
        });
    }
    loadPoints();
});

window.generateImageHint = (function(imageCharacteristicDimension, j) {
	let imageHint = undefined;
	
	let imageScale = (function() {
		let xScale = (imageHint.height > imageHint.width) ? (imageHint.width / imageHint.height) : 1;
		let yScale = (imageHint.height < imageHint.width) ? (imageHint.height / imageHint.width) : 1;
		imageHint.style.width = "" + Math.round(xScale * imageCharacteristicDimension) + "px";
		imageHint.style.height = "" + Math.round(yScale * imageCharacteristicDimension) + "px";
	});
	
	if (typeof window.images[j] != 'undefined') {
		imageHint = window.images[j].cloneNode(true);
		imageScale();
	}
	else {
		imageHint = window.initElement('img');
		imageHint.src = window.config.unifiedItems[j].imageFile;
		imageHint.onload = imageScale;
	}
	return imageHint;
});

let populatePrimarySecondarySelector = (function() {
	let imageCharacteristicDimension = window.innerWidth / 24;
	
	let primarySelector = document.getElementById('primary');
	let secondarySelector = document.getElementById('secondary');
	
	while (primarySelector.firstChild) {
		primarySelector.removeChild(primarySelector.firstChild);
	}
	while (secondarySelector.firstChild) {
		secondarySelector.removeChild(secondarySelector.firstChild);
	}
	
	for (let j = 0; j < window.config.unifiedItems.length; j++) {
		if ((typeof window.config.unifiedItems[j].wtype != 'undefined') && (window.config.unifiedItems[j].userSelectable != false) && (j != window.config.getTypeByName('God Rifle'))) {
			let selectorEntry = window.initElement('div', ['primarySecondOption']);
			if ((j == window.primarySelection) || (j == window.secondarySelection)) {
				selectorEntry.classList.add('optionSelected');
			}
			
			let labelText = window.initElement('div', ['primarySecondLabel']);
			labelText.innerText = window.config.unifiedItems[j].name;
			selectorEntry.appendChild(labelText);
			
            let imageHolder = window.initElement('div', ['primarySecondImageHolder']);
			let imageHint = window.generateImageHint(imageCharacteristicDimension, j);
			imageHolder.appendChild(imageHint);
            imageHolder.style.width = '' + Math.round(imageCharacteristicDimension) + 'px';
            imageHolder.style.height = '' + Math.round(imageCharacteristicDimension) + 'px';
            selectorEntry.appendChild(imageHolder);
			
            if (typeof window.config.unifiedItems[j].description != 'undefined') {
                selectorEntry.setAttribute("tooltip-text", window.config.unifiedItems[j].description);
            }

			if (window.config.unifiedItems[j].wtype == 1) {
				primarySelector.appendChild(selectorEntry);
				selectorEntry.addEventListener('click', function() {
					window.primarySelection = j;
					if (typeof window.secondarySelection != 'undefined') {
						if (!window.config.isValidSecondary(window.primarySelection, window.secondarySelection)) {
							window.secondarySelection = undefined;
						}
					}
					populatePrimarySecondarySelector();
				});
			}
			else if ((window.config.unifiedItems[j].wtype == 2) && (typeof window.primarySelection != 'undefined') && (window.config.isValidSecondary(window.primarySelection, j))) {
				secondarySelector.appendChild(selectorEntry);
				selectorEntry.addEventListener('click', function() {
					window.secondarySelection = j;
					populatePrimarySecondarySelector();
				});
			}
		}
	}
});

window.addEventListener('load', populatePrimarySecondarySelector);

let tips = [
	"Placing a structure between you and an attacking nuro bot (or surrounding yourself in spikes) will cause it to de-aggro",
	"When fighting nuro bots, focus on using spikes over pit traps. Try making a trap out of spikes and baiting the nuro in",
	"Crafting enables you to obtain special items, or bypass the build count limits. A list of crafting recipies is available in game",
	"Sending /builds-clear in the chat will delete all of your structures",
    "The bot-free server (nobot.mooink.repl.co) lets you 1v1 without bot interference",
];

window.randomizeTip = function() {
	let tipMenu = document.getElementById("tipHolder");
	tipMenu.innerHTML = "Tip:<br>" + tips[Math.floor(Math.random() * tips.length)];
}

window.addEventListener('load', function() {
	window.randomizeTip();
	document.getElementById("tipHolder").addEventListener('click', function() {
		window.randomizeTip();
	});
})