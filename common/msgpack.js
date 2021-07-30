(function(exports) {
    var the_encoder = new TextEncoder();
    var the_decoder = new TextDecoder();

    const TWONUM_IDENT = 2;
    const SMALLNUM_BASE = 40;
    const SMALLNUM_LENGTH = 200;

    const ARRAY_IDENT = 1;
    const SMALLARRAY_BASE = SMALLNUM_BASE + SMALLNUM_LENGTH;
    const SMALLARRAY_LENGTH = 10;

    const STRING_IDENT = 3;
    const FLOAT_IDENT = 4;
    const NEG_FLOAT_IDENT = 5;
    const FLOAT_PRECISION = 1000; // preserve 3 digits

    const NEW_CLAN_DELIM = 18;
    const CLAN_DESTROY_DELIM = 22;

    const PLAYER_UPDATE_DELIM = 19;
    const STRUCTURE_DELIM = 20;
    const PLAYER_DESTROY_DELIM = 23;
    const STRUCTURE_DESTROY_DELIM = 24;
    const PLAYER_NAME_UPDATE = 25;
    const PING = 26;
    const CHAT = 27;
    const TOGGLEAUTOHIT = 28;
    const BULLET_DELIM = 29;
    const BULLET_DESTROY_DELIM = 30;

    const CLAN_REQUEST_DELIM = 31;
    exports.SCORE_UPDATE_DELIM = 32;
    exports.LEADERBOARD_UPDATE_DELIM = 33;
    
    const HIT_DELIM = 34;
    exports.HIT_DELIM = HIT_DELIM;

    exports.TEAM_LOCATION_DELIM = 35;
    const MAP_PING = 36;
    exports.MAP_PING = MAP_PING;
    
    exports.RECONNECT = 37;
	exports.MISC = 38;

    const CLICK = 6;
    const ROTATE = 7;
    const SELITEM = 8;
    const LEFT = 9;
    const RIGHT = 10;
    const UP = 11;
    const DOWN = 12;
    const UPPERLEFT = 13;
    const UPPERRIGHT = 14;
    const LOWERLEFT = 15;
    const LOWERRIGHT = 16;
    const MOVERELEASE = 17;
    const JOIN = 0;

    const SMALLNUM_MIDDLE = Math.round(SMALLNUM_LENGTH / 2);

    function addNumb(acc, num) {
        if (num >= 0) {
            if ((num >= 0) && (num < SMALLNUM_LENGTH)) {
                acc.push(num + SMALLNUM_BASE);
            }
            else if ((num >= 0) && (num <= (256 * 255 + 255))) {
                acc.push(TWONUM_IDENT);
                let rem = num % 256;
                acc.push((num - rem) / 256);
                acc.push(rem);
            }
        }
        return acc;
    }

    function addHit(acc) {
        acc.push(HIT_DELIM);
    }

    function addPing(acc) {
        acc.push(MAP_PING);
    }

    function addPosNegNumb(acc, num) {
        return addNumb(acc, Math.max(0, Math.min(SMALLNUM_LENGTH, num + SMALLNUM_MIDDLE)));
    }

    function addString(acc, input) {
        if (input.length <= 255) {
            acc.push(STRING_IDENT);
            let encoded = the_encoder.encode(input);
            acc.push(encoded.length);
            acc.push(...encoded);
        }
        return acc;
    }

    function addFloat(acc, num) {
        if (num < 0) {
            acc.push(NEG_FLOAT_IDENT);
            let actualNum = Math.round(Math.abs(num) * FLOAT_PRECISION);
            let rem = actualNum % 256;
            acc.push((Math.abs(actualNum) - rem) / 256);
            acc.push(rem);
            return acc;
        }
        else {
            acc.push(FLOAT_IDENT);
            let actualNum = Math.round(num * FLOAT_PRECISION);
            let rem = actualNum % 256;
            acc.push((actualNum - rem) / 256);
            acc.push(rem);
            return acc;
        }
    }

    function addArray(acc, length) {
        if (length <= SMALLARRAY_LENGTH) {
            acc.push(SMALLARRAY_BASE + length);
        }
        else {
            acc.push(ARRAY_IDENT);
            acc.push(length);
        }
        return acc;
    }

    function expectNumb(input) {
        let data = input.data;
        if (data.length - input.start >= 1) {
            if ((data[input.start] >= SMALLNUM_BASE) && (data[input.start] < (SMALLNUM_BASE + SMALLNUM_LENGTH))) {
                input.start += 1;
                return data[input.start-1] - SMALLNUM_BASE;
            }
            else if (data[input.start] == TWONUM_IDENT) {
                if (data.length - input.start >= 3) {
                    input.start += 3;
                    return 256 * data[input.start-2] + data[input.start - 1];
                }
            }
            else if (data[input.start] == FLOAT_IDENT) {
                if (data.length - input.start >= 3) {
                    input.start += 3;
                    return (256 * data[input.start-2] + data[input.start - 1]) / 1000.0;
                }
            }
            else if (data[input.start] == NEG_FLOAT_IDENT) {
                if (data.length - input.start >= 3) {
                    input.start += 3;
                    return (-1.00) * (256 * data[input.start-2] + data[input.start - 1]) / 1000.0;
                }
            }
        }
        return undefined;
    }

    function expectHit(input) {
        let data = input.data;
        if (data.length - input.start >= 1) {
            if (data[input.start] == HIT_DELIM) {
                input.start += 1;
                return true;
            }
        }
        return false;
    }

    function expectPing(input) {
        let data = input.data;
        if (data.length - input.start >= 1) {
            if (data[input.start] == MAP_PING) {
                input.start += 1;
                return true;
            }
        }
        return false;
    }

    function expectString(input) {
        let data = input.data;
        if (data.length - input.start >= 2) {
            if (data[input.start] == STRING_IDENT) {
                let length = data[input.start + 1];
                if (data.length - input.start >= (2 + length)) {
                    input.start += 2 + length;
                    return the_decoder.decode(data.slice(input.start - length, input.start));
                }
            }
        }
        return undefined;
    }

    function expectPosNegNumb(input) {
        let dat = expectNumb(input);
        if (typeof dat !== 'undefined') {
            return dat - SMALLNUM_MIDDLE;
        }
        return undefined;
    }

    // We don't worry too much about processArray leaving the message in a broken state if it fails because processArray is not supposed to fail in the first place
    /*
    function processArray(input, length, offset) {
        let toReturn = [];
        for (let j = 0; j < length; j++) {
            let temp = undefined;
            if ((temp = expectNumb(input)) != undefined) {
                toReturn.push(temp);
            }
            else if ((temp = expectString(input)) != undefined) {
                toReturn.push(temp);
            }
            else {
                return undefined;
            }
        }
        return toReturn;
    }
    */

    function expectArray(input) {
        let data = input.data;
        if (data.length > input.start) {
            if ((data[input.start] >= SMALLARRAY_BASE) && (data[input.start] < SMALLARRAY_BASE + SMALLARRAY_LENGTH)) {
                let length = data[input.start] - SMALLARRAY_BASE;
                if (data.length - input.start >= 1) {
                    input.start += 1;
                    return length;
                }
            }
            else if (data[input.start] == ARRAY_IDENT) {
                if (data.length - input.start >= 2) {
                    let length = data[input.start + 1];
                    input.start += 2;
                    return length;
                }
            }
        }
        return undefined;
    }

    function preDecode(input, start=0) {
        return {
            data: input,
            start: start,
        };
    }

    exports.addNumb = addNumb;
    exports.addString = addString;
    exports.addFloat = addFloat;
    exports.addArray = addArray;
    exports.expectNumb = expectNumb;
    exports.expectString = expectString;
    exports.expectArray = expectArray;
    exports.preDecode = preDecode;
    exports.addPosNegNumb = addPosNegNumb;
    exports.expectPosNegNumb = expectPosNegNumb;
    exports.addHit = addHit;
    exports.expectHit = expectHit;
    exports.addPing = addPing;
    exports.expectPing = expectPing;
    exports.PLAYER_UPDATE_DELIM = PLAYER_UPDATE_DELIM;
    exports.PLAYER_DESTROY_DELIM = PLAYER_DESTROY_DELIM;

    exports.CLICK = CLICK;
    exports.ROTATE = ROTATE;
    exports.SELITEM = SELITEM;
    exports.LEFT = LEFT;
    exports.RIGHT = RIGHT;
    exports.UP = UP;
    exports.DOWN = DOWN;
    exports.UPPERLEFT = UPPERLEFT;
    exports.UPPERRIGHT = UPPERRIGHT;
    exports.LOWERLEFT = LOWERLEFT;
    exports.LOWERRIGHT = LOWERRIGHT;
    exports.MOVERELEASE = MOVERELEASE;
    exports.JOIN = JOIN;
    exports.STRUCTURE_DELIM = STRUCTURE_DELIM;
    exports.STRUCTURE_DESTROY_DELIM = STRUCTURE_DESTROY_DELIM;
    exports.PLAYER_NAME_UPDATE = PLAYER_NAME_UPDATE;
    exports.PING = PING;
    exports.CHAT = CHAT;
    exports.TOGGLEAUTOHIT = TOGGLEAUTOHIT;
    exports.BULLET_DELIM = BULLET_DELIM;
    exports.BULLET_DESTROY_DELIM = BULLET_DESTROY_DELIM;
    exports.NEW_CLAN_DELIM = NEW_CLAN_DELIM;
    exports.CLAN_DESTROY_DELIM = CLAN_DESTROY_DELIM;
    exports.CLAN_REQUEST_DELIM = CLAN_REQUEST_DELIM;
})((typeof module === 'undefined') ? window.msgpack = {} : module.exports); 