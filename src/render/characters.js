// Personnages dessinés procéduralement (vue isométrique, 4 orientations).
import { shade } from '../core/util.js';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Orientation écran à partir d'une direction monde. */
export function facing(dir) {
  const dx = dir ? dir[0] : 0, dy = dir ? dir[1] : 1;
  const front = dx + dy >= 0;
  let sx = dx - dy;
  if (sx === 0) sx = front ? -1 : 1;
  return { front, right: sx > 0 };
}

function hair(ctx, look, front, right, hy) {
  const c = look.hair;
  const style = look.hairStyle;
  ctx.fillStyle = c;
  if (style === 'bald') {
    ctx.beginPath(); ctx.arc(0, hy + 1, 5.6, Math.PI * 0.85, Math.PI * 1.05); ctx.arc(0, hy + 1, 5.6, -0.05 * Math.PI, 0.15 * Math.PI); ctx.fill();
    return;
  }
  if (style === 'long' || style === 'bob') {
    const len = style === 'long' ? 10 : 5;
    rr(ctx, -6, hy - 3, 12, len + 4, 3); ctx.fill();
  }
  if (!front) {
    ctx.beginPath(); ctx.arc(0, hy, 5.9, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.beginPath(); ctx.arc(0, hy - 0.5, 5.9, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
    ctx.beginPath(); ctx.ellipse(right ? -1.5 : 1.5, hy - 3.6, 5, 2.4, right ? 0.25 : -0.25, 0, Math.PI * 2); ctx.fill();
  }
  if (style === 'ponytail') { ctx.beginPath(); ctx.ellipse(right ? -6 : 6, hy + 1, 2.2, 4.5, right ? 0.5 : -0.5, 0, Math.PI * 2); ctx.fill(); }
  if (style === 'bun') { ctx.beginPath(); ctx.arc(0, hy - 6.5, 2.8, 0, Math.PI * 2); ctx.fill(); }
  if (style === 'curly') { for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.arc(-5 + k * 2, hy - 4 - (k % 2), 2.4, 0, Math.PI * 2); ctx.fill(); } }
  if (style === 'beard' && front) { ctx.beginPath(); ctx.ellipse(right ? 1 : -1, hy + 3.6, 3.8, 2.6, 0, 0, Math.PI); ctx.fill(); }
}

/**
 * Dessine une personne. (x, y) : point au sol (pieds) en pixels monde.
 * o : { look, dir, pose, t, kid, scale, carry, bubble, selected, winter }
 */
export function drawPerson(ctx, x, y, o) {
  const look = o.look;
  const s = (o.kid ? 0.68 : 1) * (o.scale || 1);
  const { front, right } = facing(o.dir);
  const pose = o.pose || 'stand';
  const t = o.t || 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (o.selected) {
    ctx.strokeStyle = 'rgba(255,214,90,0.95)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 0, 11, 5.5, 0, 0, Math.PI * 2); ctx.stroke();
  }
  if (pose !== 'sit' && pose !== 'swing') {
    ctx.fillStyle = 'rgba(20,14,8,0.28)';
    ctx.beginPath(); ctx.ellipse(0, 0, 7.5, 3.2, 0, 0, Math.PI * 2); ctx.fill();
  }
  const walking = pose === 'walk';
  const ph = walking ? Math.sin(t * 11) : 0;
  const bob = walking ? Math.abs(Math.cos(t * 11)) * 1.2 : 0;
  const sitting = pose === 'sit' || pose === 'swing';
  const dirX = right ? 1 : -1;
  const top = look.top, bottom = look.bottom;
  const skin = look.skin;
  // Jambes
  if (sitting) {
    ctx.fillStyle = bottom;
    rr(ctx, -4.5, -4, 9, 4.5, 2); ctx.fill();
    if (front) { rr(ctx, dirX > 0 ? 0 : -6, -2, 6, 5, 1.5); ctx.fill(); ctx.fillStyle = '#2a211b'; rr(ctx, dirX > 0 ? 2 : -5, 2, 4, 2.5, 1); ctx.fill(); }
  } else {
    const lift = 1.6;
    ctx.fillStyle = bottom;
    rr(ctx, -4, -12 - bob, 3.6, 11 + bob - (ph > 0 ? ph * lift : 0), 1.5); ctx.fill();
    rr(ctx, 0.4, -12 - bob, 3.6, 11 + bob - (ph < 0 ? -ph * lift : 0), 1.5); ctx.fill();
    ctx.fillStyle = '#2a211b';
    rr(ctx, -4.4, -2 - (ph > 0 ? ph * lift : 0), 4.2, 2.4, 1); ctx.fill();
    rr(ctx, 0.2, -2 - (ph < 0 ? -ph * lift : 0), 4.2, 2.4, 1); ctx.fill();
  }
  const by = sitting ? -9 : -12 - bob; // bas du torse
  // Sac à dos (derrière si de face)
  if (look.backpack && front) { ctx.fillStyle = '#7a5a3a'; rr(ctx, dirX > 0 ? -8 : 2, by - 12, 6, 11, 2); ctx.fill(); }
  // Bras arrière
  const armSwing = walking ? ph * 0.5 : 0;
  ctx.fillStyle = shade(top, -0.25);
  ctx.save(); ctx.translate(-dirX * 5.5, by - 11); ctx.rotate(-armSwing * dirX); rr(ctx, -1.6, 0, 3.2, 10, 1.5); ctx.fill(); ctx.restore();
  // Torse
  const g = ctx.createLinearGradient(-6, 0, 6, 0);
  g.addColorStop(0, shade(top, 0.1)); g.addColorStop(0.6, top); g.addColorStop(1, shade(top, -0.22));
  ctx.fillStyle = g;
  rr(ctx, -6, by - 13, 12, 14, 4); ctx.fill();
  if (look.vest) { ctx.fillStyle = shade(top, -0.35); rr(ctx, -6, by - 12, 3.5, 12, 2); ctx.fill(); rr(ctx, 2.5, by - 12, 3.5, 12, 2); ctx.fill(); }
  if (look.apron && front) { ctx.fillStyle = '#f4f1ea'; rr(ctx, -4.5, by - 8, 9, 10, 2); ctx.fill(); }
  if (look.backpack && !front) {
    ctx.fillStyle = '#7a5a3a'; rr(ctx, -5, by - 13, 10, 12, 3); ctx.fill();
    ctx.fillStyle = '#5b4028'; rr(ctx, -4, by - 5, 8, 3, 1); ctx.fill();
  } else if (look.backpack && front) {
    ctx.strokeStyle = '#5b4028'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-3, by - 13); ctx.lineTo(-3, by - 4); ctx.moveTo(3, by - 13); ctx.lineTo(3, by - 4); ctx.stroke();
  }
  // Bras avant
  ctx.fillStyle = shade(top, -0.06);
  ctx.save(); ctx.translate(dirX * 5.5, by - 11);
  let rot = armSwing * dirX;
  if (pose === 'cook' || pose === 'clean') rot = -0.9 * dirX + Math.sin(t * 8) * 0.35;
  if (o.carry) rot = -1.25 * dirX;
  ctx.rotate(rot);
  rr(ctx, -1.6, 0, 3.2, 10, 1.5); ctx.fill();
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0, 10.5, 1.8, 0, Math.PI * 2); ctx.fill();
  if (pose === 'clean') { ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(dirX * 2, 22); ctx.stroke(); ctx.fillStyle = '#d9c38a'; ctx.fillRect(dirX * 2 - 3, 20, 6, 3); }
  ctx.restore();
  if (o.carry) {
    ctx.fillStyle = '#f7f3ec'; ctx.beginPath(); ctx.ellipse(dirX * 12, by - 19, 6, 2.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d9772f'; ctx.beginPath(); ctx.arc(dirX * 12, by - 20.5, 2.6, Math.PI, 0); ctx.fill();
  }
  // Tête
  const hy = by - 19;
  ctx.fillStyle = shade(skin, -0.1);
  ctx.fillRect(-1.6, by - 15, 3.2, 3);
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(0, hy, 5.6, 0, Math.PI * 2); ctx.fill();
  if (front) {
    const ex = right ? 1.2 : -1.2;
    ctx.fillStyle = '#2a1d16';
    ctx.beginPath(); ctx.arc(ex - 2, hy + 0.3, 0.8, 0, Math.PI * 2); ctx.arc(ex + 2, hy + 0.3, 0.8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(220,110,100,0.35)';
    ctx.beginPath(); ctx.arc(ex - 3, hy + 2.3, 1.2, 0, Math.PI * 2); ctx.arc(ex + 3, hy + 2.3, 1.2, 0, Math.PI * 2); ctx.fill();
  }
  hair(ctx, look, front, right, hy);
  if (look.chefHat) {
    ctx.fillStyle = '#ffffff';
    rr(ctx, -4.5, hy - 9, 9, 5, 1.5); ctx.fill();
    ctx.beginPath(); ctx.arc(-2.5, hy - 10, 3.2, 0, 7); ctx.arc(2.5, hy - 10, 3.2, 0, 7); ctx.arc(0, hy - 12, 3.4, 0, 7); ctx.fill();
  } else if (look.hat) {
    const hc = o.winter ? '#c4412f' : shade(top, -0.2);
    ctx.fillStyle = hc;
    ctx.beginPath(); ctx.arc(0, hy - 2, 6, Math.PI, 0); ctx.fill();
    if (o.winter) { ctx.fillStyle = '#f4f0e6'; ctx.fillRect(-6, hy - 2.5, 12, 2); ctx.beginPath(); ctx.arc(0, hy - 8.5, 2, 0, 7); ctx.fill(); }
    else { ctx.beginPath(); ctx.ellipse(right ? 4 : -4, hy - 2, 5, 1.6, 0, 0, 7); ctx.fill(); }
  }
  ctx.restore();
}

/** Tête posée sur l'oreiller + couverture (pose couchée). */
export function drawSleeper(ctx, hx, hy, look, quilt, bx, by, kid) {
  const s = kid ? 0.75 : 1;
  ctx.save();
  ctx.fillStyle = shade(quilt, 0.05);
  ctx.beginPath(); ctx.ellipse((hx + bx) / 2, (hy + by) / 2 + 1, Math.hypot(bx - hx, by - hy) / 2 + 4, 6 * s, Math.atan2(by - hy, bx - hx), 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.stroke();
  ctx.translate(hx, hy);
  ctx.scale(s, s);
  ctx.fillStyle = look.skin;
  ctx.beginPath(); ctx.arc(0, -2, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = look.hair;
  ctx.beginPath(); ctx.arc(0, -3.5, 5.2, Math.PI * 0.9, Math.PI * 2.1); ctx.fill();
  ctx.strokeStyle = '#2a1d16'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(-2.6, -1); ctx.lineTo(-0.8, -1); ctx.moveTo(0.8, -1); ctx.lineTo(2.6, -1); ctx.stroke();
  ctx.restore();
}

/** Tête et épaules hors de l'eau (bain nordique). */
export function drawBather(ctx, x, y, look) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = look.skin;
  rr(ctx, -6, -6, 12, 6, 3); ctx.fill();
  ctx.beginPath(); ctx.arc(0, -11, 5.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = look.hair;
  ctx.beginPath(); ctx.arc(0, -12.5, 5.5, Math.PI, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(160,220,232,0.75)';
  ctx.beginPath(); ctx.ellipse(0, -1, 10, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** Bulle d'humeur au-dessus d'un personnage. */
export function drawBubble(ctx, x, y, kind, t) {
  const fy = y + Math.sin(t * 3) * 1.2;
  ctx.save();
  ctx.translate(x, fy);
  ctx.fillStyle = 'rgba(255,253,247,0.95)';
  ctx.strokeStyle = 'rgba(60,40,25,0.35)'; ctx.lineWidth = 1;
  rr(ctx, -8, -16, 16, 13, 5); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-2, -3.5); ctx.lineTo(0, 0); ctx.lineTo(2, -3.5); ctx.fill();
  switch (kind) {
    case 'zzz':
      ctx.fillStyle = '#5b6fa8'; ctx.font = 'bold 9px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('z', -2, -6); ctx.font = 'bold 7px Nunito, sans-serif'; ctx.fillText('z', 3, -9);
      break;
    case 'coin':
      ctx.fillStyle = '#e2b13c'; ctx.beginPath(); ctx.arc(0, -9.5, 4.2, 0, 7); ctx.fill(); ctx.strokeStyle = '#a77a1c'; ctx.stroke();
      ctx.fillStyle = '#a77a1c'; ctx.fillRect(-0.6, -12, 1.2, 5);
      break;
    case 'happy':
      ctx.fillStyle = '#e0566b';
      ctx.beginPath(); ctx.moveTo(0, -5.5); ctx.bezierCurveTo(-7, -10, -3, -15, 0, -11.5); ctx.bezierCurveTo(3, -15, 7, -10, 0, -5.5); ctx.fill();
      break;
    case 'angry':
      ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-4, -13); ctx.lineTo(-1, -10); ctx.lineTo(-4, -7); ctx.moveTo(4, -13); ctx.lineTo(1, -10); ctx.lineTo(4, -7); ctx.stroke();
      break;
    case 'food':
      ctx.fillStyle = '#f2ede2'; ctx.beginPath(); ctx.ellipse(0, -8, 5.5, 2, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#999'; ctx.stroke();
      ctx.fillStyle = '#d9772f'; ctx.beginPath(); ctx.arc(0, -9, 3, Math.PI, 0); ctx.fill();
      break;
    case 'music':
      ctx.fillStyle = '#5b3a8a'; ctx.beginPath(); ctx.ellipse(-1.5, -7, 2, 1.5, -0.4, 0, 7); ctx.fill(); ctx.fillRect(0.2, -14, 1.2, 7);
      break;
    case 'wait':
      ctx.fillStyle = '#7a6a5a'; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(-4 + k * 4, -9.5, 1.2 + (Math.floor(t * 3) % 3 === k ? 0.6 : 0), 0, 7); ctx.fill(); }
      break;
    default:
      ctx.fillStyle = '#d9822b'; ctx.font = 'bold 10px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', 0, -5.5);
  }
  ctx.restore();
}

/** Petit chat (mascotte). */
export function drawCat(ctx, x, y, t, sleeping) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(20,14,8,0.22)'; ctx.beginPath(); ctx.ellipse(0, 0, 7, 2.5, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#d9822b';
  if (sleeping) {
    ctx.beginPath(); ctx.ellipse(0, -3, 7, 4, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(-5, -4, 3.2, 0, 7); ctx.fill();
  } else {
    ctx.beginPath(); ctx.ellipse(0, -5, 6, 3.6, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(-6, -9, 3.4, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-8.5, -11); ctx.lineTo(-8, -14.5); ctx.lineTo(-6.2, -12); ctx.moveTo(-5, -12); ctx.lineTo(-3.8, -14.5); ctx.lineTo(-3.3, -11); ctx.fill();
    ctx.strokeStyle = '#d9822b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(5, -6); ctx.quadraticCurveTo(10, -8 + Math.sin(t * 3) * 3, 9, -14); ctx.stroke();
    ctx.fillStyle = '#c06a1a'; ctx.fillRect(-4, -2, 2, 2.5); ctx.fillRect(2, -2, 2, 2.5);
  }
  ctx.restore();
}
