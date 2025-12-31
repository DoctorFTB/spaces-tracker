import module from 'module';
import $ from './jquery';
import {Spaces, Url} from './spacesLib';

module.on("componentpage", function () {
	$('#main').on('geoSelected', function (e, geo) {
		var el = $('#city_redirect');
		if (el.length && geo.valid) {
			var url = new Url(el.data('url')),
				data = el.data();
			
			if (data.cityKey)
				url.query[data.cityKey] = geo.city;
			if (data.regionKey)
				url.query[data.regionKey] = geo.region;
			if (data.countryKey)
				url.query[data.countryKey] = geo.country;
			
			Spaces.redirect(url.url());
		}
	});
});
