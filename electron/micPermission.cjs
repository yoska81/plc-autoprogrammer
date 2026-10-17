// Microphone permission for voice input (desktop app): asked once with a native dialog
// (Allow once / Always allow / Don't allow). "Always" is remembered in userData/mic-permission.json and
// can be reset in Settings → Voice; "Allow once" lasts until the app is closed; "Don't allow" is not
// remembered (the next press of a microphone button asks again).
const fs = require('node:fs');
const path = require('node:path');

const FILE = 'mic-permission.json';
const BUTTONS = ['Allow once', 'Always allow', "Don't allow"];

/** Is this permission request the microphone alone (what voice input asks for)? */
function isMicRequest(permission, details) {
  if (permission !== 'media') return false;
  const types = details?.mediaTypes ?? [];
  return types.includes('audio') && !types.includes('video');
}

/** What to do with a microphone request: allow at once, or ask the user. */
function decide(state) {
  return state.always || state.session ? 'allow' : 'ask';
}

/** The state after the user picked a dialog button (index into BUTTONS); `grant` answers the request. */
function applyChoice(state, button) {
  if (button === 1) return { grant: true, state: { ...state, always: true, session: true } };
  if (button === 0) return { grant: true, state: { ...state, session: true } };
  return { grant: false, state: { ...state, session: false } };
}

/** What Settings shows: 'always' | 'session' | 'ask'. */
function status(state) {
  return state.always ? 'always' : state.session ? 'session' : 'ask';
}

function load(dir) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(dir, FILE), 'utf8'));
    return { always: j.always === true, session: false };
  } catch {
    return { always: false, session: false };
  }
}

function save(dir, state) {
  try { fs.writeFileSync(path.join(dir, FILE), JSON.stringify({ always: state.always === true })); } catch { /* read-only profile: asked again next run */ }
}

module.exports = { BUTTONS, FILE, isMicRequest, decide, applyChoice, status, load, save };
