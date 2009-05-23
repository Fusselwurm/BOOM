
// boom!

// years ago, there was a bomberman clone named BOOM. A DOS program, I think. We played it many times. Three or even four people in front of a 15''CRT. Great times.
// I will honour those with a bomberman of my own. With blackjack. An' hookers.

/* so what do we need?

a landscape, consisting of square tiles.
	* different types of tiles:
		* wall
		* floor
		* inpenetrable wall
	* tiles may have items lying on them
		* different types of items:
			* additional bomb
			* bomb improvement (higher range)
			* shoes to kick 'em
			* ... ?
			* player
				* bomberman
				* ghost

* bombs explode after some time, clearing n tiles in every direction, burning players and revealing items

* need controls so players can... control their players. geez.
	* wasd, plöä, zghj
	* clonk-like controls. hit once, run for eternity

we need a timer that triggers everything. movements of players, ghosts, bomb timers etc.

we need graphical representations of everything, bound to their models by events.

quite a lot of stuff.
*/

// first: tiles. we have a 2-dim array of them.
// for the tiles, we use prototypal inheritance. because they are many.


var BOOM = {
	util: {

		/**
		* to be applied to arrays.
		* @param item array member to be searched for
		* @param path [opt] if the search should go for a member of the array's member
		* @return index or -1
		*/
		indexOf: function (item, name) {
			var length = this.length;
			for (var i = 0; i < length; i++) {
				if ((name && (this[i][name] === item)) || (!name && (this[i] === item))) {
					return i;
				}
			}
			return -1;
		},

		/**
		* get event object. use as a mixin

		* to every listener is called with the same parameters passed to addEvent!
		*
		* @param subject [opt] object that will be the events' sender
		* @param type [opt] event type
		* both parameters are needed
		*
		*/
		eventuality: function (subject, type) {
			var listeners = [];
			return {
				/**
				* @param fn callback function
				* @param scope [opt] object to apply the callback to (i.e.: object the callback is a method of)
				*/
				subscribe: function (fn, scope) {
					if (typeof fn !== 'function') {
						throw {
							message: 'enableEventHandling.addEventListener: parameter no function',
							type: 'InvalidParamException'
						};
					}
					listeners.push({fn: fn, scope: scope});
				},
				/**
				* @param callback is removed from listeners
				*
				*/
				unsubscribe: function (fn) {
					var idx = BOOM.util.indexOf.apply(listeners, [fn], 'fn');
					if (idx > -1) {
						listeners.splice(idx, 1);
						return true;
					}
					return false;
				},
				/**
				* event is fired. listeners are called with three arguments:
				*   subject (as defined when adding the event to the caller)
				*   data
				*   event type (as defined when adding the event to the caller)
				*
				*
				* @param data [opt] data the listener will receive as third parameter
				*/
				fire: function (data) {
					var i, length = listeners.length;
					for (i = 0; i < length; i++) {
						try {
							listeners[i].fn.apply(listeners[i].scope || window, [subject, data, type]);
						} catch (e) {
							BOOM.util.logger.log((typeof subject !== 'undefined' ? subject.toString() + ': ' : '') + 'exception while triggering callback ' + i + ' for ' + type + ' event: ' + e.message);
							if (BOOM.options.debug) {
								throw e;
							}
						}
					}
				}
			};
		},

		logger: (function () {
			var messages = [];
			messages.toString = function () {
				var result = '';
				for (var i = 0; i < this.length; i++) {
					result += this[i].message + '\n';
				}
				return result;
			};

			return {
				/**
				* @param msg log/error message
				* @param type 'info', 'warning', 'error'. defaults to 'error'
				*/
				log: function (msg, type) {
					messages[messages.length] = {
						message: msg || '',
						type: type || 'error'
					};
				},
				getMessages: function () {
					return messages;
				}
			};
		})()
	},
	lib: {
		constructors: (function () {

			var material = {
				getType: function () {
					return 'material';
				},
				blast: function () {
					if (this.material === 'stone') {
						BOOM.engine.transform(this, BOOM.lib.constructors.Sand);
					}
				}
			};
			var player = {
				getType: function () {
					return 'player';
				}
			};
			var powerup = {
				getType: function () {
					return 'powerup';
				},
				blast: function () {
				}
			}
			var that = {
				Granite: function () {
					this.material = 'granite';
				},
				Stone: function () {
					this.material = 'stone';
				},
				Sand: function () {
					this.material = 'sand';
				},
				PowerupBombNumber: function () {
					this.kind = 'number';
				},
				PowerupBlastRange: function () {
					this.kind = 'blast';
				}
			};
			that.Granite.prototype = material;
			that.Stone.prototype = material;
			that.Sand.prototype = material;
			that.PowerupBombNumber.prototype = powerup;
			that.PowerupBlastRange.prototype = powerup;
			return that;
		}()),
		create: (function () {
			var boomobj = {
				blast: function () {
					BOOM.engine.destroy(boomobj);
				}
			};
			return function (F) {
				F.prototype = boomobj;
				return new F();
			}
		}())
	}
};

BOOM.options = {
	tileSize: 20,
	parent: document.getElementById('BOOM_field_of_honour'),
	debug: true,
	size: {
		x: 15,
		y: 15
	}
};

BOOM.engine = (function (my) {
	var my = my || {};
	var that = {};
	my.dimensions = my.dimensions || {
		x: 10,
		y: 10
	};

	my.getInitTile = my.getInitTile || function (x, y) {
		if ((x % 2) && (y % 2)) {
			return my.tile({material: BOOM.lib.constructors.Granite, x: x, y: y});
		} else {
			return my.tile({material: BOOM.lib.constructors.Stone, x: x, y: y});
		}
	};

	// arrays with lists of objects.
	// access via coordinates
	my.tiles = [];
	// direct access to objects
	my.objects = [];

	that.init = function () {
		var i, j, col;
		for (var i = 0; i < my.dimensions.x; i++) {
			for (j = 0; j < my.dimensions.y; j++) {
				my.getInitTile(i, j);
				that.invalidate(i, j);
			}
		}
		that.onInit.fire();
	};

	that.onChange = BOOM.util.eventuality(that, 'onChange');
	that.onInit = BOOM.util.eventuality(that, 'onInit');

	that.getMaterial = function (x, y) {
		var t = my.tiles[x][y];
		for (var i = 0; i < t.length; i++) {
			if (t[i].getType() === 'material') {
				return t[i].material;
			}
		}
	};
	that.getPos = function (obj) {
		var i = BOOM.util.indexOf.apply(my.objects, [obj, 'obj']);
		return {
			x: my.objects[i].pos.x,
			y: my.objects[i].pos.y
		};
	};
	that.getPowerup = function (x, y) {
		var t = my.tiles[x][y];
		for (var i = 0; i < t.length; i++) {
			if (t[i].getType() === 'powerup') {
				return t[i].kind;
			}
		}
	};
	that.blast = function (x, y) {
		var i, t = my.tiles[x][y];
		for (i = 0; i < t.length; i++) {
			t[i].blast();
		}
		BOOM.engine.invalidate(x, y);
	};

	that.destroy = function (obj) {
		var i = BOOM.util.indexOf.apply(my.objects, [obj, 'obj']);
		if (i === -1) {
			return false;
		}
		var o = my.objects[i];

		var j = BOOM.util.indexOf.apply(my.tiles[o.pos.x][o.pos.y], [obj]);
		my.tiles[o.pos.x][o.pos.y].splice(j, 1);

		my.objects.splice(i, 1);
		return true;
	},
	that.transform = function (from, ToConstr) {
		var pos = BOOM.engine.getPos(from);
		BOOM.engine.destroy(from);
		BOOM.engine.createObject(ToConstr, pos.x, pos.y);
	};

	that.invalidate = function (x, y) {
		my.tiles[x][y].status = 'invalid';
	};

	that.createObject = function (Constr, x, y) {
		var o = new Constr();
		var l = my.objects.push({
			pos: {
				x: x,
				y: y
			},
			obj: o
		});
		my.tiles[x][y].push(o);
		BOOM.engine.invalidate(x, y);
		return o;
	}

	// constructor for a tile
	my.tile = function (spec) {
		var rnd = Math.random(), item = '';
		if (!my.tiles[spec.x]) {
			my.tiles[spec.x] = [];
		}
		my.tiles[spec.x][spec.y] = [];
		BOOM.engine.createObject(spec.material, spec.x, spec.y);
		if (spec.material === BOOM.lib.constructors.Stone) {
			if (rnd > 0.8) {
				BOOM.engine.createObject(BOOM.lib.constructors.PowerupBlastRange, spec.x, spec.y);
			} else if (rnd > 0.6) {
				BOOM.engine.createObject(BOOM.lib.constructors.PowerupBombNumber, spec.x, spec.y);
			}
		}
	};


	that.getDebug = function () {
		if (BOOM.options.debug) {
			return {
				tiles: my.tiles,
				objects: my.objects
			};
		}
	};

	window.setInterval(function () {
		var i, j;
		for (i = 0; i < my.tiles.length; i++) {
			for (j = 0; j < my.tiles[i].length; j++) {
				if (my.tiles[i][j].status === 'invalid') {
					that.onChange.fire({x: i, y: j});
					my.tiles[i][j].status = 'valid';
				}
			}
		}
	}, 50)

	return that;
}({dimensions: BOOM.options.size}));

BOOM.graphics = (function () {
	var that = {};

	BOOM.engine.onInit.subscribe(function (subject, data, type) {
	});

	BOOM.engine.onChange.subscribe(function (subject, data, type) {
		var col,
			mat = BOOM.engine.getMaterial(data.x, data.y),
			item = BOOM.engine.getPowerup(data.x, data.y);
		var id = 'BOOM_landscape_' + data.x + '_' + data.y;
		var elm = document.getElementById(id);
		if (!elm) {
			elm = document.createElement('div');
			elm.id = id;
			elm.className = 'BOOM_tile';
			elm.style.left = BOOM.options.tileSize * data.x;
			elm.style.top = BOOM.options.tileSize * data.y;
			elm.style.color = '#fff';
// 			elm.textContent = '0';
			BOOM.options.parent.appendChild(elm);
		}

		switch (mat) {
			case 'granite': col = '#000'; break;
			case 'stone': col = '#999'; break;
			case 'sand': col = '#fff'; break;
			default: col= '#f00';
		}
		elm.style.backgroundColor = col;
		if (mat === 'sand') {
			switch (item) {
				case 'number':
					elm.style.color = '#000';
					elm.textContent = 'o';
					break;
				case 'blast':
					elm.style.color = '#f00';
					elm.textContent = 'o';
					break;
			}
		}

	});

	return that;
}());



BOOM.players = (function () {
	var that = {};
	var players = [];
	that.addPlayers = function () {

		// blast a bit of place for the players to be
		BOOM.engine.blast(0, 0);
		BOOM.engine.blast(1, 0);
		BOOM.engine.blast(0, 1);

		BOOM.engine.blast(BOOM.options.size.x - 1, BOOM.options.size.y - 1);
		BOOM.engine.blast(BOOM.options.size.x - 1, BOOM.options.size.y - 2);
		BOOM.engine.blast(BOOM.options.size.x - 2, BOOM.options.size.y - 1);

		BOOM.engine.blast(0, BOOM.options.size.y - 1);
		BOOM.engine.blast(0, BOOM.options.size.y - 2);
		BOOM.engine.blast(1, BOOM.options.size.y - 1);


		BOOM.engine.blast(BOOM.options.size.x - 1, 0);
		BOOM.engine.blast(BOOM.options.size.x - 1, 1);
		BOOM.engine.blast(BOOM.options.size.x - 2, 0);

		// create players
	};
	return that;
}());

BOOM.engine.init();
BOOM.players.addPlayers();
