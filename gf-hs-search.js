/**
 * @globals {object} GF_HS_Settings
 */

jQuery( document ).ready(function($) {

	var HS_Search = $.extend( GF_HS_Settings, {

		searching: false,

		/** Prevent new results from being shown by setting to true */
		cancelled: false,

		count: 0,

		query: '',

		/** Hold the ms since the user stopped typing */
		timeout: null,

		/** Search field container */
		wrap: $( '.gform_wrapper .gfield.helpscout-docs' ),

		field: $( '.gform_wrapper .gfield.helpscout-docs' ).find( 'input[type="text"]' ),

		results: {},

		init: function () {

			HS_Search.wrap
				.append( '<div class="' + GF_HS_Settings.template.wrap_class + '" style="display:none;" />' );

			HS_Search.field
				.attr( 'autocomplete', 'off' )
				.on( 'keydown keyup change', HS_Search.search_changed );
		},

		/**
		 * Perform search on keyup
		 * @param e
		 */
		search_changed: function ( e ) {

			var ignored_key_codes = [ 9, 16, 17, 18, 20, 32, 33, 34, 37, 38, 91, 93 ];

			if ( ignored_key_codes.indexOf( e.which ) > -1 ) {
				HS_Search.log( 'Ignored key press', e.which );
				return;
			}

			HS_Search.log( 'Starting search countdown in %d ms', parseInt( GF_HS_Settings.searchDelay, 10 ) );

			var $el = $( this ); // Used inside setTimout

			// Clear the timeout if it has already been set.
			clearTimeout( HS_Search.timeout );

			// Make a new timeout set to go off in HS_Search.searchDelay ms
			HS_Search.timeout = setTimeout( function () {

				HS_Search.log( 'Performing search', e.which );

				HS_Search.query = $el.val();

				// Deleted, empty search box
				if ( HS_Search.query.length < GF_HS_Settings.minLength || ( 8 === e.which || 46 === e.which ) && HS_Search.query.length === 0 ) {
					HS_Search.cancelled = true; // Prevent new results from being shown
					HS_Search.set_results( {} );
					return;
				}

				// Check whether a search is being performed. If not, start one.
				if ( !HS_Search.searching ) {
					// Reset the results array
					HS_Search.perform_search();
				}

			}, parseInt( GF_HS_Settings.searchDelay, 10 ) );
		},


		/**
		 * Reset results and fetch a new batch using fetch_results
		 */
		perform_search: function () {

			// Reset results
			HS_Search.results = {};
			HS_Search.cancelled = false;

			HS_Search.fetch_results();

		},

		/**
		 * Alias for console.log, but check if debug is enabled.
		 * @param item
		 * @param item2
		 */
		log: function ( item, item2 ) {
			if ( HS_Search.debug && console && console.log ) {
				console.log( item, item2 );
			}
		},

		get_results_html: function () {

			var output = '', count = 0;

			if ( 'undefined' !== typeof( HS_Search.results.articles ) && HS_Search.results.articles.items.length ) {

				output = GF_HS_Settings.template.before;

				$.each( HS_Search.results.articles.items, function ( key, article ) {

					// Default to true
					var keep = true;

					// Make sure article is in the specified collection ID(s)
					if( GF_HS_Settings.collections.length > 0 ) {

						// If we are searching within specific collections, we need to check the article's collection ID
						keep = false;

						$.each( GF_HS_Settings.collections, function ( collection_key, value ) {

							if( article.collectionId == value ) {

								// Collection ID of article matches whitelist, keep the article
								keep = true;

							}

						} );

					}

					// Don't show more than the limit
					if ( count < HS_Search.limit && keep ) {

						count++;
						output += HS_Search.get_article_html( article );

					}

				} );

				output += GF_HS_Settings.template.after;
			}

			return HS_Search.get_results_found( count ) + output;
		},

		/**
		 * Use localized GF_HS_Settings.item_template as html template for each article
		 * @param article
		 * @returns {string}
		 */
		get_article_html: function ( article ) {

			var output = GF_HS_Settings.template.item;

			for ( var key in article ) {
				if ( article.hasOwnProperty( key ) ) {
					output = output.replace( '{' + key + '}', article[ key ] );
				}
			}

			return output;
		},

		get_results_found: function ( count ) {

			var found_text = '';
			var css_class = 'results-found';

			if ( HS_Search.query.length === 0 ) {
				found_text = GF_HS_Settings.text.enter_search;
				css_class += ' message-enter_search';
			} else if ( HS_Search.query.length < HS_Search.minLength ) {
				found_text = GF_HS_Settings.text.not_long_enough.replace( '{minLength}', HS_Search.minLength );
				css_class += ' message-minlength';
			} else if ( 0 === count ) {
				found_text = GF_HS_Settings.text.no_results_found;
				css_class += ' message-no_results';
			} else {
				found_text = ( count === 1 ) ? GF_HS_Settings.text.result_found : GF_HS_Settings.text.results_found;
				css_class += ' message-results';
			}

			return GF_HS_Settings.template.results_found.replace( '{css_class}', css_class ).replace( '{text}', found_text ).replace( '{count}', count );
		},

		/**
		 * Set the results object and trigger re-generation of the HTML
		 * @param results
		 */
		set_results: function ( results ) {

			HS_Search.log( 'Adding results:', results );

			HS_Search.results = results;

			HS_Search.wrap.find( '.docs-search-wrap' )
				.html( HS_Search.get_results_html() )
				.not(':visible').slideDown();
		},

		/**
		 * HelpScout doesn't support searching for exotic characters like brackets.
		 *
		 * @param query
		 * @returns {*}
		 */
		sanitize_query: function ( query ) {
			query = query.replace( /[\{\}\[\]]/g, ' ' );
			HS_Search.log( 'Searching for %s', query );
			return query;
		},

		/**
		 * Perform a search
		 */
		fetch_results: function () {

			query = HS_Search.sanitize_query( HS_Search.query );

			$search_wrap = HS_Search.wrap.find( '.docs-search-wrap' );

			// Extensions
			$.ajax( {
				url: 'https://docsapi.helpscout.net/v1/search/articles?status=published&visibility=public&query=' + encodeURIComponent( query ),
				async: true,
				contentType: 'application/json',
				dataType: 'json',
				headers: {
					'Authorization': 'Basic ' + GF_HS_Settings._basic_auth
				},
				xhrFields: {
					withCredentials: false
				},
				beforeSend: function () {
					HS_Search.searching = true;
					$search_wrap.addClass('docs-searching');
				},
				success: function ( results ) {
					if ( !HS_Search.cancelled ) {
						HS_Search.set_results( results );
					}
				},
				error: function ( e ) {
					HS_Search.log( 'Error: %s', e );
				}
			} ).always( function () {
				HS_Search.searching = false;
				$search_wrap.removeClass('docs-searching');
			} );
		}
	} );

	HS_Search.init();
});