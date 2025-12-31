import module from 'module';
import $ from '../../jquery';
import * as pushstream from '../../core/lp';
import { MsgFlowControl } from '../../msg_fc';
import Spaces, { Codes, Url } from '../../spacesLib';
import { debounce, L } from '../../utils';
import { scrollIntoViewIfNotVisible } from '../../utils/dom';

const FALLBACK_UPDATE_INTERVAL = 30000;

let balanceError;
let onPage;
let chatId;
let messagesFlowController;
let aiFunctionDynamicCostReq;
let streamingAnswer = {};

const CUSTOM_ERRORS = {
	[Codes.COMMON.ERR_ALREADY_DONE]: L("Дождитесь завершения предыдущего запроса."),
};

const updateAiFunctionDynamicCostDebounced = debounce(updateAiFunctionDynamicCost, 250);

const PLACEHODLERS = {
	text:			L("Введите свой запрос"),
	gen_picture:	L("Опишите картинку"),
	gen_video:		L("Опишите видео"),
};

function init() {
	const chatMessagesWrap = $('#ai_chat_messages');
	if (!chatMessagesWrap.length)
		return;

	balanceError = false;
	onPage = chatMessagesWrap.data('onPage');
	chatId = +chatMessagesWrap.data('chat_id');

	$('#main').action('ai_chat_submit', async (e) => {
		e.preventDefault();

		const input = document.querySelector('.js-text_input_text textarea');
		const message = input.value.trim();

		if (!message.length)
			return;

		if (message.length > input.dataset.maxlength) {
			setFormError(L("Вы превысили максимальную длину вопроса."));
			return;
		}

		setFormError(false);

		lockUI(true);
		try {
			const response = await sendMessage(message);
			input.value = "";
			input.dispatchEvent(new Event('change', { bubbles: true }));

			if (!chatId) {
				chatId = response.chatId;
				setChatMode("chat");
				history.replaceState(history.state, document.title, response.chatUrl);
			}
			scrollIntoViewIfNotVisible(document.querySelector(`#chat-message-${response.messageId}`), { start: "center", end: "center" });
		} catch (e) {
			lockUI(false);
			setFormError(e.message);
			console.error(e);
		}
	}).action('load_more', async (e) => {
		e.preventDefault();

		if (e.currentTarget.dataset.busy)
			return;

		const toggleLoading = (flag) => {
			if (flag) {
				e.currentTarget.dataset.busy = true;
			} else {
				delete e.currentTarget.dataset.busy;
			}
			e.currentTarget.classList.toggle('stnd-link_disabled', flag);
			e.currentTarget.querySelector('.js-ico').classList.toggle('ico_spinner', flag);
		};

		toggleLoading(true);

		const messages = getMessagesIds();
		try {
			const response = await Spaces.asyncApi("services.ai.chat.getMessages", {
				Chat: chatId,
				Before: messages[messages.length - 1],
			});
			if (response.code != 0)
				throw new Error(Spaces.apiError(response));
			for (const messageId in response.messages)
				pushMessage(+messageId, response.messages[messageId]);
			if (!response.has_more)
				setHasMoreData(false);
			onPage = getMessagesIds().length;
		} catch (e) {
			console.error(`[ai-chat]`, e);
		} finally {
			toggleLoading(false);
		}
	}).action('repeat', async (e) => {
		e.preventDefault();
		const repeatMessageId = +e.currentTarget.dataset.id;
		const input = document.querySelector('.js-text_input_text textarea');
		try {
			const response = await Spaces.asyncApi("services.ai.chat.getSubFW", {
				Chat: chatId,
				Id: repeatMessageId,
			});
			if (response.code != 0)
				throw new Error(Spaces.apiError(response));

			const functionForm = document.querySelector(`.js-ai_chat_function[data-function="${response.type}"]`);
			$(functionForm).html(response.sub_fw);

			input.value = response.text;
			input.dispatchEvent(new Event('change', { bubbles: true }));

			openChatFunction(response.type);
			scrollIntoViewIfNotVisible(document.querySelector(`#ai_chat_anchor_top`));
		} catch (e) {
			console.error(`[ai-chat]`, e);
			setFormError(e.message);
		}
	}).action('ai_chat_function', async (e) => {
		e.preventDefault();
		openChatFunction(e.currentTarget.dataset.function);
	}).action('ai_chat_function_close', async (e) => {
		e.preventDefault();
		openChatFunction("text");
	}).action('ai_chat_message_details', async (e) => {
		e.preventDefault();

		const messageElement = $(e.currentTarget).parents('.js-ai_message');
		const toggleLoading = (flag) => {
			messageElement.find('.js-ai_message_details_link_spinner').toggleClass('hide', !flag);
		};

		lockUI(true);
		toggleLoading(true);
		try {
			const response = await sendMessage(undefined, 1);
			scrollIntoViewIfNotVisible(document.querySelector(`#chat-message-${response.messageId}`), { start: "center", end: "center" });
			messageElement.find('.js-ai_message_details_link').addClass('hide');
		} catch (e) {
			setFormError(e.message);
			console.error(e);
		} finally {
			lockUI(false);
			toggleLoading(false);
		}
	});

	$('#main form').on('change input', 'input, textarea, select', (e) => {
		updateAiFunctionDynamicCostDebounced();
	});

	const servicesLink = document.querySelector('.js-action_link[data-action="ai_services_inline"]');
	if (servicesLink)
		initDropdownMenu(servicesLink, "ai_services_inline");

	const handleAnswerSeq = (message, tempAnswer) => {
		if (message.chunkSeq != tempAnswer.seq) {
			console.warn(`[ai-chat] bad seq`, message.chunkSeq, tempAnswer.seq);
			tempAnswer.badSeq = true;
		}
		tempAnswer.seq++;
	};

	const handleStreamingAnswer = (message) => {
		const tempAnswer = initStreamingAnswer(message.replyTo);
		handleAnswerSeq(message, tempAnswer);

		if (!tempAnswer.badSeq) {
			tempAnswer.text = applyTextDelta(tempAnswer.text, message.delta.start, message.delta.end, message.delta.value);
			tempAnswer.messageElement.querySelector('.js-message_text').innerHTML = tempAnswer.text;
		}
	};

	const handleCompleteAnswer = (message) => {
		$('.js-ai_message_details_link').addClass('hide');

		const tempAnswer = streamingAnswer[message.replyTo];
		if (tempAnswer) {
			handleAnswerSeq(message, tempAnswer);

			tempAnswer.messageElement.remove();
			tempAnswer.messageElement.dataset.id = message.messageId;
			tempAnswer.messageElement.id = `chat-message-${message.messageId}`;
			pushMessage(message.messageId, tempAnswer.messageElement);

			delete streamingAnswer[message.replyTo];

			if (tempAnswer.badSeq) {
				messagesFlowController.get([message.messageId]);
			} else {
				const detailsLink = tempAnswer.messageElement.querySelector('.js-ai_message_details_link');
				if (detailsLink)
					detailsLink.classList.toggle('hide', !message.has_more);
			}
		} else {
			messagesFlowController.get([message.messageId]);
		}

		if (message.tokens != null)
			updateMessageStatus(message.replyTo, { tokens: message.tokens });
		lockUI(false);
	};

	const handleError = (message) => {
		const tempAnswer = streamingAnswer[message.replyTo];
		if (tempAnswer) {
			tempAnswer.messageElement.remove();
			delete streamingAnswer[message.replyTo];
		}
		updateMessageStatus(message.replyTo, { error: message.error });
		lockUI(false);
	};

	const handleFreeRequestsBalance = (freeRequestsCnt) => {
		const freeRequestsCount = document.querySelector('#ai_chat_free_requests');
		const freeRequestsInfo = document.querySelector('#ai_chat_cost_info_free');
		const paidRequestsInfo = document.querySelector('#ai_chat_cost_info_paid');

		if (freeRequestsInfo) {
			freeRequestsCount.textContent = freeRequestsCnt.toLocaleString("ru-RU");
			freeRequestsInfo.classList.toggle('hide', freeRequestsCnt <= 0);
		}

		if (paidRequestsInfo)
			paidRequestsInfo.classList.toggle('hide', freeRequestsCnt > 0);
	};

	pushstream.on('message', 'ai_chat', (message) => {
		if (message.act == pushstream.TYPES.AI_CHAT_MESSAGE) {
			if (message.chatId != chatId)
				return;
			if (message.error) {
				handleError(message);
			} else if (message.delta) {
				handleStreamingAnswer(message);
			} else if (message.messageId) {
				handleCompleteAnswer(message);
			}
		}

		if (message.act == pushstream.TYPES.BALANCE_UPDATE) {
			if (message.ai_free_chat_messages != null)
				handleFreeRequestsBalance(message.ai_free_chat_messages);

			if (balanceError && message.ai_tokens != null) {
				setFormError(false);
				balanceError = false;
			}
		}
	});

	const handleResponse = (e, response) => {
		if (response.code != 0) {
			e.fail();
			return;
		}

		e.done();

		if (response.chat_state == 'OPENED')
			lockUI(false);

		for (const messageId in response.messages)
			pushMessage(+messageId, response.messages[messageId]);
		shrinkMessages();
	};

	messagesFlowController = new MsgFlowControl({
		interval: FALLBACK_UPDATE_INTERVAL,
		focus: false,
		onRefresh: (e) => {
			return Spaces.api("services.ai.chat.getMessages", { Chat: chatId }, (response) => {
				handleResponse(e, response);
			}, {
				retry: 10,
				onError() {
					e.fail();
				}
			});
		},
		onRequest: (e) => {
			Spaces.api("services.ai.chat.getMessages", { IdS: e.queue, Chat: chatId }, (response) => {
				handleResponse(e, response);
			}, {
				retry: 10,
				onError() {
					e.fail();
				}
			});
		}
	});

	const input = document.querySelector('.js-text_input_text textarea');
	if (input.disabled) {
		console.log("[ai-chat] force refresh");
		messagesFlowController.refresh();
	}
}

function setFormError(error) {
	const input = document.querySelector('.js-text_input_text textarea');
	Spaces.view.setInputError($(input), error);
}

function setChatMode(newMode) {
	const elements = {
		dashboard:	["ai_chat_functions", "ai_chat_info", "ai_chat_history"],
		chat:		["ai_chat_messages", "ai_chat_delete"],
	};
	for (const mode in elements) {
		for (const elementId of elements[mode]) {
			const element = document.getElementById(elementId);
			if (element)
				element.classList.toggle('hide', newMode != mode);
		}
	}
}

function getChatFunction() {
	const func = document.querySelector('.js-ai_chat_function:not(.hide)');
	return {
		id: func.dataset.function,
		form: func,
		dynamicCost: func.dataset.dynamicCost === "1",
		apiData: {
			...JSON.parse(func.dataset.apiData),
			...Url.serializeForm(func),
		},
	};
}

function openChatFunction(functionId) {
	for (const func of document.querySelectorAll('.js-ai_chat_function'))
		func.classList.toggle('hide', func.dataset.function != functionId);

	const input = document.querySelector('.js-text_input_text textarea');
	input.placeholder = PLACEHODLERS[functionId];
}

async function updateAiFunctionDynamicCost() {
	const func = getChatFunction();
	if (!func.dynamicCost)
		return;
	const input = document.querySelector('.js-text_input_text textarea');
	if (aiFunctionDynamicCostReq)
		Spaces.cancelApi(aiFunctionDynamicCostReq);
	aiFunctionDynamicCostReq = Spaces.api("services.ai.chat.getCost", {
		CK: null,
		text: input.value.trim() || "dummy text",
		Cost: 1,
		...func.apiData,
	}, (response) => {
		if (response.code == 0 && response.cost) {
			func.form.querySelector('.js-ai_chat_function_cost').innerHTML = response.cost;
		}
	});
}

function initStreamingAnswer(replyTo) {
	if (!streamingAnswer[replyTo]) {
		const tempAnswerId = replyTo + 1000000;
		const messageElement = document.getElementById('ai_chat_answer_template').content.firstElementChild.cloneNode(true);
		messageElement.id = `chat-message-${tempAnswerId}`;
		messageElement.dataset.id = tempAnswerId;
		pushMessage(tempAnswerId, messageElement);

		streamingAnswer[replyTo] = {
			messageElement,
			text: "",
			seq: 0,
			badSeq: false,
		};
	}
	return streamingAnswer[replyTo];
}

async function sendMessage(message, details = false) {
	const func = getChatFunction();
	const response = await Spaces.asyncApi("services.ai.chat.sendMessage", {
		CK: null,
		Chat: chatId || undefined,
		...(details ? { Detailed: 1 } : { text: message }),
		Link_id: Spaces.params.link_id,
		...(func?.apiData ?? {})
	});

	if (response.code == Codes.SERVICES.ERR_NOT_ENOUGH_MONEY)
		balanceError = true;

	if (response.code != 0)
		throw new Error(Spaces.apiError(response, CUSTOM_ERRORS));

	pushMessage(response.message_id, response.message);
	initStreamingAnswer(response.message_id);

	shrinkMessages();

	if (response.location_bar) {
		$('#location_header').html(response.location_bar.header);
		$('#location_footer').html(response.location_bar.footer);

		$('#ai_chat_delete a').map((_, link) => {
			const url = new Url(link.href);
			if (url.query.Chat != null) {
				url.query.Chat = response.chat_id;
				link.href = url.toString();
			}
		});
	}

	return {
		messageId: response.message_id,
		chatId: response.chat_id,
		chatUrl: response.chat_url,
	};
}

async function pushMessage(id, message) {
	const existsMessage = document.getElementById(`chat-message-${id}`);
	if (existsMessage) {
		$(existsMessage).replaceWith(message);
		return;
	}

	const messagesIds = getMessagesIds();
	if (!messagesIds.length) {
		document.querySelector('#ai_chat_messages').classList.remove('hide');
		document.querySelector('#ai_chat_messages_empty')?.classList.add('hide');

		const closeChatInfo = document.getElementById('ai_chat_close_chat_info');
		if (closeChatInfo)
			closeChatInfo.classList.remove('hide');
	}

	const container = document.getElementById('ai_chat_messages');
	for (const oldMessageId of messagesIds) {
		if (id == 0 || id > oldMessageId) {
			const oldMessageElement = document.getElementById(`chat-message-${oldMessageId}`);
			if (oldMessageElement) {
				$(oldMessageElement).before(message, oldMessageElement);
				return;
			}
		}
	}
	$(container).append(message);
}

function shrinkMessages() {
	const messagesIds = getMessagesIds();
	for (let i = onPage; i < messagesIds.length; i++) {
		const messsage = document.querySelector(`#chat-message-${messagesIds[i]}`);
		messsage.remove();
	}
}

function updateMessageStatus(id, options) {
	options = {
		error: undefined,
		tokens: 0,
		...options
	};

	const messageErrors = document.querySelectorAll(`#chat-message-${id} .js-ai_message_error`);
	messageErrors.forEach((el) => el.classList.toggle('hide', !options.error));

	const messageTokens = document.querySelector(`#chat-message-${id} .js-ai_message_tokens`);
	if (messageTokens) {
		messageTokens.classList.toggle('hide', options.error || options.tokens == null);
		messageTokens.innerHTML = `(${options.tokens} tkn)`;
	}
}

function setHasMoreData(flag) {
	document.querySelector('#ai_chat_messages_load_more').classList.toggle('hide', !flag);
}

function getMessagesIds() {
	const messagesContainer = document.querySelector('#ai_chat_messages');
	const messages = [];
	for (const message of messagesContainer.children) {
		if (+message.dataset.id > 0)
			messages.push(+message.dataset.id);
	}
	return messages;
}

function initDropdownMenu(link, menuId) {
	link.dataset.menu_id = menuId;
	link.dataset.position = 1;
	link.dataset.noclass = 1;
	link.classList.add('js-dd_menu_link');
	link.classList.add('triangle-show');
}

async function lockUI(flag) {
	const input = document.querySelector('#main .js-text_input_text textarea');
	const sendButton = document.querySelector('#main button[name="cfms"]');
	const servicesButton = document.querySelector('#main button[name="inline_services"]');
	input.disabled = flag;
	sendButton.disabled = flag;
	servicesButton.disabled = flag;
	// button.querySelector('.js-ico').classList.toggle('ico_spinner', flag);
}

function applyTextDelta(str, start, end, newValue) {
	return str.slice(0, start) + newValue + str.slice(end);
}

function destroy() {
	if (messagesFlowController) {
		messagesFlowController.destroy();
		messagesFlowController = undefined;
	}
	pushstream.off('message', 'ai_chat');
	streamingAnswer = {};
}

module.on("componentpage", init);
module.on("componentpagedone", destroy);
