(function(exports) {
	let inPlaceCIP = function(playerX, playerY, cx, cy, r, toModify) {
		let a = playerX - cx;
		let b = playerY - cy;

		if (Math.abs(a) < 0.5) {
			a = (Math.sign(a) || 1) * 0.5;
		}
		if (Math.abs(b) < 0.5) {
			b = (Math.sign(b) || 1) * 0.5;
		}

		let discrim = Math.sqrt(b*b * r*r * (a*a + b*b - r*r));

		let x1 = (a * r*r - discrim) / (a*a + b*b);
		let y1 = (a * discrim + b*b * r*r) / (a*a * b + b*b*b);

		let x2 = (discrim + a * r*r) / (a*a + b*b);
		let y2 = (b*b * r*r - a * discrim) / (a*a * b + b*b*b);

		toModify[0] = x1 + cx;
		toModify[1] = y1 + cy;
		toModify[2] = x2 + cx;
		toModify[3] = y2 + cy;
	}
	let calcInterceptPoints = function(playerX, playerY, cx, cy, r) {
		let toReturn = [0, 0, 0, 0];
		inPlaceCIP(playerX, playerY, cx, cy, r, toReturn);
		return toReturn;
	}
	
	let inPlaceEC = function(x, y, lengthX, lengthY, toModify) {
		var a = 0;
		var b = 0;

		if (Math.abs(x) <= 0.5) {
			a = 0;
			b = lengthY * Math.sign(y);
		}
		if (Math.abs(y) / Math.abs(x) >= lengthY / lengthX) {
			a = x * Math.abs(lengthY / y);
			b = lengthY * Math.sign(y);
		}
		else {
			b = y * Math.abs(lengthX / x);
			a = lengthX * Math.sign(x);
		}
		
		toModify[0] = a;
		toModify[1] = b;
	}
	let extendCoords = function(x, y, lengthX, lengthY) {
		let toReturn = [0, 0];
		inPlaceEC(x, y, lengthX, lengthY, toReturn);
		return toReturn;
	}

	/*
	window.extendCoords = function(x, y, lengthX, lengthY) {
		let length = Math.sqrt(x*x + y*y);
		let a = x + (x / length) * el;
		let b = y + (y / length) * el;

		if (Math.abs(b) > lengthY) {
			a = a * Math.abs(lengthY / b);
			b = lengthY * Math.sign(b);
		}

		return [a, b];
	}
	*/
	
	exports.extendCoords = extendCoords;
	exports.calcInterceptPoints = calcInterceptPoints;
	exports.inPlaceEC = inPlaceEC;
	exports.inPlaceCIP = inPlaceCIP;
})((typeof module === 'undefined') ? window : module.exports); 