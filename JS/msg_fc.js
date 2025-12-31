import * as pushstream from './core/lp';
import Spaces from './spacesLib';
import notifications from './notifications';

export class MsgFlowControl {
	options;
	messagesQueue = [];
	lastRequest = undefined;
	lastRefreshInterval = undefined;
	lastRefreshTime = Date.now();
	uniqId = `.msg_fc${this.lastRefreshTime}`;
	refreshOnFocus = false;

	constructor(options = {}) {
		this.lastRefreshTime = Date.now();
		this.uniqId = `.msg_fc${this.lastRefreshTime}`;

		this.options = {
			onCheck: undefined,
			onRequest: undefined,
			onRefresh: undefined,
			onReset: undefined,
			interval: 30 * 1000,
			focus: false,
			...options
		};

		this.handleFocus = this.handleFocus.bind(this);

		if (this.options.focus) {
			window.addEventListener('focus', this.handleFocus);
		}

		this.enableManualRefresh(!pushstream || !pushstream.avail());

		if (pushstream) {
			pushstream
				.on(`connect`, `msg_fc${this.uniqId}`, (e) => {
					if (!e.first) {
						this.resetQueue();
						this.refreshMessages(true);
					}
					this.enableManualRefresh(false);
				})
				.on(`disconnect`, `msg_fc${this.uniqId}`, () => {
					if (!pushstream.disabled()) {
						this.enableManualRefresh(true);
						this.resetQueue();
					}
				});
		}
	}

	handleFocus() {
		if (this.refreshOnFocus) {
			this.refreshOnFocus = false;
			this.refreshMessages(true);
		}
	}

	addToQueue(ids) {
		if (this.lastRefreshInterval !== undefined)
			return;

		for (const id of ids) {
			if (!this.options.onCheck || this.options.onCheck(id)) {
				this.messagesQueue.push(id);
			}
		}

		if (!this.lastRequest && this.messagesQueue.length) {
			if (this.options.focus && !notifications.isWindowActive()) {
				this.refreshOnFocus = true;
				return;
			}

			const queue = this.messagesQueue;

			this.resetQueue();

			this.lastRequest = this.options.onRequest?.({
				queue,
				done: () => {
					this.lastRequest = undefined;
					this.addToQueue([]);
				},
				fail: () => {
					this.lastRequest = undefined;
					this.resetQueue();
					this.refreshMessages(true);
				}
			});
		}
	}

	resetQueue() {
		this.options.onReset?.();
		Spaces.cancelApi(this.lastRequest);
		this.lastRequest = undefined;
		this.messagesQueue = [];
	}

	enableManualRefresh(enable) {
		const isEnabled = this.lastRefreshInterval !== undefined;

		if (enable == isEnabled)
			return;

		if (isEnabled) {
			clearInterval(this.lastRefreshInterval);
			this.lastRefreshInterval = undefined;
		}

		if (enable) {
			this.lastRefreshInterval = setInterval(() => this.refreshMessages(), this.options.interval / 4);
			this.lastRefreshTime = Date.now();
		}
	}

	refreshMessages(force = false) {
		const now = Date.now();

		if (!this.lastRequest && (force || (this.lastRefreshInterval && now - this.lastRefreshTime >= this.options.interval))) {
			if (this.options.focus && !notifications.isWindowActive()) {
				this.refreshOnFocus = true;
				return;
			}

			this.lastRequest = this.options.onRefresh?.({
				done: () => {
					this.lastRefreshTime = Date.now();
					this.lastRequest = undefined;
				},
				fail: () => {
					this.lastRefreshTime = Date.now();
					this.lastRequest = undefined;
				},
				retry: () => {
					this.lastRefreshTime = Date.now();
					this.lastRequest = undefined;
					this.refreshMessages(true);
				}
			});
		}
	}

	destroy() {
		this.resetQueue();

		if (pushstream) {
			pushstream
			.off(`connect`, `msg_fc${this.uniqId}`)
			.off(`disconnect`, `msg_fc${this.uniqId}`);
		}

		window.removeEventListener('focus', this.handleFocus);
		this.messagesQueue = undefined;
	}

	get(ids) {
		this.addToQueue(ids);
	}

	refresh() {
		this.refreshMessages(true);
	}
}
