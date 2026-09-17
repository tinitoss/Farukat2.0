let prevMax = 3000;
for (let l = 11; l <= 500; l++) {
  let span = Math.round(800 * Math.pow(1.025, l - 10));
  if (l > 40) {
    span = Math.round(3000 * Math.pow(1.035, l - 40)); 
  }
  const minXp = prevMax;
  const maxXp = minXp + span;
  prevMax = maxXp;
  if (l === 40 || l === 41 || l === 50 || l === 100 || l === 250 || l === 500) {
    console.log(`Level ${l}: Span ${span}, Total XP to reach: ${maxXp}`);
  }
}
