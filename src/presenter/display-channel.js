// The link between the leader window and the projector (display) window.
//
// Two ways to deliver each message, both used every time:
//   1. BroadcastChannel: works between any two windows of the site served over http
//      (npm start, GitHub Pages), even if the display window was opened by hand.
//   2. postMessage straight to the window the leader opened. This also works in the
//      offline file opened from disk, where BroadcastChannel is unreliable.
// Each message carries a session id and a number, and the display ignores repeats and
// old messages, so arriving twice does no harm.
//
// What travels:
//   leader  -> display : "screen" (a full snapshot from display-snapshot.js) and "goodbye"
//   display -> leader  : "display-ready" (send me the current snapshot) and "key" (a forwarded
//                        key press, so the leader can drive the meeting from the projector window)
// Neither display message carries any content.

const CHANNEL_NAME = "military-heritage-display";
const DISPLAY_WINDOW_NAME = "military-heritage-display";
export const FORWARDED_KEYS = ["ArrowRight", "ArrowLeft", " ", "r", "R", "b", "B"];

function openBroadcastChannel() {
  try {
    return typeof BroadcastChannel === "function" ? new BroadcastChannel(CHANNEL_NAME) : null;
  } catch {
    return null; // some browsers refuse BroadcastChannel on file:// pages
  }
}

function makeSessionId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------- Leader side ----------

// One link lives for the whole leader session, so the display stays connected while the
// leader moves between pages. Each page subscribes to the events it cares about.
export function createLeaderLink() {
  const broadcast = openBroadcastChannel();
  const subscribers = new Set();
  const notify = (eventName, value) => subscribers.forEach((handlers) => handlers[eventName]?.(value));
  const onKey = (key) => notify("onKey", key);
  const onDisplayReady = () => notify("onDisplayReady");
  const onStatusChange = (status) => notify("onStatusChange", status);
  const sessionId = makeSessionId();
  let messageNumber = 0;
  let displayWindow = null;
  let lastSnapshot = null;
  let displayConnected = false;

  function deliver(message) {
    if (broadcast) broadcast.postMessage(message);
    if (displayWindow && !displayWindow.closed) displayWindow.postMessage(message, "*");
  }

  function setConnected(connected) {
    if (connected === displayConnected) return;
    displayConnected = connected;
    onStatusChange({ connected });
  }

  // Display messages can arrive by both routes. Each carries an id; act on each id once.
  const seenMessageIds = [];
  function isRepeat(messageId) {
    if (typeof messageId !== "string") return false;
    if (seenMessageIds.includes(messageId)) return true;
    seenMessageIds.push(messageId);
    if (seenMessageIds.length > 50) seenMessageIds.shift();
    return false;
  }

  function handleDisplayMessage(data) {
    if (!data || data.protocol !== 1 || isRepeat(data.messageId)) return;
    if (data.type === "display-ready") {
      setConnected(true);
      if (lastSnapshot) send(lastSnapshot); // a new or refreshed display gets the current screen at once
      onDisplayReady();
    } else if (data.type === "key" && FORWARDED_KEYS.includes(data.key)) {
      onKey(data.key);
    }
  }

  if (broadcast) broadcast.onmessage = (event) => handleDisplayMessage(event.data);
  const windowListener = (event) => {
    // After the leader page reloads it has lost its handle on the display window, but the
    // display still posts to its opener. Adopt the window that says it's ready. That's safe:
    // all it ever receives is the projector snapshot.
    if (event.data?.protocol === 1 && event.data.type === "display-ready" && event.source && event.source !== window) {
      displayWindow = event.source;
    }
    if (displayWindow && event.source === displayWindow) handleDisplayMessage(event.data);
  };
  window.addEventListener("message", windowListener);

  // Notice when the display window the leader opened is closed.
  const closedWatcher = setInterval(() => {
    if (displayWindow && displayWindow.closed) { displayWindow = null; setConnected(false); }
  }, 1000);

  function send(snapshot) {
    lastSnapshot = snapshot;
    messageNumber += 1;
    deliver({ ...snapshot, sessionId, messageNumber });
  }

  function openDisplayWindow() {
    const address = `${location.pathname}${location.search}#/display`;
    displayWindow = window.open(address, DISPLAY_WINDOW_NAME, "popup,width=1280,height=720");
    return Boolean(displayWindow);
  }

  function close() {
    deliver({ protocol: 1, type: "goodbye", sessionId, messageNumber: ++messageNumber });
    clearInterval(closedWatcher);
    window.removeEventListener("message", windowListener);
    if (broadcast) broadcast.close();
  }

  // handlers: { onKey(key), onDisplayReady(), onStatusChange({ connected }) }. Returns an unsubscribe function.
  function subscribe(handlers) {
    subscribers.add(handlers);
    return () => subscribers.delete(handlers);
  }

  return { send, openDisplayWindow, close, subscribe, isConnected: () => displayConnected };
}

// ---------- Display side ----------

// Decides whether the display should act on a message. Pure, so it can be tested.
// tracker: { sessionId, lastMessageNumber }. Returns { accept, tracker }.
// A message from a new session (the leader page was reloaded) replaces the old session.
export function acceptLeaderMessage(tracker, message) {
  if (!message || message.protocol !== 1 || typeof message.sessionId !== "string" || typeof message.messageNumber !== "number") {
    return { accept: false, tracker };
  }
  if (message.type !== "screen" && message.type !== "goodbye") return { accept: false, tracker };
  if (tracker.sessionId === message.sessionId && message.messageNumber <= tracker.lastMessageNumber) {
    return { accept: false, tracker }; // a repeat (it came by both routes) or an old message
  }
  return { accept: true, tracker: { sessionId: message.sessionId, lastMessageNumber: message.messageNumber } };
}

export function createDisplayLink({ onScreen, onGoodbye }) {
  const broadcast = openBroadcastChannel();
  let tracker = { sessionId: null, lastMessageNumber: 0 };

  function receive(message) {
    const result = acceptLeaderMessage(tracker, message);
    if (!result.accept) return;
    tracker = result.tracker;
    if (message.type === "screen") onScreen(message);
    if (message.type === "goodbye" && onGoodbye) onGoodbye();
  }

  function deliver(message) {
    if (broadcast) broadcast.postMessage(message);
    if (window.opener && !window.opener.closed) window.opener.postMessage(message, "*");
  }

  if (broadcast) broadcast.onmessage = (event) => receive(event.data);
  window.addEventListener("message", (event) => {
    if (event.source === window.opener) receive(event.data);
  });

  const displayId = makeSessionId();
  let outgoingNumber = 0;
  const nextMessageId = () => `${displayId}-${++outgoingNumber}`;

  return {
    announceReady: () => deliver({ protocol: 1, type: "display-ready", messageId: nextMessageId() }),
    forwardKey: (key) => { if (FORWARDED_KEYS.includes(key)) deliver({ protocol: 1, type: "key", key, messageId: nextMessageId() }); }
  };
}
