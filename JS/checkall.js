import module from 'module';
import $ from './jquery';
import { L } from './utils';

var global_trigger = true;

function checkAll(e) {
	var el = this,
		parent = document.getElementById(el.getAttribute('data-parent')) || document.body;
	var inputs = parent.getElementsByTagName('input');
	for (var i = 0; i < inputs.length; ++i) {
		if (inputs[i].type == 'checkbox')
			inputs[i].checked = global_trigger;
	}

	el.innerHTML = global_trigger ? L('Снять все') : L('Отметить все');

	global_trigger = !global_trigger;
	return false;
}

module.on("componentpage", function () {
	$('#main').on('click', '.js-checkall', checkAll);
	global_trigger = true;
});
