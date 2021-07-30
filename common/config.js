(function(exports) {
    const TICK_INTERVAL = 125;
    TICK_CONSTANT = TICK_INTERVAL / 90;

    exports.MAX_HEALTH = 100;
    const PLAYER_RADIUS = 12;
    const EDGE_TOLERANCE = 5 * PLAYER_RADIUS;
    exports.EDGE_TOLERANCE = EDGE_TOLERANCE;

    exports.DEFAULT_KB_ALLOWANCE = 0.8;
    exports.DEFAULT_KB_BASE = 0.1 * TICK_CONSTANT;
    exports.DEFAULT_KB_FACTOR = 0.01 * TICK_CONSTANT;

    exports.CHAT_COOLDOWN = 600;
    exports.MAX_CHAT_LEN = 110;
    exports.MAX_CLAN_LEN = 18;

    exports.HIT_ANGLE = Math.PI / 3;

    const MOVE_SPEED = 4.72 * TICK_CONSTANT;
    exports.MOVE_SPEED = MOVE_SPEED;
    const DECEL_FACTOR = 0.28;
    exports.DECEL_FACTOR = DECEL_FACTOR;
    var PHYSICAL_MOVE_SPEED = (MOVE_SPEED / DECEL_FACTOR) - MOVE_SPEED;
    exports.PHYSICAL_MOVE_SPEED = PHYSICAL_MOVE_SPEED;
    var BOOST_SPEED = 15 * TICK_CONSTANT;
    exports.BOOST_SPEED = BOOST_SPEED;

    const MAP_X = 2000;
    const MAP_Y = 1000;

    const VIEW_X = 800;
    const VIEW_Y = 400;
    exports.VIEW_X = VIEW_X;
    exports.VIEW_Y = VIEW_Y;

    exports.CAVE_X = 1000;

    exports.VIEWDISPLACEMENT_X = (VIEW_X/2) + EDGE_TOLERANCE;
    exports.VIEWDISPLACEMENT_Y = (VIEW_Y/2) + EDGE_TOLERANCE;

    const NUM_CELLS_LEN = 2;
    exports.CELL_LENGTH_X = Math.round(MAP_X / NUM_CELLS_LEN);
    exports.CELL_LENGTH_Y = Math.round(MAP_Y / NUM_CELLS_LEN);

    exports.BGITEMS_PER_VIEW = 4;
    exports.MARSH_SLOW_FACTOR = 0.4;

    exports.SHIELD_HALFANGLE = Math.PI/3;
    exports.SHIELD_DAMAGE_FACTOR = 0.33;

    exports.LANDMINE_RANGE_FACTOR = 3;

    exports.JITTER_SMOOTH_FACTOR = 0;

    exports.TOTEM_TIMER = 4 * 60 * 1000;

    const TRAP_RADIUS = 16;
    exports.TRAP_RADIUS = TRAP_RADIUS;
    const BOOST_RADIUS = 14;
    exports.BOOST_RADIUS = BOOST_RADIUS;
    const SPIKE_RADIUS = 14;
    exports.SPIKE_RADIUS = SPIKE_RADIUS;

    //var TRAP_DECEL_BASE = 0.3;
    var TRAP_TARGET_POINT = Math.pow(TRAP_RADIUS - PLAYER_RADIUS + 2.25, 2);
    exports.TRAP_DISTANCE_COEFF = 5 / (TRAP_RADIUS * TRAP_RADIUS - TRAP_TARGET_POINT);
    exports.TRAP_TARGET_POINT = TRAP_TARGET_POINT;
    exports.TRAP_SPEED_BASE = 0.2; // 0.3
    exports.TRAP_SPEED_FACTOR = 0.2 / 15; // 0.2
    
    exports.GRID_SPACING = 50;
    exports.LOWRES_MULT = 2;

    exports.PING_LENGTH = 4;

    exports.BOOSTBOT_RANGE = 350;

    exports.TOTEM_RELOAD_TIME = 2000;
    exports.TOTEM_FIRE_ID = 29;

    function getActionByName(name) {
        let actualName = name.toLowerCase();
        if (actualName == "build") {
            return 1;
        }
        else if (actualName == "melee") {
            return 2;
        }
        else if (actualName == "heal") {
            return 3;
        }
        else if (actualName == "shield") {
            return 4;
        }
        else if (actualName == "trap") {
            return 5;
        }
        else if (actualName == "gun") {
            return 6;
        }
        else if (actualName == "projectile") {
            return 7;
        }
        else if (actualName == "repairer") {
            return 8;
        }
        else if (actualName == "boost") {
            return 9;
        }
        else if (actualName == "trench") {
            return 10;
        }
        else if (actualName == "landmine") {
            return 11;
        }
        else {
            console.log("ERROR: ILLEGAL ACTION NAME REQUEST");
            return 1;
        }
    }
    exports.getActionByName = getActionByName;

    var unifiedItems = [
        {
            name: "Apple",
            action: getActionByName("heal"),
            heal: 40,
            movemult: 0.75,
			imageFile: "/Apple.png",
			radius: 10,
			holdOffset: 8,
        },
        {
            name: "Stick",
            action: getActionByName("melee"),
            meleeDmg: 20,
            strucDmg: 45,
            range: 2 * PLAYER_RADIUS + 14,
            hitSpeed: 500,
            knockback: 8,
            movemult: 1,
            strucPersistance: undefined,
            wtype: 1,
            imageFile: "/Stick.png",
            offsetY: 6,
            offsetX: 9,
            description: "A balanced weapon, with decent range, attack speed and damage",
        },
        {
            name: "Wood walls",
            action: getActionByName("build"),
            damage: 1,
            health: 450,
            radius: 14,
            build_limit: 35,
            movemult: 0.5,
            imageFile: '/Wall.png',
            ignoreRotation: true,
        },
        {
            name: "Baby spikes",
            action: getActionByName("build"),
            damage: 45, // 45 * TICK_CONSTANT
            health: 350,
            radius: SPIKE_RADIUS,
            collisionKB: 11 * TICK_CONSTANT,
            build_limit: 20,
            movemult: 0.65,
            imageFile: '/Spike.png',
            placeDelta: 1,
            afterPlaceDelta: -2,
        },
        {
            name: "Pit trap",
            action: getActionByName("trap"),
            damage: 0,
            health: 500,
            radius: TRAP_RADIUS,
            build_limit: 8,
            movemult: 0.65,
            ignoreCollisions: true,
            imageFile: '/Pit.png',
            invisible: true,
            afterPlaceDelta: -2,
        },
        {
            name: "Wrench",
            action: getActionByName("melee"),
            meleeDmg: 0,
            strucDmg: 51,
            range: 2 * PLAYER_RADIUS + 8,
            hitSpeed: 500,
            knockback: 8,
            movemult: 1.2,
            wtype: 1,
            strucPersistance: 12,
            imageFile: "/Wrench.png",
            offsetY: 7,
            offsetX: 10,
            description: "Higher move speed and structures damage, but your spikes and traps self destruct after 12 seconds",
        },
        {
            name: "Bat",
            action: getActionByName("melee"),
            meleeDmg: 26,
            strucDmg: 35,
            range: 2 * PLAYER_RADIUS + 20,
            hitSpeed: 500, // 500
            knockback: 10, // 9
            movemult: 1,
            wtype: 1,
            strucPersistance: 60,
            imageFile: "/Bat.png",
            offsetY: 7,
            offsetX: 8,
            description: "FUMINGGGGGGGGGGGGGGGG",
        },
        {
            name: "Airsoft Minigun",
            action: getActionByName("gun"),
            hitSpeed: 433,
            movemult: 0.6,
            fires: 8,
            wtype: 2,
            range: 3 * PLAYER_RADIUS,
            allows: ["Fort Stick"],
            imageFile: "/Minigun.png",
            vertical: true,
            description: "Medium-fast firerate, low damage, high knockback ranged weapon",
        },
        {
            name: "Airsoft Minigun Bullet",
            action: getActionByName("projectile"),
            playerDamage: 32,
            structureDamage: 22,
            radius: 3,
            speed: 39 * TICK_CONSTANT,
            knockback: 8,
            range: 640,
            snipeRange: 300,
            snipeDamage: 44,
            snipeSpeed: 4 * TICK_CONSTANT,
            color: '#000000',
            ignoreRotation: true,
        },
        {
            name: "Shield",
            action: getActionByName("shield"),
            meleeDmg: 36,
            strucDmg: 45,
            range: 2.25 * PLAYER_RADIUS,
            hitSpeed: 1000,
            knockback: 11,
            movemult: 0.7,
            wtype: 2,
            imageFile: "/Shield.png",
            offsetX: 2.25 * PLAYER_RADIUS,
            offsetY: 6,
            description: "Reduces melee damage and blocks projectiles",
        },
        {
            name: "Fort Stick",
            action: getActionByName("melee"),
            meleeDmg: 0,
            selfStrucDmg: 55,
            strucDmg: 26,
            range: 2 * PLAYER_RADIUS + 12,
            hitSpeed: 500,
            knockback: 7,
            movemult: 0.65,
            strucPersistance: undefined,
            wtype: 1,
            imageFile: "/FortStick.png",
            offsetY: 6,
            offsetX: 12,
            description: "Unlocks bigger walls and other base-building items"
        },
        {
            name: "Bigger Walls",
            action: getActionByName("build"),
            damage: 4 * TICK_CONSTANT,
            health: 850,
            radius: 18,
            /*
            kb_allowance: 0.8,
            kb_base: 0 * TICK_CONSTANT,
            kb_factor: 0.02 * TICK_CONSTANT,
            */
            build_limit: 45,
            movemult: 0.5,
            imageFile: '/FortWall.png'
        },
        {
            name: "Platforms",
            action: getActionByName("build"),
            damage: 0,
            health: 100,
            radius: 14,
            /*
            kb_allowance: 1,
            kb_base: 0,
            kb_factor: 0,
            */
            build_limit: 8,
            movemult: 0.5,
            ignoreCollisions: true,
            color: '#D2B48C',
            imageFile: '/Platform.png'
        },
        {
            name: "Rifle",
            action: getActionByName("gun"),
            hitSpeed: 3000,
            movemult: 0.6,
            fires: 14,
            wtype: 2,
            range: 2 * PLAYER_RADIUS + 40,
            imageFile: "/BreachingRifle.png",
            vertical: true,
            allows: ["Wrench"],
            description: "Long range, high damage, slow fire-rate ranged weapon. Currently useless",
        },
        {
            name: "Rifle Round",
            action: getActionByName("projectile"),
            playerDamage: 65,
            structureDamage: 0,
            radius: 3,
            speed: 90 * TICK_CONSTANT,
            knockback: 30,
            range: 800,
            color: '#71797E',
            ignoreRotation: true,
        },
        {
            name: "Screwdriver",
            action: getActionByName("melee"),
            meleeDmg: 10,
            strucDmg: 30, 
            range: 2 * PLAYER_RADIUS + 12,
            hitSpeed: 500,
            knockback: 0,
            movemult: 1,
            wtype: 2,
            heal: true,
            imageFile: "/Screwdriver.png",
            offsetY: 4,
            offsetX: 12,
            description: "Repairs structures and heals players",
        },
        {
            name: "Totem",
            action: getActionByName("build"),
            damage: 0,
            health: 800,
            radius: 23,
            softCollision: {
                kb_allowance: 0.8,
                kb_base: 0,
                kb_factor: 0.001 * TICK_CONSTANT
            },
            build_limit: 1,
            movemult: 0.65,
            imageFile: "/Totem.png",
            lofted: true,
            buildUnscalable: true,
        },
        {
            name: "God Rifle",
            action: getActionByName("gun"),
            hitSpeed: 300,
            movemult: 3,
            fires: 18,
            strucPersistance: 60,
            range: 2 * PLAYER_RADIUS + 40, 
            imageFile: "/BreachingRifle.png", 
            vertical: true,
            wtype: 2,
        },
        {
            name: "God Rifle Round",
            action: getActionByName("projectile"),
            playerDamage: 500,
            structureDamage: 2000,
            radius: 5,
            speed: 70 * TICK_CONSTANT,
            knockback: 30,
            range: 450,
            color: '#FF0000',
            ignoreRotation: true,
        },
        {
            name: "Anti Platform Pad",
            action: getActionByName("build"),
            damage: 0,
            health: 400,
            radius: 16,
            /*
            kb_allowance: 0.8,
            kb_base: 0.1 * TICK_CONSTANT,
            kb_factor: 0.015 * TICK_CONSTANT,
            */
            build_limit: 5,
            movemult: 0.5,
            imageFile: '/Antiplat.png',
            ignoreRotation: true,
            lofted: true,
            ignoreCollisions: true,
        },
        {
            name: "Tree", 
            action: getActionByName("build"), // Not actually placeable
            damage: 0,
            health: 999, // Can't actually take damage
            radius: 30,
            renderRadius: 55, 
            /*
            softCollision: {
                kb_allowance: 0.8,
                kb_base: 0,
                kb_factor: 0.004 * TICK_CONSTANT
            },
            */
            build_limit: 999, // Not actually buildable
            movemult: 0.5, // Not actually hold-able
            imageFile: '/Tree.png',
            
            unbreakable: true,
            lofted: true,
            viewBlocker: true,
        },
        {
            name: "Stone", 
            action: getActionByName("build"), // Not actually placeable
            damage: 0,
            health: 999, // Can't actually take damage
            radius: 30, 
            /*
            kb_allowance: 0.8,
            kb_base: 0,
            kb_factor: 0.01 * TICK_CONSTANT,
            */
            build_limit: 999, // Not actually buildable
            movemult: 0.5, // Not actually hold-able
            imageFile: '/Stone.png',
            
            unbreakable: true,
            viewBlocker: true,
            preventSqueeze: true,
            lofted: true,
            ignoreRotation: true,
        },
        {
            name: "Marsh", 
            action: getActionByName("build"), // Not actually placeable
            damage: 0,
            health: 999, // Can't actually take damage
            radius: 41, 
            /*
            kb_allowance: 1,
            kb_base: 0,
            kb_factor: 0,
            */
            build_limit: 999, // Not actually buildable
            movemult: 0.1, // Not actually hold-able
            imageFile: '/Marsh.png',
            
            unbreakable: true,
            viewBlocker: false,
            ignoreBuildCollisions: true,
            ignoreCollisions: true,
            ignoreRotation: true,
        },
        {
            name: "Boost pads",
            action: getActionByName("boost"),
            damage: 0,
            health: 250,
            radius: BOOST_RADIUS,
            collisionKB: -BOOST_SPEED,
            build_limit: 15,
            movemult: 0.5,
            imageFile: '/Boost.png',
            placeDelta: -1,
            afterPlaceDelta: -2,
            ignoreCollisions: true,
        },
        {
            name: "Boost Wrench",
            action: getActionByName("melee"),
            meleeDmg: 0,
            strucDmg: 51,
            range: 2 * PLAYER_RADIUS + 9,
            hitSpeed: 525,
            knockback: 8,
            movemult: 0.8,
            wtype: 1,
            strucPersistance: undefined,
            imageFile: "/Wrench.png",
            offsetY: 7,
            offsetX: 10,
            description: "Unlocks boost pads",
        },
        {
            name: "Club",
            action: getActionByName("melee"),
            meleeDmg: 49,
            strucDmg: 55,
            range: 2 * PLAYER_RADIUS + 20,
            hitSpeed: 1000,
            knockback: 7,
            movemult: 0.8,
            strucPersistance: 60,
            wtype: 1,
            imageFile: "/Club.png",
            offsetY: 5,
            offsetX: 10,
            description: "Very high damage, slow attack speed weapon. Can instakill with help of spikes",
        },
        {
            name: "Trench",
            action: getActionByName("trench"),
            damage: 0,
            health: 350,
            radius: 16,
            build_limit: 35,
            movemult: 0.65,
            ignoreCollisions: true,
            ignoreBuildCollisions: true,
            imageFile: '/Trench.png',
            ignoreRotation: true,
            invisible: true,
        },
        {
            name: "Landmine",
            action: getActionByName("landmine"),
            health: 150,
            radius: 15,
            damage: 32,
            collisionKB: 18,
            build_limit: 5,
            movemult: 0.65,
            ignoreCollisions: true,
            invisible: true,
            imageFile: '/Landmine.png',
            buildUnscalable: true,
        },
        { // 28
            name: "Katana",
            action: getActionByName("melee"),
            meleeDmg: 20,
            strucDmg: 40,
            range: 2 * PLAYER_RADIUS + 25,
            hitSpeed: 400,
            knockback: 8,
            movemult: 0.8,
            wtype: 1,
            strucPersistance: undefined,
            imageFile: "/Katana.png",
            offsetY: 5,
            offsetX: 10,
			userSelectable: false,
        },
        { // 29
            name: "Totem Bullet",
            action: getActionByName("projectile"),
            playerDamage: 40,
            structureDamage: 0,
            radius: 5,
            speed: 45 * TICK_CONSTANT,
            knockback: 40, // 40
            range: 400,
            color: '#2994ff',
            ignoreRotation: true,
        },
        {
            name: "Estick",
            action: getActionByName("melee"),
            meleeDmg: 0,
            strucDmg: 0,
            range: 2 * PLAYER_RADIUS + 12,
            hitSpeed: 1000,
            knockback: 0,
            movemult: 1,
            strucPersistance: undefined,
            wtype: 2,
            imageFile: "/Estick.png",
            allows: ["Stick"],
            offsetY: 6,
            offsetX: 9,
            description: "Unlocks trenches and landmines to build a different type of base",
        },
        {
            name: "Hammer",
            action: getActionByName("melee"),
            meleeDmg: 5,
            strucDmg: 51,
            range: 2 * PLAYER_RADIUS + 8,
            hitSpeed: 500,
            knockback: 8,
            movemult: 1,
            strucPersistance: undefined,
            wtype: 2,
            imageFile: "/Hammer.png",
            offsetY: 12,
            offsetX: 13,
            description: "Same structures damage as wrench. Good if you're used to pressing 2 to break"
        },
		{
            name: "Harming Powder",
            action: getActionByName("build"),
            damage: 0,
            health: 100,
            radius: 12,
            build_limit: 0,
            movemult: 0.5,
			ignoreCollisions: true,
			invisible: true,
            imageFile: '/HarmingPowder.png',
            ignoreRotation: true,
        },
		{
            name: "No Item",
            action: getActionByName("melee"),
            meleeDmg: 0,
            strucDmg: 0,
            range: 1,
            hitSpeed: 5000,
            knockback: 0,
            movemult: 0.5,
            strucPersistance: undefined,
            wtype: 1,
            imageFile: "/Stick.png",
            offsetY: 0,
            offsetX: 0,
			userSelectable: false,
        },
		{
            name: "Crafter T.1",
            action: getActionByName("build"),
            damage: 0,
            health: 400,
            radius: 30,
            build_limit: 0,
            movemult: 0.5,
            imageFile: '/CrafterT1.png',
            ignoreRotation: true,
            ignoreCollisions: true,
        },
		{
            name: "Wood",
            action: getActionByName("build"),
            damage: 0,
            health: 100,
            radius: 10,
            build_limit: 0,
            movemult: 0.5,
			ignoreCollisions: true,
            imageFile: '/WoodMat.png',
            ignoreRotation: true,
        },
		{
            name: "Rock",
            action: getActionByName("build"),
            damage: 0,
            health: 100,
            radius: 10,
            build_limit: 0,
            movemult: 0.5,
			ignoreCollisions: true,
            imageFile: '/RockMat.png',
            ignoreRotation: true,
        },
		{
			name: "Box",
			action: getActionByName("build"),
            damage: 0,
            health: 300,
            radius: 15,
            build_limit: 0,
            movemult: 0.5,
			ignoreCollisions: true,
            imageFile: '/Box.png',
            ignoreRotation: true,
		},
		{
            name: "Lapis spikes",
            action: getActionByName("build"),
            damage: 21, // 45 * TICK_CONSTANT
            health: 450,
            radius: SPIKE_RADIUS,
            collisionKB: 6 * TICK_CONSTANT,
            build_limit: 0,
            movemult: 0.65,
            imageFile: '/Lapisspike.png',
            placeDelta: 1,
            afterPlaceDelta: -2,
        },
		{
            name: "Furnace",
            action: getActionByName("build"),
            damage: 0,
            health: 400,
            radius: 30,
            build_limit: 0,
            movemult: 0.5,
            imageFile: '/Furnace.png',
            ignoreRotation: true,
            ignoreCollisions: true,
        },
		{
			name: "Charcoal",
			action: getActionByName("build"),
            damage: 0,
            health: 100,
            radius: 10,
            build_limit: 0,
            movemult: 0.5,
			ignoreCollisions: true,
            imageFile: '/Charcoal.png',
            ignoreRotation: true,
		},
		{
			name: "Aluminum",
			action: getActionByName("build"),
            damage: 0,
            health: 100,
            radius: 10,
            build_limit: 0,
            movemult: 0.5,
			ignoreCollisions: true,
            imageFile: '/Aluminum.png',
            ignoreRotation: true,
		},
		{
			name: "TNT",
			action: getActionByName("build"),
            damage: 0,
            health: 100,
            radius: 15,
            build_limit: 0,
            movemult: 0.5,
			ignoreCollisions: true,
			invisible: true,
            imageFile: '/TNT.png',
            ignoreRotation: true,
		},
		{
            name: "Spawner",
            action: getActionByName("build"),
            damage: 0,
            health: 400,
            radius: 25,
            build_limit: 0,
            movemult: 0.5,
            imageFile: '/Spawner.png',
            ignoreRotation: true,
            ignoreCollisions: true,
        },
    ];
    exports.unifiedItems = unifiedItems;

    function getTypeByName(name) {
        for (let j = 0; j < unifiedItems.length; j++) {
            if (unifiedItems[j].name.toLowerCase() == name.toLowerCase()) {
                return j;
            }
        }
        console.log("ERROR: ILLEGAL TYPE REQUEST");
        return 0;
    }
	exports.getTypeByName = getTypeByName;
	
	exports.variableHostiles = [getTypeByName("Baby Spikes"), getTypeByName("Pit Trap"), getTypeByName("Bigger Walls"), getTypeByName("Lapis spikes")];
	
	exports.isValidSecondary = function(primary, secondary) {
		let allows = unifiedItems[secondary].allows;
		if (typeof allows !== 'undefined') {
			for (let j = 0; j < allows.length; j++) {
				if (getTypeByName(allows[j]) != primary) {
					return false;
				}
			}
		}
		return true;
	};
	
	exports.defaultActionBar = [
		[2, getTypeByName("Apple")],
		[3, getTypeByName("Wood walls")],
		[4, getTypeByName("Baby Spikes")],
		[5, getTypeByName("Anti Platform Pad")],
		[6, getTypeByName("Pit trap")],
	];
	exports.itemGrants = [
		[
			[
				[3, getTypeByName("Bigger Walls")],
				[7, getTypeByName("Platforms")],
				[8, getTypeByName("Totem")],
			],
			getTypeByName("Fort Stick")
		],
		[
			[
				[3, getTypeByName("Tree")],
				[4, getTypeByName("Stone")],
				[5, getTypeByName("Marsh")],
			],
			getTypeByName("God Rifle")
		],
		[
			[
				[6, getTypeByName("Boost pads")],
			],
			getTypeByName("Boost Wrench"),
			getTypeByName("Katana")
		],
		[
			[
				[3, getTypeByName("Trench")],
				[7, getTypeByName("Landmine")],
				[8, getTypeByName("Totem")],
			],
			getTypeByName("Estick"),
		],
	];
	
	exports.actionBarSize = 9;
	exports.inventorySize = 6;

    const statPoints = ["Speed", "FOV", "Attack Speed", "Resistance", "Struc. Dmg", "Player Dmg", "Build Limit", "Vanity"];
    const statPointDescriptions = [
        "Increases your move speed",
        "Increases your field of view",
        "Increases your attack speed",
        "Reduces your damage taken",
        "Increases the damage you deal to structures",
        "Increases the damage you deal to players",
        "Increases your build limit",
        "Lets you choose a color (if more than 3 points are put in)",
    ]
    exports.STATS_MAX_VAL = 5;
    const STATS_INITIAL = 2;
    exports.TOTAL_POINTS = STATS_INITIAL * (statPoints.length) + 1;
    exports.STATS_INITIAL = STATS_INITIAL;
    exports.statPoints = statPoints;
    exports.statPointDescriptions = statPointDescriptions;

    exports.SPEED_GROWTH = 0.1;
    exports.FOV_GROWTH = 0.14;
    exports.HIT_GROWTH = 0.04;
    exports.RESISTANCE_GROWTH = 0.1;
    exports.STRUCDMG_GROWTH = 0.1;
    exports.MELEEDMG_GROWTH = 0.13;
    exports.BUILDCOUNT_GROWTH = 0.15;

    exports.colorNames = ['Default', 'Red', 'Blue', 'White', 'Black', 'Green', 'Pink', 'Yellow'];
    exports.colors = ['#4e83d9', '#FF6262', '#6287FF', '#FFFFFF', '#2e2e2e', '#62FF6C', '#D562FF', '#F1FF62'];

    exports.TICK_INTERVAL = TICK_INTERVAL;
    exports.PLAYER_RADIUS = PLAYER_RADIUS;
    exports.MAP_X = MAP_X;
    exports.MAP_Y = MAP_Y;
    exports.NUM_CELLS_LEN = NUM_CELLS_LEN;
    exports.TICK_CONSTANT = TICK_CONSTANT;
})((typeof module === 'undefined') ? window.config = {} : module.exports); 