class ChessBoard {
    constructor() {
        this.game = new Chess();
        this.board = null;
        this.orientation = 'white';
        this.currentBranch = null;
        this.completedBranches = new Set();
        this.turnIndicator = null;
        this.debugMode = false;
    }

    init() {
        const config = {
            position: 'start',
            orientation: this.orientation,
            draggable: true,
            showNotation: false, // 禁用默认坐标
            onDrop: (source, target, piece) => this.onPieceDrop(source, target, piece),
            pieceTheme: (piece) => {
                // 所有棋子都使用图片
                const pieceImages = {
                    'wK': 'img/white_King.png',
                    'wQ': 'img/white_Queen.png',
                    'wR': 'img/white_Rook.png',
                    'wB': 'img/white_Bishop.png',
                    'wN': 'img/white_Knight.png',
                    'wP': 'img/white_Pawn.png',
                    'bK': 'img/black_King.png',
                    'bQ': 'img/black_Queen.png',
                    'bR': 'img/black_Rook.png',
                    'bB': 'img/black_Bishop.png',
                    'bN': 'img/black_Knight.png',
                    'bP': 'img/black_Pawn.png'
                };
                return pieceImages[piece];
            }
        };
        
        this.board = Chessboard('board', config);
        $(window).resize(() => this.board.resize());

        // 添加棋子样式
        const style = document.createElement('style');
        style.textContent = `
            .piece-417db {
                font-size: 40px;
                line-height: 40px;
                text-align: center;
                cursor: pointer;
            }
            /* 调整图片大小以适应棋盘格子 */
            .piece-417db img {
                width: 100%;
                height: 100%;
                object-fit: contain;
                padding: 5px;
            }
        `;
        document.head.appendChild(style);

        // 创建回合指示器
        this.createTurnIndicator();
        this.updateTurnIndicator();

        // 添加自定义坐标
        this.createCustomNotation();
    }

    createTurnIndicator() {
        // 如果已存在则移除
        $('.turn-indicator').remove();
        
        // 创建新的指示器
        this.turnIndicator = $('<div class="turn-indicator"></div>');
        $('.board-container').append(this.turnIndicator);
    }

    updateTurnIndicator() {
        if (!this.turnIndicator) return;
        
        const isWhiteTurn = this.game.turn() === 'w';
        this.turnIndicator
            .removeClass('turn-white turn-black')
            .addClass(isWhiteTurn ? 'turn-white' : 'turn-black');
    }

    setOrientation(color) {
        this.orientation = color;
        this.board.orientation(color);
        this.updateTurnIndicator();
        // 重新创建坐标以适应新的方向
        setTimeout(() => this.createCustomNotation(), 0);
    }

    onPieceDrop(source, target, piece) {
        // 检查是否是用户的回合
        const isWhiteTurn = this.game.turn() === 'w';
        if ((this.orientation === 'white' && !isWhiteTurn) ||
            (this.orientation === 'black' && isWhiteTurn)) {
            return 'snapback';
        }

        // 尝试移动
        const move = this.game.move({
            from: source,
            to: target,
            promotion: 'q'
        });

        // 如果移动不合法
        if (move === null) {
            return 'snapback';
        }

        // 检查移动是否符合当前PGN分支
        if (!this.isValidMove(move)) {
            this.game.undo();
            this.showError();
            return 'snapback';
        }

        // 更新界面
        this.updateMoveHistory(move);
        this.updateTurnIndicator();
        if (this.debugMode) {
            this.updateDebugDisplay();
        }
        
        // 检查是否完成当前分支
        if (this.isCurrentBranchCompleted()) {
            this.completedBranches.add(this.currentBranch.id);
            this.updateProgress();
            if (this.debugMode) {
                this.updateDebugDisplay();
            }
            return;
        }

        // 执行电脑走棋
        setTimeout(() => this.makeComputerMove(), 500);
    }

    isValidMove(move) {
        if (!this.currentBranch) return false;
        const expectedMove = this.currentBranch.moves[this.game.history().length - 1];
        return move.san === expectedMove;
    }

    makeComputerMove() {
        if (!this.currentBranch) return;
        
        const history = this.game.history();
        const nextMove = this.currentBranch.moves[history.length];
        
        if (nextMove) {
            const move = this.game.move(nextMove);
            if (move) {
                this.board.position(this.game.fen());
                this.updateMoveHistory(move);
                this.updateTurnIndicator();
                
                // 检查电脑走完后是否完成分支
                if (this.isCurrentBranchCompleted()) {
                    this.completedBranches.add(this.currentBranch.id);
                    this.updateProgress();
                }
                
                if (this.debugMode) {
                    this.updateDebugDisplay();
                }
            }
        }
    }

    updateMoveHistory(move) {
        const history = this.game.history();
        const moveNumber = Math.floor((history.length + 1) / 2);
        const isWhiteMove = history.length % 2 === 1;
        
        // 如果是白方走棋，创建新的行棋记录
        if (isWhiteMove) {
            $('#moveHistory').append(
                `<span class="move-pair" data-move="${moveNumber}">` +
                `${moveNumber}. ${move.san}</span>`
            );
        } else {
            // 如果是黑方走棋，找到当前回合的span并添加黑方走法
            const currentMove = $(`#moveHistory .move-pair[data-move="${moveNumber}"]`);
            if (currentMove.length) {
                currentMove.append(` ${move.san} `);
            } else {
                // 如果找不到当前回合的span（比如开局黑方），创建新的
                $('#moveHistory').append(
                    `<span class="move-pair" data-move="${moveNumber}">` +
                    `${moveNumber}. ... ${move.san}</span>`
                );
            }
        }
        
        $('#moveHistory').scrollTop($('#moveHistory')[0].scrollHeight);
    }

    showError() {
        $('#errorToast').fadeIn().delay(2000).fadeOut();
        if (this.debugMode && this.currentBranch) {
            const expectedMove = this.currentBranch.moves[this.game.history().length];
            $('#errorToast').text(`您背错了！正确走法是: ${expectedMove}`);
        }
    }

    resetPosition() {
        this.game.reset();
        this.board.position('start');
        $('#moveHistory').empty();
        this.updateTurnIndicator();
    }

    updateProgress() {
        const total = window.pgnParser.getTotalBranches();
        const completed = this.completedBranches.size;
        const progress = Math.round((completed / total) * 100);
        
        $('#totalBranches').text(total);
        $('#completedBranches').text(completed);
        $('#progress').text(`${progress}%`);
        
        if (progress === 100) {
            $('#completionBanner').show();
        }
    }

    isCurrentBranchCompleted() {
        const completed = this.game.history().length === this.currentBranch.moves.length;
        if (completed && this.debugMode) {
            this.updateDebugDisplay();
        }
        return completed;
    }

    createCustomNotation() {
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const ranks = ['1', '2', '3', '4', '5', '6', '7', '8'];
        const boardElement = $('#board');
        const squareSize = boardElement.width() / 8;

        // 移除现有的坐标
        $('.notation-322f9').remove();

        // 添加文件坐标 (a-h)
        files.forEach((file, i) => {
            const notation = $('<div class="notation-322f9 alpha"></div>')
                .text(file)
                .css('left', (i * squareSize) + (squareSize / 2) + 'px');
            boardElement.append(notation);
        });

        // 添加行坐标 (1-8)
        ranks.forEach((rank, i) => {
            const notation = $('<div class="notation-322f9 numeric"></div>')
                .text(rank)
                .css('top', ((7-i) * squareSize) + (squareSize / 2) + 'px');
            boardElement.append(notation);
        });
    }

    toggleDebugMode() {
        this.debugMode = !this.debugMode;
        $('#debugPanel').toggleClass('active', this.debugMode);
        if (this.debugMode) {
            this.updateDebugDisplay();
        }
    }

    updateDebugDisplay() {
        if (!this.debugMode) return;

        const $debugMoves = $('#debugMoves');
        $debugMoves.empty();

        window.pgnParser.branches.forEach((branch, index) => {
            const $branch = $('<div>')
                .addClass('debug-branch')
                .attr('data-branch-id', branch.id);

            if (this.completedBranches.has(branch.id)) {
                $branch.addClass('completed');
            }

            // 添加分支标题
            $branch.append($('<div>').text(`分支 ${index + 1}:`));

            // 添加所有走法
            branch.moves.forEach((move, moveIndex) => {
                const moveNumber = Math.floor(moveIndex / 2) + 1;
                const isWhiteMove = moveIndex % 2 === 0;

                // 添加回合数
                if (isWhiteMove) {
                    $branch.append($('<span>').text(`${moveNumber}. `));
                }

                // 添加走法
                const $move = $('<span>')
                    .addClass('debug-move')
                    .text(move);

                // 如果是当前分支的当前走法，高亮显示
                if (branch.id === this.currentBranch?.id && 
                    moveIndex === this.game.history().length) {
                    $move.addClass('current');
                }

                $branch.append($move);

                // 在黑方走法后添加空格
                if (!isWhiteMove) {
                    $branch.append(' ');
                }
            });

            // 如果分支已完成，添加状态标记
            if (this.completedBranches.has(branch.id)) {
                $branch.append(
                    $('<span>')
                        .addClass('debug-branch-status')
                        .text('已背完')
                );
            }

            $debugMoves.append($branch);
        });
    }
}

class PGNParser {
    constructor() {
        this.branches = [];
        this.currentBranchIndex = -1;
    }

    async loadPGN(file) {
        try {
            const text = await this.readFile(file);
            this.parsePGN(text);
            return true;
        } catch (error) {
            console.error('PGN解析错误:', error);
            return false;
        }
    }

    async readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    }

    parsePGN(text) {
        this.branches = [];
        
        // 移除头部信息和注释
        text = text.replace(/\[[^\]]*\]/g, '').trim();
        text = text.replace(/\{[^}]*\}/g, '');
        
        // 找到第一个变体的位置
        const firstVariantStart = text.indexOf('(');
        if (firstVariantStart === -1) {
            // 没有变体，只有主线
            const mainBranch = this.parseMoveLine(text, 'main');
            if (mainBranch.moves.length > 0) {
                this.branches.push(mainBranch);
            }
            this.updatePGNDisplay();
            return;
        }
        
        // 解析主线（到最后）
        const mainLine = text.replace(/\([^()]*\)/g, '').trim();
        const mainGame = new Chess();
        const mainBranch = {
            id: 'main',
            moves: []
        };
        
        // 解析主线的所有移动
        const mainMatches = mainLine.match(/\d+\.\s+[^\s]+(\s+[^\s]+)?/g) || [];
        mainMatches.forEach(moveText => {
            const parts = moveText.trim().split(/\s+/);
            parts.shift(); // 移除回合数字
            parts.forEach(move => {
                if (move && move !== '.') {
                    const result = mainGame.move(move);
                    if (result) {
                        mainBranch.moves.push(result.san);
                    }
                }
            });
        });
        
        if (mainBranch.moves.length > 0) {
            this.branches.push(mainBranch);
        }
        
        // 解析变体
        let depth = 0;
        let variantStart = -1;
        let currentVariant = '';
        let commonMoves = [];
        
        for (let i = 0; i < text.length; i++) {
            if (text[i] === '(') {
                if (depth === 0) {
                    variantStart = i;
                    currentVariant = '';
                    
                    // 找到这个变体之前的所有移动
                    const beforeVariant = text.substring(0, i);
                    commonMoves = this.getMovesUpToPosition(beforeVariant);
                }
                depth++;
            } else if (text[i] === ')') {
                depth--;
                if (depth === 0 && variantStart !== -1) {
                    // 解析这个变体
                    const variantGame = new Chess();
                    const variantBranch = {
                        id: `variant_${this.branches.length}`,
                        moves: [...commonMoves] // 先添加共同的移动
                    };
                    
                    // 执行共同的移动
                    commonMoves.forEach(move => {
                        variantGame.move(move);
                    });
                    
                    // 解析变体特有的移动
                    const variantText = currentVariant.trim();
                    const variantMatches = variantText.match(/\d+\.\s+[^\s]+(\s+[^\s]+)?/g) || [];
                    variantMatches.forEach(moveText => {
                        const parts = moveText.trim().split(/\s+/);
                        parts.shift(); // 移除回合数字
                        parts.forEach(move => {
                            if (move && move !== '.') {
                                const result = variantGame.move(move);
                                if (result) {
                                    variantBranch.moves.push(result.san);
                                }
                            }
                        });
                    });
                    
                    if (variantBranch.moves.length > commonMoves.length) {
                        this.branches.push(variantBranch);
                    }
                }
            } else if (depth > 0) {
                currentVariant += text[i];
            }
        }
        
        this.updatePGNDisplay();
    }

    getMovesUpToPosition(text) {
        const moves = [];
        const tempGame = new Chess();
        
        const matches = text.match(/\d+\.\s+[^\s]+(\s+[^\s]+)?/g) || [];
        matches.forEach(moveText => {
            const parts = moveText.trim().split(/\s+/);
            parts.shift(); // 移除回合数字
            parts.forEach(move => {
                if (move && move !== '.') {
                    const result = tempGame.move(move);
                    if (result) {
                        moves.push(result.san);
                    }
                }
            });
        });
        
        return moves;
    }

    updatePGNDisplay() {
        const $pgnDisplay = $('#pgnDisplay');
        let displayText = '';
        
        this.branches.forEach((branch, index) => {
            displayText += `分支 ${index + 1}:\n`;
            
            // 格式化移动
            let formattedMoves = '';
            branch.moves.forEach((move, moveIndex) => {
                if (moveIndex % 2 === 0) {
                    formattedMoves += `${Math.floor(moveIndex / 2) + 1}. `;
                }
                formattedMoves += `${move} `;
            });
            
            displayText += formattedMoves + '\n\n';
        });
        
        $pgnDisplay.val(displayText);
    }

    parseMoveLine(line, id) {
        const tempGame = new Chess();
        const branch = {
            id: id,
            moves: []
        };
        
        // 移除结果标记
        line = line.replace(/\s*[012/\*]+-[012/\*]+\s*$/, '');
        
        // 提取所有走法
        const moves = line.match(/\d+\.\s+[^\s]+(\s+[^\s]+)?/g) || [];
        moves.forEach(moveText => {
            const parts = moveText.trim().split(/\s+/);
            parts.shift(); // 移除回合数字
            parts.forEach(move => {
                if (move && move !== '.') {
                    const result = tempGame.move(move);
                    if (result) {
                        branch.moves.push(result.san);
                    }
                }
            });
        });
        
        return branch;
    }

    getNextUncompletedBranch(completedBranches) {
        const uncompletedBranches = this.branches.filter(
            branch => !completedBranches.has(branch.id)
        );
        
        if (uncompletedBranches.length === 0) return null;
        
        this.currentBranchIndex = (this.currentBranchIndex + 1) % uncompletedBranches.length;
        return uncompletedBranches[this.currentBranchIndex];
    }

    getTotalBranches() {
        return this.branches.length;
    }
} 