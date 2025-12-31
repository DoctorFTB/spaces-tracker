import module from 'module';
import Spaces from './spacesLib';
import {tick} from './utils';

function change_blocking_api( block ) {
	const params = JSON.parse( document.querySelector( '#legal_block_uobj' ).dataset.params );
	params.Block = block;
	params.jurisdiction = document.querySelector( '#legal_block_uobj_jurisdiction' ).value;
	
	Spaces.api( "legal.block_uobj", params, function ( res ) {
		if ( res.code != 0 ) {
			Spaces.showApiError( res );
			return;
		}
		
		document.querySelector( '#legal_block_uobj' ).outerHTML = res.widget;
		tick(init);
	}, {
		onError: ( err ) => Spaces.showError( err )
	} );
}

function init() {
	document.querySelector( '#legal_block_uobj_block' ).addEventListener( 'click', function () { change_blocking_api( true ) } );
	document.querySelector( '#legal_block_uobj_unblock' ).addEventListener( 'click', function () { change_blocking_api( false ) } );
}

module.on("component", init);
