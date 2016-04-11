	// data 发送过来数据样本
	// Object {
	// 		asas: 
	// 		{
	// 			bust: 0
	// 			cards: Array[2]
	// 			identity: 0
	// 			insurance: 0
	// 			name: "asas"
	// 		}
	// 		ddd: 
	// 		{
	// 			bust: 0
	// 			cards: Array[2]
	// 			identity: 1
	// 			insurance: 0
	// 			name: "ddd"					
	// 		}
	// }





//socket设置端口，IP加端口号，本地调试用下方地址。
var socket = io.connect('http://localhost:8888');

//局域网联机测试
// var socket = io.connect('http://10.50.63.242:8888');

//加入游戏按钮
var btn1 = document.getElementById('btn1');
var btn2 = document.getElementById('btn2');
var btn3 = document.getElementById('btn3');

//买保险按钮
var ins_btn = document.getElementById('ins_btn');

//发牌按钮
var sendCard_btn = document.getElementById('sendCard');

//停牌按钮
var stopCard_btn = document.getElementById('stopCard');

//存放牌组信息对象，我方与敌方
var ourCard = {},
	otherCard = {};

//保存用户名
var nickName = "";

//监听有没有人停牌
var ready = 0;

//变量用来保存对方第一张牌
var secretCard = 0;

//进入某个房间按钮
setRoomBtn(btn1,0);
setRoomBtn(btn2,1);
setRoomBtn(btn3,2);

function setRoomBtn(btn,roomNumber){
	btn.addEventListener('click',function(){
		var name = prompt("请输入你的游戏昵称");

		if (name!=="") {
		 	socket.emit('login',{user:name,room:roomNumber});
		 	nickName = name;
		}

		btn1.style.display = "none";
		btn2.style.display = "none";
		btn3.style.display = "none";
	},false);
}


//买保险按钮
ins_btn.addEventListener('click',function(){
	socket.emit('buyInsure');
	ins_btn.style.display = 'none';
	
},false);


//发牌按钮
sendCard_btn.addEventListener('click',function(){
	socket.emit('sendCard');
	hiddenButton();
});


//停牌按钮
stopCard_btn.addEventListener('click',function(){
	socket.emit('stopCard');
	ready = 1;
	hiddenButton();
	var p = document.createElement('p');
	p.innerHTML = "请耐心等待对方操作";
	this.parentNode.appendChild(p);
})

//监听当游戏开始
socket.on('gameStart',function(data) {

	//这里曾出现BUG，有参数忘记初始化(已修复)
	resetState();

	showButton();

	//取得两边的卡组
	differCard(data);

	// console.log("我方点数: " + ourCard.cards);
	// console.log("对方点数: " + otherCard.cards);

	//查看是否触发买保险
	insurance();

	ourDiv.innerHTML = "";
	otherDiv.innerHTML = "";

	drawGame();
});

//监听对手是否退出
socket.on('oppExit',function(data){
	alert(data);
});

//监听下一轮
socket.on('nextRound',function(data){
	
	//分配卡牌
	differCard(data);

	// console.log("我方点数: " + ourCard.cards);
	// console.log("对方点数: " + otherCard.cards);

	ins_btn.style.display = "none";

	//画图
	drawGame();

	//判断是否爆牌,如果没爆那么继续下一轮
	var bst = isBust();
	if(!bst) {
		if(ready == 0) {
			showButton();
		} else {
			hiddenButton();
		}
	}


});

//监听如果结束，则把第一章牌替换成真牌
socket.on('end',function(data){
	var otherDiv = document.getElementById('otherDiv');
	otherDiv.replaceChild(secretCard,otherDiv.firstChild);
	differCard(data);
	judge();
})

//监听触发保险(改变State状态)
socket.on('confirmInsure',function(data){
	var ourState = document.getElementById('ourState');
	var otherState = document.getElementById('otherState');
	var p = document.createElement('p');
	p.innerHTML = "保险加持";
	if(nickName === data) {
		ourState.appendChild(p);
	} else {
		otherState.appendChild(p);
	}
})

//消息事件，刷新页面
socket.on('msg',function(data) {
	alert(data);
	window.location.reload();
})

//画图函数
function drawGame() {

	//获取双方区域element
	var ourDiv = document.getElementById('ourDiv');
	var otherDiv = document.getElementById('otherDiv');

	//画区域
	drawSide(ourDiv,ourCard.cards);
	drawSide(otherDiv,otherCard.cards);

	var ourState = document.getElementById('ourState');
	var otherState = document.getElementById('otherState');

	//如果隐藏牌是空的，则把他克隆出来
	if(secretCard === 0 ){
		secretCard = otherDiv.firstChild.cloneNode(false);

		otherDiv.firstChild.style.backgroundImage = "url('360.png')";
		otherDiv.firstChild.style.backgroundSize = 'contain';
		otherDiv.firstChild.style.backgroundPosition = "0 0";

		//设置庄闲
		if(ourCard.identity == 1) {
			ourState.innerHTML = "庄 <h1>" + nickName +": </h1>";
		} else {
			ourState.innerHTML = "闲 <h1>" + nickName +": </h1>";			
		}

		if(otherCard.identity == 1) {
			otherState.innerHTML = "庄 <h1>" + otherCard.name +": </h1>";
		} else {
			otherState.innerHTML = "闲 <h1>" + otherCard.name +": </h1>";
		}

	}
}


function isBust() {
	// console.log('isBust');
	var res = true;

	// 判断是否爆掉 这里要获取最小值
	var ourN = ourCard.cards.map(function(item){
		item = item%13 + 1;
		if(item > 10) {
			item = 10;
		}
		return item;
	});

	var otherN = otherCard.cards.map(function(item){
		item = item%13 + 1;
		if(item > 10) {
			item = 10;
		}
		return item;
	});

	var ourSum = ourN.reduce(function(pur,cur){
		return pur+cur;
	} );

	var otherSum = otherN.reduce(function(pur,cur){
		return pur+cur;
	});

	// console.log('我方记录：'+ourN);
	// console.log('我方总和：'+ourSum);
	// console.log('对方总和: '+otherSum);
	
	// 如果爆掉显示
	if(ourSum > 21 && otherSum > 21) {
		win('平手，双方全爆');

	} else if (ourSum > 21 && otherSum <= 21) {
		win('你输了，我方爆了');

	} else if (otherSum > 21 && ourSum <= 21) {
		win('你赢了，对方爆掉');

	} else {
		res = false;
	}
	return res;
}


function insurance(){

	//如果对方是庄家，并且对方第一张牌是A则显示买保险的按钮
	if(otherCard.identity == 1 && (otherCard.cards[1]%13 +1) == 1) {
		ins_btn.style.display = "inline-block";
	}
}

//区分双方卡片
function differCard(data) {
	for(var index in data ) {
		if(index == nickName) {
			ourCard = data[index];
		} else {
			otherCard = data[index];
		}
	}		
}


function win(str){
	alert(str);
	socket.emit('restart');
}


function hiddenButton(){
	sendCard_btn.style.display = "none";
	stopCard_btn.style.display = "none";
	ins_btn.style.display = "none";
}

function showButton(){
	sendCard_btn.style.display = "inline-block";
	stopCard_btn.style.display = "inline-block";
}

function judge(){

	// console.log('judge');

	var ourSum = getBiggestSum(ourCard.cards);
	var otherSum = getBiggestSum(otherCard.cards);

	// console.log('我方点数: '+ourSum);
	// console.log('对方点数: '+otherSum);

	//判断输赢
	//如果有人买保险了
	if(ourCard.insurance === 1 || otherCard.insurance === 1 )
	{

		//我方买保险
		if(ourCard.insurance === 1) {
			if(otherSum === 21 && otherCard.cards.length === 2){
				win('你赢了，因为庄家是黑杰克，你买了保险');
			} else {
				if (ourSum>otherSum) {
					win('恭喜你！你赢了！'+ourSum+"/"+otherSum);
				} else {
					if (otherSum>ourSum) {
						win('抱歉，你输了~~'+ourSum+"/"+otherSum);
					} else  {
						win('双方平手！');
					}						
				}

			}
		}

		//对方买保险
		if (otherCard.insurance === 1 ) {
			if(ourSum === 21 && ourCard.cards.length ===2) {
				win('你输了，因为对方买了保险，你是庄家');
			} else {
				if (ourSum>otherSum) {
					win('恭喜你！你赢了！'+ourSum+"/"+otherSum);
				} else {
					if (otherSum>ourSum) {
						win('抱歉，你输了~~'+ourSum+"/"+otherSum)
					} else {
						win('双方平手！');
					}						
				}

			}
		} 		
	} else {

		//没有人买保险
		if (ourSum>otherSum) {
			win('恭喜你！你赢了！'+ourSum+"/"+otherSum);
		} else {
			if (otherSum>ourSum) {
				win('抱歉，你输了~~'+ourSum+"/"+otherSum)
			} else {
				win('双方平手！');
			}				
		}
	
	}

}

//获得最大数字总和
function getBiggestSum(arr) {
	var res = 0;

	arr = arr.map(function(item){
		item = item%13 + 1;
		if(item>10) {
			item = 10;
		}
		return item;
	})

	// console.log(arr);
	//累加
	res = arr.reduce(function(pur,cur){
		return pur+cur;
	})

	//判断数组中是否有A
	if(arr.indexOf(1)>=0){
		if(res+10 <= 21) {
			res = res+10;
		}
	}

	return res;
}

	

function drawSide(ele,arr){

	//获取元素个数与数组长度
	var n = ele.childNodes.length;
	var m = arr.length;

	//牌比数组多就清空
	if(n>m){
		ele.innerHTML = "";
		n = 0;
	}

	//截取多出的卡片，添加DOM队列
	if(n<m) {
		var temp = arr.slice(n);
		temp.forEach(function(item){
			var y = Math.floor(item/13);
			var x = item%13;
			var div = getNormalCard(x,y);
			ele.appendChild(div);
		})
	}
}

//设置雪碧图中牌的位置
function getNormalCard(x,y){
	var div = document.createElement('div');
	div.className = "card";
	div.style.backgroundPosition = -x*5 + "rem "+ -y*7.5 + "rem";
	return div;
}


function resetState(){
	secretCard = 0;
	ready = 0;

	var p = stopCard_btn.parentNode.getElementsByTagName('p')[0];
	if(p) {
		var a = stopCard_btn.parentNode.removeChild(p);
		a = null;
	}
}