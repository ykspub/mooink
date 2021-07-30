const msgpack = require('../common/msgpack.js');

var teams = [];

var players = undefined;
var connections = undefined;

function init(p, conn) {
    players = p;
    connections = conn;
}

function Team(owner, name) {
    this.owner = owner.playerID;
    this.name = name;
    this.members = [];
    this.joinQueue = [];
    for (let j = 0; j < teams.length; j++) {
        let teamj = teams[j];
        if (typeof teamj !== 'undefined') {
            if (teamj.name == name) {
                return;
            }
        }
    }
    this.insert();
    owner.team = this.teamID;
    let notifyMsg = [msgpack.NEW_CLAN_DELIM];
    this.serializeCreate(notifyMsg);
    let toSend = new Uint8Array(notifyMsg);
    for (let j = 0; j < connections.length; j++) {
        if (typeof connections[j] !== 'undefined') {
            connections[j].send(toSend);
        }
    }
    owner.broadcastName();
}
Team.prototype.serializeCreate = function(toSend) {
    msgpack.addNumb(toSend, this.teamID);
    msgpack.addString(toSend, this.name);
    msgpack.addNumb(toSend, this.owner);
}
Team.prototype.insert = function() {
    for (let j = 0; j < teams.length; j++) {
        if (typeof teams[j] == 'undefined') {
            this.teamID = j;
            teams[j] = this;
            return;
        }
    }
    teams.push(this);
    this.teamID = teams.length - 1;
    return;
}
Team.prototype.destroy = function() {
    let toNotify = [msgpack.PLAYER_NAME_UPDATE];
    if (typeof players[this.owner] !== 'undefined') {
        players[this.owner].team = undefined;
        players[this.owner].encodeName(toNotify);
    }
    for (let j = 0; j < this.members.length; j++) {
        let memberID = this.members[j];
        if (typeof memberID !== 'undefined') {
            let member = players[memberID];
            if (typeof member !== 'undefined') {
                member.team = undefined;
                member.encodeName(toNotify);
            }
        }
    }
    let toSend = new Uint8Array(toNotify);
    let teamNotif = new Uint8Array(msgpack.addNumb([msgpack.CLAN_DESTROY_DELIM], this.teamID));
    for (let j = 0; j < connections.length; j++) {
        if (typeof connections[j] !== 'undefined') {
            connections[j].send(toSend);
            connections[j].send(teamNotif);
        }
    }
    teams[this.teamID] = undefined;
}
Team.prototype.addMember = function(player) {
    if (typeof player.team == 'undefined') {
        player.team = this.teamID;
        for (let j = 0; j < this.members.length; j++) {
            if (typeof this.members[j] == 'undefined') {
                this.members[j] = player.playerID;
            }
        }
        this.members.push(player.playerID);
    }
}
Team.prototype.requestJoin = function(player) {
    if ((typeof player.team == 'undefined') && (!this.joinQueue.includes(player.playerID))) {
        let joinQueue = this.joinQueue;
        if (typeof connections[this.owner] !== 'undefined') {
            let toSend = [msgpack.CLAN_REQUEST_DELIM];
            msgpack.addNumb(toSend, player.playerID);
            connections[this.owner].send(new Uint8Array(toSend));
        }
        for (let j = 0; j < joinQueue.length; j++) {
            if (typeof joinQueue[j] == 'undefined') {
                joinQueue[j] = player.playerID;
                return;
            }
        }
        joinQueue.push(player.playerID);
        setTimeout(function() {
            for (let j = 0; j < joinQueue.length; j++) {
                if (joinQueue[j] == player.playerID) {
                    joinQueue[j] = undefined;
                }
            }
        }, 45 * 1000);
    }
}
Team.prototype.leave = function(player) {
    if (player.team == this.teamID) {
        if (this.owner == player.playerID) {
            player.team = undefined;
            let newOwner = undefined;
            for (let j = 0; j < this.members.length; j++) {
                let currentID = this.members[j];
                if (typeof currentID !== 'undefined') {
                    if (typeof players[currentID] !== 'undefined') {
                        newOwner = currentID;
                        this.members[j] = undefined;
                        break;
                    }
                }
            }
            if (typeof newOwner === 'undefined') {
                this.destroy();
            }
            else {
                this.owner = newOwner;
                let notifyMsg = [msgpack.NEW_CLAN_DELIM];
                this.serializeCreate(notifyMsg);
                let toSend = new Uint8Array(notifyMsg);
                for (let j = 0; j < connections.length; j++) {
                    if (typeof connections[j] !== 'undefined') {
                        connections[j].send(toSend);
                    }
                }
            }
        }
        else {
            for (let j = 0; j < this.members.length; j++) {
                if (this.members[j] == player.playerID) {
                    this.members[j] = undefined;
                }
            }
        }
        player.team = undefined;
        player.broadcastName();
    }
}
Team.prototype.accept = function(ID) {
    for (let j = 0; j < this.joinQueue.length; j++) {
        if (this.joinQueue[j] == ID) {
            let thePlayer = players[ID];
            if (typeof thePlayer !== 'undefined') {
                if (typeof thePlayer.team == 'undefined') {
                    this.addMember(thePlayer);
                    thePlayer.broadcastName();
                }
            }
            this.joinQueue[j] = undefined;
        }
    }
}
Team.prototype.broadcastLocations = function() {
    let toSend = [msgpack.TEAM_LOCATION_DELIM];
    if ((this.mapPing !== undefined) && (this.mapPing >= 1)) {
        msgpack.addPing(toSend);
        this.mapPing -= 1;
    }
    else {
        this.mapPing = undefined;
    }
    if (this.owner !== undefined) {
        if (players[this.owner] !== undefined) {
            msgpack.addNumb(toSend, players[this.owner].playerID);
            if ((players[this.owner].mapPing !== undefined) && (players[this.owner].mapPing >= 1)) {
                msgpack.addPing(toSend);
                players[this.owner].mapPing -= 1;
            }
            else {
                players[this.owner].mapPing = undefined;
            }
            msgpack.addNumb(toSend, Math.round(players[this.owner].loc[0]));
            msgpack.addNumb(toSend, Math.round(players[this.owner].loc[1]));
        }
    }
    for (let j = 0; j < this.members.length; j++) {
        if (this.members[j] !== undefined) {
            if (players[this.members[j]] !== undefined) {
                msgpack.addNumb(toSend, players[this.members[j]].playerID);
                if ((players[this.members[j]].mapPing !== undefined) && (players[this.members[j]].mapPing >= 1)) {
                    msgpack.addPing(toSend);
                    players[this.members[j]].mapPing -= 1;
                }
                else {
                    players[this.members[j]].mapPing = undefined;
                }
                msgpack.addNumb(toSend, Math.round(players[this.members[j]].loc[0]));
                msgpack.addNumb(toSend, Math.round(players[this.members[j]].loc[1]));
            }
        }
    }
    let actualSend = new Uint8Array(toSend);
    for (let j = 0; j < this.members.length; j++) {
        if (connections[this.members[j]] !== undefined) {
            if (connections[this.members[j]] !== undefined) {
                connections[this.members[j]].send(actualSend);
            }
        }
    }
    if (this.owner !== undefined) {
        if (players[this.owner] !== undefined) {
            connections[this.owner].send(actualSend);
        }
    }
}

function acceptPlayer(owner, tplayerID) {
    if (typeof owner.team !== 'undefined') {
        let theTeam = teams[owner.team];
        if (typeof theTeam !== 'undefined') {
            if (theTeam.owner == owner.playerID) {
                theTeam.accept(tplayerID);
            }
        }
    }
}

function makeTeam(player, name) {
    if (typeof player.team == 'undefined') {
        let team = new Team(player, name);
        return team;
    }
    return undefined;
}

exports.teams = teams;
exports.Team = Team;
exports.acceptPlayer = acceptPlayer;
exports.init = init;
exports.makeTeam = makeTeam;