import module from "module";
import * as pushstream from '../core/lp';
import { Spaces, Codes } from "../spacesLib";
import { throttleRaf } from "../utils";
import { scrollIntoViewIfNotVisible, isVisibleOnScreen } from '../utils/dom';
import pageLoader from '../ajaxify';
import { getVisibleUnreadReactionsCount } from '../widgets/reactions';

let onCleanup = [];

module.on("componentpage", () => {
	const reactionsButton = document.querySelector('.js-mail_reactions_button');

	let cleanupFloatingButton;

	const updateFloatingButton = () => {
		const newReactionsCnt = +reactionsButton.dataset.count;
		if (newReactionsCnt > 0) {
			if (!cleanupFloatingButton) {
				const topAnchor = document.getElementById('mail-text-field');
				const bottomAnchor = document.getElementById('messages_list');
				reactionsButton.classList.remove('mail-reactions-button--is-hidden');
				cleanupFloatingButton = useFloatingButton(reactionsButton, {
					topAnchor,
					bottomAnchor,
					stickyClass: 'mail-reactions-button--is-sticky',
					stickyMargin: 8,
				});
			}
		} else {
			if (cleanupFloatingButton) {
				cleanupFloatingButton();
				cleanupFloatingButton = undefined;
			}
		}
	};

	const updateCounter = (newReactionsCnt) => {
		reactionsButton.dataset.count = newReactionsCnt;
		reactionsButton.querySelector('.js-cnt').textContent = Math.min(99, newReactionsCnt);
		updateFloatingButton();
	};

	reactionsButton.addEventListener('click', async (e) => {
		e.preventDefault();

		const response = await Spaces.asyncApi("uobj.reaction.findNew", {
			Ot: e.currentTarget.dataset.type,
			Pid: e.currentTarget.dataset.parentId,
		});
		if (response.code == Codes.COMMON.ERR_OBJECT_NOT_FOUND) {
			updateCounter(0);
			return;
		}

		if (response.code != 0)
			return;

		const messageElement = document.getElementById(`m${response.object.id}`);
		if (messageElement) {
			const newReactionsCnt = +reactionsButton.dataset.count;
			if (newReactionsCnt > 0)
				updateCounter(newReactionsCnt - 1);
			scrollIntoViewIfNotVisible(messageElement, { start: "center", end: "center" });
		} else {
			pageLoader.loadPage({ url: response.object.url });
		}
	});

	const visibleUnreadCount = getVisibleUnreadReactionsCount();
	if (visibleUnreadCount > 0) {
		const newReactionsCnt = +reactionsButton.dataset.count;
		updateCounter(Math.max(0, newReactionsCnt - visibleUnreadCount));
	}

	const handleNewReactionCounter = (message) => {
		let newReactionsCnt = message.newReactionsCnt;
		if (newReactionsCnt == null)
			return;

		if (message.parentId != +reactionsButton.dataset.parentId)
			return;
		if (message.objectType != +reactionsButton.dataset.type)
			return;

		if (message.act == pushstream.TYPES.USER_OBJECT_ADD_REACTION && message.userId != Spaces.params.nid) {
			const reactionsWidget = document.getElementById(`reactions_${message.objectType}_${message.objectId}`);
			if (reactionsWidget && isVisibleOnScreen(reactionsWidget))
				newReactionsCnt = Math.max(0, newReactionsCnt - 1);
		}
		updateCounter(newReactionsCnt);
	};

	pushstream.on("message", "mail_reactions_button", (message) => {
		switch (message.act) {
			case pushstream.TYPES.USER_OBJECT_ADD_REACTION:
			case pushstream.TYPES.USER_OBJECT_DELETE_REACTION:
			case pushstream.TYPES.USER_OBJECT_VIEW_REACTION:
				handleNewReactionCounter(message);
				break;
		}
	});

	updateFloatingButton();

	onCleanup.push(() => {
		if (cleanupFloatingButton) {
			cleanupFloatingButton();
			cleanupFloatingButton = undefined;
		}
	});
});

module.on("componentpagedone", () => {
	pushstream.off("message", "mail_reactions_button");

	for (const callback of onCleanup)
		callback();
	onCleanup = [];
});

function useFloatingButton(reactionsButton, { topAnchor, bottomAnchor, stickyClass, stickyMargin }) {
	const handleScroll = throttleRaf(() => {
		const buttonRect = reactionsButton.getBoundingClientRect();
		const topAnchorRect = topAnchor.getBoundingClientRect();
		const bottomAnchorRect = bottomAnchor.getBoundingClientRect();
		const buttonHeight = buttonRect.height;
		const alignOffset = buttonHeight / 2;

		let position = "sticky";
		if (topAnchorRect.top >= alignOffset + stickyMargin) {
			position = "top";
		} else if (bottomAnchorRect.bottom <= alignOffset + stickyMargin) {
			position = "bottom";
		}

		reactionsButton.classList.toggle(stickyClass, position == "sticky");

		if (position != "sticky") {
			const parentRect = reactionsButton.offsetParent.getBoundingClientRect();
			const offset = position == "top" ?
				topAnchorRect.top - alignOffset - parentRect.top :
				bottomAnchorRect.bottom - alignOffset - parentRect.top;
			reactionsButton.style.setProperty('--mail-reactions-button-y', `${offset}px`);
		}
	});

	window.addEventListener('scroll', handleScroll, { passive: true });
	window.addEventListener('resize', handleScroll);
	handleScroll();

	return () => {
		window.removeEventListener('scroll', handleScroll);
		window.removeEventListener('resize', handleScroll);
	};
}
