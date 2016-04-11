var express = require('express'),
	http = require('http');
var app = express();
var server = http.createServer(app);

//默认监听8888端口号
server.listen(8888);

//设置静态资源路径
app.use(express.static(__dirname+'/pub'));

app.get('/',function(req,res){
	res.sendFile(__dirname+'/index.html');
})

//socket.io绑定监听端口
var io = require('socket.io')(server);

// 新建玩家列表对象
var playerList = {};


// 房间对象，用来保存房间信息
var room = {
	'0':{

		//保存玩家socket对象的ID列表
		players:[],

		//保存牌组
		cards:[],

		//标记游戏状态
		start:0,

		//count用来记录轮询次数，当为0时候触发一起发牌事件
		count:0,

		//end用来标记结束，当为2时说明两人都不要牌，开始开拍
		end:0
	},
	'1':{
		players:[],
		cards:[],
		start:0,
		count:0,
		end:0
	},
	'2':{
		players:[],
		cards:[],
		start:0,
		count:0,
		end:0
	}
};

//玩家对象构造函数
function Player(name,socket,room){
	this.name = name;
	this.socket = socket;
	this.bust = 0;
	this.cards = [];
	//这里用来标记是否买了保险
	this.insurance = 0;
	this.identity = -1;
	this.room = room;
	this.opponent = "";
}

io.on('connection',function(socket){
	// console.log(socket.id);
	//监听登录
	socket.on('login',log);

	//监听断开连接
	socket.on('disconnect',discon);

	//监听游戏开始
	socket.on('buyInsure',buyInsure);

	//监听是否有人请求发牌
	socket.on('sendCard',sendCard);

	//监听重启游戏
	socket.on('restart',restart);

	//监听是否有人不要牌了
	socket.on('stopCard',stopCard);
});


function discon(){
	console.log('disconnect');
	if(playerList[this.id]){

		//找出房间号
		var roomNumb = playerList[this.id].room;

		//如果房间里有两个人
		if(room[roomNumb].players.length >1) {

			//断连ID离开连接，		
			playerList[this.id].socket.leave(room,function(err){
				if(err) {
					console.log(err);
				}
			});	
			
			//初始化对手ID
			var oppId = playerList[this.id].opponent;	
			playerList[oppId].socket.emit('oppExit','你的对手逃跑，你获得了胜利！')				
			playerList[oppId].bust=0;
			playerList[oppId].cards = [];
			playerList[oppId].insurance = 0;
			playerList[oppId].opponent = "";

			//改变房间状态,房间里还剩一个人
			room[roomNumb].players = [];
			room[roomNumb].players.push(oppId);

		} else {

			//如果房间里只剩下一个人并且要走了
			//改变房间状态，房间里没人了
			room[roomNumb].players=[];
		}

		//初始化房间公共状态
			room[roomNumb].cards = [];
			room[roomNumb].start = 0;	
			room[roomNumb].count = 0;
			room[roomNumb].end = 0;

		//删除本连接
		delete playerList[this.id];
	}

}

function log(data){

	console.log('login');
	//判断如果房间里的人不超过两个，并且房间游戏状态为没开始
	if(room[data.room].players.length<=2 && room[data.room].start ==0) {

		//判断昵称是否被占用
		if (room[data.room].players.length > 0 && playerList[room[data.room].players[0]].name == data.user) {
				this.emit('msg',"昵称已被占用");
		} else {
			//新建这个连接用户对象，加入游戏玩家名单中
			playerList[this.id] = new Player(data.user,this,data.room);

			//推入游戏房间列表中的玩家列表
			room[data.room].players.push(this.id);

			//如果房间列表中游戏玩家数目刚好是两个
			if(room[data.room].players.length === 2) {

				//获取第先进来的人的id
				var oppID = (room[data.room].players[0] == this.id)?room[data.room].players[1]:room[data.room].players[0];

				//设置两个玩家的对手id
				playerList[oppID].opponent = this.id;
				playerList[this.id].opponent = oppID;

				//开始游戏
				gameStart(data.room);
			}			
		}
	} else {
		this.emit('msg',"房间已满");
	}
}

//抽取Player对象需要发送的信息
function getVal(player) {
	return {
		name: player.name,
		bust: player.bust,
		cards: player.cards,
		insurance: player.insurance,
		identity: player.identity
	}
}

function gameStart(roomNumb) {

	//获取玩家列表
	var pid = room[roomNumb].players;

	//把玩家移到房间通道
	playerList[pid[0]].socket.join(roomNumb);
	playerList[pid[1]].socket.join(roomNumb);

	//初始化一副随机牌
	cardsArr = initCards(1);

	//每人的卡组里给两张牌
	playerList[pid[0]]['cards'].push(cardsArr.shift());
	playerList[pid[1]]['cards'].push(cardsArr.shift());
	playerList[pid[0]]['cards'].push(cardsArr.shift());
	// playerList[pid[0]]['cards'].push(0);
	playerList[pid[1]]['cards'].push(cardsArr.shift());

	//把剩下的卡存在房间的卡里
	room[roomNumb].cards = cardsArr;

	//直接设置庄家跟闲家，最先进入房间的为庄家
	playerList[pid[0]]['identity'] = 1;
	playerList[pid[1]]['identity'] = 0;

	//把需要的变量提取出来
	var value = setVale(pid);

	//发送一开始的第一副牌
	io.to(roomNumb).emit('gameStart',value);

	//房间状态设为在玩
	room[roomNumb].start = 1;
}


//洗牌算法
function initCards(n) {
	var n = n*52;

	//生成n张牌
	var arr = new Array(n);
	for(var i=0;i<n;i++) {
		arr[i] = i;
	}

	//第i张牌与任意一张牌换位置，换完一轮就行
	for(var i=0;i<n;i++) {

		//random函数左闭右开
		var rnd = Math.floor(Math.random()*(i+1)),
			temp = arr[rnd];
		arr[rnd] = arr[i];
		arr[i] = temp;
	}
	return arr;
}

//买保险事件，在房间中广播买保险事件
function buyInsure() {
	playerList[this.id].insurance = 1;
	io.to(playerList[this.id].room).emit('confirmInsure',playerList[this.id].name);
}


function sendCard() {


	//获取房间号
	var roomNumb = playerList[this.id].room;

	//给玩家增加一张牌
	playerList[this.id].cards.push(room[roomNumb].cards.shift());

	room[roomNumb].count++;
	// console.log('fapai ');
	// console.log('count '+room[roomNumb].count);
	// console.log('end '+room[roomNumb].end);
	//如果房间发牌次数到2，或者有人停牌了，那么广播下一轮
	if(room[roomNumb].count == 2 || room[roomNumb].end > 0) {
		var idArr = room[roomNumb].players;

		//刷新双方状态值，并发送
		var value = setVale(idArr);
		io.to(roomNumb).emit('nextRound',value);

		room[roomNumb].count = 0;
	}
}


//组装发送信息
function setVale(idArr){
	var a = getVal(playerList[idArr[0]]);
	var b = getVal(playerList[idArr[1]]);
	var c = {};
	c[a.name] = a;
	c[b.name] = b;

	return c;
}

//重新启动游戏事件
function restart(){
	var roomNumb = playerList[this.id].room;

	room[roomNumb].start++;

	//判断游戏状态 start：0未开始 1正在游戏 3游戏结束
	if(room[roomNumb].start === 3)
	{

		var pid = room[roomNumb].players;

		//初始化一副随机牌
		cardsArr = initCards(1);	

		//初始化玩家
		pid.forEach(function(item){

			playerList[item].cards = [];
			playerList[item].insurance = 0;
		});

		//每人的卡组里给两张牌
		playerList[pid[0]]['cards'].push(cardsArr.shift());
		playerList[pid[1]]['cards'].push(cardsArr.shift());
		playerList[pid[0]]['cards'].push(cardsArr.shift());

		//注视这一行用来调试，固定发一张A来触发买保险
		// playerList[pid[0]]['cards'].push(0);
		playerList[pid[1]]['cards'].push(cardsArr.shift());

		//把剩下的卡存在房间的卡里,重置游戏状态
		room[roomNumb].cards = cardsArr;

		room[roomNumb].start = 1;

		room[roomNumb].count = 0;

		room[roomNumb].end = 0;
		//把需要的变量提取出来
		var value = setVale(pid);

		io.to(roomNumb).emit('gameStart',value);				
	}

}

//对停牌事件的响应函数
function stopCard() {

	//获取房间号
	var roomNumb = playerList[this.id].room;

	room[roomNumb].end++;

	var idArr = room[roomNumb].players;

	var value = setVale(idArr);

	// console.log('end :'+room[roomNumb].end);
	// console.log('count :'+room[roomNumb].count);

	//如果两个人都停牌，则清算，若一人停牌并且第二人操作完毕
	//这里else if 曾有BUG：未判断count导致没等第二人操作完毕就触发下一轮.(已修复) 
	if(room[roomNumb].end == 2)
	{
		io.to(roomNumb).emit('end',value);
		room[roomNumb].end = 0;
	} else if(room[roomNumb].end > 0 && room[roomNumb].count >0) {
		// console.log('nextRound');
		io.to(roomNumb).emit('nextRound',value);

		room[roomNumb].count = 0;
	}
}