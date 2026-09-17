const fs = require('fs');
let code = fs.readFileSync('src/components/MembershipCardModal.tsx', 'utf8');

const startStr = "{activeTab === 'achievements' && (";
const endStr = "{/* Weekly Quests Active Banner */}";
const startIndex = code.indexOf(startStr);
const endIndex = code.indexOf(endStr);

if (startIndex !== -1 && endIndex !== -1) {
  const before = code.substring(0, startIndex);
  const after = code.substring(endIndex);
  
  const replacement = `{activeTab === 'achievements' && (
            <div className="flex flex-col gap-5">
              {/* Engagement Dashboard Header */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-[#121212] via-[#1a150a] to-[#241a05] border border-[#e2b14c]/30 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
                <div className="flex items-center gap-4">
                  <div className="p-3.5 rounded-2xl bg-[#e2b14c]/15 border border-[#e2b14c]/40 text-[#e2b14c]">
                    <Trophy className="w-7 h-7" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-mono uppercase tracking-wider text-[#e2b14c] font-bold">
                      Rewards & Achievements
                    </span>
                    <h3 className="text-lg font-black text-white">Engagement Dashboard</h3>
                    <p className="text-xs text-[#aaa]">Earn FARA by logging in, watching media, and completing milestones.</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 bg-black/50 p-3 rounded-xl border border-white/10">
                  <div className="flex flex-col">
                    <span className="text-xs text-[#888] font-medium">Daily Streak</span>
                    <span className="text-base font-black text-white">
                      {rewardState.loginStreak} <span className="text-xs font-normal text-[#777]">days</span>
                    </span>
                  </div>
                  <div className="w-px h-8 bg-white/10" />
                  <div className="flex flex-col">
                    <span className="text-xs text-[#888] font-medium">Watch Time</span>
                    <span className="text-base font-black text-[#e2b14c]">
                      {Math.floor(rewardState.totalWatchSeconds / 60)} <span className="text-xs font-normal text-[#777]">mins</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Reward History */}
              <div className="p-5 rounded-2xl bg-[#111] border border-white/5 flex flex-col gap-3 shadow-lg">
                <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                  <Flame className="w-4 h-4 text-[#e2b14c]" /> Recent Earnings
                </h3>
                {rewardState.history.length === 0 ? (
                  <div className="py-4 text-center text-xs text-[#555]">No rewards earned yet. Start exploring!</div>
                ) : (
                  <div className="flex flex-col gap-2 max-h-[150px] overflow-y-auto">
                    {rewardState.history.slice(0, 5).map(h => (
                      <div key={h.id} className="flex items-center justify-between p-2 rounded-xl bg-black border border-white/5">
                        <span className="text-xs font-semibold text-white">{h.title}</span>
                        <span className="text-xs font-bold text-[#e2b14c]">+{h.amount} FARA</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Active Milestones */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { id: 'FIRST_SALE', title: 'First Sale', desc: 'Sell any asset on the FPX Exchange', amt: 100 },
                  { id: 'HOLD_3_ASSETS', title: 'Hold 3 Assets', desc: 'Hold 3 unique FPX assets simultaneously', amt: 150 },
                  { id: 'PORTFOLIO_PROFIT_10', title: '10% Profit', desc: 'Reach a 750 FARA total portfolio valuation', amt: 200 }
                ].map(ms => (
                  <div key={ms.id} className="p-3 bg-black/60 border border-white/5 rounded-xl flex flex-col gap-2 relative overflow-hidden group">
                    {rewardState.milestones[ms.id] && (
                      <div className="absolute inset-0 bg-[#e2b14c]/10 z-0 pointer-events-none" />
                    )}
                    <div className="flex items-center justify-between z-10">
                      <span className="text-xs font-black text-white">{ms.title}</span>
                      {rewardState.milestones[ms.id] ? (
                        <span className="text-[10px] font-bold text-[#e2b14c] bg-[#e2b14c]/10 px-2 py-0.5 rounded-full">DONE</span>
                      ) : (
                        <span className="text-[10px] font-bold text-white/50 bg-white/5 px-2 py-0.5 rounded-full">+{ms.amt} FARA</span>
                      )}
                    </div>
                    <span className="text-[10px] text-[#888] leading-tight z-10">{ms.desc}</span>
                  </div>
                ))}
              </div>

              `;
  code = before + replacement + after;
  fs.writeFileSync('src/components/MembershipCardModal.tsx', code);
}
