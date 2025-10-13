import { Cl } from "@stacks/transactions";
import { describe, expect, it } from "vitest";

const accounts = simnet.getAccounts();
const alice = accounts.get("wallet_1")!;
const bob = accounts.get("wallet_2")!;

const CONTRACT_NAME = "tic-tac-toe-stats";

// Helper function to create a new game with the given bet amount, move index, and move
// on behalf of the `user` address
function createGame(
  betAmount: number,
  moveIndex: number,
  move: number,
  user: string
) {
  return simnet.callPublicFn(
    CONTRACT_NAME,
    "create-game",
    [Cl.uint(betAmount), Cl.uint(moveIndex), Cl.uint(move)],
    user
  );
}

// Helper function to join a game with the given move index and move on behalf of the `user` address
function joinGame(gameId: number, moveIndex: number, move: number, user: string) {
  return simnet.callPublicFn(
    CONTRACT_NAME,
    "join-game",
    [Cl.uint(gameId), Cl.uint(moveIndex), Cl.uint(move)],
    user
  );
}

// Helper function to play a move with the given move index and move on behalf of the `user` address
function play(gameId: number, moveIndex: number, move: number, user: string) {
  return simnet.callPublicFn(
    CONTRACT_NAME,
    "play",
    [Cl.uint(gameId), Cl.uint(moveIndex), Cl.uint(move)],
    user
  );
}

describe("Tic Tac Toe Tests", () => {
  it("allows game creation", () => {
    const { result, events } = createGame(100, 0, 1, alice);

    expect(result).toBeOk(Cl.uint(0));
    expect(events.length).toBe(2); // print_event and stx_transfer_event
  });

  it("allows game joining", () => {
    createGame(100, 0, 1, alice);
    const { result, events } = joinGame(0, 1, 2, bob);

    expect(result).toBeOk(Cl.uint(0));
    expect(events.length).toBe(2); // print_event and stx_transfer_event
  });

  it("allows game playing", () => {
    createGame(100, 0, 1, alice);
    joinGame(0, 1, 2, bob);
    const { result, events } = play(0, 2, 1, alice);

    expect(result).toBeOk(Cl.uint(0));
    expect(events.length).toBe(1); // print_event
  });

  it("does not allow creating a game with a bet amount of 0", () => {
    const { result } = createGame(0, 0, 1, alice);
    expect(result).toBeErr(Cl.uint(100));
  });

  it("does not allow joining a game that has already been joined", () => {
    createGame(100, 0, 1, alice);
    joinGame(0, 1, 2, bob);

    const { result } = joinGame(0, 1, 2, alice);
    expect(result).toBeErr(Cl.uint(103));
  });

  it("does not allow an out of bounds move", () => {
    createGame(100, 0, 1, alice);
    joinGame(0, 1, 2, bob);

    const { result } = play(0, 10, 1, alice);
    expect(result).toBeErr(Cl.uint(101));
  });

  it("does not allow a non X or O move", () => {
    createGame(100, 0, 1, alice);
    joinGame(0, 1, 2, bob);

    const { result } = play(0, 2, 3, alice);
    expect(result).toBeErr(Cl.uint(101));
  });

  it("does not allow moving on an occupied spot", () => {
    createGame(100, 0, 1, alice);
    joinGame(0, 1, 2, bob);

    const { result } = play(0, 1, 1, alice);
    expect(result).toBeErr(Cl.uint(101));
  });

  it("allows player one to win", () => {
    createGame(100, 0, 1, alice);
    joinGame(0, 3, 2, bob);
    play(0, 1, 1, alice);
    play(0, 4, 2, bob);
    const { result, events } = play(0, 2, 1, alice);

    expect(result).toBeOk(Cl.uint(0));
    expect(events.length).toBe(2); // print_event and stx_transfer_event

    const gameData = simnet.getMapEntry(CONTRACT_NAME, "games", Cl.uint(0));
    expect(gameData).toBeSome(
      Cl.tuple({
        "player-one": Cl.principal(alice),
        "player-two": Cl.some(Cl.principal(bob)),
        "is-player-one-turn": Cl.bool(false),
        "bet-amount": Cl.uint(100),
        board: Cl.list([
          Cl.uint(1),
          Cl.uint(1),
          Cl.uint(1),
          Cl.uint(2),
          Cl.uint(2),
          Cl.uint(0),
          Cl.uint(0),
          Cl.uint(0),
          Cl.uint(0),
        ]),
        winner: Cl.some(Cl.principal(alice)),
      })
    );
  });

  it("allows player two to win", () => {
    createGame(100, 0, 1, alice);
    joinGame(0, 3, 2, bob);
    play(0, 1, 1, alice);
    play(0, 4, 2, bob);
    play(0, 8, 1, alice);
    const { result, events } = play(0, 5, 2, bob);

    expect(result).toBeOk(Cl.uint(0));
    expect(events.length).toBe(2); // print_event and stx_transfer_event

    const gameData = simnet.getMapEntry(CONTRACT_NAME, "games", Cl.uint(0));
    expect(gameData).toBeSome(
      Cl.tuple({
        "player-one": Cl.principal(alice),
        "player-two": Cl.some(Cl.principal(bob)),
        "is-player-one-turn": Cl.bool(true),
        "bet-amount": Cl.uint(100),
        board: Cl.list([
          Cl.uint(1),
          Cl.uint(1),
          Cl.uint(0),
          Cl.uint(2),
          Cl.uint(2),
          Cl.uint(2),
          Cl.uint(0),
          Cl.uint(0),
          Cl.uint(1),
        ]),
        winner: Cl.some(Cl.principal(bob)),
      })
    );
  });

  describe("Player Statistics", () => {
    it("initializes player stats with default values", () => {
      const aliceStats = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-player-stats",
        [Cl.principal(alice)],
        alice
      );

      expect(aliceStats.result).toStrictEqual(
        Cl.tuple({
          "games-played": Cl.uint(0),
          "games-won": Cl.uint(0),
          "games-lost": Cl.uint(0),
          "total-stx-won": Cl.uint(0),
          "total-stx-lost": Cl.uint(0),
        })
      );
    });

    it("updates winner statistics correctly", () => {
      // Play a complete game where Alice wins
      createGame(100, 0, 1, alice);
      joinGame(0, 3, 2, bob);
      play(0, 1, 1, alice);
      play(0, 4, 2, bob);
      play(0, 2, 1, alice); // Alice wins

      // Check Alice's stats (winner)
      const aliceStats = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-player-stats",
        [Cl.principal(alice)],
        alice
      );

      expect(aliceStats.result).toStrictEqual(
        Cl.tuple({
          "games-played": Cl.uint(1),
          "games-won": Cl.uint(1),
          "games-lost": Cl.uint(0),
          "total-stx-won": Cl.uint(200), // 100 * 2
          "total-stx-lost": Cl.uint(0),
        })
      );

      // Check Bob's stats (loser)
      const bobStats = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-player-stats",
        [Cl.principal(bob)],
        bob
      );

      expect(bobStats.result).toStrictEqual(
        Cl.tuple({
          "games-played": Cl.uint(1),
          "games-won": Cl.uint(0),
          "games-lost": Cl.uint(1),
          "total-stx-won": Cl.uint(0),
          "total-stx-lost": Cl.uint(100),
        })
      );
    });

    it("tracks statistics across multiple games", () => {
      // Game 1: Alice wins
      createGame(100, 0, 1, alice);
      joinGame(0, 3, 2, bob);
      play(0, 1, 1, alice);
      play(0, 4, 2, bob);
      play(0, 2, 1, alice); // Alice wins

      // Game 2: Bob wins
      createGame(200, 0, 1, alice);
      joinGame(1, 3, 2, bob);
      play(1, 1, 1, alice);
      play(1, 4, 2, bob);
      play(1, 8, 1, alice);
      play(1, 5, 2, bob); // Bob wins

      // Check Alice's cumulative stats
      const aliceStats = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-player-stats",
        [Cl.principal(alice)],
        alice
      );

      expect(aliceStats.result).toStrictEqual(
        Cl.tuple({
          "games-played": Cl.uint(2),
          "games-won": Cl.uint(1),
          "games-lost": Cl.uint(1),
          "total-stx-won": Cl.uint(200), // Won 200 STX in game 1
          "total-stx-lost": Cl.uint(200), // Lost 200 STX in game 2
        })
      );

      // Check Bob's cumulative stats
      const bobStats = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-player-stats",
        [Cl.principal(bob)],
        bob
      );

      expect(bobStats.result).toStrictEqual(
        Cl.tuple({
          "games-played": Cl.uint(2),
          "games-won": Cl.uint(1),
          "games-lost": Cl.uint(1),
          "total-stx-won": Cl.uint(400), // Won 400 STX in game 2
          "total-stx-lost": Cl.uint(100), // Lost 100 STX in game 1
        })
      );
    });

    it("does not update statistics for unfinished games", () => {
      // Start a game but don't finish it
      createGame(100, 0, 1, alice);
      joinGame(0, 3, 2, bob);
      play(0, 1, 1, alice);
      // Game not finished

      // Check that statistics are not updated yet
      const aliceStats = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-player-stats",
        [Cl.principal(alice)],
        alice
      );

      expect(aliceStats.result).toStrictEqual(
        Cl.tuple({
          "games-played": Cl.uint(0),
          "games-won": Cl.uint(0),
          "games-lost": Cl.uint(0),
          "total-stx-won": Cl.uint(0),
          "total-stx-lost": Cl.uint(0),
        })
      );

      const bobStats = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-player-stats",
        [Cl.principal(bob)],
        bob
      );

      expect(bobStats.result).toStrictEqual(
        Cl.tuple({
          "games-played": Cl.uint(0),
          "games-won": Cl.uint(0),
          "games-lost": Cl.uint(0),
          "total-stx-won": Cl.uint(0),
          "total-stx-lost": Cl.uint(0),
        })
      );
    });
  });
});