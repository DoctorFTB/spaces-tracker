import module from 'module';
import $ from '../../jquery';
import Spaces from '../../spacesLib';
import { L, numeral } from '../../utils';
import * as pushstream from '../../core/lp';

function updateAiPayedTokens(tokens) {
	const payedTokensInfo = document.querySelector('#ai-payed-tokens');
	const tokensNoun = numeral(tokens, [L('токен'), L('токена'), L('токенов')]);
	payedTokensInfo.textContent = `${tokens.toLocaleString("ru-RU")} ${tokensNoun}`;
	payedTokensInfo.classList.toggle('red', !tokens);
	payedTokensInfo.classList.toggle('green', tokens > 0);
}

function init() {
	pushstream.on('message', 'ai_wallet', (message) => {
		if (message.act == pushstream.TYPES.BALANCE_UPDATE) {
			if (message.ai_tokens != null)
				updateAiPayedTokens(message.ai_tokens);
		}
	});

	$('#main').action("ai_wallet_top_up", (e) => {
		e.preventDefault();
		e.stopPropagation();

		const widget = $('#ai_wallet_widget');
		const link = $(e.currentTarget);
		if (link.prop('disabled'))
			return;

		const tokensInput = widget.find('input[name="Tokens"]').filter((_, r) => r.checked);
		const toggleLoading = (flag) => {
			link.prop("disabled", flag);
		};

		toggleLoading(true);
		Spaces.view.setInputError(tokensInput, false);
		Spaces.api("services.ai.wallet.topUp", { CK: null, Tokens: tokensInput.val() }, (response) => {
			toggleLoading(false);
			if (response.code != 0) {
				Spaces.view.setInputError(tokensInput, Spaces.apiError(response));
				return;
			}
			updateAiPayedTokens(response.tokens);
			$('.js-action_link.js-clicked[data-action="spoiler"][data-id="ai_wallet_widget"]').first().click();
		}, {
			onError(error) {
				Spaces.view.setInputError(tokensInput, error);
				toggleLoading(false);
			}
		});
	});

	$('#main').on('change', '#ai_wallet_widget [name="Tokens"]', (e) => {
		const widget = $('#ai_wallet_widget');
		const tokens = $(e.currentTarget).val();
		const costInfo = widget.data("costInfo");
		const cost = costInfo.find((cost) => cost.tokens == tokens);

		if (!cost) {
			console.error("Invalid costInfo", tokens, costInfo);
		}

		$('#ai_wallet_widget_price').html(cost.costNoun);
	});
}

function destroy() {
	pushstream.off('message', 'ai_wallet');
}

module.on("componentpage", init);
module.on("componentpagedone", destroy);
