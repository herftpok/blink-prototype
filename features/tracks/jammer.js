// Replay time drives both the map sticker and the frames in the exported video.
const tower = new Image();
tower.src = new URL('./art/jammer.svg', import.meta.url);
const sparks = [
  [-2.82, 89, '#e1b8ff'], [-2.24, 97, '#fff192'], [-1.18, 99, '#debcff'],
  [-.53, 97, '#fff192'], [.16, 89, '#dfb8ff'], [.69, 86, '#fff192'],
  [2.55, 91, '#fff192'], [3.05, 107, '#ffadd9']
];
export function drawJammer(ctx, gaps, p, duration, height, reduced, family) {
  const fade = 320;
  const gap = gaps.find(g => p >= g.start && (p - g.end) * duration < fade);
  if (!gap || !tower.naturalWidth) return;
  const age = (p - gap.start) * duration;
  const enter = Math.min(1, age / 170);
  const leave = Math.max(0, (p - gap.end) * duration / fade);
  const spring = 1 + 2.5 * (enter - 1) ** 3 + 1.5 * (enter - 1) ** 2;
  ctx.save();
  ctx.globalAlpha = (1 - leave) ** 2 * Math.min(1, age / 65);
  ctx.translate(300, height * .44);
  const scale = reduced ? 1 : .55 + spring * .45;
  ctx.scale(scale, scale);
  for (const [angle, radius, color] of sparks) {
    const pulse = reduced ? .5 : Math.min(1, age / 330);
    const d = radius * (.68 + .42 * pulse);
    ctx.save();
    ctx.translate(Math.cos(angle) * d, Math.sin(angle) * d);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.strokeStyle = '#382644';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-10,-2); ctx.lineTo(0,-6); ctx.lineTo(-1,-1);
    ctx.lineTo(13,-2); ctx.lineTo(0,6); ctx.lineTo(1,1); ctx.closePath();
    ctx.stroke(); ctx.fill(); ctx.restore();
  }
  ctx.shadowColor = '#1a0e3977'; ctx.shadowBlur = 7; ctx.shadowOffsetY = 4;
  ctx.drawImage(tower,-80,-88,160,153);
  ctx.shadowBlur = ctx.shadowOffsetY = 0;
  ctx.rotate(-.055);
  ctx.font = 'italic 900 32px ' + family; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
  ctx.lineWidth = 12; ctx.strokeStyle = 'white'; ctx.strokeText('глушилка',0,65);
  ctx.lineWidth = 5; ctx.strokeStyle = '#37243e'; ctx.strokeText('глушилка',0,65);
  ctx.fillStyle = '#fff095'; ctx.fillText('глушилка',0,65);
  ctx.restore();
}
