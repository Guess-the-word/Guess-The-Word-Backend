# Guess The Word backend

Express and Socket.IO server for finite two-team matches. Deploy with the companion [Match Mode frontend](https://github.com/Guess-the-word/Guess-The-Word-Frontend); the room event contract changed.

## Local setup

```sh
npm ci
npm run dev
```

The default port is 4000. Configure `PORT`, `HOST`, and `FRONTEND_ORIGIN` as needed; the frontend origin defaults to `http://localhost:3000`. For a production build, run `npm run build` followed by `npm start`.

## Verification

```sh
npm run build
npm test -- --runInBand
npm run lint
```

The frontend repository contains `scripts/test-multiplayer.cjs`, which runs against a temporary server from this compiled backend. Check out both repositories alongside each other, install both projects, build this backend, and run the script from the frontend directory. It covers a complete timed match, scoring, permissions, late joins, rematches, disconnects, and cleanup.

## Match behavior

The first connected player hosts and chooses 3, 5, or 7 rounds and 30, 60, or 90 seconds per turn. Each round has one turn per team. Correct answers score for the active team. Each turn starts with a synchronized 3-second countdown; only then is the secret sent to the describer and the full guessing timer started. Correct, pass, and timeout each resolve one turn, reveal its word to everyone for 2.5 seconds, then advance to the next countdown or final results.

The server validates membership, permissions, match and turn identifiers, and deadlines. Results survive player departures. The host can return everyone to the lobby for a rematch; arrivals during play or results wait until then. A participating player leaving an active match cancels it and returns the room to the lobby. Host ownership passes to the earliest remaining player.

Rooms are held in memory and removed when empty. Each connection is a distinct player, even when names match; refreshing is a departure followed by a new connection. See the frontend README for the full rules and manual acceptance checklist.


## Turn phases

While `status` is `playing`, snapshots include `phase` (`countdown`, `active`, or `reveal`) and `phaseSeconds` (seconds left in that phase). `timeLeft` is the configured guessing duration during countdown, the remaining guessing time during active play, and zero during reveal. The completed word is available through the latest `history` entry during reveal. `turnId` advances after the reveal, and actions outside the active phase are rejected. Server timers own every transition; late arrivals receive the current phase without restarting it. Leaving as a participant cancels countdowns and reveals just like active guessing.

Deploy the companion frontend first; it supports both the original snapshots and these additive phase fields. The frontend transition UI should be live before enabling this backend's countdown/reveal pauses.
