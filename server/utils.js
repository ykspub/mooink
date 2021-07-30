const config = require('../common/config.js');
const utilCalc = require('../common/utilCalc.js');

let CIPCache = [0, 0, 0, 0];

function getSquaredDistance(x1, y1, x2, y2) {
    return Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2);
}

function makePositive(a) {
    return Math.max(a, 0);
}

function angleWorks(theta, rcorner, lcorner) {
    /*
    let angleWorks = false;
    if ((theta <= rcorner) && (theta >= lcorner)) {
        angleWorks = true;
    }
    else if (rcorner >= Math.PI) {
        if (((theta <= rcorner) || (theta <= rcorner - 2 * Math.PI)) && (theta >= lcorner)) {
            angleWorks = true;
        }
    }
    else if (lcorner <= -Math.PI) {
        if (((theta >= lcorner) || (theta >= lcorner + 2 * Math.PI)) && (theta <= rcorner)) {
            angleWorks = true;
        }
    }
    if (angleWorks == true) {
        return true;
    }
    return false;
    */
    let actual_theta = normalizeAngle(theta);
    let actual_lcorner = normalizeAngle(lcorner);
    if (actual_lcorner > actual_theta) {
        actual_lcorner -= 2 * Math.PI;
    }
    let actual_rcorner = normalizeAngle(rcorner);
    if (actual_rcorner < actual_lcorner) {
        actual_rcorner += 2 * Math.PI;
    }
    else if ((actual_rcorner - actual_lcorner) >= 2 * Math.PI) {
        actual_rcorner -= 2 * Math.PI;
    }
    if ((actual_theta < actual_lcorner) || (actual_theta > actual_rcorner)) {
        return false;
    }
    return true;
}

function isMeleeHit(x1, y1, x2, y2, dir, range) {
    let theta = Math.atan2(x2 - x1, y2 - y1); 
    let rcorner = dir + (Math.PI / 2);
    let lcorner = dir - config.HIT_ANGLE;
    let distance = Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2);
    if (distance <= Math.pow(config.PLAYER_RADIUS, 2)) {
        return true;
    }
    if (angleWorks(theta, rcorner, lcorner) == true) {
        if (distance <= Math.pow(range, 2)) {
            return true;
        }
    }
    return false;
}

function isCollision(p0, p1, c0, c1, pr, cr) {
    if (Math.abs(p0 - c0) > (pr + cr)) {
        return false;
    }
    if (Math.abs(p1 - c1) > (pr + cr)) {
        return false;
    }
    if ((Math.pow((p0 - c0), 2) + 
        Math.pow((p1 - c1), 2)) <= Math.pow((pr + cr), 2)) {
        return true;
    }
}

function pointSegmentSquaredDistance(la0, la1, lb0, lb1, c0, c1) {
    let dot = ((lb0 - la0) * (c0 - la0) + (lb1 - la1) * (c1 - la1));
    let distance = getSquaredDistance(la0, la1, lb0, lb1);
    if (distance <= 1) {
        return getSquaredDistance(la0, la1, c0, c1);
    }
    let projection = Math.min(1, Math.max(0, dot / distance));
    return getSquaredDistance(c0, c1, la0 + projection * (lb0 - la0), la1 + projection * (lb1 - la1));
}

function prepOccludes(p0, p1, s0, s1, sr) {
	utilCalc.inPlaceCIP(p0, p1, s0, s1, sr, CIPCache);
}

function occludes(p0, p1, b0, b1, s0, s1, br, sr) {
    // An object can't occlude the view if
    // it's on the wrong side
    if (((b0 + br < p0 - sr) && (s0 > p0)) || 
        ((b0 - br > p0 + sr) && (s0 < p0))) {
        return false;
    }
    if (((b1 + br < p1 - sr) && (s1 > p1)) || 
        ((b1 - br > p1 + sr) && (s1 < p1))) {
        return false;
    }
	
	// An object cannot occlude something that's
    // closer than it is
	if ((Math.abs(b0 - p0) > Math.abs(s0 - p0) + br + sr) || (Math.abs(b1 - p1) > Math.abs(s1 - p1) + br + sr)) {
		return false;
	}
    
	let firstDecision = true;
	if (CIPCache[0] != undefined) {
		firstDecision = (pointSegmentSquaredDistance(p0, p1, CIPCache[0], CIPCache[1], b0, b1) <= br * br);
	}
	if (firstDecision) {
		CIPCache[0] = undefined;
	}
	
	let secondDecision = true;
	if (CIPCache[2] != undefined) {
		secondDecision = (pointSegmentSquaredDistance(p0, p1, CIPCache[2], CIPCache[3], b0, b1) <= br * br);
	}
	if (secondDecision) {
		CIPCache[2] = undefined;
	}
	
	return firstDecision && secondDecision;
}

/*
// This checks if an object (b) blocks the view
// that a player (p) has on a structure (s).
function occludes(p0, p1, b0, b1, s0, s1, br, sr) {
    // An object can't occlude the view if
    // it's on the wrong side
    if (((b0 + br < p0) && (s0 > p0)) || 
        ((b0 - br > p0) && (s0 < p0))) {
        return false;
    }
    if (((b1 + br < p1) && (s1 > p1)) || 
        ((b1 - br > p1) && (s1 < p1))) {
        return false;
    }
	
	// An object cannot occlude something that's
    // closer than it is
	if ((Math.abs(b0 - p0) > Math.abs(s0 - p0) + br) || (Math.abs(b1 - p1) > Math.abs(s1 - p1) + br)) {
		return false;
	}
    
    if (pointSegmentSquaredDistance(p0, p1, s0, s1, b0, b1) <= br * br) {
        return true;
    }
    return false;
}
*/

function calculateGridCoords(loc) {
    return [Math.min(config.NUM_CELLS_LEN-1, Math.max(0, Math.floor(loc[0] / config.CELL_LENGTH_X))), Math.min(config.NUM_CELLS_LEN-1, Math.max(0, Math.floor(loc[1] / config.CELL_LENGTH_Y)))];
}

function runAroundResult(p, callback, cutoffX, cutoffY, ...args) {
    let to_return = false;
    let gridX = p.gridCoords[0];
    let gridY = p.gridCoords[1];
    to_return = to_return || callback(p, gridX, gridY, ...args);
    let left = (p.loc[0] - gridX * config.CELL_LENGTH_X) < cutoffX;
    let right = (p.loc[0] - gridX * config.CELL_LENGTH_X) > makePositive(config.CELL_LENGTH_X - cutoffX);
    let down = (p.loc[1] - gridY * config.CELL_LENGTH_Y) < cutoffY;
    let up = (p.loc[1] - gridY * config.CELL_LENGTH_Y) > makePositive(config.CELL_LENGTH_Y - cutoffY);
    if (left == true) {
        if (gridX > 0) {
            to_return = to_return || callback(p, gridX - 1, gridY, ...args);
        }
    }
    if (right == true) {
        if (gridX + 1 < config.NUM_CELLS_LEN) {
            to_return = to_return || callback(p, gridX + 1, gridY, ...args);
        }
    }
    if (down == true) {
        if (gridY > 0) {
            to_return = to_return || callback(p, gridX, gridY - 1, ...args);
        }
    }
    if (up == true) {
        if (gridY + 1 < config.NUM_CELLS_LEN) {
            to_return = to_return || callback(p, gridX, gridY + 1, ...args);
        }
    }
    if ((up == true) && (right == true)) {
        if ((gridY + 1 < config.NUM_CELLS_LEN) && (gridX + 1 < config.NUM_CELLS_LEN)) {
            to_return = to_return || callback(p, gridX + 1, gridY + 1, ...args);
        }
    }
    if ((down == true) && (right == true)) {
        if ((gridY > 0) && (gridX + 1 < config.NUM_CELLS_LEN)) {
            to_return = to_return || callback(p, gridX + 1, gridY - 1, ...args);
        }
    }
    if ((down == true) && (left == true)) {
        if ((gridY > 0) && (gridX > 0)) {
            to_return = to_return || callback(p, gridX - 1, gridY - 1, ...args);
        }
    }
    if ((up == true) && (left == true)) {
        if ((gridY + 1 < config.NUM_CELLS_LEN) && (gridX > 0)) {
            to_return = to_return || callback(p, gridX - 1, gridY + 1, ...args);
        }
    }
    return to_return;
}

function runAround(p, callback, cutoffX, cutoffY, ...args) {
    let gridX = p.gridCoords[0];
    let gridY = p.gridCoords[1];
    callback(p, gridX, gridY, ...args);
    let left = (p.loc[0] - gridX * config.CELL_LENGTH_X) < cutoffX;
    let right = (p.loc[0] - gridX * config.CELL_LENGTH_X) > (config.CELL_LENGTH_X - cutoffX);
    let down = (p.loc[1] - gridY * config.CELL_LENGTH_Y) < cutoffY;
    let up = (p.loc[1] - gridY * config.CELL_LENGTH_Y) > (config.CELL_LENGTH_Y - cutoffY);
    if (left == true) {
        if (gridX > 0) {
            callback(p, gridX - 1, gridY, ...args);
        }
    }
    if (right == true) {
        if (gridX + 1 < config.NUM_CELLS_LEN) {
            callback(p, gridX + 1, gridY, ...args);
        }
    }
    if (down == true) {
        if (gridY > 0) {
            callback(p, gridX, gridY - 1, ...args);
        }
    }
    if (up == true) {
        if (gridY + 1 < config.NUM_CELLS_LEN) {
            callback(p, gridX, gridY + 1, ...args);
        }
    }
    if ((up == true) && (right == true)) {
        if ((gridY + 1 < config.NUM_CELLS_LEN) && (gridX + 1 < config.NUM_CELLS_LEN)) {
            callback(p, gridX + 1, gridY + 1, ...args);
        }
    }
    if ((down == true) && (right == true)) {
        if ((gridY > 0) && (gridX + 1 < config.NUM_CELLS_LEN)) {
            callback(p, gridX + 1, gridY - 1, ...args);
        }
    }
    if ((down == true) && (left == true)) {
        if ((gridY > 0) && (gridX > 0)) {
            callback(p, gridX - 1, gridY - 1, ...args);
        }
    }
    if ((up == true) && (left == true)) {
        if ((gridY + 1 < config.NUM_CELLS_LEN) && (gridX > 0)) {
            callback(p, gridX - 1, gridY + 1, ...args);
        }
    }
}

function flipAngle(theta) {
    if (theta < 0) {
        return Math.PI + theta;
    }
    else {
        return -Math.PI + theta;
    }
}

function normalizeAngle(theta) {
    let runningTheta = theta;
    while (runningTheta < -Math.PI) {
        runningTheta = Math.PI + (Math.PI + runningTheta);
    }
    while (runningTheta > Math.PI) {
        runningTheta = -Math.PI + (runningTheta - Math.PI);
    }
    return runningTheta;
}

exports.runAround = runAround;
exports.runAroundResult = runAroundResult;
exports.getSquaredDistance = getSquaredDistance;
exports.makePositive = makePositive;
exports.isMeleeHit = isMeleeHit;
exports.isCollision = isCollision;
exports.calculateGridCoords = calculateGridCoords;
exports.prepOccludes = prepOccludes;
exports.occludes = occludes;
exports.angleWorks = angleWorks;
exports.pointSegmentSquaredDistance = pointSegmentSquaredDistance;
exports.flipAngle = flipAngle;
exports.normalizeAngle = normalizeAngle;