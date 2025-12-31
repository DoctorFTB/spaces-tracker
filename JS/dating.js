import $ from './jquery';
import {ge, ce} from './utils';

// deprecated, todo: переписать
var Dating = {
	init: function(){
		var age_from = ge("#age_from"),
			age_to = ge("#age_to"),
			page_to = document.getElementsByClassName("page_num_input")[1];
		
		if (age_from && age_to && page_to) {
			age_from.onfocus = function() {
				Dating.doOnFocus("mainSearch");
			}
		
			age_to.onfocus = function() {
				Dating.doOnFocus("mainSearch");
			}
			
			page_to.onfocus = function() {
				Dating.doOnFocus("go", true);
			}
		}

		
		var inputs = document.getElementsByTagName("input");
			for (var i = 0; i < inputs.length; i++) {
				if (inputs[i].type == 'text') {
					inputs[i].onblur = function() {
						Dating.doOnBlur();
					}
				}
			}
		
	},
	
	toggleAdvanced: function (btn) {
		var params = document.getElementById('AdvancedSearchParams');
		if (params.style.display == "none") {
			params.style.display = "block";
			btn.style.display = "none";
			
			var input = ce('input', {
				type: 'hidden',
				name: "advanced_search",
				value: 1
			});
			insert_before(btn, input);
		}
		return false;
	},
	
	doOnFocus: function(submit, cl) {
		var submit_el = cl ? document.getElementsByClassName(submit)[2] : document.getElementById(submit);
		var inputs = document.getElementsByTagName("input");
		for (var i = 0; i < inputs.length; i++) {
			if (inputs[i].type == 'submit') {
				inputs[i].type = 'button';
			}
		}
		if (submit_el)
			submit_el.type = 'submit';
	},
	
	doOnBlur: function() {
		var inputs = document.getElementsByTagName("input");
		for (var i = 0; i < inputs.length; i++) {
			if (inputs[i].type == 'submit') {
				inputs[i].type = 'button';
			}
		}
		
		$.each(['#AdvancedSearch', '#PlaceSelector', '#PlaceDelete', '#mainSearch'], function (k, v) {
			var e = ge(v);
			if (e)
				e.type = 'submit';
		});
		
		var page = document.getElementsByClassName("page")[1];
		if (page)
			page.type = 'submit';
		
		var go = document.getElementsByClassName("page")[1];
		if (go)
			go.type = 'submit';
		
		var pages = document.getElementsByClassName("page_choose");
		for (var i = 0; i < pages.length; i++)
			pages[i].type = 'submit';
	}
}

function insert_before(p, e) {
	p.parentElement.insertBefore(e, p);
	return e;
}

Dating.init();

window.Dating = Dating;
