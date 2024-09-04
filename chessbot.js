const { parentPort, workerData, isMainThread } = require("node:worker_threads");
const { Chess } = require('chess.js');

const powers = {
    p: 1,
    n: 3,
    b: 3,
    r: 5,
    q: 9,
    k: 200,
};

const heuristics = [
    (game, botcolor='b')=>{ // version 0
        var board = game.board();
        var power = 0;
    
        for(var i=0; i<8; i++){
            for(var j=0; j<8; j++){
                if(board[i][j] == null){ continue; }
                if(board[i][j].color == botcolor){
                    power += powers[board[i][j].type];
                }else{
                    power -= powers[board[i][j].type];
                }
            }
        }
    
        return power;
    },
    (game, botcolor='b')=>{ // version 1
        var board = game.board();
        var player = game.turn();
        var power = 0;
    
        for(var i=0; i<8; i++){
            for(var j=0; j<8; j++){
                if(board[i][j] == null){ continue; }
                if(board[i][j].color == botcolor){
                    power += powers[board[i][j].type];
                }else{
                    power -= powers[board[i][j].type];
                }
            }
        }

        if(game.inCheck()){
            power += (player == botcolor)? -100 : +100;
        }
        if(game.isCheckmate()){
            power += (player == botcolor)? -1000 : +1000;
        }
        
        return power;
    },
    (game, botcolor='b')=>{ // version 2
        var board = game.board();
        var player = game.turn();
        var power = 0;
    
        for(var i=0; i<8; i++){
            for(var j=0; j<8; j++){
                if(board[i][j] == null){ continue; }
                if(board[i][j].color == botcolor){
                    power += powers[board[i][j].type];
                }else{
                    power -= powers[board[i][j].type];
                }
            }
        }

        if(game.isDraw() || game.isStalemate()){
            power -= 50;
        }
        if(game.inCheck()){
            power += (player == botcolor)? -100 : +100;
        }
        if(game.isCheckmate()){
            power += (player == botcolor)? -1000 : +1000;
        }
        
        
        return power;
    },
    (game, botcolor='b')=>{ // version 3
        var board = game.board();
        var player = game.turn();
        var usercolor = (botcolor=='b')? 'w' : 'b';
        var power = 0;
        var history = game.history({ verbose: true });
        var lastmove = history[history.length-1];
    
        for(var i=0; i<8; i++){
            for(var j=0; j<8; j++){
                if(board[i][j] == null){ continue; }
                if(board[i][j].color == botcolor){
                    power += powers[board[i][j].type];

                    // Don't sacrifice valuable pieces
                    if(game.isAttacked(board[i][j].square, usercolor)){
                        power -= powers[board[i][j].type]*2;
                    }
                }else{
                    power -= powers[board[i][j].type];
                }
            }
        }

        // Preserve Castling
        power += ((game.getCastlingRights(botcolor).k)? 25 : 0)
               - ((game.getCastlingRights(usercolor).k)? 25 : 0);
        power += ((game.getCastlingRights(botcolor).k)? 25 : 0)
               - ((game.getCastlingRights(usercolor).q)? 25 : 0);

        // Castle carefully and it's ok to waste the Castle Rights
        if(player != botcolor && (lastmove.flags == 'k' || lastmove.flags == 'q')){
            power += 60;
            if(game.isAttacked((lastmove.flags == 'k')? "f8" : "d8")){
                power -= 70;
            }
        }

        // No ties
        if(game.isDraw() || game.isStalemate()){
            power -= 50;
        }

        // Pin the king carefully
        if(game.inCheck()){
            power += (player == botcolor)? -100 : +100;
            if(player != botcolor){
                if(game.isAttacked(lastmove.to, player)){
                    power -= 100+powers[game.get(lastmove.to).type];
                }
            }
        }

        // Win
        if(game.isCheckmate()){
            power += (player == botcolor)? -1000 : +1000;
        }
        
        
        return power;
    }
];

function getpiececount(game){
    var board = game.board();
    var count = 0;

    for(var i=0; i<8; i++){
        for(var j=0; j<8; j++){
            if(board[i][j] == null){ continue; }
            else{ count++; }
        }
    }

    return count;
}

function shuffle(array){
    return array.reduceRight(
        (prev, curr, idx, arr)=>{
            return prev.push(arr.splice(0 | Math.random() * arr.length, 1)[0]), prev;
        },
        []
    );
};

function minmax(game, botcolor, depth, getboardpower){
    var moves = game.moves();
    var player = game.turn();
    
    depth--;

    var move = {
        move: null,
        score: 0,
        calculated: 0,
    };

    var i=0;
    for(i=0; i<moves.length; i++){
        game.move(moves[i]);
        var power = (depth == 0)?
            getboardpower(game, botcolor) : 
            (result = minmax(game, botcolor, depth, getboardpower)).score;

        if(
            i == 0 ||
            (player == botcolor && power > move.score) ||
            (player != botcolor && power < move.score)
        ){
            move.move = moves[i];
            move.score = power;
        }
        if(result != null){ move.calculated += result.calculated; }

        game.undo();
    }

    move.calculated += i;
    delete moves;
    return move;
}

function abprune(game, botcolor, depth, getboardpower, a, b){
    var moves = game.moves();
    var player = game.turn();
    
    depth--;

    var move = {
        move: null,
        score: 0,
        calculated: 0,
    };

    var i=0;
    for(i=0; i<moves.length; i++){
        game.move(moves[i]);
        var result = null;
        var power = (depth == 0)?
            getboardpower(game, botcolor) : 
            (result = abprune(game, botcolor, depth, getboardpower, a, b)).score;

        if(
            i == 0 ||
            (player == botcolor && power > move.score) ||
            (player != botcolor && power < move.score)
        ){
            move.move = moves[i];
            move.score = power;

            if(player == botcolor){
                a = power;
            }else{
                b = power;
            }
        }
        if(result != null){ move.calculated += result.calculated; }

        game.undo();

        if(a>=b){ break; }
    }

    move.calculated += i;
    delete moves;
    return move;
}

function abprune_v2(game, botcolor, depthlimit, depth, timestart, timelimit_l, timelimit_h, piecelimit, getboardpower, a, b){
    var moves = shuffle(game.moves());
    var player = game.turn();
    var timespan = ((new Date(Date.now()-timestart)).getTime()/1000);
    
    depthlimit--;
    if(getpiececount(game) <= piecelimit && timespan < timelimit_l){ depthlimit++; }

    var move = {
        move: null,
        score: 0,
        calculated: 0,
        depth: {
            max: depth,
            choice: 0,
        },
        timecutoff: false,
    };

    var i=0;
    for(i=0; i<moves.length; i++){
        game.move(moves[i]);
        timespan = (new Date(Date.now()-timestart)).getTime()/1000;
        
        var result = null;
        var power = (depthlimit == 0 || game.isGameOver() || timespan >= timelimit_h)?
            getboardpower(game, botcolor) : 
            (result = abprune_v2(game, botcolor, depthlimit, depth+1, timestart, timelimit_l, timelimit_h, piecelimit, getboardpower, a, b)).score;

        if(
            i == 0 ||
            (player == botcolor && power > move.score) ||
            (player != botcolor && power < move.score)
        ){
            move.move = moves[i];
            move.score = power;

            move.depth.choice = (result == null)? depth : result.depth.choice;

            if(player == botcolor){
                a = power;
            }else{
                b = power;
            }
        }
        if(result != null){
            move.calculated += result.calculated;
            move.timecutoff = (move.timecutoff == false)? result.timecutoff : move.timecutoff;
            move.depth.max = (result.depth.max>move.depth.max)? result.depth.max : move.depth.max;
        }
        if(move.timecutoff == false && timespan >= timelimit_h){ move.timecutoff = depth; }

        game.undo();

        if(a>=b){ break; }
    }
    
    move.calculated += i;
    delete moves;
    return move;
}


module.exports = {
    shuffle: (game)=>{
        return {
            move: shuffle(game.moves()),
        }
    },
    getnext: (game, botcolor='b', heuristics_func)=>{
        var moves = game.moves();

        var best = {
            index: null,
            score: 0,
        };
    
        for(var i=0; i<moves.length; i++){
            game.move(moves[i]);
            var score = heuristics_func(game, botcolor);
            if(score >= best.score || i==0){
                best.score = score;
                best.index = i;
            }
            game.undo();
        }
    
        return {
            move: moves[best.index],
            stats: {
                score: best.score
            },
        };
    },
    minmax: (game, botcolor='b', depth, heuristics_func)=>{
        var time = Date.now();
        var result = minmax(game, botcolor, depth, heuristics_func);
        var timespan = (new Date(Date.now()-time)).getTime()/1000;

        var score = heuristics_func(game, botcolor);
        game.move(result.move);

        return {
            move: result.move,
            stats: {
                timespan: timespan,
                calculated: result.calculated,
                score: {
                    best: result.score,
                    prev: score,
                    next: heuristics_func(game, botcolor),
                }
            },
        };
    },
    abprune: (game, botcolor='b', depth, heuristics_func)=>{
        var time = Date.now();
        var result = abprune(game, botcolor, depth, heuristics_func, -Infinity, +Infinity);
        var timespan = (new Date(Date.now()-time)).getTime()/1000;

        var score = heuristics_func(game, botcolor);
        game.move(result.move);

        return {
            move: result.move,
            stats: {
                timespan: timespan,
                calculated: result.calculated,
                score: {
                    best: result.score,
                    prev: score,
                    next: heuristics_func(game, botcolor),
                }
            },
        };
    },
    abprune_v2: (game, botcolor='b', depthlimit, timelimit_l, timelimit_h, piecelimit, heuristics_func)=>{
        var time = Date.now();
        var result = abprune_v2(game, botcolor, depthlimit, 1, time, timelimit_l, timelimit_h, piecelimit, heuristics_func, -Infinity, +Infinity);
        var timespan = (new Date(Date.now()-time)).getTime()/1000;

        var score = heuristics_func(game, botcolor);
        game.move(result.move);

        return {
            move: result.move,
            stats: {
                timespan: timespan,
                calculated: result.calculated,
                depth: result.depth,
                timecutoff: result.timecutoff,
                score: {
                    best: result.score,
                    prev: score,
                    next: heuristics_func(game, botcolor),
                }
            },
        };
    },
}

if(!isMainThread){
    parentPort.postMessage(
        module.exports["abprune_v2"](
            new Chess(workerData[0]),
            workerData[1],
            5,   // depth limit
            10,  // lower time limit
            150, // higher time limit
            15,  // piece limit
            heuristics[3]
        )
    );
}

