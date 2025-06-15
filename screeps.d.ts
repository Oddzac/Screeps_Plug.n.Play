/**
 * Screeps TypeScript Declarations
 * This file provides type definitions for the Screeps game API
 */

// Game object contains all methods and properties related to game world manipulation
declare namespace Game {
    export const cpu: CPU;
    export const creeps: {[creepName: string]: Creep};
    export const flags: {[flagName: string]: Flag};
    export const rooms: {[roomName: string]: Room};
    export const spawns: {[spawnName: string]: StructureSpawn};
    export const structures: {[structureId: string]: Structure};
    export const time: number;
    
    export function getObjectById<T>(id: string): T | null;
    export function notify(message: string, groupInterval?: number): void;
}

// Memory object contains all memory properties
declare namespace Memory {
    export const creeps: {[creepName: string]: any};
    export const flags: {[flagName: string]: any};
    export const rooms: {[roomName: string]: any};
    export const spawns: {[spawnName: string]: any};
}

// CPU object
interface CPU {
    limit: number;
    tickLimit: number;
    bucket: number;
    shardLimits: {[shard: string]: number};
    used: number;
    getUsed(): number;
}

// Creep object
interface Creep {
    body: BodyPartDefinition[];
    carry: {[resourceType: string]: number};
    carryCapacity: number;
    fatigue: number;
    hits: number;
    hitsMax: number;
    id: string;
    memory: any;
    name: string;
    owner: Owner;
    pos: RoomPosition;
    room: Room;
    saying: string;
    spawning: boolean;
    store: Store;
    ticksToLive: number;
    
    attack(target: Creep | Structure): ScreepsReturnCode;
    attackController(controller: StructureController): ScreepsReturnCode;
    build(target: ConstructionSite): ScreepsReturnCode;
    cancelOrder(methodName: string): OK | ERR_NOT_FOUND;
    claimController(controller: StructureController): ScreepsReturnCode;
    dismantle(target: Structure): ScreepsReturnCode;
    drop(resourceType: ResourceConstant, amount?: number): ScreepsReturnCode;
    generateSafeMode(controller: StructureController): ScreepsReturnCode;
    getActiveBodyparts(type: BodyPartConstant): number;
    harvest(target: Source | Mineral): ScreepsReturnCode;
    heal(target: Creep): ScreepsReturnCode;
    move(direction: DirectionConstant): ScreepsReturnCode;
    moveByPath(path: PathStep[] | RoomPosition[] | string): ScreepsReturnCode;
    moveTo(target: RoomPosition | {pos: RoomPosition}, opts?: MoveToOpts): ScreepsReturnCode;
    notifyWhenAttacked(enabled: boolean): ScreepsReturnCode;
    pickup(target: Resource): ScreepsReturnCode;
    pull(target: Creep): ScreepsReturnCode;
    rangedAttack(target: Creep | Structure): ScreepsReturnCode;
    rangedHeal(target: Creep): ScreepsReturnCode;
    rangedMassAttack(): ScreepsReturnCode;
    repair(target: Structure): ScreepsReturnCode;
    reserveController(controller: StructureController): ScreepsReturnCode;
    say(message: string, public?: boolean): ScreepsReturnCode;
    signController(controller: StructureController, text: string): ScreepsReturnCode;
    suicide(): ScreepsReturnCode;
    transfer(target: Creep | Structure, resourceType: ResourceConstant, amount?: number): ScreepsReturnCode;
    upgradeController(controller: StructureController): ScreepsReturnCode;
    withdraw(target: Structure | Tombstone, resourceType: ResourceConstant, amount?: number): ScreepsReturnCode;
}

// Room object
interface Room {
    controller: StructureController;
    energyAvailable: number;
    energyCapacityAvailable: number;
    memory: any;
    name: string;
    storage: StructureStorage;
    terminal: StructureTerminal;
    visual: RoomVisual;
    
    createConstructionSite(x: number, y: number, structureType: StructureConstant): ScreepsReturnCode;
    createConstructionSite(pos: RoomPosition, structureType: StructureConstant): ScreepsReturnCode;
    createFlag(x: number, y: number, name?: string, color?: ColorConstant, secondaryColor?: ColorConstant): string | number;
    createFlag(pos: RoomPosition, name?: string, color?: ColorConstant, secondaryColor?: ColorConstant): string | number;
    find<T>(type: FindConstant, opts?: FindOpts): T[];
    findExitTo(room: string): ExitConstant;
    findPath(fromPos: RoomPosition, toPos: RoomPosition, opts?: FindPathOpts): PathStep[];
    getPositionAt(x: number, y: number): RoomPosition | null;
    getTerrain(): RoomTerrain;
    lookAt(x: number, y: number): LookAtResult[];
    lookAt(pos: RoomPosition): LookAtResult[];
    lookAtArea(top: number, left: number, bottom: number, right: number, asArray?: boolean): LookAtResultMatrix | LookAtResultWithPos[];
    lookForAt<T>(type: string, x: number, y: number): T[];
    lookForAt<T>(type: string, pos: RoomPosition): T[];
    lookForAtArea(type: string, top: number, left: number, bottom: number, right: number, asArray?: boolean): LookAtResultMatrix | LookAtResultWithPos[];
}

// Structure objects
interface Structure {
    hits: number;
    hitsMax: number;
    id: string;
    pos: RoomPosition;
    room: Room;
    structureType: StructureConstant;
    destroy(): ScreepsReturnCode;
    isActive(): boolean;
    notifyWhenAttacked(enabled: boolean): ScreepsReturnCode;
}

interface StructureController extends Structure {
    level: number;
    progress: number;
    progressTotal: number;
    reservation: ReservationDefinition;
    safeModeAvailable: number;
    safeModeCooldown: number;
    sign: SignDefinition;
    ticksToDowngrade: number;
    upgradeBlocked: number;
}

interface StructureSpawn extends Structure {
    memory: any;
    name: string;
    spawning: {
        name: string;
        needTime: number;
        remainingTime: number;
        directions?: DirectionConstant[];
    } | null;
    store: Store;
    
    spawnCreep(body: BodyPartConstant[], name: string, opts?: SpawnOptions): ScreepsReturnCode;
    recycleCreep(creep: Creep): ScreepsReturnCode;
    renewCreep(creep: Creep): ScreepsReturnCode;
}

interface StructureStorage extends Structure {
    store: Store;
}

interface StructureTerminal extends Structure {
    store: Store;
    cooldown: number;
    send(resourceType: ResourceConstant, amount: number, destination: string, description?: string): ScreepsReturnCode;
}

interface StructureContainer extends Structure {
    store: Store;
}

interface StructureLink extends Structure {
    store: Store;
    cooldown: number;
    transferEnergy(target: StructureLink, amount?: number): ScreepsReturnCode;
}

// Store interface
interface Store {
    getCapacity(resource?: ResourceConstant): number;
    getFreeCapacity(resource?: ResourceConstant): number;
    getUsedCapacity(resource?: ResourceConstant): number;
    [resource: string]: number | ((resource?: ResourceConstant) => number);
}

// RoomPosition object
interface RoomPosition {
    x: number;
    y: number;
    roomName: string;
    
    createConstructionSite(structureType: StructureConstant): ScreepsReturnCode;
    createFlag(name?: string, color?: ColorConstant, secondaryColor?: ColorConstant): string | number;
    findClosestByPath<T>(type: FindConstant, opts?: FindPathOpts): T | null;
    findClosestByPath<T>(objects: T[], opts?: FindPathOpts): T | null;
    findClosestByRange<T>(type: FindConstant, opts?: FindOpts): T | null;
    findClosestByRange<T>(objects: T[], opts?: FindOpts): T | null;
    findInRange<T>(type: FindConstant, range: number, opts?: FindOpts): T[];
    findInRange<T>(objects: T[], range: number, opts?: FindOpts): T[];
    findPathTo(x: number, y: number, opts?: FindPathOpts): PathStep[];
    findPathTo(target: RoomPosition | {pos: RoomPosition}, opts?: FindPathOpts): PathStep[];
    getDirectionTo(x: number, y: number): DirectionConstant;
    getDirectionTo(target: RoomPosition | {pos: RoomPosition}): DirectionConstant;
    getRangeTo(x: number, y: number): number;
    getRangeTo(target: RoomPosition | {pos: RoomPosition}): number;
    inRangeTo(x: number, y: number, range: number): boolean;
    inRangeTo(target: RoomPosition | {pos: RoomPosition}, range: number): boolean;
    isEqualTo(x: number, y: number): boolean;
    isEqualTo(target: RoomPosition | {pos: RoomPosition}): boolean;
    isNearTo(x: number, y: number): boolean;
    isNearTo(target: RoomPosition | {pos: RoomPosition}): boolean;
    look(): LookAtResult[];
    lookFor<T>(type: string): T[];
}

// Constants
type BodyPartConstant = 'move' | 'work' | 'carry' | 'attack' | 'ranged_attack' | 'tough' | 'heal' | 'claim';
type DirectionConstant = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
type ResourceConstant = 'energy' | 'power' | 'hydrogen' | 'oxygen' | 'lemergium' | 'keanium' | 'zynthium' | 'utrium' | 'catalyst';
type StructureConstant = 'spawn' | 'extension' | 'road' | 'wall' | 'rampart' | 'link' | 'storage' | 'tower' | 'observer' | 'power_spawn' | 'extractor' | 'lab' | 'terminal' | 'container' | 'nuker';
type FindConstant = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 101 | 102 | 103 | 104 | 105 | 106 | 107 | 108 | 109;
type ExitConstant = 1 | 3 | 5 | 7;
type ColorConstant = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

// Return codes
type ScreepsReturnCode = OK | ERR_NOT_OWNER | ERR_NO_PATH | ERR_NAME_EXISTS | ERR_BUSY | ERR_NOT_FOUND | ERR_NOT_ENOUGH_ENERGY | ERR_INVALID_TARGET | ERR_FULL | ERR_NOT_IN_RANGE | ERR_INVALID_ARGS | ERR_TIRED | ERR_NO_BODYPART | ERR_RCL_NOT_ENOUGH | ERR_GCL_NOT_ENOUGH;

type OK = 0;
type ERR_NOT_OWNER = -1;
type ERR_NO_PATH = -2;
type ERR_NAME_EXISTS = -3;
type ERR_BUSY = -4;
type ERR_NOT_FOUND = -5;
type ERR_NOT_ENOUGH_ENERGY = -6;
type ERR_INVALID_TARGET = -7;
type ERR_FULL = -8;
type ERR_NOT_IN_RANGE = -9;
type ERR_INVALID_ARGS = -10;
type ERR_TIRED = -11;
type ERR_NO_BODYPART = -12;
type ERR_RCL_NOT_ENOUGH = -14;
type ERR_GCL_NOT_ENOUGH = -15;

// Additional interfaces
interface BodyPartDefinition {
    boost: string | undefined;
    type: BodyPartConstant;
    hits: number;
}

interface Owner {
    username: string;
}

interface ReservationDefinition {
    username: string;
    ticksToEnd: number;
}

interface SignDefinition {
    username: string;
    text: string;
    time: number;
    datetime: Date;
}

interface MoveToOpts {
    reusePath?: number;
    serializeMemory?: boolean;
    noPathFinding?: boolean;
    visualizePathStyle?: PolyStyle;
    ignoreCreeps?: boolean;
    ignoreRoads?: boolean;
    ignoreDestructibleStructures?: boolean;
    ignoreSwamps?: boolean;
    avoid?: RoomPosition[];
    maxOps?: number;
    maxRooms?: number;
    range?: number;
    plainCost?: number;
    swampCost?: number;
}

interface FindPathOpts {
    ignoreCreeps?: boolean;
    ignoreRoads?: boolean;
    ignoreDestructibleStructures?: boolean;
    ignoreSwamps?: boolean;
    avoid?: RoomPosition[];
    maxOps?: number;
    maxRooms?: number;
    range?: number;
    plainCost?: number;
    swampCost?: number;
    costCallback?: (roomName: string, costMatrix: CostMatrix) => CostMatrix | boolean;
    serialize?: boolean;
}

interface FindOpts {
    filter?: any;
}

interface PathStep {
    x: number;
    y: number;
    dx: number;
    dy: number;
    direction: DirectionConstant;
}

interface RoomTerrain {
    get(x: number, y: number): 0 | 1 | 2;
}

interface LookAtResult {
    type: string;
    [key: string]: any;
}

interface LookAtResultWithPos extends LookAtResult {
    x: number;
    y: number;
}

interface LookAtResultMatrix {
    [y: number]: {
        [x: number]: LookAtResult[]
    };
}

interface PolyStyle {
    fill: string;
    opacity?: number;
    stroke?: string;
    strokeWidth?: number;
    lineStyle?: string;
}

interface SpawnOptions {
    memory?: any;
    energyStructures?: (StructureSpawn | StructureExtension)[];
    dryRun?: boolean;
    directions?: DirectionConstant[];
}

// Global constants
declare const OK: OK;
declare const ERR_NOT_OWNER: ERR_NOT_OWNER;
declare const ERR_NO_PATH: ERR_NO_PATH;
declare const ERR_NAME_EXISTS: ERR_NAME_EXISTS;
declare const ERR_BUSY: ERR_BUSY;
declare const ERR_NOT_FOUND: ERR_NOT_FOUND;
declare const ERR_NOT_ENOUGH_ENERGY: ERR_NOT_ENOUGH_ENERGY;
declare const ERR_INVALID_TARGET: ERR_INVALID_TARGET;
declare const ERR_FULL: ERR_FULL;
declare const ERR_NOT_IN_RANGE: ERR_NOT_IN_RANGE;
declare const ERR_INVALID_ARGS: ERR_INVALID_ARGS;
declare const ERR_TIRED: ERR_TIRED;
declare const ERR_NO_BODYPART: ERR_NO_BODYPART;
declare const ERR_RCL_NOT_ENOUGH: ERR_RCL_NOT_ENOUGH;
declare const ERR_GCL_NOT_ENOUGH: ERR_GCL_NOT_ENOUGH;

declare const FIND_EXIT_TOP: 1;
declare const FIND_EXIT_RIGHT: 3;
declare const FIND_EXIT_BOTTOM: 5;
declare const FIND_EXIT_LEFT: 7;
declare const FIND_EXIT: 10;
declare const FIND_CREEPS: 101;
declare const FIND_MY_CREEPS: 102;
declare const FIND_HOSTILE_CREEPS: 103;
declare const FIND_SOURCES_ACTIVE: 104;
declare const FIND_SOURCES: 105;
declare const FIND_DROPPED_RESOURCES: 106;
declare const FIND_STRUCTURES: 107;
declare const FIND_MY_STRUCTURES: 108;
declare const FIND_HOSTILE_STRUCTURES: 109;
declare const FIND_FLAGS: 110;
declare const FIND_CONSTRUCTION_SITES: 111;
declare const FIND_MY_SPAWNS: 112;
declare const FIND_HOSTILE_SPAWNS: 113;
declare const FIND_MY_CONSTRUCTION_SITES: 114;
declare const FIND_HOSTILE_CONSTRUCTION_SITES: 115;
declare const FIND_MINERALS: 116;
declare const FIND_NUKES: 117;
declare const FIND_TOMBSTONES: 118;
declare const FIND_POWER_CREEPS: 119;
declare const FIND_MY_POWER_CREEPS: 120;
declare const FIND_HOSTILE_POWER_CREEPS: 121;
declare const FIND_DEPOSITS: 122;
declare const FIND_RUINS: 123;

declare const TOP: 1;
declare const TOP_RIGHT: 2;
declare const RIGHT: 3;
declare const BOTTOM_RIGHT: 4;
declare const BOTTOM: 5;
declare const BOTTOM_LEFT: 6;
declare const LEFT: 7;
declare const TOP_LEFT: 8;

declare const RESOURCE_ENERGY: 'energy';
declare const RESOURCE_POWER: 'power';

declare const STRUCTURE_SPAWN: 'spawn';
declare const STRUCTURE_EXTENSION: 'extension';
declare const STRUCTURE_ROAD: 'road';
declare const STRUCTURE_WALL: 'constructedWall';
declare const STRUCTURE_RAMPART: 'rampart';
declare const STRUCTURE_KEEPER_LAIR: 'keeperLair';
declare const STRUCTURE_PORTAL: 'portal';
declare const STRUCTURE_CONTROLLER: 'controller';
declare const STRUCTURE_LINK: 'link';
declare const STRUCTURE_STORAGE: 'storage';
declare const STRUCTURE_TOWER: 'tower';
declare const STRUCTURE_OBSERVER: 'observer';
declare const STRUCTURE_POWER_BANK: 'powerBank';
declare const STRUCTURE_POWER_SPAWN: 'powerSpawn';
declare const STRUCTURE_EXTRACTOR: 'extractor';
declare const STRUCTURE_LAB: 'lab';
declare const STRUCTURE_TERMINAL: 'terminal';
declare const STRUCTURE_CONTAINER: 'container';
declare const STRUCTURE_NUKER: 'nuker';
declare const STRUCTURE_FACTORY: 'factory';
declare const STRUCTURE_INVADER_CORE: 'invaderCore';

declare const MOVE: 'move';
declare const WORK: 'work';
declare const CARRY: 'carry';
declare const ATTACK: 'attack';
declare const RANGED_ATTACK: 'ranged_attack';
declare const TOUGH: 'tough';
declare const HEAL: 'heal';
declare const CLAIM: 'claim';

declare const COLOR_RED: 1;
declare const COLOR_PURPLE: 2;
declare const COLOR_BLUE: 3;
declare const COLOR_CYAN: 4;
declare const COLOR_GREEN: 5;
declare const COLOR_YELLOW: 6;
declare const COLOR_ORANGE: 7;
declare const COLOR_BROWN: 8;
declare const COLOR_GREY: 9;
declare const COLOR_WHITE: 10;

// Add your custom types and extensions here
interface Creep {
    giveWay(): void;
}