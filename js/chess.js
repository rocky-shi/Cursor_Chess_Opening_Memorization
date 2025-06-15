class ChessBoard {
    constructor() {
        this.game = new Chess();
        this.board = null;
        this.orientation = 'white';
        this.currentBranch = null;
        this.completedBranches = new Set();
        this.turnIndicator = null;
        this.availableBranches = []; // 当前可用的分支
        this.isStudyMode = false; // 是否在背谱模式
        this.computerUsedBranches = new Set(); // 电脑已使用过的分支（用于白方第一步）
        this.errorCount = 0; // 错误计数器
        this.errorThreshold = 5; // 错误阈值，5次后提示正确走法
        this.correctMoves = 0; // 正确步数
        this.totalMoves = 0; // 总步数（已走步数）
        
        // 点击移动相关属性
        this.selectedSquare = null; // 当前选中的方格
        this.clickToMove = true; // 是否启用点击移动
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
        this.clearHighlights();

        // 如果不在背谱模式，允许自由下棋
        if (!this.isStudyMode) {
            this.updateMoveHistory(move);
            this.updateTurnIndicator();
            return;
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

    onSnapEnd() {
        // 确保棋盘位置与游戏状态同步
        if (this.board) {
            this.board.position(this.game.fen());
        }
    }

    findMatchingBranch(move) {
        const currentHistory = this.game.history();
        const moveIndex = currentHistory.length - 1;
        
        // 在可用分支中查找匹配的分支
        for (const branch of this.availableBranches) {
            if (branch.moves[moveIndex] === move.san) {
                return branch;
            }
        }
        
        return null;
    }

    updateAvailableBranches() {
        if (!window.pgnParser || !window.pgnParser.branches) {
            this.availableBranches = [];
            return;
        }

        const currentHistory = this.game.history();
        
        // 筛选出与当前历史匹配且未完成的分支
        this.availableBranches = window.pgnParser.branches.filter(branch => {
            // 跳过已完成的分支
            if (this.completedBranches.has(branch.id)) {
                return false;
            }
            
            // 检查历史是否匹配
            for (let i = 0; i < currentHistory.length; i++) {
                if (i >= branch.moves.length || branch.moves[i] !== currentHistory[i]) {
                    return false;
                }
            }
            
            return true;
        });
    }

    makeComputerMove() {
        if (!this.currentBranch) return;
        
        const history = this.game.history();
        const nextMove = this.currentBranch.moves[history.length];
        
        if (nextMove) {
            const move = this.game.move(nextMove);
            if (move) {
                if (this.board) {
                    this.board.position(this.game.fen()); // 更新棋盘位置
                }
                
                // 清除高亮状态（电脑移动了）
                this.clearHighlights();
                
                this.updateMoveHistory(move);
                this.updateTurnIndicator();
                
                // 更新可用分支
                this.updateAvailableBranches();
                
                // 检查电脑走完后是否完成分支
                if (this.isCurrentBranchCompleted()) {
                    this.onBranchCompleted();
                    return;
                }
            }
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
        }
    }

    makeFirstComputerMove() {
        if (!this.isStudyMode || this.availableBranches.length === 0) return;
        
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
                this.clearHighlights();
                
                this.updateMoveHistory(move);
                this.updateTurnIndicator();
                this.updateAvailableBranches();
                
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
        const completed = this.completedBranches.size;
        const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        $('#totalBranches').text(total);
        $('#completedBranches').text(completed);
        $('#progress').text(`${progress}%`);
        
        if (progress === 100 && total > 0) {
            // 显示恭喜信息，并从后端获取真实的累积正确率
            this.showCompletionBanner();
        }
    }

    updateAccuracy() {
        // 如果有当前PGN ID，从后端获取累积正确率
        if (window.currentPgnId && window.chessAPI && window.chessAPI.isBackendAvailable) {
            this.updateAccuracyFromBackend();
        } else {
            // 后备方案：使用当前会话的数据计算正确率
            const accuracy = this.totalMoves > 0 ? Math.round((this.correctMoves / this.totalMoves) * 100) : 0;
            this.displayAccuracy(accuracy, this.correctMoves, this.totalMoves);
        }
    }

    async showCompletionBanner() {
        // 默认显示信息（如果无法从后端获取数据，则使用当前会话数据）
        let finalAccuracyText = '正在获取...';
        
        // 先显示横幅
        $('#completionBanner').html(`🎉 恭喜！您已背完所有分支！最终正确率：<span style="font-weight: bold;">${finalAccuracyText}</span>`);
        $('#completionBanner').show();
        
        // 尝试从后端获取真实的累积正确率
        if (window.currentPgnId && window.chessAPI && window.chessAPI.isBackendAvailable) {
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
        } else {
            // 没有后端连接，使用当前会话数据
            const finalAccuracy = this.totalMoves > 0 ? Math.round((this.correctMoves / this.totalMoves) * 100) : 0;
            finalAccuracyText = this.totalMoves > 0 ? 
                `${this.correctMoves}/${this.totalMoves} (${finalAccuracy}%)` : 
                '0/0 (0%)';
            console.log(`最终正确率（离线模式）: ${finalAccuracyText}`);
        }
        
        // 更新横幅显示真实的正确率
        $('#completionBanner').html(`🎉 恭喜！您已背完所有分支！最终正确率：<span style="font-weight: bold;">${finalAccuracyText}</span>`);
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
        // 更新UI显示，包含分子分母格式
        const accuracyText = total > 0 ? `${correct}/${total} (${accuracy}%)` : '0/0 (0%)';
        $('#accuracy').text(accuracyText);
        
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
        
        // 加载用户进度
        await this.loadUserProgress();
        
        // 重置正确率统计
        this.correctMoves = 0;
        this.totalMoves = 0;
        this.updateAccuracy();
        
        this.resetPosition(true); // 重置位置并重置正确率
        this.errorCount = 0; // 重置错误计数器
        
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

    stopStudy() {
        this.isStudyMode = false;
        this.currentBranch = null;
        this.availableBranches = [];
        this.computerUsedBranches.clear(); // 清空电脑已使用的分支记录
        this.errorCount = 0; // 重置错误计数器
        
        // 重置正确率统计
        this.correctMoves = 0;
        this.totalMoves = 0;
        this.updateAccuracy();
        
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
        if (!this.isStudyMode) {
            const canSelect = (currentTurn === 'w' && piece.color === 'w') ||
                             (currentTurn === 'b' && piece.color === 'b');
            console.log(`非背谱模式选择结果: ${canSelect}`);
            return canSelect;
        }

        // 背谱模式下的选择限制
        const isWhiteTurn = currentTurn === 'w';
        const canMove = (this.orientation === 'white' && isWhiteTurn) ||
                        (this.orientation === 'black' && !isWhiteTurn);
        
        console.log(`背谱模式检查: isWhiteTurn=${isWhiteTurn}, canMove=${canMove}`);
        
        if (!canMove) {
            console.log('背谱模式下不能移动');
            return false;
        }
        
        // 只允许选择当前方的棋子
        const canSelectInStudy = (currentTurn === 'w' && piece.color === 'w') ||
                                (currentTurn === 'b' && piece.color === 'b');
        console.log(`背谱模式选择结果: ${canSelectInStudy}`);
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
        this.clearHighlights();
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
        this.clearHighlights();

        // 如果不在背谱模式，允许自由下棋
        if (!this.isStudyMode) {
            this.updateMoveHistory(move);
            this.updateTurnIndicator();
            return true;
        }

        // 背谱模式下检查移动是否正确
        const matchingBranch = this.findMatchingBranch(move);
        
        if (!matchingBranch) {
            // 没有匹配的分支，走错了
            console.log('没有找到匹配的分支');
            this.game.undo(); // 撤销移动
            this.board.position(this.game.fen()); // 更新棋盘显示
            
            // 统计错误步数：已走步数+1，正确步数不变
            this.totalMoves++;
            this.updateAccuracy();
            
            // 记录错误移动到数据库
            this.recordMoveProgress(false);
            
            this.showError();
            return false;
        }

        console.log('找到匹配的分支');

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
        if (!window.chessAPI || !window.chessAPI.isBackendAvailable || !window.pgnParser?.metadata?.id) {
            console.log('跳过加载用户进度：后端不可用或没有PGN数据');
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
} 