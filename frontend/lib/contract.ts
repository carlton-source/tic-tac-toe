import { STACKS_TESTNET } from "@stacks/network";
import {
  BooleanCV,
  Cl,
  cvToValue,
  fetchCallReadOnlyFunction,
  ListCV,
  OptionalCV,
  PrincipalCV,
  TupleCV,
  uintCV,
  UIntCV,
} from "@stacks/transactions";

const CONTRACT_ADDRESS = "ST262DFWDS07XGFC8HYE4H7MAESRD6M6G1B3K48JF";
const CONTRACT_NAME = "tic-tac-toe-stats";

type GameCV = {
  "player-one": PrincipalCV;
  "player-two": OptionalCV<PrincipalCV>;
  "is-player-one-turn": BooleanCV;
  "bet-amount": UIntCV;
  board: ListCV<UIntCV>;
  winner: OptionalCV<PrincipalCV>;
};

export type Game = {
  id: number;
  "player-one": string;
  "player-two": string | null;
  "is-player-one-turn": boolean;
  "bet-amount": number;
  board: number[];
  winner: string | null;
};

export enum Move {
  EMPTY = 0,
  X = 1,
  O = 2,
}

export const EMPTY_BOARD = [
  Move.EMPTY,
  Move.EMPTY,
  Move.EMPTY,
  Move.EMPTY,
  Move.EMPTY,
  Move.EMPTY,
  Move.EMPTY,
  Move.EMPTY,
  Move.EMPTY,
];

export async function getAllGames() {
  // Fetch the latest-game-id from the contract
  const latestGameIdCV = (await fetchCallReadOnlyFunction({
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: "get-latest-game-id",
    functionArgs: [],
    senderAddress: CONTRACT_ADDRESS,
    network: STACKS_TESTNET,
  })) as UIntCV;

  // Convert the uintCV to a JS/TS number type
  const latestGameId = parseInt(latestGameIdCV.value.toString());

  // Loop from 0 to latestGameId-1 and fetch the game details for each game
  const games: Game[] = [];
  for (let i = 0; i < latestGameId; i++) {
    const game = await getGame(i);
    if (game) games.push(game);
  }
  return games;
}

export async function getGame(gameId: number) {
  // Use the get-game read only function to fetch the game details for the given gameId
  const gameDetails = await fetchCallReadOnlyFunction({
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: "get-game",
    functionArgs: [uintCV(gameId)],
    senderAddress: CONTRACT_ADDRESS,
    network: STACKS_TESTNET,
  });

  const responseCV = gameDetails as OptionalCV<TupleCV<GameCV>>;
  // If we get back a none, then the game does not exist and we return null
  if (responseCV.type === "none") return null;
  // If we get back a value that is not a tuple, something went wrong and we return null
  if (responseCV.value.type !== "tuple") return null;

  // If we got back a GameCV tuple, we can convert it to a Game object
  const gameCV = responseCV.value.value;

  const game: Game = {
    id: gameId,
    "player-one": gameCV["player-one"].value,
    "player-two":
      gameCV["player-two"].type === "some"
        ? gameCV["player-two"].value.value
        : null,
    "is-player-one-turn": cvToValue(gameCV["is-player-one-turn"]),
    "bet-amount": parseInt(gameCV["bet-amount"].value.toString()),
    board: gameCV["board"].value.map((cell) => parseInt(cell.value.toString())),
    winner:
      gameCV["winner"].type === "some" ? gameCV["winner"].value.value : null,
  };
  return game;
}

export async function createNewGame(
  betAmount: number,
  moveIndex: number,
  move: Move
) {
  const txOptions = {
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: "create-game",
    functionArgs: [uintCV(betAmount), uintCV(moveIndex), uintCV(move)],
  };

  return txOptions;
}

export async function joinGame(gameId: number, moveIndex: number, move: Move) {
  const txOptions = {
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: "join-game",
    functionArgs: [uintCV(gameId), uintCV(moveIndex), uintCV(move)],
  };

  return txOptions;
}

export async function play(gameId: number, moveIndex: number, move: Move) {
  const txOptions = {
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: "play",
    functionArgs: [uintCV(gameId), uintCV(moveIndex), uintCV(move)],
  };

  return txOptions;
}

export type PlayerStats = {
  "games-played": number;
  "games-won": number;
  "games-lost": number;
  "total-stx-won": number;
  "total-stx-lost": number;
};

export type LeaderboardEntry = {
  address: string;
  stats: PlayerStats;
  winRate: number;
  netStx: number;
};

export async function getPlayerStats(playerAddress: string): Promise<PlayerStats | null> {
  try {
    const statsCV = await fetchCallReadOnlyFunction({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: "get-player-stats",
      functionArgs: [Cl.standardPrincipal(playerAddress)],
      senderAddress: CONTRACT_ADDRESS,
      network: STACKS_TESTNET,
    });

    if (statsCV.type !== "tuple") return null;

    const stats = statsCV as TupleCV<{
      "games-played": UIntCV;
      "games-won": UIntCV;
      "games-lost": UIntCV;
      "total-stx-won": UIntCV;
      "total-stx-lost": UIntCV;
    }>;

    return {
      "games-played": parseInt(stats.value["games-played"].value.toString()),
      "games-won": parseInt(stats.value["games-won"].value.toString()),
      "games-lost": parseInt(stats.value["games-lost"].value.toString()),
      "total-stx-won": parseInt(stats.value["total-stx-won"].value.toString()),
      "total-stx-lost": parseInt(stats.value["total-stx-lost"].value.toString()),
    };
  } catch (error) {
    console.error("Error fetching player stats:", error);
    return null;
  }
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    // Get all games to find unique players
    const games = await getAllGames();
    const uniquePlayers = new Set<string>();

    // Extract unique player addresses from all games
    games.forEach((game) => {
      uniquePlayers.add(game["player-one"]);
      if (game["player-two"]) {
        uniquePlayers.add(game["player-two"]);
      }
    });

    // Fetch stats for each player
    const leaderboard: LeaderboardEntry[] = [];
    
    for (const playerAddress of uniquePlayers) {
      const stats = await getPlayerStats(playerAddress);
      if (stats && stats["games-played"] > 0) {
        // Safely calculate win rate, ensuring no NaN values
        const gamesWon = stats["games-won"] || 0;
        const gamesPlayed = stats["games-played"] || 0;
        const winRate = gamesPlayed > 0 && !isNaN(gamesWon) && !isNaN(gamesPlayed)
          ? (gamesWon / gamesPlayed) * 100 
          : 0;
        
        // Safely calculate net STX, ensuring no NaN values
        const totalWon = stats["total-stx-won"] || 0;
        const totalLost = stats["total-stx-lost"] || 0;
        const netStx = (!isNaN(totalWon) && !isNaN(totalLost)) 
          ? totalWon - totalLost 
          : 0;

        leaderboard.push({
          address: playerAddress,
          stats,
          winRate: isNaN(winRate) ? 0 : winRate,
          netStx: isNaN(netStx) ? 0 : netStx,
        });
      }
    }

    // Sort by win rate descending, then by games played descending
    return leaderboard.sort((a, b) => {
      if (a.winRate === b.winRate) {
        return b.stats["games-played"] - a.stats["games-played"];
      }
      return b.winRate - a.winRate;
    });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return [];
  }
}
