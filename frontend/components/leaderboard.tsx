"use client";

import { useEffect, useState } from "react";
import { LeaderboardEntry, getLeaderboard } from "@/lib/contract";

export function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        setLoading(true);
        setError(null);
        const data = await getLeaderboard();
        setLeaderboard(data);
      } catch (err) {
        console.error("Error fetching leaderboard:", err);
        setError("Failed to load leaderboard data");
      } finally {
        setLoading(false);
      }
    }

    fetchLeaderboard();
  }, []);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatStx = (amount: number) => {
    // Handle NaN, undefined, or null values
    if (isNaN(amount) || amount === undefined || amount === null) {
      return "0.000000";
    }
    return (amount / 1000000).toFixed(6); // Convert microSTX to STX
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2 text-gray-600">Loading leaderboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md">
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <div className="p-8 text-center">
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Games Played Yet</h3>
        <p className="text-gray-600">The leaderboard will show player statistics once games are completed.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Player Leaderboard</h2>
        <p className="text-gray-600">Top players ranked by win rate and games played</p>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-7 gap-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
            <div className="col-span-1">Rank</div>
            <div className="col-span-2">Player</div>
            <div className="col-span-1 text-center">Win Rate</div>
            <div className="col-span-1 text-center">Games</div>
            <div className="col-span-1 text-center">W/L</div>
            <div className="col-span-1 text-center">Net STX</div>
          </div>
        </div>
        
        <ul className="divide-y divide-gray-200">
          {leaderboard.map((entry, index) => (
            <li key={entry.address} className="px-4 py-4 hover:bg-gray-50">
              <div className="grid grid-cols-7 gap-4 items-center">
                {/* Rank */}
                <div className="col-span-1">
                  <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-medium ${
                    index === 0 
                      ? 'bg-yellow-100 text-yellow-800' 
                      : index === 1 
                      ? 'bg-gray-100 text-gray-800'
                      : index === 2
                      ? 'bg-orange-100 text-orange-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {index + 1}
                  </span>
                </div>

                {/* Player Address */}
                <div className="col-span-2">
                  <div className="text-sm font-medium text-gray-900 font-mono">
                    {formatAddress(entry.address)}
                  </div>
                </div>

                {/* Win Rate */}
                <div className="col-span-1 text-center">
                                  <div className="text-sm text-gray-900">
                  {isNaN(entry.winRate) ? "0.0" : entry.winRate.toFixed(1)}%
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                  <div 
                    className="bg-blue-600 h-2 rounded-full" 
                    style={{ width: `${isNaN(entry.winRate) ? 0 : Math.max(0, Math.min(100, entry.winRate))}%` }}
                  ></div>
                </div>
                </div>

                {/* Games Played */}
                <div className="col-span-1 text-center">
                  <div className="text-sm text-gray-900">
                    {entry.stats["games-played"] || 0}
                  </div>
                </div>

                {/* Win/Loss Record */}
                <div className="col-span-1 text-center">
                  <div className="text-sm text-gray-900">
                    <span className="text-green-600 font-medium">{entry.stats["games-won"] || 0}</span>
                    <span className="text-gray-400">/</span>
                    <span className="text-red-600 font-medium">{entry.stats["games-lost"] || 0}</span>
                  </div>
                </div>

                {/* Net STX */}
                <div className="col-span-1 text-center">
                  <div className={`text-sm font-medium ${
                    !isNaN(entry.netStx) && entry.netStx > 0 
                      ? 'text-green-600' 
                      : !isNaN(entry.netStx) && entry.netStx < 0 
                      ? 'text-red-600' 
                      : 'text-gray-900'
                  }`}>
                    {!isNaN(entry.netStx) && entry.netStx >= 0 ? '+' : ''}{formatStx(entry.netStx)} STX
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="text-xs text-gray-500 space-y-1">
        <p>• Win Rate: Percentage of games won out of total games played</p>
        <p>• Net STX: Total STX won minus total STX lost from betting</p>
        <p>• Rankings are sorted by win rate, then by total games played</p>
      </div>
    </div>
  );
}