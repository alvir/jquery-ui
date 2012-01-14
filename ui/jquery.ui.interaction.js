(function( $, undefined ) {

var interaction; // = $.ui.interaction

$.widget( "ui.interaction", {
	version: "@VERSION",
	_create: function() {
		for ( var hook in interaction.hooks ) {
			interaction.hooks[ hook ].setup( this, this._startProxy( hook ) );
		}
	},

	_startProxy: function( hook ) {
		var that = this;
		return function( event, position ) {
			that._interactionStart( event, position, hook );
		}
	},

	_interactionStart: function( event, position, hook ) {
		// only one interaction can happen at a time
		if ( interaction.started ) {
			return;
		}

		if ( false !== this._start( event, position ) ) {
			interaction.started = true;
			interaction.hooks[ hook ].handle( this );
		}
	},

	_interactionMove: function( event, position ) {
		this._move( event, position );
	},

	_interactionStop: function( event, position ) {
		this._stop( event, position );
		interaction.started = false;
	}
});

interaction = $.ui.interaction;
$.extend( interaction, {
	started: false,
	hooks: {}
});

interaction.hooks.mouse = {
	setup: function( widget, start ) {
		widget._bind({
			"mousedown": function( event ) {
				if ( event.which === 1 ) {
					event.preventDefault();
					start( event, {
						left: event.pageX,
						top: event.pageY
					});
				}
			}
		});
	},

	handle: function( widget ) {
		function mousemove( event ) {
			event.preventDefault();
			widget._interactionMove( event, {
				left: event.pageX,
				top: event.pageY
			});
		}

		function mouseup( event ) {
			widget._interactionStop( event, {
				left: event.pageX,
				top: event.pageY
			});
			widget.document
				.unbind( "mousemove", mousemove )
				.unbind( "mouseup", mouseup );
		}

		widget._bind( widget.document, {
			"mousemove": mousemove,
			"mouseup": mouseup
		});
	}
};

// WebKit doesn't support TouchList.identifiedTouch()
function getTouch( event ) {
	var touch,
		touches = event.originalEvent.changedTouches,
		i = 0, length = touches.length;
	
	for ( ; i < length; i++ ) {
		if ( touches[ i ].identifier === touchHook.id ) {
			return touches[ i ];
		}
	}
}

var touchHook = interaction.hooks.touch = {
	setup: function( widget, start ) {
		widget._bind({
			"touchstart": function( event ) {
				var touch;

				if ( touchHook.id ) {
					return;
				}

				touch = event.originalEvent.changedTouches.item( 0 );
				touchHook.id = touch.identifier;

				event.preventDefault();
				start( event, {
					left: touch.pageX,
					top: touch.pageY
				});
			}
		});
	},

	handle: function( widget ) {
		function touchmove( event ) {
			// TODO: test non-Apple WebKits to see if they allow
			// zooming/scrolling if we don't preventDefault()
			var touch = getTouch( event );
			if ( !touch ) {
				return;
			}

			event.preventDefault();
			widget._interactionMove( event, {
				left: touch.pageX,
				top: touch.pageY
			});
		}

		function touchend( event ) {
			var touch = getTouch( event );
			if ( !touch ) {
				return;
			}

			widget._interactionStop( event, {
				left: touch.pageX,
				top: touch.pageY
			});
			touchHook.id = null;
			widget.document
				.unbind( "touchmove", touchmove )
				.unbind( "touchend", touchend );
		}

		widget._bind( widget.document, {
			"touchmove": touchmove,
			"touchend": touchend
		});
	}
};

var pointerHook = interaction.hooks.msPointer = {
	setup: function( widget, start ) {
		widget._bind({
			"MSPointerDown": function( _event ) {
				var event = _event.originalEvent;

				if ( pointerHook.id ) {
					return;
				}

				// TODO: how can we detect a "right click" with a pen?
				// TODO: get full details about which and button from MS
				// touch and pen = 1
				// primary mouse button = 2
				if ( event.which > 2 ) {
					return;
				}

				// track which pointer is performing the interaction
				pointerHook.id = event.pointerId;
				// prevent panning/zooming
				event.preventManipulation();
				// prevent promoting pointer events to mouse events
				event.preventMouseEvent();

				start( event, {
					left: event.pageX,
					top: event.pageY
				});
			}
		});
	},

	handle: function( widget ) {
		function move( _event ) {
			var event = _event.originalEvent,
				pageX = event.pageX,
				pageY = event.pageY;

			// always prevent manipulation to avoid panning/zooming
			event.preventManipulation();

			if ( event.pointerId !== pointerHook.id ) {
				return;
			}

			// MS streams events constantly, even if there is no movement
			// so we optimize by ignoring repeat events
			if ( pointerHook.x === pageX && pointerHook.y === pageY ) {
				return;
			}

			pointerHook.x = pageX;
			pointerHook.y = pageY;
			widget._interactionMove( event, {
				left: pageX,
				top: pageY
			});
		}

		function stop( _event ) {
			var event = _event.originalEvent;

			if ( event.pointerId !== pointerHook.id ) {
				return;
			}

			widget._interactionStop( event, {
				left: event.pageX,
				top: event.pageY
			});
			pointerHook.id = pointerHook.x = pointerHook.y = undefined;
			widget.document
				.unbind( "MSPointerMove", move )
				.unbind( "MSPointerUp", stop )
				.unbind( "MSPointerCancel", stop );
		}

		widget._bind( widget.document, {
			"MSPointerMove": move,
			"MSPointerUp": stop,
			"MSPointerCancel": stop
		});
	}
};

})( jQuery );