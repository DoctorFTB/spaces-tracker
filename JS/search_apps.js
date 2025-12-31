import module from 'module';
import $ from './jquery';
import Spaces from './spacesLib';
import page_loader from './ajaxify';
import UniversalSearch from './search';

var detached;

UniversalSearch.register("app", {
	apiMethod: 'app.search',
	param: "q",
	results: "apps",
	hideEmpty: true,
	onToggleList: function (e) {
		var apps_list = $('#apps_list'),
			apps_search = $('#apps_search');
		
		if (e.valueEmpty) {
			if (detached) {
				apps_list.append(detached);
				detached = null;
			}
		} else {
			// Отцепляем все ноды, чтобы не дублировались id в виджетах игр
			if (!detached)
				detached = apps_list.children().detach();
		}
		
		apps_list.toggleClass('hide', !e.valueEmpty);
		apps_search.toggleClass('hide', !!e.valueEmpty);
	},
	onBeforeSend(query, apiData) {
		apiData.Sel = this.el.data('sel');
	},
	apiData: {
		Link_id: Spaces.params.link_id
	}
});

module.on("componentpage", function () {
	UniversalSearch.recheck();
});

module.on("componentpagedone", function () {
	// Чтобы память не текла
	if (detached)
		detached.remove();
	detached = null;
});

