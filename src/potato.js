/**
POTATO : Canvas Basic Experiment Toolkit
Copyright (C) 2012 James Li
Version:1.1

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
**/

(function(window){

	//Base
	var CanvasBase=function(canvasId){
			//setCanvas
			var canvas=document.getElementById(canvasId);
			
			if(!canvas){return}
			
			context=canvas.getContext("2d");

			return new CanvasBase.fn.init(canvas,context);
		},
		
		//set in init
		_this,
		
		pageX=function(elm){
			return elm.offsetParent ? elm.offsetLeft+pageX(elm.offsetParent) : elm.offsetLeft
		},
		
		pageY=function(elm){
			return elm.offsetParent ? elm.offsetTop+pageY(elm.offsetParent) : elm.offsetTop
		},
		
		//use requestAnimationFrame
		Anim=requestAnimFrame = (function(callback){
			return window.requestAnimationFrame ||
			window.webkitRequestAnimationFrame ||
			window.mozRequestAnimationFrame ||
			window.oRequestAnimationFrame ||
			window.msRequestAnimationFrame ||
			function(callback){
				window.setTimeout(callback, 1000 / 60);
			};
		})(),
		
		getStyle=function(elm,name){
			if(elm.style[name])
			return elm.style[name];
			else if(elm.currentStyle)
			return elm.currentStyle[name];
			else if(document.defaultView&&document.defaultView.getComputedStyle){
				name=name.replace(/([A-Z])/g,"-$1");
				name=name.toLowerCase();
				var s=document.defaultView.getComputedStyle(elm,"");
				return s&&s.getPropertyValue(name);
			}else{
				return null;
			}
		},
			
		extend=function(){
			var target=arguments[0]||{},
				i=1,
				length=arguments.length,
				deep=false,
				options,
				name,
				src,
				copy;
			
			if(typeof target==="boolean"){
				deep=target;
				target=arguments[1] || {};
				i=2;
			}
			
			if(typeof target!=="object" && typeof target!=="function"){
				target={};
			}
			
			if(length==i){
				target=this;
				--i;
			}
			
			for(;i<length;i++){
				if((options=arguments[i])!=null){
					for(name in options){
						src=target[name];
						copy=options[name];
						
						if(target==copy){
							continue;
						}
						
						if(deep && copy && typeof copy===("object" || "array")){
							var _clone= (src && typeof src===("object" || "array")) ? src : (typeof copy==="array") ? [] : {};
							target[name]=extend(deep,_clone,copy);
						}else if(copy !==undefined){
							target[name]=copy;
						}
					}
				}
			}
			return target;
		},
			
		clone=function(){
			var obj=arguments[0],
				temp,
				copy;
			
			if(typeof obj==="object"){
				temp={};
				for(var i in obj){
					if(typeof obj[i]==="object"){
						copy=clone(obj[i]);
					}else{
						copy=obj[i];
					}
					temp[i]=copy;
				}
			}else if(typeof obj==="function"){
				
				temp=function(){return obj.apply(this,arguments)};
				for(var i in obj){
					temp[i]=obj[i];
				}
			}else{//other case:data-type:number,boolean,null,undefined
				temp=obj;
			}
			return temp;
		},
			
		//globalalpha color fix to rgb color value, used in different alpha value of shapes
		alphaFix=function(){
			var c0=getStyle(_this.canvas,"backgroundColor");
			//if canvas use a rgba backgroundColor
			if(c0=="" || c0=="transparent"){
				c0="rgb(255,255,255)";
			}
			else if(c0.indexOf("rgba")>-1){
				var m=c0.match(/[\d\.]+/g);
				if(m.length<4){return}
				var a0=parseFloat(m.pop());
				for(var i=0;i<3;i++){
					m[i]=parseInt(parseInt(m[i])*a0).toString();
				}
				c0="rgb("+m.join(",")+")";
			}
			c0=c0.match(/\d+/g);
			var c1_fill=_this.context.fillStyle.substring(1),
				c1_stroke=_this.context.strokeStyle.substring(1);
			var a1=_this.context.globalAlpha;
			var c2_fill=[],c2_stroke=[];
			for(var i=0;i<3;i++){
				var c1f=parseInt(c1_fill.substr(i*2,2),16);
				var c1s=parseInt(c1_stroke.substr(i*2,2),16);
				c0[i]=parseInt(c0[i]);
				var c2f=c1f*a1+c0[i]-c0[i]*a1;
				var c2s=c1s*a1+c0[i]-c0[i]*a1;
				c2_fill.push(parseInt(c2f).toString(16));
				c2_stroke.push(parseInt(c2s).toString(16));
			};
			return {fill:"#"+c2_fill.join(""),stroke:"#"+c2_stroke.join("")};
		},
			
		//two matrix multiply
		mtxMultiply=function(m,n){
			var a=m[0]*n[0]+m[1]*n[2],
				b=m[0]*n[1]+m[1]*n[3],
				c=m[2]*n[0]+m[3]*n[2],
				d=m[2]*n[1]+m[3]*n[3],
				e=m[4]*n[0]+m[5]*n[2]+n[4],
				f=m[4]*n[1]+m[5]*n[3]+n[5];
			return [a,b,c,d,e,f];
		},
		
		/*v: array[x0,y0] 
		**victor(x0,y0,1) divide the transform matrix m, result vector(x0,y0,1),return array(x,y)
		*/
		mtxDivision=function(v,m){
			var x=(m[3]*(v[0]-m[4])-m[2]*(v[1]-m[5]))/(m[0]*m[3]-m[1]*m[2]),
				y=(m[0]*(v[1]-m[5])-m[1]*(v[0]-m[4]))/(m[0]*m[3]-m[1]*m[2]);
			return [x,y];
		},
		
		//----------------bind transform matrix----------------//
		bindTransform=function(context){
			var _super=context.__proto__,
				mtxSaving=[];
			
			//rewrite setTransform
			context.setTransform=function(){
				_super.setTransform.apply(this,arguments);
				_this.currentMTX=Array.prototype.slice.call(arguments,0);
			};
			
			//rewrite transform
			context.transform=function(){
				_super.transform.apply(this,arguments);
				//matrix multiply
				var m=_this.currentMTX;
				var n=arguments;
				_this.currentMTX=mtxMultiply(m,n);
			};
			
			//translate
			context.translate=function(){
				_super.translate.apply(this,arguments);
				_this.currentMTX[4]+=arguments[0];
				_this.currentMTX[5]+=arguments[1];
			};
			
			//scale
			context.scale=function(){
				_super.scale.apply(this,arguments);
				_this.currentMTX[0]*=arguments[0];
				_this.currentMTX[3]*=arguments[1];
			};
			
			//rorate
			context.rotate=function(){
				_super.rotate.call(this,arguments[0]);
				var angle=arguments[0];
				var temp0=_this.currentMTX;
				var temp1=[Math.cos(angle),Math.sin(angle),-Math.sin(angle),Math.cos(angle),0,0];
				_this.currentMTX=mtxMultiply(temp0,temp1);
			};
			
			//save and restore
			context.save=function(){
				_super.save.call(this);
				mtxSaving.push(_this.currentMTX.slice(0));
			}
			context.restore=function(){
				_super.restore.call(this);
				if(mtxSaving.length>0)
					_this.currentMTX=mtxSaving.pop();
			}
			
		},
			
		//zoomFactor of current page
		zoomFactor=1,
			
		//temp coordinate x and y, (new-temp)=diff, used in drag event
		tempx,tempy;
		
	//CanvasBase prototype
	CanvasBase.fn=CanvasBase.prototype={
		
		init:function(canvas,context){
			
			_this=this;
			
			this.canvas=canvas;
			
			this.context=context;
			
			this.initPos();
			
			bindTransform(context);
			
			return this;
		},
		
		version:"1.1",
		
		extend:extend,
		
		map:function(obj){
			var ret={key:[],value:[]};
			
			for(var i in obj){
				ret.key.push(i);
				ret.value.push(obj[i]);
			}
			
			return ret;
		},
		
		defaultMTX:[1,0,0,1,0,0],
		
		currentMTX:[1,0,0,1,0,0],
		
		//event fire single or both when shapes overlapping
		stopPropagation:true,
		
	}
	CanvasBase.fn.init.prototype=CanvasBase.prototype;
	
	//--------------------event handler-------------------//
	CanvasBase.prototype.addEvent=function(element,type,fn){
		if(document.addEventListener)
			return element.addEventListener(type,fn,false);
		else if(document.attachEvent)
			return element.attachEvent("on"+type,fn);
		else
			return element["on"+type]=fn;
	};
	CanvasBase.prototype.removeEvent=function(element,type,fn){
		if(document.removeEventListener)
			return element.removeEventListener(type,fn,false);
		else if(document.detachEvent)
			return element.detachEvent("on"+type,fn);
		else
			return false;
	};
	
	//--------------------------position------------------------//
	//get position
	CanvasBase.prototype.getPos=function(){
		var scrollX,scrollY,
			rect,physicalWidth;

		_this.canvas.winX=pageX(_this.canvas);
		_this.canvas.winY=pageY(_this.canvas);
		
		//scroll position must get value after window onload
		//if ie && version below 8,the scrollleft of html should consider the zoomfactor
		if(window.pageXOffset != undefined && window.pageYOffset != undefined){
			
			scrollX=window.pageXOffset;
			scrollY=window.pageYOffset;
			
		}else{
			
			//ie below 9
			rect=document.body.getBoundingClientRect();
			physicalWidth=rect.right-rect.left;
			zoomFactor=rect ? physicalWidth/document.body.offsetWidth : 1;
			scrollX=document.documentElement.scrollLeft/zoomFactor;
			scrollY=document.documentElement.scrollTop/zoomFactor;
			
		}
		_this.canvas.diffX=_this.canvas.winX-scrollX;//mouse event: x=e.clientX-diffX;
		_this.canvas.diffY=_this.canvas.winY-scrollY;//mouse event: y=e.clientY-diffY;
		
		return this;
	};
	
	//initial position
	CanvasBase.prototype.initPos=function(){
		
		//set position variables when load and scroll 
		this.addEvent(window,"mouseover",this.getPos);	
		this.addEvent(window,"scroll",this.getPos);
		
		//mousemove
		this.addEvent(this.canvas,"mousemove",function(e){
			//get coordinate x/y
			e=e||window.event;	
			if(_this.canvas.x) tempx=_this.canvas.x;
			if(_this.canvas.y) tempy=_this.canvas.y;
			_this.canvas.x=Math.round(e.clientX/zoomFactor-_this.canvas.diffX);
			_this.canvas.y=Math.round(e.clientY/zoomFactor-_this.canvas.diffY);
		});
		
		return this;
	};
		
		
	//--------------------------animate-------------------//
	//draw
	CanvasBase.prototype.draw=function(){};
	//animate state update
	CanvasBase.prototype.update=function(){};
	//canvas clear
	CanvasBase.prototype.clear=function(){
		this.context.save();
		this.context.setTransform(1,0,0,1,0,0);
		this.context.clearRect(0,0,this.canvas.width,this.canvas.height);
		this.context.restore();
		return this;
	};
	
	//animate
	CanvasBase.prototype.animate=function(){
		this.clear();
		this.update();
		this.draw();
		var _this=this;
		Anim(function(){
			_this.animate();
		});
	};	
	
	CanvasBase.prototype.cancelAnimate=function(){
		if(!!Anim){
			var currentFrame=Anim({}) ? Anim({}) : 0;
			Anim=function(){return 0};
			return currentFrame;
		}
		return false;
	};
	
	CanvasBase.prototype.restoreAnimate=function(){
		Anim=requestAnimFrame;
		this.animate();
		return this;
	};
		
		
	//--------------------Shape------------------------------//
	var Shape=CanvasBase.prototype.Shape=function(){
		var _fn=arguments[0];
		if(!_fn || typeof _fn!=="function"){
			_fn=function(){};
		}
		//store constr function
		Shape.store.add(_fn,"constr");
		
		return new Shape.fn.init(_fn);	
	};	
	
	extend(Shape,{
		store:{
			id_constr:1,
			id_drawFn:1,
			id_shapeObj:1,
			type:["constr","drawFn","shapeObj"],
			cache_constr:{},
			cache_drawFn:{},
			cache_shapeObj:{},
			add:function(fn,type){
				if(!fn["id_"+type] && !isNaN(Shape.store["id_"+type])){
					fn["id_"+type]=Shape.store["id_"+type]++;
					return !!(Shape.store["cache_"+type][fn["id_"+type]]=fn);
				}
			}
		},
		extendFn:function(fn1,fn2){
			if(!fn1){return}
			if(!fn2){fn2=function(){}}
			return function(){
				fn1.apply(this,arguments);
				fn2.apply(this,arguments);
			}
		}
	});

	Shape.fn=Shape.prototype={
		//initial
		init:function(){
			var self=this,
				ret,//shape constructor
				id_constr=arguments[0].id_constr;
			ret=function(){
				var obj=clone(self);//shape instance object
					
				obj.id_constr=id_constr;	
				if(arguments.callee.id_drawFn){
					obj.id_drawFn=arguments.callee.id_drawFn;
				}
				
				//quick set options
				if(typeof arguments[arguments.length-1]=="object"){
					obj.options=arguments[arguments.length-1];
				}
			
				Shape.store.cache_constr[id_constr].apply(obj,arguments);
				
				//store shapeObj
				Shape.store.add(obj,"shapeObj");
				
				return obj;
			};
			
			ret.id_constr=id_constr;
			
			//extend constructor function
			ret.extend=function(fn){
				var fn1=Shape.store.cache_constr[id_constr];
				/*since the origin constr normally contain draw(),
				*so apply it at latest to bind props (like options) first*/
				var temp=Shape.extendFn(fn,fn1);
				Shape.store.cache_constr[id_constr]=temp;
				
				return ret;
			};
			
			//extend draw constructor function
			ret.extendDraw=function(fn){
				if(!ret.id_drawFn){
					Shape.store.add(fn,"drawFn");
					ret.id_drawFn=fn.id_drawFn;
				}else{
					var fn1=Shape.store.cache_drawFn[ret.id_drawFn];
					var temp=Shape.extendFn(fn1,fn);
					Shape.store.cache_drawFn[ret.id_drawFn]=temp;
				}
				return ret;
			}
			
			return ret;
		},
		
		//getProperty
		get:function(p){return this.p!==undefined ? this.p : null},
		
		//customer properties set(only for undefined properties)	
		set:function(){
			if(arguments.length==0){
				return this;
			}
			if(typeof arguments[0]=="object"){
				for(var i in arguments[0]){
					if(this.i===undefined)
						this[i]=arguments[0][i];			
				}
				return this;
			}
			if(arguments.length==2 && typeof arguments[0]=="string" &&this[arguments[0]]===undefined){
				this[arguments[0]]=arguments[1];
				return this;
			}		
		},
		
		//draw options
		drawOptions:function(options){
			if(options["lineWidth"]!==undefined){
				_this.context.lineWidth=options["lineWidth"];
			}
			if(options["fill"]!==undefined){
				_this.context.fillStyle=options["fill"];
				_this.context.fill();
			}
			if(options["stroke"]!==undefined){
				_this.context.strokeStyle=options["stroke"];
				_this.context.stroke();
			}
		},
		
		current:false,//inpath and have largest z-index
			
		inpath:false,//point or mouse cursor in shape path
		
		dragable:false,
		
		draw:function(fn){
			
			//add extended drawFn
			if(this.id_drawFn){
				var fn1=Shape.store.cache_drawFn[this.id_drawFn];
				this.drawFn=Shape.extendFn(fn,fn1);
			}else{
				this.drawFn=fn;
				Shape.store.add(fn,"drawFn");
				this.id_drawFn=fn.id_drawFn;
			}
			
			this.mtx=_this.currentMTX.slice(0);
			
			if(this.options){	
				this.originOps=clone(this.options);
			}
			
			this.events();
			
			this.draw= function(){
				var detect=arguments[0]=="detect" ? true : false;
	
				_this.context.save();
				
				_this.context.beginPath();
				
				this.drawFn.apply(this,arguments);
				this.isCurrent();
				
				if(this.options && typeof this.options=="object" && !detect){
					this.drawOptions(this.options);
				}
				
				_this.context.restore();
				
				return this;
			}
		},
		
		remove:function(){
			var ind=this.id_shapeObj;
			if(ind!=undefined){
				delete Shape.store.cache_shapeObj[ind];
				_this.clear();
				_this.drawShapes();
			}
			this.draw=function(){};//empty the draw
			this.inpath=this.current=false;
			return;
		},
			
		setDragable:function(b){
			if(arguments.length==0)
				this.dragable=true;
			else
				this.dragable=!!arguments[0];
			return this;
		},
			
		isInPath:function(x,y){
			var coordX=x ? x : _this.canvas.x,
				coordY=y ? y : _this.canvas.y;
			//isPointInPath not support in Internet Explorer below ie9

			/**bugfix:some browser (firefox below 5 and old version opera)report isPointInPath() not calculate the transform matrix,
			*so fix it by reset transform before detect path.see https://bugzilla.mozilla.org/show_bug.cgi?id=405300**/
			_this.context.setTransform(1,0,0,1,0,0);
			return this.inpath=(coordX && coordY && _this.context.isPointInPath(coordX,coordY)) ? true : false;
		},
			
		isCurrent:function(){
			if(!this.isInPath()){
				return this.current=false;
			}else{
				for(var i in _this.shapeList){
					if(_this.shapeList[i].current==true && _this.shapeList[i]!=this)
						return this.current=false;
				}
				return this.current=true;
			}
		},
			
		isOptionChanged:function(){
			var o=this.originOps,
				c=this.options;
			if(!o || !c){return false;}
			if(c.fill!=o.fill){
				return true;
			}
			if(c.stroke!=o.stroke){
				return true;
			}
			if(c.lineWidth!=o.lineWidth){
				return true;
			}
			return false;
		},
			
		//shape events
		events:function(){
			var s=this,changeback=false;
			
			//partial handler
			var eventsPartial=function(s,_fn){
				return function(e){			
					_this.context.save();

					_fn.call(_this.canvas);	
					
					_this.context.setTransform.apply(_this.context,s.mtx);
					//if a rgba color cover to existed canvas, it should be fixed to an equal rgb color
					if(_this.context.globalAlpha!=1){
						var fixedColor=alphaFix();
						_this.context.globalAlpha=1;
						_this.context.fillStyle=fixedColor.fill;
						_this.context.strokeStyle=fixedColor.stroke;
					}
					
					if(s.isOptionChanged()){
						s.draw();
						changeback=true;
					}else{
						if(changeback){
							changeback=false;
							s.draw();
						}else{
							s.draw("detect");
						}
					}
					
					_this.context.restore();
				}		
			};
			
			_this.addEvent(_this.canvas,"click",eventsPartial(s,function(){
				if(_this.stopPropagation){
					if(s.current){
						s.handleEvents("click");
						s.onclick();
					}
				}else{
					if(s.inpath){
						s.handleEvents("click");
						s.onclick();
					}
				}
			}));
			_this.addEvent(_this.canvas,"mousedown",eventsPartial(s,function(){
				if(s.current && s.dragable){
					s.dragging=true;	
				}
				if(_this.stopPropagation){
					if(s.current){
						s.handleEvents("mousedown");
						s.onmousedown();
						s.mdown=true;
					}
				}else{
					if(s.inpath){
						s.handleEvents("mousedown");
						s.onmousedown();
						s.mdown=true;
					}
				}
			}));
			_this.addEvent(_this.canvas,"mouseup",eventsPartial(s,function(){
				s.dragging=false;
				if(_this.stopPropagation){
					if(s.current && s.mdown){
						s.handleEvents("mouseup");
						s.onmouseup();
						s.mdown=null;
					}
				}else{
					if(s.inpath && s.mdown){
						s.handleEvents("mouseup");
						s.onmouseup();
						s.mdown=null;
					}
				}
			}));
			_this.addEvent(_this.canvas,"mousemove",eventsPartial(s,function(e){
				
				if(s.dragging){
					_this.clear();				
					var dx=_this.canvas.x-tempx,//add dx
						dy=_this.canvas.y-tempy;//add dy		
					var r=mtxDivision([dx,dy],s.mtx);
					s.x+=r[0];
					s.y+=r[1];
					_this.drawShapes();		
					s.handleEvents("drag");
					s.ondrag();
				}else{
					if(s.inpath){
						if(!s.state_inpath){
							s.state_inpath=true;
							s.handleEvents("mouseover");
							s.onmouseover();					
						}
						s.handleEvents("mousemove");
						s.onmousemove();
					}else{
						if(s.state_inpath){
							s.handleEvents("mouseout");
							s.onmouseout();
						}
						s.state_inpath=false
					}
				}
					
			}));
			
			return this;
		},
		
		//Shape addEvent / removeEvent / handleEvents
		addEvent:function(ev,fn){
			if(!this.eventsList)this.eventsList={};
			if(this.eventsList[ev]==undefined){this.eventsList[ev]=[];}		
			this.eventsList[ev].push(fn);
			return this;
		},
		
		removeEvent:function(ev,fn){
			if(this.eventsList[ev] && this.eventsList[ev].indexOf(fn)!==-1){
				var index=this.eventsList[ev].indexOf(fn);
				return this.eventsList[ev].splice(index,1);
			}
		},
			
		handleEvents:function(ev){
			if(!this.eventsList)this.eventsList={};
			if(this.eventsList[ev]==undefined){this.eventsList[ev]=[];}	
			var list=this.eventsList[ev];
			if(!list){return}
			for(var i=0;i<list.length;i++){
				list[i].call(this);
			}
		},
			
		//shape move
		move:function(endX,endY,type){
			if(!type)type="easing";
			if(type=="easing"){
				if(this.easing==undefined || isNaN(this.easing))
					this.easing=0.1;
				if(this.vx==undefined || isNaN(this.vx))
					this.vx=0;
				if(this.vy==undefined || isNaN(this.vy))
					this.vy=0;
				if(Math.abs(endX-this.x)>1){
					this.vx=(endX-this.x)*this.easing;
					this.x+=this.vx;
				}else{
					this.x=endX;
					this.vx=0;
				}
				if(Math.abs(endY-this.y)>1){
					this.vy=(endY-this.y)*this.easing;
					this.y+=this.vy;
				}else{
					this.y=endY;
					this.vy=0;
				}
			}else if(type=="elastic"){
				if(this.vx==undefined || isNaN(this.vx))
					this.vx=0;
				if(this.vy==undefined || isNaN(this.vy))
					this.vy=0;
				if(this.spring==undefined || isNaN(this.spring))
					this.spring=0.01;
				if(this.friction==undefined || isNaN(this.friction))
					this.friction=0.8;
				if(this.springLength==undefined || isNaN(this.springLength))
					this.springLength=0;
				
				var angle=Math.atan2((endY-this.y),(endX-this.x));
				endX-=Math.cos(angle)*this.springLength;
				endY-=Math.sin(angle)*this.springLength;
				this.vx+=(endX-this.x)*this.spring;
				this.vy+=(endY-this.y)*this.spring;
				this.vx*=this.friction;
				this.vy*=this.friction;
				this.x+=this.vx;
				this.y+=this.vy;
			}
			
			return this;
		},
		
		//shape hit(only for test, shape ball)
		isHitted:function(s){
			if(!this.r || !s.r){return}
			var min=s.r+this.r;
			var dx=s.x-this.x;
			var dy=s.y-this.y;
			var dist=Math.sqrt(dx*dx+dy*dy);
			var angle=Math.atan2(dy,dx);
			return dist<min ? [min-dist,angle] : false
		},
		
		//reset shape mouse events
		onclick:function(){},
			
		onmousedown:function(){},
		
		onmousemove:function(){},
		
		onmouseover:function(){},
		
		onmouseout:function(){},
		
		onmouseup:function(){},
		
		ondrag:function(){}
	};
	
	Shape.fn.init.prototype=Shape.fn;
	
		
	CanvasBase.prototype.drawShapes=function(){
		var shapes,i=1,currentShape,currentDraw,mtx,drawFn;
		
		if(this.Shape.store.id_shapeObj>1){
			//to make sure current shape draw at last which makes it the highest z-index 
			shapes=this.Shape.store.cache_shapeObj;
			for(i in shapes){
				if(!shapes[i].current){
					mtx=shapes[i].mtx;
					_this.context.save();
					_this.context.setTransform.apply(_this.context,mtx);
					shapes[i].draw();
					_this.context.restore();
				}else{
					currentShape=shapes[i];
					currentDraw=shapes[i].draw;
				}
			}
			if(!!currentShape && !!currentDraw){
				var mtx=currentShape.mtx;
				_this.context.save();
				_this.context.setTransform.apply(_this.context,mtx);
				currentDraw.call(currentShape);
				_this.context.restore();
			}
		}
	}	
	
	//-------------------Extend Shapes-------------------------------//
	Shape.extend=CanvasBase.prototype.extend;
	
	//Shape: Circle
	CanvasBase.prototype.Circle=Shape(function(x,y,r){
		this.x=x;
		this.y=y;
		this.r=r;
				
		this.draw(function(){
			_this.context.arc(this.x,this.y,this.r,0,Math.PI*2,false);
		});
	});
	
	//Shape: Rect
	CanvasBase.prototype.Rect=Shape(function(x,y,w,h){		
		this.x=x;
		this.y=y;
		this.w=w;
		this.h=h;
				
		this.draw(function(){
			_this.context.rect(this.x,this.y,this.w,this.h);
		});
	});
	
	//Shape:ellipse
	CanvasBase.prototype.Ellipse=Shape(function(cx,cy,rx,ry){
		this.x=cx;
		this.y=cy;
		this.rx=rx;
		this.ry=ry;
		var self=this;
		
		//constant
		var EToBConst=2/3*(Math.sqrt(2)-1);
		//control point width and height	
		this.offsetX=this.rx*2*EToBConst,
		this.offsetY=this.ry*2*EToBConst;
		
		this.draw(function(){
			self.maxX=self.x+self.rx,
			self.maxY=self.y+self.ry,
			self.minX=self.x-self.rx,
			self.minY=self.y-self.ry;
			
			_this.context.moveTo(self.minX,self.y);
			
			_this.context.bezierCurveTo(self.minX,self.y-self.offsetY,self.x-self.offsetX,self.minY,self.x,self.minY);
			
			_this.context.bezierCurveTo(self.x+self.offsetX,self.minY,self.maxX,self.y-self.offsetY,self.maxX,self.y);
			
			_this.context.bezierCurveTo(self.maxX,self.y+self.offsetY,self.x+self.offsetX,self.maxY,self.x,self.maxY);
			
			_this.context.bezierCurveTo(self.x-self.offsetX,self.maxY,self.minX,self.y+self.offsetY,self.minX,self.y);
		});
	});
	
	//Shape:Polygon
	CanvasBase.prototype.Polygon=Shape(function(){
		//at least three point 
		if(arguments.length<6){return}
		this.x=arguments[0];//start x
		this.y=arguments[1];//start y
		var self=this;
		
		this.coord=[];
		for(var i=2;i<arguments.length;i++){
			if(typeof arguments[i]==="number"){
				this.coord.push(arguments[i])
			}else{
				break;
			}
		};
		if(this.coord.length%2==1){
			this.coord.splice(-1,1);
		}
		
		this.draw(function(){
			
			_this.context.moveTo(self.x,self.y);
			for(var i=0;i<self.coord.length;i+=2){
				_this.context.lineTo(self.coord[i],self.coord[i+1]);
			}
			_this.context.lineTo(self.x,self.y);
		});
		
		this.coordFix=function(){
			var dx=_this.canvas.x-tempx,//add dx
				dy=_this.canvas.y-tempy;//add dy		
			var r=mtxDivision([dx,dy],self.mtx);
			
			for(var i=0;i<self.coord.length;i+=2){
				self.coord[i]+=dx;
				self.coord[i+1]+=dy;
			}
		};
		
		this.addEvent("drag",function(){
			self.coordFix();
		});
	});

	//set global object
	window.CanvasBase=window.CB=CanvasBase;

})(window);
