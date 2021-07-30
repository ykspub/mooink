const msgpack = require('../common/msgpack.js');
var scores = [];

function findScore(playerID) {
  for (let j = 0; j < scores.length; j++) {
    if (scores[j] !== undefined) {
      if (scores[j][0] == playerID) {
        return scores[j][1];
      }
    }
  }
  return 0;
}

function setScore(playerID, score) {
  for (let j = 0; j < scores.length; j++) {
    if (scores[j] !== undefined) {
      if (scores[j][0] == playerID) {
        scores[j][1] = score;
        return;
      }
    }
  }
  scores.push([playerID, score]);
}

function recalcLeaderboard() {
  scores.sort(function(x, y) {
    if ((x == undefined) && (y == undefined)) {
      return 0;
    }
    else if (x == undefined) {
      return -1;
    }
    else if (y == undefined) {
      return 1;
    }
    if (x[1] < y[1]) {
      return -1;
    }
    else {
      return 1;
    }
  });
}

function reportKill(playerID, otherID) {
  let playerScore = findScore(playerID);
  let otherScore = findScore(otherID);
  let newScore = playerScore + Math.max(1, 1 + Math.floor((otherScore - playerScore) / 2));
  setScore(playerID, newScore);
  setScore(otherID, 0);
  recalcLeaderboard();
  return newScore;
}

function removeScore(playerID) {
	if (scores.length >= 1) {
		for (let j = scores.length-1; j >= 0; j--) {
			if ((typeof scores[j] == 'undefined') || (typeof scores[j][0] == 'undefined') || (scores[j][0] == playerID)) {
				scores.splice(j, 1);
			}
		}
		recalcLeaderboard();
	}
}

function serializeLeaderboard() {
	let acc = [msgpack.LEADERBOARD_UPDATE_DELIM];
	let count = 0;
	for (let j = 0; j < scores.length; j++) {
		if (scores[j] !== undefined) {
			msgpack.addNumb(acc, scores[j][0]);
			msgpack.addNumb(acc, scores[j][1]);
			count++;
			if (count >= 10) {
				return acc;
			}
		}
	}
	return acc;
}

function notifyLeaderboard(connections) {
	let leaderData = new Uint8Array(serializeLeaderboard());
	for (let j = 0; j < connections.length; j++) {
		if (connections[j] != undefined) {
			connections[j].send(leaderData);
		}
	}
}

exports.reportKill = reportKill;
exports.removeScore = removeScore;
exports.setScore = setScore;
exports.serializeLeaderboard = serializeLeaderboard;
exports.notifyLeaderboard = notifyLeaderboard;