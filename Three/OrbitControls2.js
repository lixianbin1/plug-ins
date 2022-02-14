import * as THREE from 'three'
THREE.OrbitControls = function ( object, domElement ) {
	this.object = object;
	this.domElement = ( domElement !== undefined ) ? domElement : document;
	// 设置为false可禁用此控件
	this.enabled = true;

	// "target" 设置焦点的位置，即对象围绕其旋转的位置
	this.target = new THREE.Vector3();

	// 可以移入和移出多远（仅透视照相机）
	this.minDistance = 0;
	this.maxDistance = Infinity;

	// 放大和缩小的距离（仅正交摄影机）
	this.minZoom = 0;
	this.maxZoom = Infinity;

	// 垂直环绕的距离、上限和下限
	// 范围是 0 到 Math.PI 的弧度.
	this.minPolarAngle = 0; // 弧度
	this.maxPolarAngle = Math.PI; // 弧度

	// 水平轨道的距离，上限和下限
	// 如果设置，则必须是区间[-Math.PI，Math.PI]的子区间。
	this.minAzimuthAngle = - Infinity; // 弧度
	this.maxAzimuthAngle = Infinity; // 弧度

	// 设置为true以启用阻尼（惯性）
	// 如果阻尼已启用，则必须调用控件。在动画中循环controls.update()
	this.enableDamping = false;
	this.dampingFactor = 0.25;

	// This option actually enables dollying in and out; left as "zoom" for backwards compatibility.
	// 设置为false可禁用缩放
	this.enableZoom = true;
	this.zoomSpeed = 1.0;

	// 设置为false可禁用旋转
	this.enableRotate = true;
	this.rotateSpeed = 1.0;

	// 设置为false可禁用平移
	this.enablePan = true;
	this.panSpeed = 1.0;
	this.screenSpacePanning = false; // if true, pan in screen-space
	this.keyPanSpeed = 7.0;	// pixels moved per arrow key push

	// 设置为true可自动围绕目标旋转
	// If auto-rotate is enabled, you must call controls.update() in your animation loop
	this.autoRotate = false;
	this.autoRotateSpeed = 2.0; // 30 seconds per round when fps is 60

	// Set to false to disable use of the keys
	this.enableKeys = true;

	// The four arrow keys
	this.keys = { LEFT: 37, UP: 38, RIGHT: 39, BOTTOM: 40 };

	// Mouse buttons
	this.mouseButtons = { LEFT: THREE.MOUSE.LEFT, MIDDLE: THREE.MOUSE.MIDDLE, RIGHT: THREE.MOUSE.RIGHT };

	// for reset
	this.target0 = this.target.clone();
	this.position0 = this.object.position.clone();
	this.zoom0 = this.object.zoom;

	this.getPolarAngle = function () {
		return spherical.phi;
	};

	this.getAzimuthalAngle = function () {
		return spherical.theta;
	};

	this.saveState = function () {
		scope.target0.copy( scope.target );
		scope.position0.copy( scope.object.position );
		scope.zoom0 = scope.object.zoom;

	};

	this.reset = function () {
		scope.target.copy( scope.target0 );
		scope.object.position.copy( scope.position0 );
		scope.object.zoom = scope.zoom0;
		scope.object.updateProjectionMatrix();
		scope.dispatchEvent( changeEvent );
		scope.update();
		state = STATE.NONE;
	};

	// this method is exposed, but perhaps it would be better if we can make it private...
	this.update = function () {

		var offset = new THREE.Vector3();

		// so camera.up is the orbit axis
		var quat = new THREE.Quaternion().setFromUnitVectors( object.up, new THREE.Vector3( 0, 1, 0 ) );
		var quatInverse = quat.clone().inverse();

		var lastPosition = new THREE.Vector3();
		var lastQuaternion = new THREE.Quaternion();

		return function update() {

			var position = scope.object.position;

			offset.copy( position ).sub( scope.target );

			// rotate offset to "y-axis-is-up" space
			offset.applyQuaternion( quat );

			// angle from z-axis around y-axis
			spherical.setFromVector3( offset );

			if ( scope.autoRotate && state === STATE.NONE ) {

				rotateLeft( getAutoRotationAngle() );

			}

			spherical.theta += sphericalDelta.theta;
			spherical.phi += sphericalDelta.phi;

			// restrict theta to be between desired limits
			spherical.theta = Math.max( scope.minAzimuthAngle, Math.min( scope.maxAzimuthAngle, spherical.theta ) );

			// restrict phi to be between desired limits
			spherical.phi = Math.max( scope.minPolarAngle, Math.min( scope.maxPolarAngle, spherical.phi ) );

			spherical.makeSafe();


			spherical.radius *= scale;

			// restrict radius to be between desired limits
			spherical.radius = Math.max( scope.minDistance, Math.min( scope.maxDistance, spherical.radius ) );

			// move target to panned location
			scope.target.add( panOffset );

			offset.setFromSpherical( spherical );

			// rotate offset back to "camera-up-vector-is-up" space
			offset.applyQuaternion( quatInverse );

			position.copy( scope.target ).add( offset );

			scope.object.lookAt( scope.target );

			if ( scope.enableDamping === true ) {

				sphericalDelta.theta *= ( 1 - scope.dampingFactor );
				sphericalDelta.phi *= ( 1 - scope.dampingFactor );

				panOffset.multiplyScalar( 1 - scope.dampingFactor );

			} else {

				sphericalDelta.set( 0, 0, 0 );

				panOffset.set( 0, 0, 0 );

			}

			scale = 1;

			// update condition is:
			// min(camera displacement, camera rotation in radians)^2 > EPS
			// using small-angle approximation cos(x/2) = 1 - x^2 / 8

			if ( zoomChanged ||
				lastPosition.distanceToSquared( scope.object.position ) > EPS ||
				8 * ( 1 - lastQuaternion.dot( scope.object.quaternion ) ) > EPS ) {

				scope.dispatchEvent( changeEvent );

				lastPosition.copy( scope.object.position );
				lastQuaternion.copy( scope.object.quaternion );
				zoomChanged = false;

				return true;

			}

			return false;

		};

	}();

	this.dispose = function () {

		scope.domElement.removeEventListener( 'contextmenu', onContextMenu, false );
		scope.domElement.removeEventListener( 'mousedown', onMouseDown, false );
		scope.domElement.removeEventListener( 'wheel', onMouseWheel, false );

		scope.domElement.removeEventListener( 'touchstart', onTouchStart, false );
		scope.domElement.removeEventListener( 'touchend', onTouchEnd, false );
		scope.domElement.removeEventListener( 'touchmove', onTouchMove, false );

		document.removeEventListener( 'mousemove', onMouseMove, false );
		document.removeEventListener( 'mouseup', onMouseUp, false );

		window.removeEventListener( 'keydown', onKeyDown, false );

		//scope.dispatchEvent( { type: 'dispose' } ); // should this be added here?

	};

	//
	// internals
	//

	var scope = this;

	var changeEvent = { type: 'change' };
	var startEvent = { type: 'start' };
	var endEvent = { type: 'end' };

	var STATE = { NONE: - 1, ROTATE: 0, DOLLY: 1, PAN: 2, TOUCH_ROTATE: 3, TOUCH_DOLLY_PAN: 4 };

	var state = STATE.NONE;

	var EPS = 0.000001;

	// current position in spherical coordinates
	var spherical = new THREE.Spherical();
	var sphericalDelta = new THREE.Spherical();

	var scale = 1;
	var panOffset = new THREE.Vector3();
	var zoomChanged = false;

	//右键屏幕坐标
	var rotateStart = new THREE.Vector2();
	var rotateEnd = new THREE.Vector2();
	var rotateDelta = new THREE.Vector2();

	var panStart = new THREE.Vector2();
	var panEnd = new THREE.Vector2();
	var panDelta = new THREE.Vector2();

	var dollyStart = new THREE.Vector2();
	var dollyEnd = new THREE.Vector2();
	var dollyDelta = new THREE.Vector2();

	function getAutoRotationAngle() {

		return 2 * Math.PI / 60 / 60 * scope.autoRotateSpeed;

	}

	function getZoomScale() {

		return Math.pow( 0.95, scope.zoomSpeed );

	}

	function rotateLeft( angle ) {

		sphericalDelta.theta -= angle;

	}

	//改变观察角度
	function rotateUp( angle ) {

		sphericalDelta.phi -= angle;

	}

	var panLeft = function () {

		var v = new THREE.Vector3();

		return function panLeft( distance, objectMatrix ) {

			v.setFromMatrixColumn( objectMatrix, 0 ); // get X column of objectMatrix
			v.multiplyScalar( - distance );

			panOffset.add( v );

		};

	}();

	var panUp = function () {

		var v = new THREE.Vector3();

		return function panUp( distance, objectMatrix ) {

			if ( scope.screenSpacePanning === true ) {

				v.setFromMatrixColumn( objectMatrix, 1 );

			} else {

				v.setFromMatrixColumn( objectMatrix, 0 );
				v.crossVectors( scope.object.up, v );

			}

			v.multiplyScalar( distance );

			panOffset.add( v );

		};

	}();

	// deltaX and deltaY are in pixels; right and down are positive
	var pan = function () {

		var offset = new THREE.Vector3();

		return function pan( deltaX, deltaY ) {

			var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

			if ( scope.object.isPerspectiveCamera ) {

				// perspective
				var position = scope.object.position;
				offset.copy( position ).sub( scope.target );
				var targetDistance = offset.length();

				// half of the fov is center to top of screen
				targetDistance *= Math.tan( ( scope.object.fov / 2 ) * Math.PI / 180.0 );

				// we use only clientHeight here so aspect ratio does not distort speed
				panLeft( 2 * deltaX * targetDistance / element.clientHeight, scope.object.matrix );
				panUp( 2 * deltaY * targetDistance / element.clientHeight, scope.object.matrix );

			} else if ( scope.object.isOrthographicCamera ) {
				// orthographic
				panLeft( deltaX * ( scope.object.right - scope.object.left ) / scope.object.zoom / element.clientWidth, scope.object.matrix );
				panUp( deltaY * ( scope.object.top - scope.object.bottom ) / scope.object.zoom / element.clientHeight, scope.object.matrix );
			} else {
				// camera neither orthographic nor perspective
				console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.' );
				scope.enablePan = false;
			}
		};
	}();

	function dollyIn( dollyScale ) {
		if ( scope.object.isPerspectiveCamera ) {
			scale /= dollyScale;
		} else if ( scope.object.isOrthographicCamera ) {
			scope.object.zoom = Math.max( scope.minZoom, Math.min( scope.maxZoom, scope.object.zoom * dollyScale ) );
			scope.object.updateProjectionMatrix();
			zoomChanged = true;
		} else {
			console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.' );
			scope.enableZoom = false;
		}
	}

	function dollyOut( dollyScale ) {

		if ( scope.object.isPerspectiveCamera ) {

			scale *= dollyScale;

		} else if ( scope.object.isOrthographicCamera ) {

			scope.object.zoom = Math.max( scope.minZoom, Math.min( scope.maxZoom, scope.object.zoom / dollyScale ) );
			scope.object.updateProjectionMatrix();
			zoomChanged = true;
		} else {
			console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.' );
			scope.enableZoom = false;

		}

	}

/* 鼠标事件 */
	/*左键点击:移动==>*/
	function handleMouseDownPan( event ) {
		panStart.set( event.clientX, event.clientY );
	}
	function handleMouseMovePan( event ) {
		panEnd.set( event.clientX, event.clientY );
		panDelta.subVectors( panEnd, panStart ).multiplyScalar( scope.panSpeed );
		pan( panDelta.x, panDelta.y );
		panStart.copy( panEnd );
		scope.update();
	}
	/*<===========*/
	/*中键点击:移动==>*/
	function handleMouseDownDolly( event ) {
		dollyStart.set( event.clientX, event.clientY );
	}
	function handleMouseMoveDolly( event ) {
		dollyEnd.set( event.clientX, event.clientY );
		dollyDelta.subVectors( dollyEnd, dollyStart );
		if ( dollyDelta.y > 0 ) {
			dollyIn( getZoomScale() );
		} else if ( dollyDelta.y < 0 ) {
			dollyOut( getZoomScale() );
		}
		dollyStart.copy( dollyEnd );
		scope.update();
	}
	/*<===========*/
	/*右键点击:移动==>*/
	function handleMouseDownRotate( event ) {
		rotateStart.set( event.clientX, event.clientY );
	}
	function handleMouseMoveRotate( event ) {
		rotateEnd.set( event.clientX, event.clientY );
		rotateDelta.subVectors( rotateEnd, rotateStart ).multiplyScalar( scope.rotateSpeed );
		var element = scope.domElement === document ? scope.domElement.body : scope.domElement;
		rotateLeft( 2 * Math.PI * rotateDelta.x / element.clientHeight ); // yes, height
		// rotateUp( 2 * Math.PI * rotateDelta.y / element.clientHeight );
		rotateStart.copy( rotateEnd );
		scope.update();
	}
	/*<===========*/
	// 鼠标弹起
	function handleMouseUp( event ) {
		console.log('弹起',event)
	}
	// 设置鼠标点击事件
	function onMouseDown( event ) {
		if ( scope.enabled === false ) return;
		event.preventDefault();
		switch ( event.button ) {
			case scope.mouseButtons.LEFT:
				if ( event.ctrlKey || event.metaKey || event.shiftKey ) {
					if ( scope.enableRotate === false ) return;
					handleMouseDownRotate( event );
					state = STATE.ROTATE;
				} else {
					if ( scope.enablePan === false ) return;
					handleMouseDownPan( event );
					state = STATE.PAN;
				}
				break;
			case scope.mouseButtons.MIDDLE:
				if ( scope.enableZoom === false ) return;
				handleMouseDownDolly( event );
				state = STATE.DOLLY;
				break;
			case scope.mouseButtons.RIGHT:
				if ( scope.enableRotate === false ) return;
				handleMouseDownRotate( event );
				state = STATE.ROTATE;
				break;
		}
		if ( state !== STATE.NONE ) {
			document.addEventListener( 'mousemove', onMouseMove,{passive:false} );
			document.addEventListener( 'mouseup', onMouseUp, {passive:false} );
			scope.dispatchEvent( startEvent );
		}
	}
	// 设置鼠标点击移动处理
	function onMouseMove( event ) {
		if ( scope.enabled === false ) return;
		event.preventDefault();
		switch ( state ) {
			case STATE.ROTATE:
				if ( scope.enableRotate === false ) return;
				handleMouseMoveRotate( event );
				break;
			case STATE.DOLLY:
				if ( scope.enableZoom === false ) return;
				handleMouseMoveDolly( event );
				break;
			case STATE.PAN:
				if ( scope.enablePan === false ) return;
				handleMouseMovePan( event );
				break;
		}
	}
	// 设置鼠标离开
	function onMouseUp( event ) {
		if ( scope.enabled === false ) return;
		handleMouseUp( event );
		document.removeEventListener( 'mousemove', onMouseMove, false );
		document.removeEventListener( 'mouseup', onMouseUp, false );
		scope.dispatchEvent( endEvent );
		state = STATE.NONE;
	}


	function onMouseWheel( event ) {
		if ( scope.enabled === false || scope.enableZoom === false || ( state !== STATE.NONE && state !== STATE.ROTATE ) ) return;

		event.preventDefault();
		event.stopPropagation();

		scope.dispatchEvent( startEvent );

		handleMouseWheel( event );

		scope.dispatchEvent( endEvent );

	}

	/* 特殊事件 */
	function handleMouseWheel( event ) { //滚轮事件
		//console.log( '滚动',event );
		if ( event.deltaY < 0 ) { //滚动向上
			// dollyOut( getZoomScale() );
			rotateUp(  -Math.PI/180  );
		} else if ( event.deltaY > 0 ) { //滚动向下
			// dollyIn( getZoomScale() );
			rotateUp(  Math.PI/180  );
		}
		scope.update();
	}
	function onContextMenu( event ) { //关闭右键菜单
		if ( scope.enabled === false ) return;
		event.preventDefault();
	}


	/*设置键盘事件*/
	function onKeyDown( event ) {
		if ( scope.enabled === false || scope.enableKeys === false || scope.enablePan === false ) return;
		handleKeyDown( event );
	}
	function handleKeyDown( event ) { /*键盘点击*/
		switch ( event.keyCode ) {
			case scope.keys.UP:
				pan( 0, scope.keyPanSpeed );
				scope.update();
				break;
			case scope.keys.BOTTOM:
				pan( 0, - scope.keyPanSpeed );
				scope.update();
				break;
			case scope.keys.LEFT:
				pan( scope.keyPanSpeed, 0 );
				scope.update();
				break;
			case scope.keys.RIGHT:
				pan( - scope.keyPanSpeed, 0 );
				scope.update();
				break;
		}
	}

	// 设置触摸事件
	function onTouchStart( event ) {
		if ( scope.enabled === false ) return;
		event.preventDefault();
		switch ( event.touches.length ) {
			case 1:	// 单指触碰：移动
				if ( scope.enableZoom === false && scope.enablePan === false ) return;
				oneHandleTouchStartDollyPan(event)
				state = STATE.TOUCH_DOLLY_PAN;
				break;
			case 2:	// 双指触碰: 缩放
				if ( scope.enableZoom === false && scope.enablePan === false ) return;
				handleTouchStartEnableZoom( event );
				state = STATE.TOUCH_DOLLY_PAN;
				break;
			default:
				state = STATE.NONE;
		}
		if ( state !== STATE.NONE ) {
			scope.dispatchEvent( startEvent );
		}
	}
	function onTouchMove( event ) {
		if ( scope.enabled === false ) return;
		event.preventDefault();
		event.stopPropagation();
		switch ( event.touches.length ) {
			case 1: // 单指触碰：移动
				if ( scope.enableZoom === false && scope.enablePan === false ) return;
				oneHandleTouchMoveDollyPan(event)
				break;
			case 2: // 双指触碰: 缩放
				if ( scope.enableZoom === false && scope.enablePan === false ) return;
				if ( state !== STATE.TOUCH_DOLLY_PAN ) return;
				handleTouchMoveEnableZoom( event );
				break;
			default:
				state = STATE.NONE;
		}
	}
	function onTouchEnd( event ) {
		if ( scope.enabled === false ) return;
		handleTouchEnd( event );
		scope.dispatchEvent( endEvent );
		state = STATE.NONE;
	}
	/* 触摸 */
	/*单指触摸:移动==>*/
	function oneHandleTouchStartDollyPan(event){
		if ( scope.enablePan ) { //移动
			var x =  event.touches[ 0 ].pageX;
			var y =  event.touches[ 0 ].pageY;
			panStart.set( x, y );
		}
	}
	function oneHandleTouchMoveDollyPan(event){
		if ( scope.enablePan ) {
			var x =   event.touches[ 0 ].pageX ;
			var y =   event.touches[ 0 ].pageY ;
			panEnd.set( x, y );
			panDelta.subVectors( panEnd, panStart ).multiplyScalar( scope.panSpeed );
			pan( panDelta.x, panDelta.y );
			panStart.copy( panEnd );
		}
		scope.update();
	}
	/*<===========*/
	/*双指触摸:缩放==>*/
	function handleTouchStartEnableZoom( event ) {
		if ( scope.enableZoom ) { //缩放
			var dx = event.touches[ 0 ].pageX - event.touches[ 1 ].pageX;
			var dy = event.touches[ 0 ].pageY - event.touches[ 1 ].pageY;
			var distance = Math.sqrt( dx * dx + dy * dy );
			dollyStart.set( 0, distance );
		}
		// if(scope.enableRotate){ //旋转
		// 	var x = 0.5 * ( event.touches[ 0 ].pageX + event.touches[ 1 ].pageX );
		// 	var y = 0.5 * ( event.touches[ 0 ].pageY + event.touches[ 1 ].pageY );
		// 	rotateStart.set( x, y );
		// }
		// if ( scope.enablePan ) { //移动
		// 	var x = 0.5 * ( event.touches[ 0 ].pageX + event.touches[ 1 ].pageX );
		// 	var y = 0.5 * ( event.touches[ 0 ].pageY + event.touches[ 1 ].pageY );
		// 	panStart.set( x, y );
		// }
	}
	function handleTouchMoveEnableZoom( event ) {
		if ( scope.enableZoom ) { //缩放
			var dx = event.touches[ 0 ].pageX - event.touches[ 1 ].pageX;
			var dy = event.touches[ 0 ].pageY - event.touches[ 1 ].pageY;
			var distance = Math.sqrt( dx * dx + dy * dy );
			dollyEnd.set( 0, distance );
			dollyDelta.set( 0, Math.pow( dollyEnd.y / dollyStart.y, scope.zoomSpeed ) );
			dollyIn( dollyDelta.y );
			dollyStart.copy( dollyEnd );
		}
		// if(scope.enableRotate){ //旋转
		// 	var rx = 0.5 * ( event.touches[ 0 ].pageX + event.touches[ 1 ].pageX );
		// 	var ry = 0.5 * ( event.touches[ 0 ].pageY + event.touches[ 1 ].pageY );
		// 	rotateEnd.set( rx, ry );
		// 	rotateDelta.subVectors( rotateEnd, rotateStart ).multiplyScalar( scope.rotateSpeed );
		// 	var element = scope.domElement === document ? scope.domElement.body : scope.domElement;
		// 	rotateLeft( 2 * Math.PI * rotateDelta.x / element.clientHeight ); // yes, height
		// 	rotateUp( 2 * Math.PI * rotateDelta.y / element.clientHeight );
		// 	rotateStart.copy( rotateEnd );
		// 	scope.update();
		// }
		// if ( scope.enablePan ) { //移动
		// 	var x = 0.5 * ( event.touches[ 0 ].pageX + event.touches[ 1 ].pageX );
		// 	var y = 0.5 * ( event.touches[ 0 ].pageY + event.touches[ 1 ].pageY );
		// 	panEnd.set( x, y );
		// 	panDelta.subVectors( panEnd, panStart ).multiplyScalar( scope.panSpeed );
		// 	pan( panDelta.x, panDelta.y );
		// 	panStart.copy( panEnd );
		// }
		scope.update();
	}
	/*<===========*/
	// 触摸结束
	function handleTouchEnd( event ) {
		console.log( '触摸结束',event);
	}


	//方法绑定
	scope.domElement.addEventListener( 'contextmenu', onContextMenu, {passive:false} );
	scope.domElement.addEventListener( 'mousedown', onMouseDown, {passive:false} );
	scope.domElement.addEventListener( 'wheel', onMouseWheel, {passive:false} );
	scope.domElement.addEventListener( 'touchstart', onTouchStart, {passive:false} );
	scope.domElement.addEventListener( 'touchend', onTouchEnd, {passive:false} );
	scope.domElement.addEventListener( 'touchmove', onTouchMove, {passive:false} );
	window.addEventListener( 'keydown', onKeyDown, {passive:false} );

	// force an update at start
	this.update();

};

THREE.OrbitControls.prototype = Object.create( THREE.EventDispatcher.prototype );
THREE.OrbitControls.prototype.constructor = THREE.OrbitControls;
