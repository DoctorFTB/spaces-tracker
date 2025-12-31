import { reachGoal } from "../../../metrics/track";
import Spaces from "../../../spacesLib";

const CHECKPOINT_INTERVAL = 15;
const STAT_RESEND_INTERVAL = 5000;
const REWIND_THRESHOLD = 2;

export function setupViewTracker(player, viewToken) {
	let queue = [];
	let currentCheckpoint;
	let lastApiRequest;
	let prevTimestamp;

	const flushCheckpoints = () => {
		if (currentCheckpoint && currentCheckpoint.start != currentCheckpoint.end) {
			const delta = Math.round(currentCheckpoint.end - currentCheckpoint.start);
			if (delta > 0) {
				queue.push(`${viewToken}:${Math.round(currentCheckpoint.start)}:${delta}`);
				sendStatistic();
			}
		}
		currentCheckpoint = undefined;
	};

	const addCheckpoint = (time) => {
		if (typeof time !== "number" || !Number.isFinite(time))
			return;

		if (prevTimestamp) {
			const delta = time - prevTimestamp;
			if (delta < -0.5 || delta >= REWIND_THRESHOLD)
				flushCheckpoints();
		}
		prevTimestamp = time;

		if (currentCheckpoint) {
			currentCheckpoint.end = time;
			if (currentCheckpoint.end - currentCheckpoint.start >= CHECKPOINT_INTERVAL)
				flushCheckpoints();
		}

		if (!currentCheckpoint) {
			currentCheckpoint = {
				start: time,
				end: time
			};
		}
	};

	const sendStatistic = () => {
		if (lastApiRequest || !queue.length)
			return;

		const chunk = [...queue];

		const onError = (error, retry) => {
			lastApiRequest = undefined;
			console.log(`[view-tracker] ${error}`);
			if (retry)
				queue = [...chunk, ...queue];
			setTimeout(sendStatistic, STAT_RESEND_INTERVAL);
			return;
		};

		queue = [];
		lastApiRequest = Spaces.api("uobj.view", { toKens_player: chunk, CK: null }, (res) => {
			if (res.code != 0) {
				onError(Spaces.apiError(res), false);
				return;
			}
			lastApiRequest = undefined;
		}, { onError: (error) => onError(error, true) });
	};

	player.on("timeupdate", () => addCheckpoint(player.currentTime()));
	player.on("pause", () => flushCheckpoints());
	player.on("ended", () => flushCheckpoints());
}

export function setupStatistic(player) {
	const cleanup = () => {
		player.off("firstplay", onFirstPlay);
		player.off("error", onError);
		player.off("canplay", onCanPlay);
	};

	const onFirstPlay = () => {
		reachGoal("play");
	};
	const onError = () => {
		reachGoal("play_error");
		cleanup();
	};
	const onCanPlay = () => {
		reachGoal("play_success");
		cleanup();
	};

	player.one("firstplay", onFirstPlay);
	player.one("error", onError);
	player.one("canplay", onCanPlay);
}
