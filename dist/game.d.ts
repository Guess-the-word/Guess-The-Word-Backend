export type Team = '1' | '2';
export type Status = 'waiting' | 'playing' | 'finished';
export interface Settings {
    rounds: number;
    turnSeconds: number;
}
export interface TurnResult {
    round: number;
    team: Team;
    outcome: 'correct' | 'passed' | 'expired';
    points: number;
    word: string;
    describerName: string;
}
export interface GuessEntry {
    name: string;
    guess: string;
    round: number;
    team: Team;
}
export interface RoomSnapshot {
    roomName: string;
    players: string[];
    nicknames: Record<string, string>;
    hostId: string;
    teams: Record<Team, string[]>;
    waitingPlayers: string[];
    status: Status;
    settings: Settings;
    lobbyId: string;
    matchId: string | null;
    turnId: number;
    round: number;
    currentTeam: Team;
    describer: string | null;
    yourWord: string | null;
    timeLeft: number;
    score: Record<Team, number>;
    history: TurnResult[];
    guesses: GuessEntry[];
    winner: Team | 'draw' | null;
    notice: string;
}
export type ActionResult = {
    ok: true;
} | {
    ok: false;
    error: string;
};
/** Owns room lifecycle and match rules. Private words never enter a shared snapshot. */
export declare class MatchRooms {
    private publish;
    private now;
    private rooms;
    private memberships;
    constructor(publish: (playerId: string, snapshot: RoomSnapshot) => void, now?: () => number);
    roomFor(playerId: string): string | undefined;
    handle(event: string, playerId: string, payload: unknown): ActionResult;
    private join;
    leave(playerId: string): void;
    private play;
    private beginTurn;
    private resolveTurn;
    private returnToLobby;
    private assignTeam;
    private removeFromTeams;
    private host;
    private round;
    private timeLeft;
    private clearTimer;
    snapshot(playerId: string): RoomSnapshot | undefined;
    private broadcast;
    dispose(): void;
}
//# sourceMappingURL=game.d.ts.map