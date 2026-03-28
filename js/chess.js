class ChessBoard {
    constructor() {
        this.game = new Chess();
        this.board = null;
        this.orientation = 'white';
        this.currentBranch = null;
        this.completedBranches = new Set();
        this.pausedBranches = new Set(); // 暂停的分支
        this.branchErrorCounts = new Map(); // 每个分支的错误计数
        this.turnIndicator = null;
        this.availableBranches = []; // 当前可用的分支
        this.isStudyMode = false; // 是否在背谱模式
        this.isSetupLearningMode = false; // 是否在摆棋学习模式
        this.isMemoryLearningMode = false; // 是否在记忆学习模式
        this.computerUsedBranches = new Set(); // 电脑已使用过的分支（用于白方第一步）
        this.errorCount = 0; // 错误计数器
        this.errorThreshold = 5; // 错误阈值，5次后提示正确走法
        this.correctMoves = 0; // 正确步数
        this.totalMoves = 0; // 总步数（已走步数）
        this.memoryCorrectMoves = 0; // 记忆学习模式的正确步数
        this.memoryTotalMoves = 0;   // 记忆学习模式的总步数
        this.accuracy = 0;
        
        // 点击移动相关属性
        this.selectedSquare = null; // 当前选中的方格
        this.clickToMove = true; // 是否启用点击移动
        
        // 分支状态管理
        this.memoryCompletedBranches = new Set(); // 记忆学习已完成的分支
        this.memoryPausedBranches = new Set();    // 记忆学习暂停的分支
        
        // 摆棋学习模式的分支过滤管理
        this.setupLearningHiddenBranches = new Set(); // 摆棋学习中已隐藏的分支（不匹配当前历史的分支）
        this.setupLearningCompletedBranchIds = new Set(); // 本局摆棋学习已走完的分支 id
        this.setupLearningTargetBranchIndex = null; // 非 null 时只练该序号分支（完成一分支后自动设为「下一个」）
        
        // 分支错误计数
        this.memoryBranchErrorCounts = new Map(); // 记忆学习分支错误计数
        
        // 记忆学习模式选项
        this.startFromCommon = false; // 是否从公共部分开始
    }

    init() {
        // 立即尝试初始化，如果失败则重试
        this.initializeBoard();
    }

    initializeBoard() {
        console.log('Initializing chess board...');
        
        const boardElement = document.getElementById('board');
        
        if (!boardElement) {
            console.error('Board element not found');
            // 如果元素还没准备好，稍后重试
            setTimeout(() => this.initializeBoard(), 200);
            return;
        }

        if (typeof Chessboard === 'undefined') {
            console.error('Chessboard.js library not loaded');
            // 如果库还没加载，稍后重试
            setTimeout(() => this.initializeBoard(), 200);
            return;
        }
        
        try {
            // 清除可能存在的旧棋盘
            $(boardElement).empty();
            
            // 保存this引用
            const self = this;
            
            // 配置棋盘
            const config = {
                draggable: true,
                position: 'start',
                onDragStart: function(source, piece, position, orientation) {
                    return self.onDragStart(source, piece, position, orientation);
                },
                onDrop: function(source, target, piece, newPos, oldPos, orientation) {
                    return self.onDrop(source, target);
                },
                onSnapEnd: function() {
                    return self.onSnapEnd();
                },
                pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png',
                showNotation: true,
                sparePieces: false
            };
            
            console.log('Creating chessboard with config:', config);
            this.board = Chessboard('board', config);
            
            // 添加移动端触控支持，防止拖拽时页面滚动
            this.addTouchSupport();
            
            // 添加点击移动支持
            this.addClickMoveSupport();
            
            // 等待一小段时间确保棋盘完全渲染
            setTimeout(() => {
                if (this.board) {
                    console.log('Chessboard initialized successfully');
                    
                    // 设置初始位置
                    this.board.position('start');
                    
                    // 创建回合指示器
                    this.createTurnIndicator();
                    this.updateTurnIndicator();
                    
                    // 调整棋盘大小以确保正确显示
                    try {
                        this.board.resize();
                        console.log('Board resized successfully');
                    } catch (e) {
                        console.warn('Board resize failed:', e);
                    }
                } else {
                    console.error('Chessboard initialization failed, retrying...');
                    setTimeout(() => this.initializeBoard(), 500);
                }
            }, 100);
            
        } catch (error) {
            console.error('Error initializing chessboard:', error);
            setTimeout(() => this.initializeBoard(), 500);
        }
    }

    onDragStart(source, piece, position, orientation) {
        // 如果游戏结束，不允许移动
        if (this.game.game_over()) return false;
        
        // 如果不在背谱模式，允许自由拖拽
        if (!this.isStudyMode) {
            // 只允许拖拽当前方的棋子
            if ((this.game.turn() === 'w' && piece.search(/^b/) !== -1) ||
                (this.game.turn() === 'b' && piece.search(/^w/) !== -1)) {
                return false;
            }
            return true;
        }

        // 背谱模式下的拖拽限制
        const isWhiteTurn = this.game.turn() === 'w';
        const canMove = (this.orientation === 'white' && isWhiteTurn) ||
                        (this.orientation === 'black' && !isWhiteTurn);
        
        if (!canMove) return false;
        
        // 只允许拖拽当前方的棋子
        if ((this.game.turn() === 'w' && piece.search(/^b/) !== -1) ||
            (this.game.turn() === 'b' && piece.search(/^w/) !== -1)) {
            return false;
        }
        
        return true;
    }

    onDrop(source, target) {
        console.log(`Move attempted: ${source} to ${target}`);
        
        // 如果起始位置和目标位置相同，这可能是点击操作被误识别为拖拽
        if (source === target) {
            console.log('检测到点击操作（起始=目标），调用点击处理逻辑');
            this.handleSquareClick(source);
            return 'snapback'; // 返回snapback防止棋盘状态变化
        }
        
        // 正常的拖拽移动
        const move = this.game.move({
            from: source,
            to: target,
            promotion: 'q' // 默认升为皇后
        });

        // 如果移动不合法
        if (move === null) {
            console.log('Illegal move');
            return 'snapback';
        }

        console.log('Legal move:', move);

        // 清除高亮状态（有棋子移动了）
        this.clearHighlightsNew();

        // 如果不在任何学习模式，允许自由下棋
        if (!this.isStudyMode && !this.isSetupLearningMode && !this.isMemoryLearningMode) {
            this.updateMoveHistory(move);
            this.updateTurnIndicator();
            return;
        }

        // 摆棋学习模式
        if (this.isSetupLearningMode) {
            return this.handleSetupLearningMove(move);
        }

        // 记忆学习模式
        if (this.isMemoryLearningMode) {
            return this.handleMemoryLearningMove(move);
        }

        // 背谱模式下检查移动是否正确
        const matchingBranch = this.findMatchingBranch(move);
        
        if (!matchingBranch) {
            // 没有匹配的分支，走错了
            console.log('No matching branch found');
            this.game.undo(); // 撤销移动
            
            // 统计错误步数：已走步数+1，正确步数不变
            this.totalMoves++;
            this.updateAccuracy();
            
            // 记录错误移动到数据库
            this.recordMoveProgress(false);
            
            this.showError();
            return 'snapback';
        }

        console.log('Found matching branch');

        // 走对了，重置错误计数器
        this.errorCount = 0;
        
        // 统计正确步数：正确步数+1，已走步数+1
        this.correctMoves++;
        this.totalMoves++;
        this.updateAccuracy();
        
        // 记录正确移动到数据库
        this.recordMoveProgress(true);

        // 更新当前分支
        this.currentBranch = matchingBranch;
        this.updateAvailableBranches();

        // 更新界面
        this.updateMoveHistory(move);
        this.updateTurnIndicator();
        
        // 检查是否完成当前分支
        if (this.isCurrentBranchCompleted()) {
            this.onBranchCompleted();
            return;
        }

        // 执行电脑走棋
        setTimeout(() => this.makeComputerMove(), 500);
    }

    // 处理摆棋学习模式的移动
    handleSetupLearningMove(move) {
        if (!this.isSetupLearningMode) {
            return;
        }
        
        console.log('摆棋学习模式：处理用户移动:', move);
        
        // 检查这个移动是否在任何分支中
        const currentHistory = this.game.history();
        const moveIndex = currentHistory.length - 1; // 当前移动的索引
        const currentMove = currentHistory[moveIndex];
        
        console.log('当前走棋历史:', currentHistory);
        console.log('当前移动索引:', moveIndex);
        console.log('当前移动:', currentMove);
        
        let matchingBranches = [];
        let newlyHiddenBranches = [];
        let newlyRestoredBranches = [];
        
        // 首先检查所有分支（包括之前隐藏的）
        for (let i = 0; i < window.pgnParser.branches.length; i++) {
            const branch = window.pgnParser.branches[i];
            const branchId = branch.id || `branch_${i}`;
            const wasHidden = this.setupLearningHiddenBranches.has(branchId);
            
            console.log(`检查分支 ${i + 1}: ${branch.moves.join(' ')}, 之前隐藏状态: ${wasHidden}`);
            
            // 检查历史是否匹配
            let isMatch = true;
            for (let j = 0; j < currentHistory.length; j++) {
                if (j >= branch.moves.length || branch.moves[j] !== currentHistory[j]) {
                    isMatch = false;
                    break;
                }
            }
            
            if (
                isMatch &&
                !this.setupLearningCompletedBranchIds.has(branchId) &&
                (this.setupLearningTargetBranchIndex === null || i === this.setupLearningTargetBranchIndex)
            ) {
                // 这个分支匹配当前历史，且未标记完成、且符合当前顺序目标
                matchingBranches.push(branch);
                
                // 如果之前是隐藏的，现在需要恢复
                if (wasHidden) {
                    this.setupLearningHiddenBranches.delete(branchId);
                    newlyRestoredBranches.push(branch);
                    console.log(`摆棋学习：恢复之前隐藏的分支 ${i + 1}: ${branch.moves.join(' ')}`);
                }
            } else {
                // 这个分支不匹配当前历史
                if (!wasHidden) {
                    // 之前没有隐藏，现在需要隐藏
                    this.setupLearningHiddenBranches.add(branchId);
                    newlyHiddenBranches.push(branch);
                    console.log(`摆棋学习：隐藏不匹配的分支 ${i + 1}: ${branch.moves.join(' ')}`);
                }
                // 如果之前已经隐藏，保持隐藏状态
            }
        }
        
        console.log(`摆棋学习：匹配分支数: ${matchingBranches.length}, 新隐藏分支数: ${newlyHiddenBranches.length}, 新恢复分支数: ${newlyRestoredBranches.length}`);
        
        if (matchingBranches.length === 0) {
            // 没有匹配的分支，显示错误提示
            $('#errorToast').text('您走的招法不在本棋谱中').css('background', '#ff4444').fadeIn().delay(3000).fadeOut().promise().done(() => {
                $('#errorToast').css('background', '#ff4444');
            });
            
            // 撤销移动
            this.game.undo();
            if (this.board) {
                this.board.position(this.game.fen());
            }
            return;
        }
        
        // 有匹配的分支，继续正常流程
        console.log(`摆棋学习：找到 ${matchingBranches.length} 个匹配分支`);
        
        // 更新可用分支列表
        this.availableBranches = matchingBranches;
        
        // 更新UI显示
        this.updateMoveHistory(move);
        this.updateTurnIndicator();
        
        // 如果有分支恢复，显示提示
        if (newlyRestoredBranches.length > 0) {
            const message = `✅ 恢复了 ${newlyRestoredBranches.length} 个分支`;
            $('#errorToast').text(message).css('background', '#28a745').fadeIn().delay(2000).fadeOut().promise().done(() => {
                $('#errorToast').css('background', '#ff4444');
            });
        }
        
        // 检查是否有分支完成
        // 在摆棋学习模式下，需要检查所有匹配的分支
        let completedBranch = null;
        console.log('摆棋学习：开始检查分支完成状态');
        console.log('当前历史长度:', currentHistory.length);
        console.log('匹配分支数量:', matchingBranches.length);
        
        for (const branch of matchingBranches) {
            console.log(`检查分支完成: 分支长度=${branch.moves.length}, 当前历史长度=${currentHistory.length}`);
            if (currentHistory.length === branch.moves.length) {
                // 检查历史是否完全匹配
                let isCompleteMatch = true;
                for (let j = 0; j < currentHistory.length; j++) {
                    if (currentHistory[j] !== branch.moves[j]) {
                        isCompleteMatch = false;
                        console.log(`分支完成检查失败: 第${j+1}步 历史=${currentHistory[j]}, 分支=${branch.moves[j]}`);
                        break;
                    }
                }
                if (isCompleteMatch) {
                    completedBranch = branch;
                    console.log('摆棋学习：找到完成的分支:', branch);
                    break;
                }
            }
        }
        
        if (completedBranch) {
            console.log('摆棋学习：检测到分支完成，调用完成处理函数');
            this.onSetupLearningBranchCompleted();
        } else {
            console.log('摆棋学习：没有检测到分支完成');
        }
    }

    // 获取下一步可以走的招法
    getNextPossibleMoves() {
        if (!window.pgnParser || !window.pgnParser.branches) {
            return [];
        }

        const currentHistory = this.game.history();
        const nextMoves = new Set();
        
        // 在所有分支中查找下一步可能的招法
        for (const branch of window.pgnParser.branches) {
            // 检查当前历史是否与分支的前几步匹配
            let isMatch = true;
            for (let i = 0; i < currentHistory.length; i++) {
                if (i >= branch.moves.length || branch.moves[i] !== currentHistory[i]) {
                    isMatch = false;
                    break;
                }
            }
            
            // 如果匹配，添加下一步招法
            if (isMatch && currentHistory.length < branch.moves.length) {
                const nextMove = branch.moves[currentHistory.length];
                if (nextMove) {
                    nextMoves.add(nextMove);
                }
            }
        }
        
        return Array.from(nextMoves).sort();
    }

    // 更新摆棋学习模式的棋谱显示
    updateSetupLearningNotation() {
        if (!this.isSetupLearningMode) return;
        
        // 重新高亮当前分支和招法
        this.highlightCurrentBranchInNotation();
        
        // 如果棋谱区域被清空了（比如被updateMoveHistory清空），重新显示完整棋谱
        if ($('#moveHistory').find('[id^="branch-"]').length === 0) {
            this.showFullNotation();
        }
    }

    // 处理记忆学习模式的移动
    handleMemoryLearningMove(move) {
        // 检查移动是否正确
        const matchingBranch = this.findMatchingBranch(move);
        
        if (!matchingBranch) {
            // 走错了，撤销移动
            this.game.undo();
            this.errorCount++; // 增加当前会话错误计数器
            this.memoryTotalMoves++; // 增加记忆学习总步数
            
            // 记录记忆学习分支级别的错误计数
            if (this.currentBranch) {
                const branchId = this.currentBranch.id || `branch_${window.pgnParser.branches.indexOf(this.currentBranch)}`;
                const currentBranchErrors = this.memoryBranchErrorCounts.get(branchId) || 0;
                this.memoryBranchErrorCounts.set(branchId, currentBranchErrors + 1);
                console.log(`记忆学习分支 ${branchId} 错误计数增加到: ${currentBranchErrors + 1}`);
            }
            
            // 显示错误提示
            this.showMemoryLearningError();
            return;
        }

        // 走对了，重置错误计数器
        this.errorCount = 0;
        
        // 统计正确步数（记忆学习模式）
        this.memoryCorrectMoves++;
        this.memoryTotalMoves++;
        this.updateAccuracy();
        
        // 记录正确移动到数据库
        this.recordMoveProgress(true);

        // 更新当前分支
        this.currentBranch = matchingBranch;
        console.log('记忆学习模式：设置当前分支:', this.currentBranch);
        console.log('当前错误计数重置为0，但分支学习过程中的错误记录仍然保留');
        
        // 更新可用分支
        this.updateAvailableBranches();
        
        // 更新界面
        this.updateMoveHistory(move);
        this.updateTurnIndicator();
        
        // 立即更新可走棋子的高亮
        this.highlightCurrentPieces();
        
        // 检查是否完成当前分支
        if (this.isCurrentBranchCompleted()) {
            console.log('当前分支已完成，调用分支完成处理');
            this.onMemoryLearningBranchCompleted();
            return true;
        }
        
        // 额外检查：如果当前分支没有设置，但游戏历史已经完成某个分支
        if (!this.currentBranch) {
            console.log('当前分支未设置，检查是否有其他分支完成');
            const currentHistory = this.game.history();
            for (const branch of window.pgnParser.branches) {
                if (currentHistory.length === branch.moves.length) {
                    let isMatch = true;
                    for (let i = 0; i < currentHistory.length; i++) {
                        if (currentHistory[i] !== branch.moves[i]) {
                            isMatch = false;
                            break;
                        }
                    }
                    if (isMatch) {
                        console.log('找到完成的分支，但当前分支未设置，直接调用分支完成处理');
                        this.onMemoryLearningBranchCompleted();
                        return true;
                    }
                }
            }
        }

        // 执行电脑走棋
        setTimeout(() => {
            this.makeComputerMove();
            // 电脑走棋后，重新高亮可走棋子
            if (this.isMemoryLearningMode) {
                setTimeout(() => this.highlightCurrentPieces(), 600);
            }
        }, 500);
        
        return true;
    }

    onSnapEnd() {
        // 确保棋盘位置与游戏状态同步
        if (this.board) {
            this.board.position(this.game.fen());
        }
    }

    findMatchingBranch(move) {
        const currentHistory = this.game.history();
        const moveIndex = currentHistory.length - 1;
        
        console.log('findMatchingBranch: 查找匹配分支');
        console.log('当前历史:', currentHistory);
        console.log('移动索引:', moveIndex);
        console.log('移动SAN:', move.san);
        console.log('当前模式: 背诵学习=', this.isStudyMode, '记忆学习=', this.isMemoryLearningMode);
        
        // 在可用分支中查找匹配的分支
        for (const branch of this.availableBranches) {
            if (branch.moves[moveIndex] === move.san) {
                console.log('在可用分支中找到匹配:', branch);
                return branch;
            }
        }
        
        // 如果availableBranches中没有找到，尝试在所有分支中查找
        if (!window.pgnParser || !window.pgnParser.branches) {
            console.log('没有PGN解析器或分支数据');
            return null;
        }
        
        for (const branch of window.pgnParser.branches) {
            const branchId = branch.id || `branch_${window.pgnParser.branches.indexOf(branch)}`;
            
            // 根据当前模式跳过已完成的分支
            if (this.isMemoryLearningMode) {
                // 记忆学习模式：跳过已完成和暂停的分支
                if (this.memoryCompletedBranches.has(branchId) || this.memoryPausedBranches.has(branchId)) {
                    console.log('记忆学习模式：跳过已完成或暂停分支:', branchId);
                    continue;
                }
            } else if (this.isStudyMode) {
                // 背诵学习模式：跳过已完成的分支
                if (this.completedBranches.has(branchId)) {
                    console.log('背诵学习模式：跳过已完成分支:', branchId);
                    continue;
                }
            }
            
            // 检查历史是否匹配
            let isMatch = true;
            for (let i = 0; i < currentHistory.length; i++) {
                if (i >= branch.moves.length || branch.moves[i] !== currentHistory[i]) {
                    isMatch = false;
                    break;
                }
            }
            
            if (isMatch) {
                console.log('在所有分支中找到匹配:', branch);
                return branch;
            }
        }
        
        console.log('没有找到匹配的分支');
        return null;
    }

    updateAvailableBranches() {
        if (!window.pgnParser || !window.pgnParser.branches) {
            this.availableBranches = [];
            return;
        }

        const currentHistory = this.game.history();
        console.log('更新可用分支，当前历史:', currentHistory);
        console.log('当前模式: 背诵学习=', this.isStudyMode, '记忆学习=', this.isMemoryLearningMode);
        
        if (this.isMemoryLearningMode) {
            console.log('记忆学习模式 - 已完成分支:', Array.from(this.memoryCompletedBranches));
            console.log('记忆学习模式 - 暂停分支:', Array.from(this.memoryPausedBranches));
        } else {
            console.log('背诵学习模式 - 已完成分支:', Array.from(this.completedBranches));
            console.log('背诵学习模式 - 暂停分支:', Array.from(this.pausedBranches));
        }
        
        // 筛选出与当前历史匹配且未完成的分支
        this.availableBranches = window.pgnParser.branches.filter(branch => {
            const branchId = branch.id || `branch_${window.pgnParser.branches.indexOf(branch)}`;
            
            if (this.isMemoryLearningMode) {
                // 记忆学习模式：跳过已完成和暂停的分支
                if (this.memoryCompletedBranches.has(branchId)) {
                    console.log('记忆学习模式：跳过已完成分支:', branchId);
                    return false;
                }
                
                if (this.memoryPausedBranches && this.memoryPausedBranches.has(branchId)) {
                    console.log('记忆学习模式：跳过暂停分支:', branchId);
                    return false;
                }
            } else {
                // 背诵学习模式：跳过已完成的分支
                if (this.completedBranches.has(branchId)) {
                    console.log('背诵学习模式：跳过已完成分支:', branchId);
                    return false;
                }
                
                // 跳过暂停的分支
                if (this.pausedBranches && this.pausedBranches.has(branchId)) {
                    console.log('背诵学习模式：跳过暂停分支:', branchId);
                    return false;
                }
            }
            
            // 检查历史是否匹配
            for (let i = 0; i < currentHistory.length; i++) {
                if (i >= branch.moves.length || branch.moves[i] !== currentHistory[i]) {
                    return false;
                }
            }
            
            return true;
        });
        
        console.log('可用分支数量:', this.availableBranches.length);
    }

    makeComputerMove() {
        console.log('makeComputerMove 被调用，当前分支:', this.currentBranch);
        if (!this.currentBranch) {
            console.log('没有当前分支，无法执行电脑走棋');
            return;
        }
        
        const history = this.game.history();
        const nextMove = this.currentBranch.moves[history.length];
        console.log('电脑下一步走法:', nextMove, '当前历史长度:', history.length);
        
        if (nextMove) {
            const move = this.game.move(nextMove);
            if (move) {
                console.log('电脑成功执行走棋:', move);
                if (this.board) {
                    this.board.position(this.game.fen()); // 更新棋盘位置
                }
                
                // 清除高亮状态（电脑移动了）
                this.clearHighlightsNew();
                
                this.updateMoveHistory(move);
                this.updateTurnIndicator();
                
                // 更新可用分支
                this.updateAvailableBranches();
                
                // 如果是记忆学习模式，重新高亮可走棋子
                if (this.isMemoryLearningMode) {
                    this.highlightCurrentPieces();
                }
                
                // 检查电脑走完后是否完成分支
                if (this.isCurrentBranchCompleted()) {
                    console.log('电脑走棋后检测到分支完成，调用分支完成处理');
                    if (this.isMemoryLearningMode) {
                        // 确保当前分支设置正确，以便状态记录
                        if (!this.currentBranch) {
                            console.log('警告：电脑走棋后分支完成，但currentBranch未设置，尝试查找匹配分支');
                            const currentHistory = this.game.history();
                            for (const branch of window.pgnParser.branches) {
                                if (currentHistory.length === branch.moves.length) {
                                    let isMatch = true;
                                    for (let i = 0; i < currentHistory.length; i++) {
                                        if (currentHistory[i] !== branch.moves[i]) {
                                            isMatch = false;
                                            break;
                                        }
                                    }
                                    if (isMatch) {
                                        this.currentBranch = branch;
                                        console.log('找到匹配分支并设置为currentBranch:', branch);
                                        break;
                                    }
                                }
                            }
                        }
                        this.onMemoryLearningBranchCompleted();
                    } else {
                        this.onBranchCompleted();
                    }
                    return;
                }
            } else {
                console.log('电脑走棋失败');
            }
        } else {
            console.log('没有下一步走法');
        }
    }

    createTurnIndicator() {
        this.turnIndicator = document.getElementById('turnIndicator');
        if (!this.turnIndicator) {
            this.turnIndicator = document.createElement('div');
            this.turnIndicator.id = 'turnIndicator';
            this.turnIndicator.className = 'turn-indicator';
            const boardContainer = document.querySelector('.board-container');
            if (boardContainer) {
                boardContainer.appendChild(this.turnIndicator);
            }
        }
    }

    updateTurnIndicator() {
        if (!this.turnIndicator) return;
        
        const isWhiteTurn = this.game.turn() === 'w';
        this.turnIndicator.className = `turn-indicator ${isWhiteTurn ? 'turn-white' : 'turn-black'}`;
    }

    setOrientation(color) {
        this.orientation = color;
        if (this.board) {
            this.board.orientation(color);
        }
        this.updateTurnIndicator();
    }

    updateMoveHistory(move) {
        if (this.isSetupLearningMode) {
            // 不重绘后滚到底部（会停在最大分支编号处）；滚动由 highlight 里对齐「序号最小」主分支
            this.showFullNotation();
            return;
        }

        const moveNumber = Math.ceil(this.game.history().length / 2);
        const isWhiteMove = this.game.history().length % 2 === 1;
        const moveText = isWhiteMove ? `${moveNumber}. ${move.san}` : `${move.san}`;

        $('#moveHistory').append(`<span class="move-pair">${moveText}</span>`);

        const mh = $('#moveHistory')[0];
        if (mh) {
            mh.scrollTop = mh.scrollHeight;
        }
    }

    showError() {
        this.errorCount++;
        
        let errorMessage = `您背错了！这是第${this.errorCount}次错误。`;
        
        // 只有在错误次数达到阈值时才显示正确走法
        if (this.errorCount >= this.errorThreshold) {
            const possibleMoves = this.getPossibleMoves();
            if (possibleMoves.length > 0) {
                errorMessage += ` 正确走法有: ${possibleMoves.join(', ')}`;
            }
            // 重置错误计数器
            this.errorCount = 0;
        } else {
            errorMessage += ` 再错${this.errorThreshold - this.errorCount}次将提示正确走法。`;
        }
        
        $('#errorToast').text(errorMessage).fadeIn().delay(3000).fadeOut();
    }

    getPossibleMoves() {
        const currentHistory = this.game.history();
        const moveIndex = currentHistory.length;
        const possibleMoves = new Set();
        
        // 收集所有可用分支在当前位置的可能走法
        for (const branch of this.availableBranches) {
            if (moveIndex < branch.moves.length) {
                possibleMoves.add(branch.moves[moveIndex]);
            }
        }
        
        return Array.from(possibleMoves);
    }

    resetPosition(resetAccuracy = false) {
        // 清除选择状态
        this.deselectSquare();
        
        this.game.reset();
        if (this.board) {
            this.board.position('start');
        }
        $('#moveHistory').empty();
        this.updateTurnIndicator();
        this.currentBranch = null;
        this.errorCount = 0; // 重置错误计数器
        this.branchErrorCounts.clear(); // 重置分支级别错误计数
        
        if (this.isStudyMode) {
            // 只有在明确要求时才重置正确率统计
            if (resetAccuracy) {
                this.correctMoves = 0;
                this.totalMoves = 0;
                this.updateAccuracy();
            }
            
            this.updateAvailableBranches();
            
            // 如果用户选择黑方，电脑先走
            if (this.orientation === 'black' && this.availableBranches.length > 0) {
                setTimeout(() => this.makeFirstComputerMove(), 500);
            }
        } else if (this.isSetupLearningMode) {
            console.log('摆棋学习模式：重置位置和状态');

            // 回到初始位置后解除「只练某一顺序分支」限制，仍可练任意未完成分支
            this.setupLearningTargetBranchIndex = null;

            const hiddenCount = this.setupLearningHiddenBranches.size;
            this.setupLearningHiddenBranches.clear();
            console.log(`已清空 ${hiddenCount} 个隐藏分支`);

            this.recomputeSetupLearningAvailableAndHidden();
            console.log(`已按未完成分支重算可用列表，共 ${this.availableBranches.length} 个分支`);

            this.showFullNotation();
            
            // 如果用户选择黑方，电脑先走
            if (this.orientation === 'black' && window.pgnParser && window.pgnParser.branches) {
                console.log('摆棋学习模式黑方视角：准备电脑首步走棋');
                setTimeout(() => this.makeFirstComputerMoveForSetupLearning(), 500);
            }
            
            console.log('摆棋学习模式：位置重置完成');
        } else if (this.isMemoryLearningMode) {
            // 记忆学习模式：重新高亮可走棋子
            this.highlightCurrentPieces();
            
            // 如果明确要求重置正确率，重置记忆学习的统计数据
            if (resetAccuracy) {
                this.memoryCorrectMoves = 0;
                this.memoryTotalMoves = 0;
                this.updateAccuracy();
            }
            
            // 如果用户选择黑方，电脑先走白方棋
            if (this.orientation === 'black' && this.availableBranches.length > 0) {
                // 检查是否所有分支都已完成或暂停（记忆学习模式使用记忆学习的状态集合）
                const totalBranches = window.pgnParser.branches.length;
                const completedAndPausedCount = this.memoryCompletedBranches.size + (this.memoryPausedBranches ? this.memoryPausedBranches.size : 0);
                
                if (completedAndPausedCount >= totalBranches) {
                    console.log('记忆学习模式黑方视角：所有分支都已完成或暂停，电脑不再自动走棋');
                } else {
                    console.log('记忆学习模式黑方视角：准备电脑首步走棋，可用分支数量:', this.availableBranches.length);
                    setTimeout(() => this.makeFirstComputerMoveForMemoryLearning(), 500);
                }
            } else if (this.orientation === 'black') {
                console.log('记忆学习模式黑方视角：没有可用分支，无法进行电脑首步走棋');
            }
        }
    }

    makeFirstComputerMove() {
        if ((!this.isStudyMode && !this.isMemoryLearningMode) || this.availableBranches.length === 0) return;
        
        // 获取第一手可能的走法和对应的分支
        const firstMoveOptions = new Map(); // 走法 -> 对应的分支数组
        
        for (const branch of this.availableBranches) {
            if (branch.moves.length > 0) {
                const firstMove = branch.moves[0];
                if (!firstMoveOptions.has(firstMove)) {
                    firstMoveOptions.set(firstMove, []);
                }
                firstMoveOptions.get(firstMove).push(branch);
            }
        }
        
        // 筛选出未使用过的走法
        const unusedMoves = [];
        for (const [move, branches] of firstMoveOptions) {
            // 检查这个走法对应的分支是否都被使用过了
            const hasUnusedBranch = branches.some(branch => !this.computerUsedBranches.has(branch.id));
            if (hasUnusedBranch) {
                unusedMoves.push(move);
            }
        }
        
        // 如果所有分支都用过了，重置已使用记录
        if (unusedMoves.length === 0) {
            this.computerUsedBranches.clear();
            // 重新获取所有第一手走法
            for (const [move] of firstMoveOptions) {
                unusedMoves.push(move);
            }
        }
        
        // 随机选择一个未使用的走法
        if (unusedMoves.length > 0) {
            const randomMove = unusedMoves[Math.floor(Math.random() * unusedMoves.length)];
            const correspondingBranches = firstMoveOptions.get(randomMove);
            
            // 从对应分支中选择一个未使用的分支（如果有的话）
            let selectedBranch = null;
            for (const branch of correspondingBranches) {
                if (!this.computerUsedBranches.has(branch.id)) {
                    selectedBranch = branch;
                    break;
                }
            }
            
            // 如果没找到未使用的分支，就选第一个
            if (!selectedBranch) {
                selectedBranch = correspondingBranches[0];
            }
            
            // 标记这个分支为已使用
            this.computerUsedBranches.add(selectedBranch.id);
            
            // 执行走棋
            const move = this.game.move(randomMove);
            if (move) {
                if (this.board) {
                    this.board.position(this.game.fen()); // 更新棋盘位置
                }
                
                // 清除高亮状态（电脑移动了）
                this.clearHighlightsNew();
                
                this.updateMoveHistory(move);
                this.updateTurnIndicator();
                this.updateAvailableBranches();
                
                // 如果是记忆学习模式，重新高亮可走棋子
                if (this.isMemoryLearningMode) {
                    setTimeout(() => this.highlightCurrentPieces(), 100);
                }
                
                // 显示提示信息
                const message = `电脑选择了走法: ${randomMove}。现在轮到您走棋了！`;
                $('#errorToast').text(message).css('background', '#17a2b8').fadeIn().delay(2000).fadeOut().promise().done(() => {
                    $('#errorToast').css('background', '#ff4444');
                });
            }
        }
    }

    updateProgress() {
        // 直接使用branches数组的长度，因为window.pgnParser现在是后端响应对象
        const total = window.pgnParser && window.pgnParser.branches ? window.pgnParser.branches.length : 0;
        let completed = 0;
        
        // 根据当前模式计算完成的分支数
        if (this.isMemoryLearningMode) {
            // 记忆学习模式：使用记忆学习独立的状态集合
            completed = this.memoryCompletedBranches.size + (this.memoryPausedBranches ? this.memoryPausedBranches.size : 0);
        } else if (this.isSetupLearningMode) {
            completed = this.setupLearningCompletedBranchIds.size;
        } else {
            // 背谱模式：使用背诵学习的状态集合
            completed = this.completedBranches.size;
        }
        
        const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        console.log('=== 更新进度显示 ===');
        console.log('总分支数:', total);
        console.log('已完成分支数:', completed);
        console.log('完成进度:', progress + '%');
        
        if (this.isMemoryLearningMode) {
            console.log('记忆学习模式 - 已完成分支列表:', Array.from(this.memoryCompletedBranches));
            console.log('记忆学习模式 - 暂停分支列表:', Array.from(this.memoryPausedBranches || []));
        } else if (this.isSetupLearningMode) {
            console.log('摆棋学习 - 本局已走完分支:', Array.from(this.setupLearningCompletedBranchIds));
        } else {
            console.log('背诵学习模式 - 已完成分支列表:', Array.from(this.completedBranches));
        }
        
        $('#totalBranches').text(total);
        $('#completedBranches').text(completed);
        $('#progress').text(`${progress}%`);
        
        if (progress === 100 && total > 0) {
            // 显示恭喜信息，并从后端获取真实的累积正确率
            console.log('所有分支已完成，显示完成横幅');
            this.showCompletionBanner();
        } else {
            // 进度不是100%，隐藏完成横幅
            $('#completionBanner').hide();
        }
        
        console.log('=== 进度显示更新完成 ===');
    }

    updateAccuracy() {
        // 根据当前模式选择正确的统计数据
        if (this.isMemoryLearningMode) {
            // 记忆学习模式：使用记忆学习的统计数据
            const accuracy = this.memoryTotalMoves > 0 ? Math.round((this.memoryCorrectMoves / this.memoryTotalMoves) * 100) : 0;
            this.displayAccuracy(accuracy, this.memoryCorrectMoves, this.memoryTotalMoves);
        } else if (this.isStudyMode) {
            // 背谱模式：从后端获取累积正确率
            if (window.currentPgnId && window.chessAPI && window.chessAPI.isBackendAvailable) {
                this.updateAccuracyFromBackend();
            } else {
                // 后备方案：使用当前会话的数据计算正确率
                const accuracy = this.totalMoves > 0 ? Math.round((this.correctMoves / this.totalMoves) * 100) : 0;
                this.displayAccuracy(accuracy, this.correctMoves, this.totalMoves);
            }
        } else {
            // 其他模式：使用背谱的统计数据
            if (window.currentPgnId && window.chessAPI && window.chessAPI.isBackendAvailable) {
                this.updateAccuracyFromBackend();
            } else {
                const accuracy = this.totalMoves > 0 ? Math.round((this.correctMoves / this.totalMoves) * 100) : 0;
                this.displayAccuracy(accuracy, this.correctMoves, this.totalMoves);
            }
        }
    }

    async showCompletionBanner() {
        // 根据当前模式选择不同的完成提示
        let completionText = '';
        if (this.isMemoryLearningMode) {
            completionText = '🎉 恭喜！您已记忆完所有分支！';
        } else if (this.isSetupLearningMode) {
            completionText = '🎉 恭喜！您已完成所有分支的摆棋学习！';
        } else {
            completionText = '🎉 恭喜！您已背完所有分支！';
        }
        
        // 默认显示信息（如果无法从后端获取数据，则使用当前会话数据）
        let finalAccuracyText = '正在获取...';
        
        // 先显示横幅
        $('#completionBanner').html(`${completionText} 最终正确率：<span style="font-weight: bold;">${finalAccuracyText}</span>`);
        $('#completionBanner').show();
        
        // 尝试从后端获取真实的累积正确率
        if (
            window.currentPgnId &&
            window.chessAPI &&
            window.chessAPI.isBackendAvailable &&
            !this.isMemoryLearningMode &&
            !this.isSetupLearningMode
        ) {
            try {
                const response = await fetch(`${window.chessAPI.baseURL}/progress/current-stats/${window.currentPgnId}`, {
                    credentials: 'include'
                });

                if (response.ok) {
                    const result = await response.json();
                    if (result.success) {
                        // 使用后端返回的累积正确率
                        finalAccuracyText = result.total_attempts > 0 ? 
                            `${result.total_correct}/${result.total_attempts} (${result.accuracy_rate}%)` : 
                            '0/0 (0%)';
                        
                        console.log(`最终正确率（后端数据）: ${finalAccuracyText}`);
                    } else {
                        throw new Error('获取统计数据失败');
                    }
                } else {
                    throw new Error(`HTTP错误: ${response.status}`);
                }
            } catch (error) {
                console.error('获取后端正确率失败:', error);
                // 使用当前会话数据作为后备
                const finalAccuracy = this.totalMoves > 0 ? Math.round((this.correctMoves / this.totalMoves) * 100) : 0;
                finalAccuracyText = this.totalMoves > 0 ? 
                    `${this.correctMoves}/${this.totalMoves} (${finalAccuracy}%)` : 
                    '0/0 (0%)';
                console.log(`最终正确率（会话数据）: ${finalAccuracyText}`);
            }
        } else if (this.isMemoryLearningMode) {
            // 记忆学习模式：使用记忆学习的统计数据
            const finalAccuracy = this.memoryTotalMoves > 0 ? Math.round((this.memoryCorrectMoves / this.memoryTotalMoves) * 100) : 0;
            finalAccuracyText = this.memoryTotalMoves > 0 ? 
                `${this.memoryCorrectMoves}/${this.memoryTotalMoves} (${finalAccuracy}%)` : 
                '0/0 (0%)';
            console.log(`记忆学习最终正确率: ${finalAccuracyText}`);
        } else {
            // 没有后端连接，使用当前会话数据
            const finalAccuracy = this.totalMoves > 0 ? Math.round((this.correctMoves / this.totalMoves) * 100) : 0;
            finalAccuracyText = this.totalMoves > 0 ? 
                `${this.correctMoves}/${this.totalMoves} (${finalAccuracy}%)` : 
                '0/0 (0%)';
            console.log(`最终正确率（离线模式）: ${finalAccuracyText}`);
        }
        
        // 更新横幅显示真实的正确率
        $('#completionBanner').html(`${completionText} 最终正确率：<span style="font-weight: bold;">${finalAccuracyText}</span>`);
    }

    async updateAccuracyFromBackend() {
        try {
            const response = await fetch(`${window.chessAPI.baseURL}/progress/current-stats/${window.currentPgnId}`, {
                credentials: 'include'
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    // 使用后端返回的累积正确率，包含分子分母
                    this.displayAccuracy(result.accuracy_rate, result.total_correct, result.total_attempts);
                    console.log(`正确率更新（后端数据）: ${result.total_correct}/${result.total_attempts} = ${result.accuracy_rate}%`);
                    return;
                }
            }
        } catch (error) {
            console.error('获取后端正确率失败:', error);
        }

        // 如果后端获取失败，使用当前会话数据
        const accuracy = this.totalMoves > 0 ? Math.round((this.correctMoves / this.totalMoves) * 100) : 0;
        this.displayAccuracy(accuracy, this.correctMoves, this.totalMoves);
        console.log(`正确率更新（会话数据）: ${this.correctMoves}/${this.totalMoves} = ${accuracy}%`);
    }

    displayAccuracy(accuracy, correct = 0, total = 0) {
        // 根据当前模式选择正确的标签
        let labelText = '背谱正确率';
        if (this.isMemoryLearningMode) {
            labelText = '记忆学习正确率';
        } else if (this.isSetupLearningMode) {
            labelText = '摆棋学习正确率';
        }
        
        // 更新UI显示，包含分子分母格式
        const accuracyText = total > 0 ? `${correct}/${total} (${accuracy}%)` : '0/0 (0%)';
        $('#accuracy').text(accuracyText);
        
        // 更新标签文本（找到包含accuracy span的div元素）
        const accuracyDiv = $('#accuracy').parent();
        if (accuracyDiv.length > 0) {
            // 替换整个div的内容
            accuracyDiv.html(`${labelText}: <span id="accuracy">${accuracyText}</span>`);
        }
        
        // 根据正确率设置不同的颜色
        const accuracyElement = $('#accuracy');
        if (accuracy >= 90) {
            accuracyElement.css('color', '#4CAF50'); // 绿色 - 优秀
        } else if (accuracy >= 70) {
            accuracyElement.css('color', '#FF9800'); // 橙色 - 良好
        } else {
            accuracyElement.css('color', '#f44336'); // 红色 - 需要改进
        }
    }

    isCurrentBranchCompleted() {
        if (!this.currentBranch) return false;
        return this.game.history().length === this.currentBranch.moves.length;
    }

    onBranchCompleted() {
        // 标记当前分支为已完成
        this.completedBranches.add(this.currentBranch.id);
        this.updateProgress();
        
        // 记录到数据库
        this.recordBranchProgress(true);
        
        // 显示分支完成模态框
        this.showBranchCompletedModal();
        
        // 2秒后自动回到初始位置（不重置正确率）
        setTimeout(() => {
            this.resetPosition(false); // 不重置正确率，保持累积
        }, 2000);
    }

    showBranchCompletedModal() {
        // 计算当前正确率
        const accuracy = this.totalMoves > 0 ? Math.round((this.correctMoves / this.totalMoves) * 100) : 0;
        const accuracyText = this.totalMoves > 0 ? `${this.correctMoves}/${this.totalMoves} (${accuracy}%)` : '0/0 (0%)';
        
        const modal = $(`
            <div class="modal-overlay">
                <div class="modal-content">
                    <h3>🎉 分支背诵完成！</h3>
                    <p>恭喜您成功背完了当前分支！</p>
                    <p>当前累积正确率：<span style="color: #4CAF50; font-weight: bold;">${accuracyText}</span></p>
                    <p>即将自动回到初始位置...</p>
                </div>
            </div>
        `);
        
        $('body').append(modal);
        
        // 2秒后自动移除模态框
        setTimeout(() => {
            modal.remove();
        }, 2000);
    }

    async startStudy() {
        // 检查是否有PGN数据
        if (!window.pgnParser || !window.pgnParser.branches || window.pgnParser.branches.length === 0) {
            const message = '请先加载PGN文件！';
            $('#errorToast').text(message).css('background', '#dc3545').fadeIn().delay(3000).fadeOut().promise().done(() => {
                $('#errorToast').css('background', '#ff4444');
            });
            return false;
        }

        this.isStudyMode = true;
        this.isSetupLearningMode = false;
        this.isMemoryLearningMode = false;
        $('#setupLearningNav').hide();

        // 加载用户进度
        await this.loadUserProgress();
        
        // 重置正确率统计
        this.correctMoves = 0;
        this.totalMoves = 0;
        this.memoryCorrectMoves = 0; // 重置记忆学习正确步数
        this.memoryTotalMoves = 0;   // 重置记忆学习总步数
        this.errorCount = 0; // 重置错误计数器
        this.branchErrorCounts.clear(); // 重置分支级别错误计数
        this.updateAccuracy();
        
        // 先更新可用分支，确保resetPosition中的电脑首步走棋逻辑能正确执行
        this.updateAvailableBranches();
        
        this.resetPosition(true);
        
        // 再次检查是否有可用分支
        if (this.availableBranches.length === 0) {
            const message = '没有可用的分支进行背谱！可能所有分支都已完成。';
            $('#errorToast').text(message).css('background', '#ffc107').fadeIn().delay(3000).fadeOut().promise().done(() => {
                $('#errorToast').css('background', '#ff4444');
            });
            this.isStudyMode = false;
            return false;
        }
        
        // 显示提示信息
        if (this.orientation === 'black') {
            // 黑方视角，电脑会先走
            const message = `背谱模式已开启！电脑将随机选择一个分支走出白方第一步，然后您进行背谱练习。`;
            $('#errorToast').text(message).css('background', '#28a745').fadeIn().delay(3000).fadeOut().promise().done(() => {
                $('#errorToast').css('background', '#ff4444');
            });
        } else {
            // 白方视角，显示可能的走法
            const possibleMoves = this.getPossibleMoves();
            if (possibleMoves.length > 0) {
                const message = `背谱模式已开启！根据您的走棋自动匹配分支。当前可能的走法: ${possibleMoves.join(', ')}`;
                $('#errorToast').text(message).css('background', '#28a745').fadeIn().delay(3000).fadeOut().promise().done(() => {
                    $('#errorToast').css('background', '#ff4444');
                });
            }
        }
        
        return true;
    }

    // 摆棋学习模式
    async startSetupLearning() {
        // 检查是否有PGN数据
        if (!window.pgnParser || !window.pgnParser.branches || window.pgnParser.branches.length === 0) {
            const message = '请先加载PGN文件！';
            $('#errorToast').text(message).css('background', '#dc3545').fadeIn().delay(3000).fadeOut().promise().done(() => {
                $('#errorToast').css('background', '#ff4444');
            });
            return false;
        }

        this.isSetupLearningMode = true;
        this.isStudyMode = false;
        this.isMemoryLearningMode = false;
        
        // 初始化摆棋学习的分支过滤状态
        this.setupLearningHiddenBranches.clear();
        this.setupLearningCompletedBranchIds.clear();
        this.setupLearningTargetBranchIndex = null;

        // 重置正确率统计
        this.correctMoves = 0;
        this.totalMoves = 0;
        this.memoryCorrectMoves = 0;
        this.memoryTotalMoves = 0;
        this.errorCount = 0;
        this.branchErrorCounts.clear();
        this.memoryBranchErrorCounts.clear();
        this.updateAccuracy();
        
        // 重置棋盘位置
        this.resetPosition(true);
        
        // 显示完整棋谱（摆棋学习：仍显示全部分支，主参考线为序号最小匹配分支）
        this.showFullNotation();

        $('#setupLearningNav').css('display', 'flex');
        
        // 移动端棋谱显示验证
        setTimeout(() => {
            const moveHistoryElement = $('#moveHistory');
            const branchElements = moveHistoryElement.find('[id^="branch-"]');
            const notationTitle = moveHistoryElement.find('strong:contains("棋谱")');
            
            console.log('摆棋学习启动后棋谱显示验证:');
            console.log('moveHistory元素存在:', moveHistoryElement.length > 0);
            console.log('棋谱标题存在:', notationTitle.length > 0);
            console.log('分支元素数量:', branchElements.length);
            console.log('预期分支数量:', window.pgnParser.branches.length);
            
            if (branchElements.length === 0) {
                console.warn('警告：没有找到分支元素，棋谱可能没有正确显示');
                // 尝试重新显示棋谱
                this.showFullNotation();
            }
            
            // 检查移动端显示
            const isMobile = window.innerWidth <= 768;
            if (isMobile) {
                console.log('移动端检测：当前为移动端显示');
                console.log('屏幕宽度:', window.innerWidth);
                console.log('容器宽度:', moveHistoryElement.width());
                console.log('容器高度:', moveHistoryElement.height());
            }
        }, 500);
        
        // 显示提示信息
        const message = '摆棋学习模式已开启！';
        $('#errorToast').text(message).css('background', '#17a2b8').fadeIn().delay(2000).fadeOut().promise().done(() => {
            $('#errorToast').css('background', '#ff4444');
        });
        
        // 不再显示冗长的提示信息
        
        return true;
    }

    // 记忆学习模式
    async startMemoryLearning() {
        // 检查是否有PGN数据
        if (!window.pgnParser || !window.pgnParser.branches || window.pgnParser.branches.length === 0) {
            const message = '请先加载PGN文件！';
            $('#errorToast').text(message).css('background', '#dc3545').fadeIn().delay(3000).fadeOut().promise().done(() => {
                $('#errorToast').css('background', '#ff4444');
            });
            return false;
        }

        this.isMemoryLearningMode = true;
        this.isStudyMode = false;
        this.isSetupLearningMode = false;
        $('#setupLearningNav').hide();

        // 加载用户进度
        await this.loadUserProgress();
        
        // 在记忆学习模式下，清空从后端加载的背诵进度
        if (this.isMemoryLearningMode) {
            console.log('记忆学习模式：清空从后端加载的背诵进度');
            // 清空从后端加载的分支状态
            this.completedBranches.clear();
            this.pausedBranches.clear();
        }
        
        // 从持久化存储恢复记忆学习的分支状态
        this.restoreBranchStatesFromStorage();
        
        // 重置正确率统计
        this.correctMoves = 0;
        this.totalMoves = 0;
        this.memoryCorrectMoves = 0; // 重置记忆学习正确步数
        this.memoryTotalMoves = 0;   // 重置记忆学习总步数
        this.errorCount = 0; // 重置错误计数器
        this.branchErrorCounts.clear(); // 重置背诵学习分支级别错误计数
        this.memoryBranchErrorCounts.clear(); // 重置记忆学习分支级别错误计数
        this.updateAccuracy();
        
        // 先更新可用分支，确保resetPosition中的电脑首步走棋逻辑能正确执行
        this.updateAvailableBranches();
        
        this.resetPosition(true);
        
        // 更新可用分支
        this.updateAvailableBranches();
        
        // 隐藏棋谱显示
        this.hideNotation();
        
        // 显示所有分支名称
        this.showBranchNames();
        
        // 高亮当前可走的棋子
        this.highlightCurrentPieces();
        
        // 显示提示信息
        let message = '';
        if (this.orientation === 'white') {
            message = `记忆学习模式已开启！您是白方，请先走棋。系统会高亮可走的棋子，请尝试走出正确的招法。错误2次后将提示正确走法。`;
            console.log('记忆学习模式：白方视角，等待用户先走棋');
        } else {
            message = `记忆学习模式已开启！您是黑方，电脑将先走白方棋。系统会高亮可走的棋子，请尝试走出正确的招法。错误2次后将提示正确走法。`;
            console.log('记忆学习模式：黑方视角，电脑将先走白方棋');
        }
        
        // 添加移动端点击走棋的测试信息
        console.log('记忆学习模式：移动端点击走棋已启用');
        console.log('点击走棋支持状态:', this.clickToMove);
        console.log('棋盘元素状态:', !!this.board);
        
        // 显示记忆学习选项
        $('#memoryLearningOptions').show();
        
        $('#errorToast').text(message).css('background', '#FF5722').fadeIn().delay(4000).fadeOut().promise().done(() => {
            $('#errorToast').css('background', '#ff4444');
        });
        
        // 如果是黑方视角，确保电脑首步走棋逻辑正确执行
        if (this.orientation === 'black') {
            console.log('黑方视角：检查可用分支数量:', this.availableBranches.length);
            console.log('黑方视角：等待resetPosition中的电脑首步走棋逻辑执行');
        }
        
        return true;
    }

    stopStudy() {
        this.isStudyMode = false;
        this.isSetupLearningMode = false;
        this.isMemoryLearningMode = false;
        this.currentBranch = null;
        this.availableBranches = [];
        this.computerUsedBranches.clear(); // 清空电脑已使用的分支记录
        this.errorCount = 0; // 重置错误计数器
        this.branchErrorCounts.clear(); // 重置分支级别错误计数
        this.memoryBranchErrorCounts.clear(); // 重置记忆学习分支级别错误计数
        
        // 隐藏记忆学习选项
        $('#memoryLearningOptions').hide();
        
        // 清理摆棋学习的分支过滤状态
        this.setupLearningHiddenBranches.clear();
        this.setupLearningCompletedBranchIds.clear();
        this.setupLearningTargetBranchIndex = null;
        
        // 重置正确率统计
        this.correctMoves = 0;
        this.totalMoves = 0;
        this.memoryCorrectMoves = 0; // 重置记忆学习正确步数
        this.memoryTotalMoves = 0;   // 重置记忆学习总步数
        this.updateAccuracy();
        
        // 清除高亮状态
        this.clearHighlightsNew();
        
        // 隐藏棋谱显示
        this.hideNotation();
        
        // 隐藏分支名称显示
        $('#branchNames').hide();
        
        // 注意：不清理本地存储的分支状态，保留记忆学习进度
        // 只有在用户明确要求重置进度时才清理
        console.log('停止学习模式，保留记忆学习进度');
        
        return true;
    }

    addTouchSupport() {
        const boardElement = document.getElementById('board');
        if (!boardElement) return;

        let isDragging = false;
        let touchStartY = 0;
        let lastTouchTarget = null;

        // 检查元素是否是棋子
        const isPieceElement = (element) => {
            if (!element) return false;
            
            // 检查多种可能的棋子标识
            return element.classList.contains('piece-417db') ||
                   element.closest('.piece-417db') ||
                   element.classList.toString().includes('piece') ||
                   (element.style && element.style.backgroundImage && element.style.backgroundImage.includes('.png')) ||
                   element.getAttribute('data-piece') ||
                   (element.className && element.className.includes('piece'));
        };

        // 处理触摸开始事件
        boardElement.addEventListener('touchstart', (e) => {
            const target = e.target;
            lastTouchTarget = target;
            
            // 检查是否触摸在棋子上
            if (isPieceElement(target)) {
                isDragging = true;
                touchStartY = e.touches[0].clientY;
                console.log('开始拖拽棋子，阻止页面滚动');
                
                // 立即阻止滚动
                e.preventDefault();
            }
        }, { passive: false });

        // 处理触摸移动事件
        boardElement.addEventListener('touchmove', (e) => {
            // 如果正在拖拽棋子，或者触摸目标是棋子，都阻止滚动
            if (isDragging || isPieceElement(e.target) || isPieceElement(lastTouchTarget)) {
                e.preventDefault();
                e.stopPropagation();
                
                // 更新拖拽状态
                if (!isDragging && isPieceElement(e.target)) {
                    isDragging = true;
                    touchStartY = e.touches[0].clientY;
                    console.log('检测到棋子拖拽，阻止页面滚动');
                }
            }
        }, { passive: false });

        // 处理触摸结束事件
        boardElement.addEventListener('touchend', (e) => {
            if (isDragging) {
                isDragging = false;
                lastTouchTarget = null;
                console.log('结束拖拽棋子，恢复页面滚动');
            }
        }, { passive: true });

        // 处理触摸取消事件
        boardElement.addEventListener('touchcancel', (e) => {
            if (isDragging) {
                isDragging = false;
                lastTouchTarget = null;
                console.log('拖拽被取消，恢复页面滚动');
            }
        }, { passive: true });

        // 为整个棋盘容器添加额外的保护
        const boardContainer = boardElement.closest('.board-container');
        if (boardContainer) {
            // 使用事件委托处理动态生成的棋子
            boardContainer.addEventListener('touchstart', (e) => {
                if (isPieceElement(e.target)) {
                    e.preventDefault();
                }
            }, { passive: false });

            boardContainer.addEventListener('touchmove', (e) => {
                if (isDragging || isPieceElement(e.target)) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }, { passive: false });
        }

        // 为document添加全局监听，作为最后的防护
        document.addEventListener('touchmove', (e) => {
            if (isDragging) {
                e.preventDefault();
            }
        }, { passive: false });

        console.log('移动端触控支持已添加 - 拖拽棋子时将阻止页面滚动');
    }

    // 添加点击移动支持
    addClickMoveSupport() {
        const self = this;
        
        // 等待棋盘完全加载后再添加事件监听
        setTimeout(() => {
            const boardElement = document.getElementById('board');
            if (!boardElement) {
                console.error('棋盘元素未找到');
                return;
            }

            console.log('添加点击移动支持到棋盘');

            // 使用事件委托来处理点击事件，捕获阶段
            boardElement.addEventListener('click', function(e) {
                if (!self.clickToMove) return;
                
                console.log('检测到点击事件:', e.target);

                // 阻止事件冒泡，避免与拖拽冲突
                e.stopPropagation();

                // 找到被点击的方格
                const square = self.getSquareFromClick(e);
                if (!square) {
                    console.log('未能确定点击的方格');
                    return;
                }

                console.log('点击方格:', square);
                self.handleSquareClick(square);
            }, true); // 使用捕获阶段

            // 也在普通事件阶段添加监听，作为备选
            boardElement.addEventListener('click', function(e) {
                if (!self.clickToMove) return;
                
                // 如果在捕获阶段已经处理过，就不再处理
                if (e.defaultPrevented) return;
                
                const square = self.getSquareFromClick(e);
                if (square) {
                    console.log('备选监听器处理点击:', square);
                    self.handleSquareClick(square);
                }
            }, false);

            console.log('点击移动支持已添加');
        }, 200);
    }

    // 处理方格点击
    handleSquareClick(square) {
        const piece = this.game.get(square);
        
        console.log(`处理方格点击: ${square}, 棋子:`, piece, '当前选中:', this.selectedSquare);
        console.log(`当前模式: 背诵学习=${this.isStudyMode}, 记忆学习=${this.isMemoryLearningMode}, 摆棋学习=${this.isSetupLearningMode}`);
        
        // 如果没有选中的方格
        if (!this.selectedSquare) {
            console.log('没有选中方格，尝试选择棋子');
            // 只有点击己方棋子才能选择
            if (this.canSelectPiece(square, piece)) {
                console.log('可以选择该棋子，进行选择');
                this.selectSquare(square);
            } else {
                console.log('不能选择该棋子 - 可能不是己方棋子或没有棋子');
            }
            return;
        }

        // 如果已经有选中的方格
        if (this.selectedSquare === square) {
            // 点击同一个方格，取消选择
            console.log('点击同一方格，取消选择');
            this.deselectSquare();
            return;
        }

        // 如果点击的是己方的另一个棋子，切换选择
        if (this.canSelectPiece(square, piece)) {
            console.log('点击己方另一个棋子，切换选择');
            this.deselectSquare();
            this.selectSquare(square);
            return;
        }

        // 如果点击的是空格子或敌方棋子，检查是否可以移动
        if (!piece || this.isOpponentPiece(piece)) {
            // 先检查这是否是一个合法的移动
            const isLegalMove = this.isLegalMove(this.selectedSquare, square);
            
            if (isLegalMove) {
                console.log(`尝试移动从 ${this.selectedSquare} 到 ${square}`);
                const moveResult = this.attemptMove(this.selectedSquare, square);
                if (moveResult) {
                    this.deselectSquare();
                }
                // 如果移动失败，保持当前选择状态
            } else {
                console.log('点击了不合法的目标位置，取消选择');
                this.deselectSquare();
            }
        } else {
            console.log('其他情况，取消选择');
            this.deselectSquare();
        }
    }

    // 检查是否可以选择这个棋子
    canSelectPiece(square, piece) {
        console.log(`检查是否可以选择棋子: ${square}, 棋子:`, piece);
        
        // 没有棋子的方格不能选择
        if (!piece) {
            console.log('没有棋子，不能选择');
            return false;
        }
        
        // 如果游戏结束，不允许选择
        if (this.game.game_over()) {
            console.log('游戏结束，不能选择');
            return false;
        }
        
        const currentTurn = this.game.turn();
        console.log(`当前轮次: ${currentTurn}, 棋子颜色: ${piece.color}, 背谱模式: ${this.isStudyMode}, 棋盘方向: ${this.orientation}`);
        
        // 如果不在背谱模式，允许选择当前方的棋子
        if (!this.isStudyMode && !this.isMemoryLearningMode) {
            const canSelect = (currentTurn === 'w' && piece.color === 'w') ||
                             (currentTurn === 'b' && piece.color === 'b');
            console.log(`非学习模式选择结果: ${canSelect}`);
            return canSelect;
        }

        // 学习模式（背诵学习或记忆学习）下的选择限制
        const isWhiteTurn = currentTurn === 'w';
        const canMove = (this.orientation === 'white' && isWhiteTurn) ||
                        (this.orientation === 'black' && !isWhiteTurn);
        
        console.log(`学习模式检查: isWhiteTurn=${isWhiteTurn}, canMove=${canMove}`);
        
        if (!canMove) {
            console.log('学习模式下不能移动');
            return false;
        }
        
        // 只允许选择当前方的棋子
        const canSelectInStudy = (currentTurn === 'w' && piece.color === 'w') ||
                                (currentTurn === 'b' && piece.color === 'b');
        console.log(`学习模式选择结果: ${canSelectInStudy}`);
        return canSelectInStudy;
    }

    // 检查是否是对方棋子
    isOpponentPiece(piece) {
        if (!piece) return false;
        return (this.game.turn() === 'w' && piece.color === 'b') ||
               (this.game.turn() === 'b' && piece.color === 'w');
    }

    // 检查移动是否合法
    isLegalMove(from, to) {
        if (!from || !to) return false;
        
        // 使用chess.js的moves方法获取指定方格的所有合法移动
        const moves = this.game.moves({ square: from, verbose: true });
        
        // 检查目标方格是否在合法移动列表中
        return moves.some(move => move.to === to);
    }

    // 从点击事件获取方格名称
    getSquareFromClick(e) {
        const target = e.target;
        let element = target;
        
        console.log('点击目标:', target, '类名:', target.className);
        
        // 向上查找，最多查找8层，寻找方格元素
        for (let i = 0; i < 8 && element && element !== document.body; i++) {
            if (element.className && typeof element.className === 'string') {
                console.log(`第${i}层元素:`, element.tagName, '类名:', element.className);
                
                // 检查data-square属性
                if (element.getAttribute && element.getAttribute('data-square')) {
                    const square = element.getAttribute('data-square');
                    console.log('找到data-square属性:', square);
                    return square;
                }
                
                // 检查类名中是否包含方格信息
                const classNames = element.className.split(' ');
                for (let className of classNames) {
                    // chessboard.js可能使用不同的格式，尝试多种模式
                    
                    // 模式1: square-a1 格式
                    if (className.startsWith('square-')) {
                        const square = className.replace('square-', '');
                        if (square.match(/^[a-h][1-8]$/)) {
                            console.log('从类名找到方格(模式1):', square);
                            return square;
                        }
                    }
                    
                    // 模式2: 直接是方格名 a1, b2等
                    if (className.match(/^[a-h][1-8]$/)) {
                        console.log('直接类名方格(模式2):', className);
                        return className;
                    }
                    
                    // 模式3: chessboard.js内部可能的格式
                    if (className.includes('square') && element.getAttribute) {
                        // 尝试从其他属性获取
                        const coords = element.getAttribute('data-square') || 
                                     element.getAttribute('square') ||
                                     element.getAttribute('data-coord');
                        if (coords && coords.match(/^[a-h][1-8]$/)) {
                            console.log('从属性找到方格(模式3):', coords);
                            return coords;
                        }
                    }
                }
            }
            
            element = element.parentElement;
        }
        
        console.log('DOM查找失败，尝试位置计算');
        // 如果仍然没找到，尝试根据位置计算
        const square = this.getSquareFromPosition(e);
        console.log('位置计算结果:', square);
        return square;
    }
    
    // 根据点击位置计算方格
    getSquareFromPosition(e) {
        const boardElement = document.getElementById('board');
        if (!boardElement) {
            console.log('位置计算：找不到棋盘元素');
            return null;
        }
        
        // 找到实际的棋盘容器（可能是子元素）
        const chessboardContainer = boardElement.querySelector('[class*="chessboard"]') || boardElement;
        const rect = chessboardContainer.getBoundingClientRect();
        
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        console.log(`点击位置: (${x}, ${y}), 棋盘尺寸: ${rect.width}x${rect.height}`);
        
        // 计算方格大小（假设棋盘是正方形）
        const boardSize = Math.min(rect.width, rect.height);
        const squareSize = boardSize / 8;
        
        // 计算方格坐标
        const file = Math.floor(x / squareSize);
        const rank = Math.floor(y / squareSize);
        
        console.log(`计算的坐标: file=${file}, rank=${rank}, squareSize=${squareSize}`);
        
        // 检查是否在有效范围内
        if (file < 0 || file > 7 || rank < 0 || rank > 7) {
            console.log('坐标超出棋盘范围');
            return null;
        }
        
        // 根据棋盘方向转换坐标
        let square;
        if (this.orientation === 'white') {
            square = String.fromCharCode(97 + file) + (8 - rank);
        } else {
            square = String.fromCharCode(97 + (7 - file)) + (rank + 1);
        }
        
        console.log(`计算出的方格: ${square}`);
        return square;
    }

    // 选择方格
    selectSquare(square) {
        this.selectedSquare = square;
        
        // 高亮显示选中的方格
        this.highlightSquare(square, 'selected');
        
        console.log('选中方格:', square);
    }

    // 取消选择方格
    deselectSquare() {
        if (this.selectedSquare) {
            console.log('取消选择方格:', this.selectedSquare);
            this.selectedSquare = null;
        }
        
        // 清除所有高亮
        this.clearHighlightsNew();
    }

    // 尝试移动棋子
    attemptMove(from, to) {
        console.log(`尝试移动: ${from} 到 ${to}`);
        
        // 尝试移动
        const move = this.game.move({
            from: from,
            to: to,
            promotion: 'q' // 默认升为皇后
        });

        // 如果移动不合法
        if (move === null) {
            console.log('非法移动');
            return false;
        }

        console.log('合法移动:', move);

        // 更新棋盘显示
        this.board.position(this.game.fen());

        // 清除高亮状态（有棋子移动了）
        this.clearHighlightsNew();

        // 如果不在背谱模式，允许自由下棋
        if (!this.isStudyMode && !this.isMemoryLearningMode) {
            this.updateMoveHistory(move);
            this.updateTurnIndicator();
            return true;
        }

        // 记忆学习模式下的移动处理
        if (this.isMemoryLearningMode) {
            console.log('记忆学习模式：处理用户移动');
            console.log('移动详情:', move);
            console.log('当前游戏历史:', this.game.history());
            
            const matchingBranch = this.findMatchingBranch(move);
            console.log('查找匹配分支结果:', matchingBranch);
            
            if (!matchingBranch) {
                // 没有匹配的分支，走错了
                console.log('记忆学习：没有找到匹配的分支');
                this.game.undo(); // 撤销移动
                this.board.position(this.game.fen()); // 更新棋盘显示
                
                // 统计错误步数
                this.errorCount++;
                this.memoryTotalMoves++;
                this.updateAccuracy();
                
                // 显示错误提示
                this.showMemoryLearningError();
                return false;
            }
            
            console.log('记忆学习：找到匹配的分支');
            console.log('匹配分支详情:', matchingBranch);
            
            // 走对了，重置错误计数器
            this.errorCount = 0;
            
            // 统计正确步数
            this.memoryCorrectMoves++;
            this.memoryTotalMoves++;
            this.updateAccuracy();
            
            // 更新当前分支
            this.currentBranch = matchingBranch;
            this.updateAvailableBranches();
            
            // 更新界面
            this.updateMoveHistory(move);
            this.updateTurnIndicator();
            this.highlightCurrentPieces();
            
            // 检查是否完成当前分支
            if (this.isCurrentBranchCompleted()) {
                console.log('记忆学习：当前分支已完成，调用分支完成处理');
                this.onMemoryLearningBranchCompleted();
                return true;
            }
            
            // 执行电脑走棋
            console.log('记忆学习：准备执行电脑走棋');
            setTimeout(() => this.makeComputerMove(), 500);
            
            return true;
        }

        // 背谱模式下检查移动是否正确
        const matchingBranch = this.findMatchingBranch(move);
        
        if (!matchingBranch) {
            // 没有匹配的分支，走错了
            console.log('No matching branch found');
            this.game.undo(); // 撤销移动
            
            // 统计错误步数：已走步数+1，正确步数不变
            this.totalMoves++;
            this.updateAccuracy();
            
            // 记录错误移动到数据库
            this.recordMoveProgress(false);
            
            this.showError();
            return 'snapback';
        }

        console.log('Found matching branch');

        // 走对了，重置错误计数器
        this.errorCount = 0;
        
        // 统计正确步数：正确步数+1，已走步数+1
        this.correctMoves++;
        this.totalMoves++;
        this.updateAccuracy();
        
        // 记录正确移动到数据库
        this.recordMoveProgress(true);

        // 更新当前分支
        this.currentBranch = matchingBranch;
        this.updateAvailableBranches();

        // 更新界面
        this.updateMoveHistory(move);
        this.updateTurnIndicator();
        
        // 检查是否完成当前分支
        if (this.isCurrentBranchCompleted()) {
            this.onBranchCompleted();
            return true;
        }

        // 执行电脑走棋
        setTimeout(() => this.makeComputerMove(), 500);
        
        return true;
    }

    // 高亮显示方格
    highlightSquare(square, type = 'selected') {
        const squareElement = this.getSquareElement(square);
        if (!squareElement) return;

        // 移除之前的高亮类
        squareElement.classList.remove('highlight-selected', 'highlight-possible', 'highlight-capture');
        
        // 添加新的高亮类
        if (type === 'selected') {
            squareElement.classList.add('highlight-selected');
        } else if (type === 'possible') {
            squareElement.classList.add('highlight-possible');
        } else if (type === 'capture') {
            squareElement.classList.add('highlight-capture');
        }
    }

    // 显示可能的移动
    showPossibleMoves(square) {
        const moves = this.game.moves({ square: square, verbose: true });
        
        moves.forEach(move => {
            const targetSquare = move.to;
            const piece = this.game.get(targetSquare);
            
            // 如果目标方格有敌方棋子，显示为捕获高亮
            if (piece && piece.color !== this.game.get(square).color) {
                this.highlightSquare(targetSquare, 'capture');
            } else {
                this.highlightSquare(targetSquare, 'possible');
            }
        });
    }

    // 清除所有高亮
    clearHighlights() {
        const boardElement = document.getElementById('board');
        if (!boardElement) return;

        // 清除原有方格的高亮类
        const highlightElements = boardElement.querySelectorAll('.highlight-selected, .highlight-possible, .highlight-capture');
        highlightElements.forEach(element => {
            element.classList.remove('highlight-selected', 'highlight-possible', 'highlight-capture');
        });

        // 清除覆盖层
        const overlayElements = boardElement.querySelectorAll('.square-overlay');
        overlayElements.forEach(element => {
            element.remove();
        });
    }

    // 获取方格元素
    getSquareElement(square) {
        const boardElement = document.getElementById('board');
        if (!boardElement) return null;

        console.log('查找方格元素:', square);

        // 方法1: 通过data-square属性查找
        let squareElement = boardElement.querySelector(`[data-square="${square}"]`);
        if (squareElement) {
            console.log('通过data-square找到元素');
            return squareElement;
        }
        
        // 方法2: 通过类名查找
        squareElement = boardElement.querySelector(`.square-${square}`);
        if (squareElement) {
            console.log('通过类名找到元素');
            return squareElement;
        }
        
        // 方法3: 遍历所有可能的方格元素
        const allSquares = boardElement.querySelectorAll('[class*="square"]');
        console.log(`找到${allSquares.length}个可能的方格元素`);
        
        for (let element of allSquares) {
            const classList = element.className.split(' ');
            for (let className of classList) {
                if (className === `square-${square}` || className === square) {
                    console.log('通过遍历找到元素');
                    return element;
                }
            }
        }
        
        // 方法4: 如果是chessboard.js，尝试根据坐标计算位置
        // 这个方法作为最后的fallback，创建一个临时的高亮overlay
        if (!squareElement) {
            console.log('未找到方格元素，尝试创建临时overlay');
            squareElement = this.createSquareOverlay(square);
        }
        
        return squareElement;
    }

    // 创建方格覆盖层（用于高亮显示）
    createSquareOverlay(square) {
        const boardElement = document.getElementById('board');
        if (!boardElement) return null;

        // 计算方格位置
        const fileIndex = square.charCodeAt(0) - 97; // a=0, b=1, etc.
        const rankIndex = parseInt(square[1]) - 1;   // 1=0, 2=1, etc.

        const chessboardContainer = boardElement.querySelector('[class*="chessboard"]') || boardElement;
        const rect = chessboardContainer.getBoundingClientRect();
        const squareSize = Math.min(rect.width, rect.height) / 8;

        // 根据棋盘方向计算实际位置
        let x, y;
        if (this.orientation === 'white') {
            x = fileIndex * squareSize;
            y = (7 - rankIndex) * squareSize;
        } else {
            x = (7 - fileIndex) * squareSize;
            y = rankIndex * squareSize;
        }

        // 创建覆盖层元素
        const overlay = document.createElement('div');
        overlay.className = `square-overlay overlay-${square}`;
        overlay.style.position = 'absolute';
        overlay.style.left = x + 'px';
        overlay.style.top = y + 'px';
        overlay.style.width = squareSize + 'px';
        overlay.style.height = squareSize + 'px';
        overlay.style.pointerEvents = 'none';
        overlay.style.zIndex = '10';

        // 添加到棋盘容器
        chessboardContainer.style.position = 'relative';
        chessboardContainer.appendChild(overlay);

        console.log(`创建覆盖层: ${square} at (${x}, ${y})`);
        return overlay;
    }

    // 进度记录相关方法
    recordMoveProgress(isCorrect) {
        if (!this.currentBranch || !window.pgnParser?.metadata?.id) {
            return;
        }

        // 检查这步之后是否到达分支最后一步
        const isBranchEnd = this.isCurrentBranchCompleted();

        // 使用updateProgress函数记录移动
        if (typeof updateProgress === 'function') {
            updateProgress(
                window.pgnParser.metadata.id, 
                this.currentBranch.id, 
                isCorrect, 
                0, // duration - 我们可以添加计时逻辑
                '',  // notes
                isBranchEnd  // 是否到达分支最后一步
            ).then(() => {
                // 进度更新完成后，刷新正确率显示
                setTimeout(() => {
                    this.updateAccuracy();
                }, 100);
            }).catch(() => {
                // 如果进度更新失败，仍然更新正确率显示
                this.updateAccuracy();
            });
        } else {
            // 如果没有updateProgress函数，直接更新正确率
            this.updateAccuracy();
        }
    }

    recordBranchProgress(isCompleted) {
        if (!this.currentBranch || !window.pgnParser?.metadata?.id) {
            return;
        }

        // 检查是否真的到达分支最后一步
        const isBranchEnd = this.isCurrentBranchCompleted();
        
        // 使用updateProgress函数记录分支完成，传递is_branch_end参数
        if (typeof updateProgress === 'function') {
            updateProgress(
                window.pgnParser.metadata.id, 
                this.currentBranch.id, 
                isCompleted, 
                0, // duration
                isCompleted ? '分支已完成' : '',
                isBranchEnd // 新增：是否到达分支最后一步
            ).then(() => {
                // 进度更新完成后，刷新正确率显示
                setTimeout(() => {
                    this.updateAccuracy();
                }, 100);
            }).catch(() => {
                // 如果进度更新失败，仍然更新正确率显示
                this.updateAccuracy();
            });
        } else {
            // 如果没有updateProgress函数，直接更新正确率
            this.updateAccuracy();
        }
    }

    // 加载用户进度
    async loadUserProgress() {
        // 如果是记忆学习模式，跳过加载背诵进度
        if (this.isMemoryLearningMode) {
            console.log('记忆学习模式：跳过加载背诵进度，只使用本地存储的记忆学习状态');
            return;
        }
        
        if (!window.currentPgnId || !window.chessAPI || !window.chessAPI.isBackendAvailable) {
            console.log('无法加载用户进度：缺少必要参数或后端不可用');
            return;
        }

        try {
            console.log('开始加载用户进度...');
            const response = await fetch(`${window.chessAPI.baseURL}/progress/my`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success && result.progress) {
                    console.log(`加载到${result.progress.length}条进度记录`);
                    
                    // 筛选当前PGN文件的进度记录
                    const currentPgnProgress = result.progress.filter(p => 
                        p.pgn_game_id === window.pgnParser.metadata.id
                    );
                    
                    console.log(`当前PGN文件的进度记录：${currentPgnProgress.length}条`);
                    
                    // 将已完成的分支标记为完成
                    currentPgnProgress.forEach(progress => {
                        if (progress.is_completed) {
                            this.completedBranches.add(progress.branch_id);
                            console.log(`恢复已完成分支：${progress.branch_id}`);
                        }
                        // 检查是否有暂停的分支（记忆学习模式下的特殊标记）
                        if (progress.is_paused) {
                            this.pausedBranches.add(progress.branch_id);
                            console.log(`恢复暂停分支：${progress.branch_id}`);
                        }
                    });
                    
                    // 更新进度显示
                    this.updateProgress();
                    
                    // 更新正确率显示
                    this.updateAccuracy();
                    
                    console.log(`✅ 用户进度加载完成，已完成分支数：${this.completedBranches.size}`);
                } else {
                    console.log('没有找到进度记录');
                }
            } else if (response.status === 401) {
                console.log('用户未登录，跳过进度加载');
            } else {
                console.error('加载用户进度失败:', response.status, response.statusText);
            }
        } catch (error) {
            console.error('加载用户进度请求失败:', error);
        }
    }

    // 根据当前棋盘历史重算摆棋学习的可用/隐藏分支（与 handleSetupLearningMove 判定一致）
    recomputeSetupLearningAvailableAndHidden() {
        if (!window.pgnParser || !window.pgnParser.branches) return;
        const currentHistory = this.game.history();
        this.setupLearningHiddenBranches.clear();
        this.availableBranches = [];
        for (let i = 0; i < window.pgnParser.branches.length; i++) {
            const branch = window.pgnParser.branches[i];
            const branchId = branch.id || `branch_${i}`;
            if (this.setupLearningCompletedBranchIds.has(branchId)) {
                this.setupLearningHiddenBranches.add(branchId);
                continue;
            }
            if (this.setupLearningTargetBranchIndex !== null && i !== this.setupLearningTargetBranchIndex) {
                this.setupLearningHiddenBranches.add(branchId);
                continue;
            }
            let isMatch = true;
            for (let j = 0; j < currentHistory.length; j++) {
                if (j >= branch.moves.length || branch.moves[j] !== currentHistory[j]) {
                    isMatch = false;
                    break;
                }
            }
            if (!isMatch) {
                this.setupLearningHiddenBranches.add(branchId);
            } else {
                this.availableBranches.push(branch);
            }
        }
    }

    // 完成当前分支后：按序号找下一个尚未走完的分支（先向后找，再从头找）
    findNextSetupLearningBranchIndexAfter(completedIndex) {
        const branches = window.pgnParser.branches;
        const n = branches.length;
        for (let j = completedIndex + 1; j < n; j++) {
            const id = branches[j].id || `branch_${j}`;
            if (!this.setupLearningCompletedBranchIds.has(id)) {
                return j;
            }
        }
        for (let j = 0; j < completedIndex; j++) {
            const id = branches[j].id || `branch_${j}`;
            if (!this.setupLearningCompletedBranchIds.has(id)) {
                return j;
            }
        }
        return -1;
    }

    // 分支走完后自动回到起点并锁定「下一个」分支
    setupLearningAdvanceToNextBranch(completedBranchIndex) {
        if (!this.isSetupLearningMode || !window.pgnParser || !window.pgnParser.branches) {
            return;
        }
        const branches = window.pgnParser.branches;
        const completedId = branches[completedBranchIndex].id || `branch_${completedBranchIndex}`;
        this.setupLearningCompletedBranchIds.add(completedId);
        this.updateProgress();

        const nextIdx = this.findNextSetupLearningBranchIndexAfter(completedBranchIndex);
        if (nextIdx < 0) {
            $('#errorToast')
                .text('🎉 本局摆棋学习已全部完成！')
                .css('background', '#9C27B0')
                .fadeIn()
                .delay(4000)
                .fadeOut()
                .promise()
                .done(() => {
                    $('#errorToast').css('background', '#ff4444');
                });
            this.setupLearningTargetBranchIndex = null;
            this.showCompletionBanner();
            return;
        }

        this.setupLearningTargetBranchIndex = nextIdx;

        this.deselectSquare();
        this.game.reset();
        if (this.board) {
            this.board.position('start');
        }
        $('#moveHistory').empty();
        this.errorCount = 0;
        this.branchErrorCounts.clear();
        this.setupLearningHiddenBranches.clear();
        this.recomputeSetupLearningAvailableAndHidden();
        this.showFullNotation();
        this.updateTurnIndicator();

        $('#errorToast')
            .text(`分支 ${completedBranchIndex + 1} 已完成 → 请继续学习分支 ${nextIdx + 1}`)
            .css('background', '#28a745')
            .fadeIn()
            .delay(3500)
            .fadeOut()
            .promise()
            .done(() => {
                $('#errorToast').css('background', '#ff4444');
            });

        if (this.orientation === 'black' && this.availableBranches.length > 0) {
            setTimeout(() => this.makeFirstComputerMoveForSetupLearning(), 500);
        }
    }

    // 摆棋学习：主参考分支 = 当前局面下仍满足条件（前缀匹配、未完成、顺序目标）的「PGN 序号 i 最小」的一条
    getSetupLearningPrimaryMatchingBranchRef() {
        if (!window.pgnParser || !window.pgnParser.branches || window.pgnParser.branches.length === 0) {
            return { branch: null, index: -1 };
        }
        const hist = this.game.history();
        const branches = window.pgnParser.branches;
        for (let i = 0; i < branches.length; i++) {
            const branch = branches[i];
            const branchId = branch.id || `branch_${i}`;
            if (this.setupLearningCompletedBranchIds.has(branchId)) {
                continue;
            }
            if (this.setupLearningTargetBranchIndex !== null && i !== this.setupLearningTargetBranchIndex) {
                continue;
            }
            let prefixOk = true;
            for (let j = 0; j < hist.length; j++) {
                if (j >= branch.moves.length || branch.moves[j] !== hist[j]) {
                    prefixOk = false;
                    break;
                }
            }
            if (!prefixOk) {
                continue;
            }
            return { branch, index: i };
        }
        return { branch: null, index: -1 };
    }

    // 摆棋学习：右侧棋谱滚动到「序号最小的匹配分支」区块，避免 scrollHeight 滚到最底下（最大编号）
    scrollSetupLearningNotationToPrimaryBranch() {
        if (!this.isSetupLearningMode) return;
        const container = document.getElementById('moveHistory');
        if (!container) return;
        const { index } = this.getSetupLearningPrimaryMatchingBranchRef();
        const el = index >= 0 ? document.getElementById(`branch-${index}`) : null;
        if (!el) {
            container.scrollTop = 0;
            return;
        }
        const cRect = container.getBoundingClientRect();
        const eRect = el.getBoundingClientRect();
        const margin = 8;
        const delta = eRect.top - cRect.top - margin;
        const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
        container.scrollTop = Math.max(0, Math.min(maxScroll, container.scrollTop + delta));
    }

    // 摆棋学习：沿「序号最小的匹配分支」后退一步
    setupLearningStepPrev() {
        if (!this.isSetupLearningMode) return;
        if (this.game.history().length === 0) {
            $('#errorToast').text('已在起始局面').css('background', '#6c757d').fadeIn().delay(2000).fadeOut().promise().done(() => {
                $('#errorToast').css('background', '#ff4444');
            });
            return;
        }
        this.game.undo();
        if (this.board) {
            this.board.position(this.game.fen());
        }
        this.recomputeSetupLearningAvailableAndHidden();
        this.showFullNotation();
        this.updateTurnIndicator();
    }

    // 摆棋学习：沿「序号最小的匹配分支」前进一步（与手动走子同一套校验）
    setupLearningStepNext() {
        if (!this.isSetupLearningMode) return;
        const { branch } = this.getSetupLearningPrimaryMatchingBranchRef();
        if (!branch) {
            $('#errorToast').text('没有可用的棋谱分支').css('background', '#dc3545').fadeIn().delay(2000).fadeOut().promise().done(() => {
                $('#errorToast').css('background', '#ff4444');
            });
            return;
        }
        const h = this.game.history();
        if (h.length >= branch.moves.length) {
            $('#errorToast').text('已在当前展示分支末尾').css('background', '#6c757d').fadeIn().delay(2000).fadeOut().promise().done(() => {
                $('#errorToast').css('background', '#ff4444');
            });
            return;
        }
        const nextSan = branch.moves[h.length];
        const move = this.game.move(nextSan);
        if (!move) {
            $('#errorToast').text('无法执行该步，请检查局面').css('background', '#dc3545').fadeIn().delay(2500).fadeOut().promise().done(() => {
                $('#errorToast').css('background', '#ff4444');
            });
            return;
        }
        if (this.board) {
            this.board.position(this.game.fen());
        }
        this.handleSetupLearningMove(move);
    }

    // 显示完整棋谱
    showFullNotation() {
        if (!window.pgnParser || !window.pgnParser.branches) {
            console.log('showFullNotation: 没有PGN数据');
            return;
        }

        console.log('showFullNotation: 开始显示棋谱');
        console.log('分支数量:', window.pgnParser.branches.length);
        console.log('当前模式: 摆棋学习=', this.isSetupLearningMode, '记忆学习=', this.isMemoryLearningMode);

        // 检测是否为移动端
        const isMobile = window.innerWidth <= 768;
        console.log('移动端检测:', isMobile, '屏幕宽度:', window.innerWidth);

        const moveHistoryElement = $('#moveHistory');

        let notationHTML = '<div style="margin-bottom: 15px;"><strong>📚 完整棋谱：</strong></div>';

        const currentHistory = this.game.history();
        console.log('当前走棋历史:', currentHistory);

        window.pgnParser.branches.forEach((branch, branchIndex) => {
            const branchId = branch.id || `branch_${branchIndex}`;
            const isHidden = this.setupLearningHiddenBranches.has(branchId);

            console.log(`分支 ${branchIndex + 1}:`, branch.moves, '隐藏状态:', isHidden);

            const mobileStyle = isMobile ? 'font-size: 12px; line-height: 1.4;' : '';

            let branchStyle = `margin-bottom: 10px; padding: 8px; border-radius: 4px; border-left: 4px solid; ${mobileStyle}`;
            let borderColor = '#dee2e6';
            let backgroundColor = '#f8f9fa';
            let opacity = '1';
            let statusText = '';

            if (isHidden) {
                borderColor = '#dc3545';
                backgroundColor = '#f8d7da';
                opacity = '0.6';
                statusText = ' (已隐藏)';
            }

            branchStyle += `background: ${backgroundColor}; border-left-color: ${borderColor}; opacity: ${opacity};`;

            notationHTML += `<div id="branch-${branchIndex}" style="${branchStyle}">`;

            notationHTML += `<strong>分支 ${branchIndex + 1}${statusText}:</strong> `;

            branch.moves.forEach((move, moveIndex) => {
                const moveId = `branch-${branchIndex}-move-${moveIndex}`;
                const isCurrentMove = moveIndex < currentHistory.length && currentHistory[moveIndex] === move;
                const isPastMove = moveIndex < currentHistory.length;

                let moveClass = '';
                if (isCurrentMove) {
                    moveClass = 'current-move';
                } else if (isPastMove) {
                    moveClass = 'past-move';
                }

                const moveStyle = isMobile ? 'font-size: 11px; padding: 2px 4px; margin: 1px; min-width: 35px; text-align: center;' : '';

                notationHTML += `<span id="${moveId}" class="chess-move ${moveClass}" style="${moveStyle}">${move}</span> `;
            });

            notationHTML += '</div>';
        });

        console.log('棋谱HTML生成完成，长度:', notationHTML.length);

        // 在走法历史区域显示棋谱
        if (moveHistoryElement.length > 0) {
            moveHistoryElement.html(notationHTML);
            console.log('棋谱已显示到moveHistory区域');
            
            // 验证分支显示状态
            const displayedBranches = moveHistoryElement.find('[id^="branch-"]');
            const hiddenBranches = this.setupLearningHiddenBranches.size;
            const totalBranches = window.pgnParser.branches.length;
            
            console.log('棋谱显示验证:');
            console.log('总分支数:', totalBranches);
            console.log('显示的分支数:', displayedBranches.length);
            console.log('隐藏分支数:', hiddenBranches);
            console.log('可用分支数:', this.availableBranches.length);
            
            if (displayedBranches.length !== totalBranches) {
                console.warn('警告：显示的分支数量与总分支数量不匹配');
            }

            if (hiddenBranches > 0 && this.isSetupLearningMode) {
                console.log('注意：摆棋学习下不匹配的走法会标为已隐藏；主参考线为序号最小的匹配分支');
            }
        } else {
            console.error('moveHistory元素未找到');
        }
        
        // 添加CSS样式
        this.addNotationStyles();
        
        // 高亮当前分支
        this.highlightCurrentBranchInNotation();
        
        // 如果是摆棋学习模式，显示可用分支信息
        if (this.isSetupLearningMode) {
            this.showSetupLearningBranchInfo();
        }
        
        console.log('showFullNotation: 完成');
    }
    
    // 显示摆棋学习的可用分支信息
    showSetupLearningBranchInfo() {
        // 不再显示分支信息，保持界面简洁
        console.log('showSetupLearningBranchInfo: 已禁用，不再显示分支信息');
        return;
    }

    // 添加棋谱显示的CSS样式
    addNotationStyles() {
        // 检查是否已经添加了样式
        if (document.getElementById('notation-styles')) {
            return;
        }
        
        const style = document.createElement('style');
        style.id = 'notation-styles';
        style.textContent = `
            .chess-move {
                padding: 2px 4px;
                margin: 0 1px;
                border-radius: 3px;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            .chess-move:hover {
                background: rgba(0, 123, 255, 0.1);
            }
            .chess-move.past-move {
                background: rgba(40, 167, 69, 0.2);
                color: #155724;
                font-weight: 500;
            }
            .chess-move.current-move {
                background: rgba(0, 123, 255, 0.3);
                color: #004085;
                font-weight: bold;
                box-shadow: 0 0 5px rgba(0, 123, 255, 0.5);
            }
            .branch-active {
                background: #e3f2fd !important;
                border-left: 4px solid #2196F3;
            }
        `;
        document.head.appendChild(style);
    }

    // 高亮当前分支在棋谱中的显示（摆棋学习：序号最小的匹配分支）
    highlightCurrentBranchInNotation() {
        if (!this.isSetupLearningMode) return;

        const { index: branchIndex } = this.getSetupLearningPrimaryMatchingBranchRef();

        document.querySelectorAll('[id^="branch-"]').forEach(element => {
            if (/^branch-\d+$/.test(element.id)) {
                element.classList.remove('branch-active');
            }
        });

        if (branchIndex >= 0) {
            const branchElement = document.getElementById(`branch-${branchIndex}`);
            if (branchElement) {
                branchElement.classList.add('branch-active');
            }
        }

        this.updateMoveHighlights();
        this.scrollSetupLearningNotationToPrimaryBranch();
    }

    // 更新招法高亮
    updateMoveHighlights() {
        const currentHistory = this.game.history();

        document.querySelectorAll('.chess-move').forEach(element => {
            element.classList.remove('past-move', 'current-move');
        });

        let primaryBranchIndex = -1;
        if (this.isSetupLearningMode) {
            primaryBranchIndex = this.getSetupLearningPrimaryMatchingBranchRef().index;
        }

        window.pgnParser.branches.forEach((branch, branchIndex) => {
            branch.moves.forEach((move, moveIndex) => {
                const moveElement = document.getElementById(`branch-${branchIndex}-move-${moveIndex}`);
                if (!moveElement) return;

                if (moveIndex < currentHistory.length) {
                    if (currentHistory[moveIndex] === move) {
                        if (
                            this.isSetupLearningMode &&
                            primaryBranchIndex >= 0 &&
                            branchIndex !== primaryBranchIndex
                        ) {
                            // 其它变线与主线着法相同：只用弱高亮，避免看起来像「最后一条分支」才是主线
                            moveElement.classList.add('past-move');
                        } else {
                            moveElement.classList.add('current-move');
                        }
                    } else {
                        moveElement.classList.add('past-move');
                    }
                }
            });
        });
    }

    // 隐藏棋谱显示
    hideNotation() {
        $('#moveHistory').empty();
    }

    // 高亮当前可走的棋子
    highlightCurrentPieces() {
        if (!this.isMemoryLearningMode) {
            return;
        }

        console.log('记忆学习模式：开始高亮可走棋子');
        
        // 获取当前局面的所有合法走法
        const moves = this.game.moves({ verbose: true });
        const piecePositions = new Set();

        // 获取当前历史
        const currentHistory = this.game.history();
        console.log('当前历史:', currentHistory);
        
        // 在所有分支中查找匹配当前历史的分支
        for (const branch of window.pgnParser.branches) {
            const branchId = branch.id || `branch_${window.pgnParser.branches.indexOf(branch)}`;
            
            // 跳过已完成和暂停的分支
            if (this.memoryCompletedBranches.has(branchId) || (this.memoryPausedBranches && this.memoryPausedBranches.has(branchId))) {
                continue;
            }
            
            // 检查历史是否匹配
            let isMatch = true;
            for (let i = 0; i < currentHistory.length; i++) {
                if (i >= branch.moves.length || branch.moves[i] !== currentHistory[i]) {
                    isMatch = false;
                    break;
                }
            }
            
            // 如果匹配，添加下一步可以走的棋子位置
            if (isMatch && currentHistory.length < branch.moves.length) {
                const nextMove = branch.moves[currentHistory.length];
                if (nextMove) {
                    console.log('找到匹配分支，下一步走法:', nextMove);
                    // 找到能够走出这个招法的棋子位置
                    for (const move of moves) {
                        if (move.san === nextMove) {
                            piecePositions.add(move.from);
                            console.log('高亮棋子位置:', move.from, '招法:', move.san);
                            break;
                        }
                    }
                }
            }
        }

        console.log('需要高亮的棋子位置:', Array.from(piecePositions));
        
        // 高亮可移动的棋子
        piecePositions.forEach(square => {
            this.highlightSquareNew(square, 'highlight-possible');
        });
    }

    // 高亮指定方格（新版本）
    highlightSquareNew(square, className) {
        if (!this.board) return;

        // 使用现有的highlightSquare函数，但需要转换类名
        let type = 'selected';
        if (className === 'highlight-possible') {
            type = 'possible';
        } else if (className === 'highlight-capture') {
            type = 'capture';
        }
        
        this.highlightSquare(square, type);
    }

    // 清除所有高亮（新版本）
    clearHighlightsNew() {
        if (!this.board) return;

        // 使用现有的clearHighlights函数
        this.clearHighlights();
    }

    // 检查移动是否在棋谱中
    isMoveInNotation(move) {
        if (!window.pgnParser || !window.pgnParser.branches) {
            return false;
        }

        const currentHistory = this.game.history();
        const moveIndex = currentHistory.length - 1; // 当前移动的索引

        // 检查是否有任何分支包含这个移动
        for (const branch of window.pgnParser.branches) {
            if (moveIndex < branch.moves.length && branch.moves[moveIndex] === move.san) {
                return true;
            }
        }

        return false;
    }

    // 检查是否有任何分支完成
    isAnyBranchCompleted() {
        if (!window.pgnParser || !window.pgnParser.branches) {
            return false;
        }

        const currentHistory = this.game.history();
        
        for (const branch of window.pgnParser.branches) {
            if (currentHistory.length === branch.moves.length) {
                // 检查历史是否匹配
                let isMatch = true;
                for (let i = 0; i < currentHistory.length; i++) {
                    if (currentHistory[i] !== branch.moves[i]) {
                        isMatch = false;
                        break;
                    }
                }
                if (isMatch) {
                    return true;
                }
            }
        }

        return false;
    }

    // 摆棋学习模式分支完成处理
    onSetupLearningBranchCompleted() {
        console.log('摆棋学习模式：分支完成处理开始');
        
        // 找到完成的分支信息
        const currentHistory = this.game.history();
        let completedBranchIndex = -1;
        let completedBranch = null;
        
        console.log('当前走棋历史:', currentHistory);
        console.log('当前历史长度:', currentHistory.length);
        
        // 在所有分支中查找完成的分支
        for (let i = 0; i < window.pgnParser.branches.length; i++) {
            const branch = window.pgnParser.branches[i];
            console.log(`检查分支 ${i + 1}: 长度=${branch.moves.length}, 招法=${branch.moves.join(' ')}`);
            
            if (currentHistory.length === branch.moves.length) {
                let isMatch = true;
                for (let j = 0; j < currentHistory.length; j++) {
                    if (currentHistory[j] !== branch.moves[j]) {
                        isMatch = false;
                        console.log(`分支 ${i + 1} 第 ${j + 1} 步不匹配: 历史=${currentHistory[j]}, 分支=${branch.moves[j]}`);
                        break;
                    }
                }
                if (isMatch) {
                    completedBranchIndex = i;
                    completedBranch = branch;
                    console.log(`找到完成的分支 ${i + 1}: ${branch.moves.join(' ')}`);
                    break;
                }
            }
        }
        
        if (!completedBranch) {
            console.warn('警告：没有找到完成的分支，但函数被调用了');
            return;
        }
        
        const message = `🎉 分支 ${completedBranchIndex + 1} 完成！`;
        console.log('分支完成消息:', message);
        $('#errorToast').text(message).css('background', '#9C27B0').fadeIn().delay(1200).fadeOut().promise().done(() => {
            $('#errorToast').css('background', '#ff4444');
        });

        console.log('摆棋学习模式：分支完成，自动进入下一分支');
        setTimeout(() => {
            this.setupLearningAdvanceToNextBranch(completedBranchIndex);
        }, 1300);
    }

    // 查找两个分支的公共部分
    findCommonPrefix(branch1, branch2) {
        if (!branch1 || !branch2 || !branch1.moves || !branch2.moves) {
            return [];
        }
        
        const commonMoves = [];
        const minLength = Math.min(branch1.moves.length, branch2.moves.length);
        
        for (let i = 0; i < minLength; i++) {
            if (branch1.moves[i] === branch2.moves[i]) {
                commonMoves.push(branch1.moves[i]);
            } else {
                break;
            }
        }
        
        return commonMoves;
    }
    
    // 找到下一个可用分支
    findNextAvailableBranch(currentBranch) {
        if (!currentBranch || !window.pgnParser || !window.pgnParser.branches) {
            return null;
        }
        
        const currentBranchId = currentBranch.id;
        const allBranches = window.pgnParser.branches;
        
        // 找到下一个未完成且未暂停的分支
        for (const branch of allBranches) {
            const branchId = branch.id || `branch_${allBranches.indexOf(branch)}`;
            
            // 跳过当前分支
            if (branchId === currentBranchId) {
                continue;
            }
            
            // 跳过已完成和暂停的分支
            if (this.memoryCompletedBranches.has(branchId) || 
                (this.memoryPausedBranches && this.memoryPausedBranches.has(branchId))) {
                continue;
            }
            
            return branch;
        }
        
        return null;
    }
    
    // 从指定步数开始设置棋盘位置
    resetToPosition(commonMoves, nextBranch) {
        // 清除选择状态
        this.deselectSquare();
        
        // 重置到初始位置
        this.game.reset();
        if (this.board) {
            this.board.position('start');
        }
        
        // 清空历史显示
        $('#moveHistory').empty();
        
        // 如果commonMoves为空，直接返回
        if (!commonMoves || commonMoves.length === 0) {
            this.currentBranch = null;
            this.errorCount = 0;
            this.updateTurnIndicator();
            this.updateAvailableBranches();
            this.highlightCurrentPieces();
            return;
        }
        
        // 使用nextBranch来执行公共部分的步数
        if (nextBranch && nextBranch.moves.length >= commonMoves.length) {
            // 执行公共部分的所有步数
            for (let i = 0; i < commonMoves.length; i++) {
                try {
                    const move = this.game.move(commonMoves[i]);
                    if (!move) {
                        console.error('无法执行移动:', commonMoves[i]);
                        break;
                    }
                } catch (e) {
                    console.error('执行移动时出错:', e);
                    break;
                }
            }
            
            // 更新棋盘显示
            if (this.board) {
                this.board.position(this.game.fen());
            }
            
            // 更新当前分支为下一个分支
            this.currentBranch = nextBranch;
            this.errorCount = 0;
            
            // 根据游戏历史更新显示
            const history = this.game.history();
            $('#moveHistory').empty();
            for (let i = 0; i < history.length; i++) {
                const moveNumber = Math.ceil((i + 1) / 2);
                const isWhiteMove = (i + 1) % 2 === 1;
                let moveText = '';
                if (isWhiteMove) {
                    moveText = `${moveNumber}. ${history[i]}`;
                } else {
                    moveText = ` ${history[i]}`;
                }
                $('#moveHistory').append(`<span class="move-pair">${moveText}</span>`);
            }
            
            this.updateTurnIndicator();
            this.updateAvailableBranches();
            
            // 如果用户是黑方视角，且当前轮到白方走棋，需要自动走白方的下一步
            // 如果用户是白方视角，且当前轮到黑方走棋，需要自动走黑方的下一步
            if (this.isMemoryLearningMode) {
                const currentTurn = this.game.turn();
                const nextMoveIndex = commonMoves.length;
                
                if (this.orientation === 'black' && currentTurn === 'w') {
                    // 黑方视角：轮到白方走棋，需要自动走下一步
                    if (nextBranch.moves.length > nextMoveIndex) {
                        const nextMove = nextBranch.moves[nextMoveIndex];
                        console.log('从公共部分开始：黑方视角，自动走白方下一步:', nextMove);
                        
                        // 延迟执行，确保UI更新完成
                        setTimeout(() => {
                            const move = this.game.move(nextMove);
                            if (move) {
                                if (this.board) {
                                    this.board.position(this.game.fen());
                                }
                                
                                // 清除高亮状态（电脑移动了）
                                this.clearHighlightsNew();
                                
                                this.updateMoveHistory(move);
                                this.updateTurnIndicator();
                                this.updateAvailableBranches();
                                
                                // 重新高亮可走棋子
                                setTimeout(() => this.highlightCurrentPieces(), 100);
                                
                                // 显示提示信息
                                const message = `电脑选择了走法: ${nextMove}。现在轮到您走棋了！`;
                                $('#errorToast').text(message).css('background', '#17a2b8').fadeIn().delay(2000).fadeOut().promise().done(() => {
                                    $('#errorToast').css('background', '#ff4444');
                                });
                            }
                        }, 500);
                    } else {
                        // 没有下一步了，直接高亮
                        this.highlightCurrentPieces();
                    }
                } else if (this.orientation === 'white' && currentTurn === 'b') {
                    // 白方视角：轮到黑方走棋，需要自动走下一步
                    if (nextBranch.moves.length > nextMoveIndex) {
                        const nextMove = nextBranch.moves[nextMoveIndex];
                        console.log('从公共部分开始：白方视角，自动走黑方下一步:', nextMove);
                        
                        // 延迟执行，确保UI更新完成
                        setTimeout(() => {
                            const move = this.game.move(nextMove);
                            if (move) {
                                if (this.board) {
                                    this.board.position(this.game.fen());
                                }
                                
                                // 清除高亮状态（电脑移动了）
                                this.clearHighlightsNew();
                                
                                this.updateMoveHistory(move);
                                this.updateTurnIndicator();
                                this.updateAvailableBranches();
                                
                                // 重新高亮可走棋子
                                setTimeout(() => this.highlightCurrentPieces(), 100);
                                
                                // 显示提示信息
                                const message = `电脑选择了走法: ${nextMove}。现在轮到您走棋了！`;
                                $('#errorToast').text(message).css('background', '#17a2b8').fadeIn().delay(2000).fadeOut().promise().done(() => {
                                    $('#errorToast').css('background', '#ff4444');
                                });
                            }
                        }, 500);
                    } else {
                        // 没有下一步了，直接高亮
                        this.highlightCurrentPieces();
                    }
                } else {
                    // 轮到用户走棋，直接高亮
                    this.highlightCurrentPieces();
                }
            } else {
                // 非记忆学习模式，直接高亮
                this.highlightCurrentPieces();
            }
        } else {
            // 如果无法找到合适的分支，回到初始位置
            this.currentBranch = null;
            this.errorCount = 0;
            this.updateTurnIndicator();
            this.updateAvailableBranches();
            
            // 如果用户是黑方视角，需要自动走第一步
            if (this.orientation === 'black' && this.isMemoryLearningMode && this.availableBranches.length > 0) {
                setTimeout(() => this.makeFirstComputerMoveForMemoryLearning(), 500);
            } else {
                this.highlightCurrentPieces();
            }
        }
    }

    // 记忆学习模式分支完成处理
    onMemoryLearningBranchCompleted() {
        // 找到完成的分支信息
        const currentHistory = this.game.history();
        let completedBranchIndex = -1;
        let completedBranch = null;
        
        console.log('记忆学习分支完成检测，当前历史:', currentHistory);
        console.log('当前分支:', this.currentBranch);
        
        // 首先检查当前分支是否完成
        if (this.currentBranch && currentHistory.length === this.currentBranch.moves.length) {
            // 验证历史是否匹配
            let isMatch = true;
            for (let j = 0; j < currentHistory.length; j++) {
                if (currentHistory[j] !== this.currentBranch.moves[j]) {
                    isMatch = false;
                    break;
                }
            }
            
            if (isMatch) {
                // 找到对应的分支索引
                for (let i = 0; i < window.pgnParser.branches.length; i++) {
                    if (window.pgnParser.branches[i].id === this.currentBranch.id) {
                        completedBranchIndex = i;
                        completedBranch = this.currentBranch;
                        break;
                    }
                }
            }
        }
        
        // 如果当前分支没有完成，尝试在所有分支中查找
        if (!completedBranch) {
            for (let i = 0; i < window.pgnParser.branches.length; i++) {
                const branch = window.pgnParser.branches[i];
                if (currentHistory.length === branch.moves.length) {
                    let isMatch = true;
                    for (let j = 0; j < currentHistory.length; j++) {
                        if (currentHistory[j] !== branch.moves[j]) {
                            isMatch = false;
                            break;
                        }
                    }
                    if (isMatch) {
                        completedBranchIndex = i;
                        completedBranch = branch;
                        break;
                    }
                }
            }
        }
        
        console.log('找到完成的分支:', completedBranch, '索引:', completedBranchIndex);
        
        if (completedBranch) {
            const branchId = completedBranch.id || `branch_${completedBranchIndex}`;
            
            console.log('=== 记忆学习分支完成处理开始 ===');
            console.log('完成的分支ID:', branchId);
            console.log('分支索引:', completedBranchIndex);
            console.log('错误计数:', this.errorCount);
            console.log('当前记忆学习已完成分支数量:', this.memoryCompletedBranches.size);
            console.log('当前记忆学习暂停分支数量:', this.memoryPausedBranches ? this.memoryPausedBranches.size : 0);
            
            // 检查是否有错误 - 使用记忆学习分支级别的错误计数
            const branchErrors = this.memoryBranchErrorCounts.get(branchId) || 0;
            if (branchErrors > 0) {
                // 有错误，标记为暂停
                this.memoryPausedBranches.add(branchId);
                console.log(`记忆学习分支标记为暂停（有${branchErrors}次错误）:`, branchId);
                const message = `⏸️ 分支 ${completedBranchIndex + 1} 记忆完成但中间有${branchErrors}次错误，已标记为暂停。`;
                $('#errorToast').text(message).css('background', '#FF5722').fadeIn().delay(4000).fadeOut().promise().done(() => {
                    $('#errorToast').css('background', '#ff4444');
                });
            } else {
                // 无错误，标记为完成
                this.memoryCompletedBranches.add(branchId);
                console.log('记忆学习分支标记为完成（无错误）:', branchId);
                console.log('更新后记忆学习已完成分支数量:', this.memoryCompletedBranches.size);
                const message = `✅ 分支 ${completedBranchIndex + 1} 完美完成！`;
                $('#errorToast').text(message).css('background', '#28a745').fadeIn().delay(4000).fadeOut().promise().done(() => {
                    $('#errorToast').css('background', '#ff4444');
                });
            }
            
            // 显示记忆学习的当前正确率
            const memoryAccuracy = this.memoryTotalMoves > 0 ? Math.round((this.memoryCorrectMoves / this.memoryTotalMoves) * 100) : 0;
            const accuracyMessage = `记忆学习正确率：${this.memoryCorrectMoves}/${this.memoryTotalMoves} (${memoryAccuracy}%)`;
            console.log(accuracyMessage);
            
            console.log('开始更新UI显示...');
            
            // 更新分支名称显示
            this.updateBranchNamesDisplay();
            console.log('分支名称显示已更新');
            
            // 更新进度显示
            this.updateProgress();
            console.log('进度显示已更新');
            
            // 保存分支状态到持久化存储
            this.saveBranchStateToStorage(branchId, branchErrors > 0 ? 'paused' : 'completed');
            console.log('分支状态已保存到持久化存储');
            
            console.log('=== 分支完成处理结束 ===');
        }
        
        // 延迟后准备下一个分支
        setTimeout(() => {
            if (this.startFromCommon && completedBranch) {
                // 如果启用了"从公共部分开始"选项
                const nextBranch = this.findNextAvailableBranch(completedBranch);
                
                if (nextBranch) {
                    // 找到两个分支的公共部分
                    const commonMoves = this.findCommonPrefix(completedBranch, nextBranch);
                    console.log('找到公共部分，步数:', commonMoves.length);
                    console.log('公共部分:', commonMoves);
                    
                    if (commonMoves.length > 0) {
                        // 从公共部分的最后一步开始（即公共部分的长度）
                        console.log('从公共部分开始，步数:', commonMoves.length);
                        this.resetToPosition(commonMoves, nextBranch);
                    } else {
                        // 没有公共部分，从初始位置开始
                        console.log('没有公共部分，从初始位置开始');
                        this.resetPosition(true);
                        this.highlightCurrentPieces();
                    }
                } else {
                    // 没有下一个分支，回到初始位置
                    console.log('没有下一个可用分支，回到初始位置');
                    this.resetPosition(true);
                    this.highlightCurrentPieces();
                }
            } else {
                // 未启用"从公共部分开始"选项，正常回到初始位置
                this.resetPosition(true);
                this.highlightCurrentPieces();
            }
        }, 3000);
    }

    // 显示记忆学习模式的错误提示
    showMemoryLearningError() {
        // 注意：错误计数器已经在handleMemoryLearningMove中增加了，这里不需要重复增加
        // this.errorCount++; // 删除这行，避免重复计数
        
        let errorMessage = `您走错了！这是第${this.errorCount}次错误。`;
        
        // 错误2次后提示正确走法
        if (this.errorCount >= 2) {
            // 获取按照棋谱的下一步招法
            const nextMoves = this.getNextPossibleMoves();
            if (nextMoves.length > 0) {
                if (nextMoves.length === 1) {
                    errorMessage += ` 下一步应该走: ${nextMoves[0]}`;
                } else {
                    errorMessage += ` 下一步可以走: ${nextMoves.join(', ')}`;
                }
            } else {
                // 如果没有找到下一步招法，使用原来的方法
                const possibleMoves = this.getPossibleMoves();
                if (possibleMoves.length > 0) {
                    errorMessage += ` 正确走法有: ${possibleMoves.join(', ')}`;
                }
            }
            // 重置错误计数器
            this.errorCount = 0;
        } else {
            errorMessage += ` 再错${2 - this.errorCount}次将提示正确走法。`;
        }
        
        $('#errorToast').text(errorMessage).css('background', '#FF5722').fadeIn().delay(4000).fadeOut().promise().done(() => {
            $('#errorToast').css('background', '#ff4444');
        });
    }

    // 摆棋学习模式的电脑先走
    makeFirstComputerMoveForSetupLearning() {
        if (!this.isSetupLearningMode || !window.pgnParser || !window.pgnParser.branches) return;
        
        // 获取第一手可能的走法（仅当前可用的未完成分支）
        const firstMoves = new Set();
        const sourceBranches =
            this.availableBranches && this.availableBranches.length > 0
                ? this.availableBranches
                : window.pgnParser.branches;
        for (const branch of sourceBranches) {
            if (branch.moves.length > 0) {
                firstMoves.add(branch.moves[0]);
            }
        }
        
        // 随机选择一个第一手走法
        const firstMoveArray = Array.from(firstMoves);
        if (firstMoveArray.length > 0) {
            const randomFirstMove = firstMoveArray[Math.floor(Math.random() * firstMoveArray.length)];
            
            // 执行走棋
            const move = this.game.move(randomFirstMove);
            if (move) {
                if (this.board) {
                    this.board.position(this.game.fen()); // 更新棋盘位置
                }

                this.recomputeSetupLearningAvailableAndHidden();

                // 更新走法历史（摆棋学习内会重绘棋谱）
                this.updateMoveHistory(move);
                this.updateTurnIndicator();
                
                // 显示提示信息
                const message = `电脑选择了走法: ${randomFirstMove}。现在轮到您走棋了！`;
                $('#errorToast').text(message).css('background', '#17a2b8').fadeIn().delay(3000).fadeOut().promise().done(() => {
                    $('#errorToast').css('background', '#ff4444');
                });
            }
        }
    }

    // 显示所有分支名称
    showBranchNames() {
        if (!window.pgnParser || !window.pgnParser.branches) {
            return;
        }

        let branchNamesHTML = '<div style="margin-bottom: 15px;"><strong>🌿 分支列表：</strong></div>';
        
        window.pgnParser.branches.forEach((branch, index) => {
            const branchId = branch.id || `branch_${index}`;
            let statusIcon = '⏳'; // 默认：待学习
            let statusText = '待学习';
            
            if (this.isMemoryLearningMode) {
                // 记忆学习模式：使用记忆学习独立的状态集合
                if (this.memoryCompletedBranches.has(branchId)) {
                    statusIcon = '✅';
                    statusText = '完美完成';
                } else if (this.memoryPausedBranches.has(branchId)) {
                    statusIcon = '⏸️';
                    statusText = '记忆完成但中间有错误';
                }
            } else {
                // 背诵学习模式：使用背诵学习的状态集合
                if (this.completedBranches.has(branchId)) {
                    statusIcon = '✅';
                    statusText = '已完成';
                }
            }
            
            branchNamesHTML += `<div class="branch-item" data-branch-id="${branchId}">`;
            branchNamesHTML += `<span class="status-icon">${statusIcon}</span> `;
            branchNamesHTML += `<span class="branch-name">分支 ${index + 1}</span>`;
            branchNamesHTML += `<span class="status-text">${statusText}</span>`;
            branchNamesHTML += '</div>';
        });

        $('#branchNames').html(branchNamesHTML).show();
        
        // 添加分支名称样式
        this.addBranchNamesStyles();
        
        // 如果是记忆学习模式，更新视角信息
        if (this.isMemoryLearningMode) {
            this.updateBranchNamesWithPerspective();
        }
    }

    // 添加分支名称显示的CSS样式
    addBranchNamesStyles() {
        // 检查是否已经添加了样式
        if (document.getElementById('branch-names-styles')) {
            return;
        }
        
        const style = document.createElement('style');
        style.id = 'branch-names-styles';
        style.textContent = `
            .branch-name-item {
                transition: all 0.3s ease;
            }
            .branch-name-item.branch-completed {
                background: #d4edda !important;
                border-left-color: #28a745 !important;
                color: #155724;
            }
            .branch-name-item.branch-paused {
                background: #fff3cd !important;
                border-left-color: #ffc107 !important;
                color: #856404;
            }
            .branch-name-item.branch-pending {
                background: #f8f9fa !important;
                border-left-color: #6c757d !important;
                color: #495057;
            }
        `;
        document.head.appendChild(style);
    }

    // 更新分支名称显示
    updateBranchNamesDisplay() {
        if (this.isMemoryLearningMode) {
            console.log('更新分支名称显示 - 记忆学习模式');
            console.log('当前已完成分支:', Array.from(this.completedBranches));
            console.log('当前暂停分支:', Array.from(this.pausedBranches));
            
            this.showBranchNames();
            // 注意：showBranchNames已经包含了updateBranchNamesWithPerspective的调用
            
            console.log('分支名称显示更新完成');
        }
    }

    // 记忆学习模式下的电脑首步走棋
    makeFirstComputerMoveForMemoryLearning() {
        if (!this.isMemoryLearningMode || this.availableBranches.length === 0) {
            console.log('记忆学习模式：无法进行电脑首步走棋 - 模式不匹配或无可用分支');
            return;
        }
        
        // 检查是否所有分支都已完成或暂停（记忆学习模式使用记忆学习的状态集合）
        const totalBranches = window.pgnParser.branches.length;
        const completedAndPausedCount = this.memoryCompletedBranches.size + (this.memoryPausedBranches ? this.memoryPausedBranches.size : 0);
        
        if (completedAndPausedCount >= totalBranches) {
            console.log('记忆学习模式：所有分支都已完成或暂停，电脑不再自动走棋');
            // 显示完成提示
            const message = '🎉 恭喜！您已记忆完所有分支！';
            $('#errorToast').text(message).css('background', '#28a745').fadeIn().delay(4000).fadeOut().promise().done(() => {
                $('#errorToast').css('background', '#ff4444');
            });
            return;
        }
        
        console.log('记忆学习模式：电脑首步走棋，可用分支:', this.availableBranches);
        console.log(`分支状态：总计${totalBranches}，已完成${this.memoryCompletedBranches.size}，暂停${this.memoryPausedBranches ? this.memoryPausedBranches.size : 0}`);
        
        // 获取第一手可能的走法和对应的分支
        const firstMoveOptions = new Map(); // 走法 -> 对应的分支数组
        
        for (const branch of this.availableBranches) {
            if (branch.moves.length > 0) {
                const firstMove = branch.moves[0];
                if (!firstMoveOptions.has(firstMove)) {
                    firstMoveOptions.set(firstMove, []);
                }
                firstMoveOptions.get(firstMove).push(branch);
            }
        }
        
        // 随机选择一个走法
        if (firstMoveOptions.size > 0) {
            const moves = Array.from(firstMoveOptions.keys());
            const randomMove = moves[Math.floor(Math.random() * moves.length)];
            const correspondingBranches = firstMoveOptions.get(randomMove);
            
            // 选择第一个对应的分支
            const selectedBranch = correspondingBranches[0];
            
            console.log('电脑选择走法:', randomMove, '对应分支:', selectedBranch);
            
            // 设置当前分支
            this.currentBranch = selectedBranch;
            
            // 执行走棋
            const move = this.game.move(randomMove);
            if (move) {
                if (this.board) {
                    this.board.position(this.game.fen()); // 更新棋盘位置
                }
                
                // 清除高亮状态（电脑移动了）
                this.clearHighlightsNew();
                
                this.updateMoveHistory(move);
                this.updateTurnIndicator();
                this.updateAvailableBranches();
                
                // 重新高亮可走棋子
                setTimeout(() => this.highlightCurrentPieces(), 100);
                
                // 显示提示信息
                const message = `电脑选择了走法: ${randomMove}。现在轮到您走棋了！`;
                $('#errorToast').text(message).css('background', '#17a2b8').fadeIn().delay(2000).fadeOut().promise().done(() => {
                    $('#errorToast').css('background', '#ff4444');
                });
            }
        }
    }

    // 检查用户视角并进行相应设置
    checkUserPerspective() {
        console.log('=== 检查用户视角 ===');
        console.log('当前视角:', this.orientation);
        console.log('可用分支数量:', this.availableBranches.length);
        console.log('已完成分支:', Array.from(this.completedBranches));
        console.log('暂停分支:', Array.from(this.pausedBranches));
        
        if (this.orientation === 'white') {
            // 白方视角：用户先走，不需要电脑先走
            console.log('⚪ 用户选择白方，等待用户先走棋');
            console.log('设置当前分支为空，等待用户走棋后自动匹配');
            // 确保当前分支为空，等待用户走棋后自动匹配
            this.currentBranch = null;
        } else {
            // 黑方视角：电脑先走白方棋
            console.log('⚫ 用户选择黑方，电脑将先走白方棋');
            // 检查是否有可用分支
            if (this.availableBranches.length > 0) {
                console.log('准备电脑首步走棋，可用分支:', this.availableBranches.map(b => b.id || '未命名'));
                // 电脑首步走棋会在resetPosition中自动调用
            } else {
                console.log('⚠️ 没有可用分支，无法进行记忆学习');
            }
        }
        
        console.log('=== 视角检查完成 ===');
        
        // 更新分支名称显示，根据视角显示不同信息
        this.updateBranchNamesWithPerspective();
    }

    // 根据用户视角更新分支名称显示
    updateBranchNamesWithPerspective() {
        if (!this.isMemoryLearningMode) return;
        
        console.log('更新分支名称显示，当前视角:', this.orientation);
        
        // 只在白方视角下显示提示信息
        let perspectiveInfo = '';
        if (this.orientation === 'white') {
            perspectiveInfo = '<div style="margin-bottom: 15px; padding: 8px; background: #e3f2fd; border-radius: 4px; border-left: 4px solid #2196F3;"><strong>⚪ 白方视角：</strong>您先走棋，系统将根据您的走法自动匹配分支</div>';
        }
        // 黑方视角不显示提示信息
        
        // 在分支名称前插入视角信息（如果有的话）
        const branchNamesDiv = $('#branchNames');
        if (branchNamesDiv.length > 0 && perspectiveInfo) {
            const currentContent = branchNamesDiv.html();
            // 在第一个div之前插入视角信息
            const updatedContent = perspectiveInfo + currentContent;
            branchNamesDiv.html(updatedContent);
            console.log('视角信息已添加到分支名称显示');
        } else if (branchNamesDiv.length > 0) {
            console.log('黑方视角，不显示视角提示信息');
        } else {
            console.log('⚠️ 分支名称区域未找到，无法添加视角信息');
        }
    }

    // 保存分支状态到持久化存储
    saveBranchStateToStorage(branchId, status) {
        try {
            // 尝试保存到后端数据库
            if (window.chessAPI && window.chessAPI.isBackendAvailable && window.pgnParser?.metadata?.id) {
                this.saveBranchStateToBackend(branchId, status);
            }
            
            // 同时保存到本地存储作为备份
            this.saveBranchStateToLocalStorage(branchId, status);
            
            console.log(`分支状态已保存: ${branchId} -> ${status}`);
        } catch (error) {
            console.error('保存分支状态失败:', error);
        }
    }

    // 保存分支状态到后端数据库
    async saveBranchStateToBackend(branchId, status) {
        try {
            const response = await fetch(`${window.chessAPI.baseURL}/progress/branch-state`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    pgn_game_id: window.pgnParser.metadata.id,
                    branch_id: branchId,
                    status: status,
                    mode: 'memory_learning'
                })
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    console.log('分支状态已保存到后端:', result.message);
                } else {
                    console.warn('后端保存分支状态失败:', result.message);
                }
            } else {
                console.warn('后端保存分支状态HTTP错误:', response.status);
            }
        } catch (error) {
            console.error('后端保存分支状态网络错误:', error);
        }
    }

    // 保存分支状态到本地存储
    saveBranchStateToLocalStorage(branchId, status) {
        try {
            const storageKey = `memory_learning_${window.pgnParser?.metadata?.id || 'unknown'}`;
            let storedData = localStorage.getItem(storageKey);
            let branchStates = {};
            
            if (storedData) {
                try {
                    branchStates = JSON.parse(storedData);
                } catch (e) {
                    console.warn('解析本地存储数据失败，重置为空对象');
                    branchStates = {};
                }
            }
            
            // 更新分支状态
            branchStates[branchId] = {
                status: status,
                timestamp: Date.now(),
                mode: 'memory_learning'
            };
            
            // 保存到本地存储
            localStorage.setItem(storageKey, JSON.stringify(branchStates));
            console.log('分支状态已保存到本地存储:', branchId, status);
        } catch (error) {
            console.error('本地存储分支状态失败:', error);
        }
    }

    // 从持久化存储恢复记忆学习的分支状态
    restoreBranchStatesFromStorage() {
        try {
            const storageKey = `memory_learning_${window.pgnParser?.metadata?.id || 'unknown'}`;
            let storedData = localStorage.getItem(storageKey);
            let branchStates = {};
            
            if (storedData) {
                try {
                    branchStates = JSON.parse(storedData);
                } catch (e) {
                    console.warn('解析本地存储数据失败，重置为空对象');
                    branchStates = {};
                }
            }
            
            console.log('从持久化存储恢复分支状态:', branchStates);
            
            // 遍历分支状态，恢复分支
            for (const branchId in branchStates) {
                const branchState = branchStates[branchId];
                if (branchState.mode === 'memory_learning') {
                    if (branchState.status === 'completed') {
                        this.memoryCompletedBranches.add(branchId);
                        console.log(`恢复记忆学习已完成分支: ${branchId}`);
                    } else if (branchState.status === 'paused') {
                        this.memoryPausedBranches.add(branchId);
                        console.log(`恢复记忆学习暂停分支: ${branchId}`);
                    }
                }
            }
            
            console.log('恢复完成后的记忆学习分支状态:');
            console.log('- 已完成分支:', Array.from(this.memoryCompletedBranches));
            console.log('- 暂停分支:', Array.from(this.memoryPausedBranches));
            
        } catch (error) {
            console.error('从本地存储恢复分支状态失败:', error);
        }
    }

    // 清理本地存储的分支状态
    clearBranchStatesFromStorage() {
        localStorage.removeItem(`memory_learning_${window.pgnParser?.metadata?.id || 'unknown'}`);
        console.log('本地存储的分支状态已清理');
    }
    
    // 通用的记忆学习进度清理函数
    clearAllMemoryLearningProgress() {
        try {
            if (!window.pgnParser?.metadata?.id) {
                console.log('没有PGN数据，无法清理记忆学习进度');
                return;
            }
            
            const pgnId = window.pgnParser.metadata.id;
            const pgnFilename = window.pgnParser.metadata.filename || pgnId;
            
            console.log('开始清理记忆学习进度...');
            console.log('PGN ID:', pgnId);
            console.log('PGN 文件名:', pgnFilename);
            
            // 清理所有可能的记忆学习进度存储
            const allKeys = Object.keys(localStorage);
            const memoryLearningKeys = allKeys.filter(key => 
                key.startsWith('memory_learning_') && 
                (key.includes(pgnId.toString()) || key.includes(pgnFilename))
            );
            
            console.log('找到的记忆学习进度存储键:', memoryLearningKeys);
            
            memoryLearningKeys.forEach(key => {
                localStorage.removeItem(key);
                console.log(`已清理: ${key}`);
            });
            
            // 清空当前的分支状态
            this.memoryCompletedBranches.clear();
            this.memoryPausedBranches.clear();
            this.memoryBranchErrorCounts.clear();
            
            console.log(`记忆学习进度清理完成，共清理了 ${memoryLearningKeys.length} 个存储项`);
            
            // 更新UI显示
            this.updateProgress();
            this.updateBranchNamesDisplay();
            
        } catch (error) {
            console.error('清理记忆学习进度失败:', error);
        }
    }

    // 强制刷新棋谱显示（用于移动端显示问题）
    forceRefreshNotation() {
        console.log('forceRefreshNotation: 强制刷新棋谱显示');
        
        if (!window.pgnParser || !window.pgnParser.branches) {
            console.log('没有PGN数据，无法刷新棋谱');
            return;
        }
        
        // 清空现有内容
        const moveHistoryElement = $('#moveHistory');
        if (moveHistoryElement.length > 0) {
            moveHistoryElement.empty();
            console.log('已清空moveHistory区域');
        }
        
        // 重新显示棋谱
        if (this.isSetupLearningMode) {
            console.log('摆棋学习模式：重新显示完整棋谱');
            this.showFullNotation();
        } else if (this.isMemoryLearningMode) {
            console.log('记忆学习模式：重新显示分支名称');
            this.showBranchNames();
        }
        
        // 添加CSS样式
        this.addNotationStyles();
        
        console.log('棋谱显示强制刷新完成');
    }

    // 手动重置摆棋学习的分支隐藏状态（用于测试和调试）
    resetSetupLearningHiddenBranches() {
        console.log('resetSetupLearningHiddenBranches: 重置摆棋学习的分支隐藏状态');
        
        const hiddenCount = this.setupLearningHiddenBranches.size;
        this.setupLearningHiddenBranches.clear();
        
        console.log(`已重置 ${hiddenCount} 个隐藏分支`);
        
        // 重新显示棋谱
        if (this.isSetupLearningMode) {
            this.showFullNotation();
            this.showSetupLearningBranchInfo();
        }
        
        // 显示提示
        if (hiddenCount > 0) {
            const message = `已重置 ${hiddenCount} 个隐藏分支，所有分支现在都可用。`;
            $('#errorToast').text(message).css('background', '#28a745').fadeIn().delay(3000).fadeOut().promise().done(() => {
                $('#errorToast').css('background', '#ff4444');
            });
        }
        
        return hiddenCount;
    }

    // 检查当前是否有分支完成
    checkForCompletedBranches() {
        if (!window.pgnParser || !window.pgnParser.branches) {
            return null;
        }
        
        const currentHistory = this.game.history();
        if (currentHistory.length === 0) {
            return null;
        }
        
        // 检查是否有分支完成
        for (let i = 0; i < window.pgnParser.branches.length; i++) {
            const branch = window.pgnParser.branches[i];
            if (currentHistory.length === branch.moves.length) {
                let isMatch = true;
                for (let j = 0; j < currentHistory.length; j++) {
                    if (currentHistory[j] !== branch.moves[j]) {
                        isMatch = false;
                        break;
                    }
                }
                if (isMatch) {
                    return {
                        branchIndex: i,
                        branch: branch,
                        moves: branch.moves
                    };
                }
            }
        }
        
        return null;
    }

    // 测试分支完成检测逻辑（用于调试）
    testBranchCompletionDetection() {
        if (!this.isSetupLearningMode) {
            console.log('testBranchCompletionDetection: 当前不是摆棋学习模式');
            return;
        }
        
        console.log('=== 测试分支完成检测逻辑 ===');
        const currentHistory = this.game.history();
        console.log('当前走棋历史:', currentHistory);
        console.log('当前历史长度:', currentHistory.length);
        
        if (!window.pgnParser || !window.pgnParser.branches) {
            console.log('没有PGN数据');
            return;
        }
        
        console.log('所有分支:');
        window.pgnParser.branches.forEach((branch, index) => {
            console.log(`分支 ${index + 1}: 长度=${branch.moves.length}, 招法=${branch.moves.join(' ')}`);
        });
        
        // 检查是否有分支完成
        let completedBranch = null;
        for (let i = 0; i < window.pgnParser.branches.length; i++) {
            const branch = window.pgnParser.branches[i];
            if (currentHistory.length === branch.moves.length) {
                let isMatch = true;
                for (let j = 0; j < currentHistory.length; j++) {
                    if (currentHistory[j] !== branch.moves[j]) {
                        isMatch = false;
                        break;
                    }
                }
                if (isMatch) {
                    completedBranch = branch;
                    console.log(`✅ 找到完成的分支 ${i + 1}: ${branch.moves.join(' ')}`);
                    break;
                }
            }
        }
        
        if (completedBranch) {
            console.log('分支完成检测成功！');
        } else {
            console.log('没有检测到完成的分支');
        }
        
        console.log('=== 测试结束 ===');
    }
} 