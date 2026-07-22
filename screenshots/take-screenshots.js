const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });

  // ── FAN DASHBOARD (mobile viewport) ────────────────────────────────────────
  const fanCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const fan = await fanCtx.newPage();

  // Login page
  await fan.goto('http://localhost:5175');
  await fan.waitForLoadState('networkidle');
  await fan.screenshot({ path: 'd:/kyma/coxa/screenshots/01-fan-login.png', fullPage: true });
  console.log('01 fan login');

  // Login
  try {
    await fan.fill('input[type=email]', 'fan@coxa.local');
    await fan.fill('input[type=password]', 'Demo1234!');
    await fan.click('button[type=submit]');
    await fan.waitForLoadState('networkidle');
    await new Promise(r => setTimeout(r, 2000));
  } catch {}

  // Home
  await fan.goto('http://localhost:5176');
  await fan.waitForLoadState('networkidle');
  await new Promise(r => setTimeout(r, 1500));
  await fan.screenshot({ path: 'd:/kyma/coxa/screenshots/02-fan-home.png', fullPage: true });
  console.log('02 fan home');

  // Membership
  await fan.goto('http://localhost:5176/membership');
  await fan.waitForLoadState('networkidle');
  await new Promise(r => setTimeout(r, 1500));
  await fan.screenshot({ path: 'd:/kyma/coxa/screenshots/03-fan-membership.png', fullPage: true });
  console.log('03 fan membership');

  // Plans tab
  try {
    await fan.click('text=Join');
    await fan.waitForLoadState('networkidle');
    await new Promise(r => setTimeout(r, 1000));
  } catch {}
  await fan.screenshot({ path: 'd:/kyma/coxa/screenshots/03b-fan-membership-plans.png', fullPage: true });
  console.log('03b fan membership plans');

  // Referrals
  await fan.goto('http://localhost:5176/membership/referrals');
  await fan.waitForLoadState('networkidle');
  await new Promise(r => setTimeout(r, 1500));
  await fan.screenshot({ path: 'd:/kyma/coxa/screenshots/04-fan-referrals.png', fullPage: true });
  console.log('04 fan referrals');

  // Rewards
  await fan.goto('http://localhost:5176/rewards');
  await fan.waitForLoadState('networkidle');
  await new Promise(r => setTimeout(r, 1500));
  await fan.screenshot({ path: 'd:/kyma/coxa/screenshots/05-fan-rewards.png', fullPage: true });
  console.log('05 fan rewards');

  await fanCtx.close();

  // ── CLUB DASHBOARD (desktop viewport) ──────────────────────────────────────
  const clubCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const club = await clubCtx.newPage();

  // Login
  await club.goto('http://localhost:5173');
  await club.waitForLoadState('networkidle');
  await club.screenshot({ path: 'd:/kyma/coxa/screenshots/06-club-login.png', fullPage: true });
  console.log('06 club login');

  try {
    await club.fill('input[type=email]', 'admin@coxa.local');
    await club.fill('input[type=password]', 'Demo1234!');
    await club.click('button[type=submit]');
    await club.waitForLoadState('networkidle');
    await new Promise(r => setTimeout(r, 2500));
  } catch {}

  // Overview
  await club.goto('http://localhost:5174');
  await club.waitForLoadState('networkidle');
  await new Promise(r => setTimeout(r, 1500));
  await club.screenshot({ path: 'd:/kyma/coxa/screenshots/07-club-overview.png', fullPage: true });
  console.log('07 club overview');

  // Membership plans
  await club.goto('http://localhost:5174/membership/plans');
  await club.waitForLoadState('networkidle');
  await new Promise(r => setTimeout(r, 1500));
  await club.screenshot({ path: 'd:/kyma/coxa/screenshots/08-club-membership-plans.png', fullPage: true });
  console.log('08 club membership plans');

  // Members
  await club.goto('http://localhost:5174/membership/members');
  await club.waitForLoadState('networkidle');
  await new Promise(r => setTimeout(r, 1500));
  await club.screenshot({ path: 'd:/kyma/coxa/screenshots/09-club-members.png', fullPage: true });
  console.log('09 club members');

  // Priority ranking
  await club.goto('http://localhost:5174/membership/priority');
  await club.waitForLoadState('networkidle');
  await new Promise(r => setTimeout(r, 2000));
  await club.screenshot({ path: 'd:/kyma/coxa/screenshots/10-club-priority.png', fullPage: true });
  console.log('10 club priority');

  // Check-in dashboard (with windows)
  await club.goto('http://localhost:5174/ticketing/check-in');
  await club.waitForLoadState('networkidle');
  await new Promise(r => setTimeout(r, 2000));
  await club.screenshot({ path: 'd:/kyma/coxa/screenshots/11-club-checkin.png', fullPage: true });
  console.log('11 club check-in');

  await clubCtx.close();
  await browser.close();
  console.log('ALL DONE');
})().catch(e => { console.error(e.message); process.exit(1); });
