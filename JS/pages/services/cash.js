import module from 'module';
import * as pushstream from '../../core/lp';
import { L, numeral } from '../../utils';

const tpl = {
	money(amount) {
		const moneyNoun = numeral(amount, [L("монета"), L("монеты"), L("монет")]);
		return `<span class="${amount > 0 ? 'green' : 'red'}">${Number(amount).toLocaleString("ru-RU")} ${moneyNoun}</span>`;
	},
	bonus(amount) {
		const bonusNoun = numeral(amount, [L("бонусная"), L("бонусных"), L("бонусных")]);
		return `<span class="darkblue">${Number(amount).toLocaleString("ru-RU")} ${bonusNoun}</span>`;
	}
};

function init() {
	pushstream.on('message', 'cash_widget', (message) => {
		if (message.act == pushstream.TYPES.BALANCE_UPDATE) {
			if (message.money != null)
				$('#cash_widget_money').html(tpl.money(message.money));
			if (message.bonus != null)
				$('#cash_widget_bonus').html(tpl.bonus(message.bonus)).toggleClass('hide', !message.bonus);
		}
	});
}

function destroy() {
	pushstream.off('message', 'cash_widget');
}

module.on("componentpage", init);
module.on("componentpagedone", destroy);
