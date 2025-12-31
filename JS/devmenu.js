import module from 'module';
import $ from './jquery';
import cookie from './cookie';
import {ge, ce, L, html_wrap} from './utils';

var cookies_menu;

module.on("component", function () {
	var sandbox = ge('#sandbox_indicator');
	if (sandbox) {
		sandbox.removeAttribute("onclick");
		sandbox.onclick = function () {
			ge('#sandbox_menu') ? _closeMenu() : _renderMenu(sandbox);
			return false;
		};
		sandbox.onclick();
	}
});

var new_cookie_name, new_cookie_value, new_cookie_btn;
function _renderMenu(sandbox) {
	var div = ce('div', {
		id: 'sandbox_menu',
		innerHTML: ''
	}, {
		'padding':		'5px',
		'max-width':	'1024px',
		'margin':		'0 auto'
	});
	sandbox.parentNode.insertBefore(div, sandbox.nextSibling);
	
	new_cookie_name = ce('input', {value: '', placeholder: 'name', type: 'text', size: 10});
	div.appendChild(new_cookie_name);
	new_cookie_value = ce('input', {value: '', placeholder: 'value', type: 'text', size: 10});
	div.appendChild(new_cookie_value);
	new_cookie_btn = ce('input', {value: 'add', type: 'submit', onclick: _addNewCookie});
	div.appendChild(new_cookie_btn);
	div.appendChild(ce('hr'));
	
	var cookies_wrap = ce('div', {}, {display: 'none'});
	div.appendChild(ce('input', {
		type: "submit",
		value: L("Выйти из песочницы"),
		onclick: function () {
			cookie.remove('sandbox');
			location.reload();
			return false;
		}
	}));
	div.appendChild(ce('input', {
		type: "submit",
		value: L("Редактор cookies"),
		onclick: function () {
			cookies_wrap.style.display = cookies_wrap.style.display == 'none' ? '' : 'none';
			return false;
		}
	}));
	div.appendChild(ce('hr'));
	div.appendChild(cookies_wrap);
	cookies_menu = ce('form', {
		onclick: _cookiesMenu
	});
	cookies_wrap.appendChild(cookies_menu);
	
	_renderCookiesList();
	
	div.appendChild(ce('input', {
		type: "submit",
		value: L("Админ панель"),
		onclick: function () {
			location.href = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
			return false;
		}
	}));
	
	// Скроллим
	window.scrollTo && window.scrollTo(0, document.body.scrollHeight);
}

function _renderCookiesList() {
	var cookies = cookie.all(), html = '',
		colors = {
			sid: 'red',
			sandbox: 'yellow',
			user_id: 'grey'
		};
	
	html += '<table border="1">';
	for (var k in cookies) {
		var key = html_wrap(k);
		html += 
		'<tr>' + 
			'<td><b class="'+(colors[key] || '')+'">' + key + '</b></td>' + 
			'<td width="100%"><input type="text" value="' + html_wrap(cookies[k]) + '" name="' + key + '" style="width: 100%;box-sizing: border-box;" /></td>' + 
			'<td><nobr><input type="submit" value="save" cookie-name="' + key + '" act="save" />&nbsp;' + 
				'<input type="submit" value="del" cookie-name="' + key + '" act="del" /></nobr></td>' + 
		'</tr>';
	}
	html += '</table>' + 
		'<h2 class="red" style="font-size: 30px">' + L('Никому не сообщайте эти данные, иначе вас ВЗЛОМАЮТ.') + '</h2>';
	cookies_menu.innerHTML = html;
}

function _addNewCookie() {
	cookie.set(new_cookie_name.value, new_cookie_value.value);
	_renderCookiesList();
	new_cookie_name.value = '';
	new_cookie_value.value = '';
}

function _cookiesMenu(e) {
	if (e.target.nodeName == "INPUT") {
		var act = e.target.getAttribute('act'), name = e.target.getAttribute('cookie-name');
		if (act) {
			if (act == "save") {
				cookie.set(name, cookies_menu.elements[name].value);
			} else if (act == "del") {
				cookie.set(name, '', {expires: -1});
			}
			_renderCookiesList();
			return false;
		}
	}
}

function _closeMenu() {
	var menu = ge('#sandbox_menu');
	menu.parentNode.removeChild(menu);
}
